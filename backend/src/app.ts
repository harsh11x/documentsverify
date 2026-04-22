import crypto from "node:crypto";
import cors from "cors";
import express from "express";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { z } from "zod";
import { chainWriteQueue } from "./queues.js";
import { encryptPII, stableCertHash } from "./security.js";
import { createStore, Role } from "./store.js";

const envSchema = z.object({
  CORS_ORIGINS: z.string().default("http://localhost:3000,http://localhost:3001"),
  DATABASE_URL: z.string().optional(),
  JWT_ACCESS_SECRET: z.string().default("dev_access_secret_change_me"),
  CHAIN_WORKER_TOKEN: z.string().default("dev_chain_worker_token"),
  SUPER_ADMIN_EMAIL: z.string().default("admin@docverify.local"),
  SUPER_ADMIN_PASSWORD: z.string().default("Admin@12345")
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

const orgRegisterSchema = z.object({
  name: z.string().min(2),
  countryName: z.string().min(2).optional(),
  stateName: z.string().min(2).optional(),
  city: z.string().min(2),
  orgType: z.enum(["GOV", "PVT"]),
  sector: z.string().min(2),
  domain: z.string().min(2),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8).optional(),
  adminPhone: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{8,15}$/, "adminPhone must be a valid mobile number")
    .optional()
});

const orgDecisionSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  reason: z.string().min(3)
});

const issueSchema = z.object({
  orgId: z.string().min(1),
  branchId: z.string().min(1),
  certType: z.string().min(1),
  identifierType: z.string().min(1),
  identifierValue: z.string().min(1),
  holderName: z.string().min(1),
  holderDob: z.string().min(1),
  issueDate: z.string().min(1)
});

const revokeSchema = z.object({
  certUuid: z.string().uuid(),
  reason: z.string().min(3)
});

const publicLookupSchema = z.object({
  orgId: z.string().min(1),
  certType: z.string().min(1),
  identifierValue: z.string().min(1)
});

const chainTxMetaSchema = z.object({
  blockchainProvider: z.enum(["evm", "fabric"]).optional(),
  gasUsed: z.string().optional(),
  gasPriceGwei: z.string().optional(),
  totalFeeEth: z.string().optional(),
  blockNumber: z.number().int().nonnegative().optional(),
  confirmations: z.number().int().nonnegative().optional()
});

function getBearerToken(authHeader?: string): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

export function createApp() {
  const env = envSchema.parse(process.env);
  const allowlist = env.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean);
  const store = createStore(env.DATABASE_URL);
  void store.initialize().then(() => store.createSuperAdmin(env.SUPER_ADMIN_EMAIL, env.SUPER_ADMIN_PASSWORD));
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin || allowlist.includes(origin)) return cb(null, true);
        return cb(new Error("CORS blocked"));
      }
    })
  );
  app.use(express.json({ limit: "2mb" }));
  app.use((req, res, next) => {
    res.setHeader("x-request-id", crypto.randomUUID());
    next();
  });
  app.use((req, res, next) => {
    const startedAt = Date.now();
    res.on("finish", () => {
      const elapsedMs = Date.now() - startedAt;
      console.log(`[backend-api] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${elapsedMs}ms)`);
    });
    next();
  });

  const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false });
  const verifyLimiter = rateLimit({ windowMs: 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });
  app.use("/api", apiLimiter);

  async function enqueueChainJob(name: string, payload: Record<string, unknown>) {
    if (process.env.DISABLE_QUEUES === "true") return;
    try {
      console.log(`[backend-api] enqueue chain job=${name}`, payload);
      await Promise.race([
        chainWriteQueue.add(name, payload),
        new Promise((_, reject) => setTimeout(() => reject(new Error("queue_timeout")), 1500))
      ]);
    } catch {
      // Queue failures should not block core API workflows in local/dev mode.
    }
  }

  function requireRole(roles: Role[]) {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const token = getBearerToken(req.header("authorization"));
      if (!token) return res.status(401).json({ error: "missing_token" });
      try {
        const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as {
          userId: string;
          email: string;
          role: Role;
          orgId: string | null;
        };
        if (!roles.includes(decoded.role)) {
          return res.status(403).json({ error: "forbidden" });
        }
        (req as express.Request & { user: typeof decoded }).user = decoded;
        return next();
      } catch {
        return res.status(401).json({ error: "invalid_token" });
      }
    };
  }

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "backend-api" });
  });

  app.post("/api/auth/login", async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const user = await store.authenticate(parsed.data.email, parsed.data.password);
    if (!user) return res.status(401).json({ error: "invalid_credentials" });
    const accessToken = jwt.sign(
      { userId: user.userId, email: user.email, role: user.role, orgId: user.orgId },
      env.JWT_ACCESS_SECRET,
      { expiresIn: "12h" }
    );
    return res.json({ accessToken, role: user.role, orgId: user.orgId });
  });

  app.post("/api/org/register", async (req, res) => {
    const parsed = orgRegisterSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const orgId = crypto.randomUUID();
    const org = await store.createOrgApplication({
      orgId,
      name: parsed.data.name,
      city: parsed.data.city,
      orgType: parsed.data.orgType,
      sector: parsed.data.sector,
      domain: parsed.data.domain
    });
    const adminPassword = parsed.data.adminPassword ?? `Temp#${crypto.randomUUID().slice(0, 8)}`;
    await store.createOrgAdmin(orgId, parsed.data.adminEmail, adminPassword);
    return res.status(201).json({
      ...org,
      countryName: parsed.data.countryName ?? null,
      stateName: parsed.data.stateName ?? null,
      adminEmail: parsed.data.adminEmail,
      adminPhone: parsed.data.adminPhone ?? null
    });
  });

  app.get("/api/certificates/mine", requireRole(["org_admin"]), async (req, res) => {
    const user = (req as express.Request & { user: { orgId: string | null } }).user;
    if (!user.orgId) return res.status(400).json({ error: "org_context_missing" });
    const items = await store.listCertificatesByOrg(user.orgId);
    return res.json({ items });
  });

  app.get("/api/certificates", requireRole(["super_admin"]), async (_req, res) => {
    const items = await store.listAllCertificates();
    return res.json({ items });
  });

  app.get("/api/super-admin/orgs/pending", requireRole(["super_admin"]), async (_req, res) => {
    const pending = await store.listPendingOrgs();
    return res.json({ items: pending });
  });

  app.post("/api/super-admin/orgs/:orgId/decision", requireRole(["super_admin"]), async (req, res) => {
    const parsed = orgDecisionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const org = await store.decideOrg(req.params.orgId, parsed.data.decision, parsed.data.reason);
    if (!org) return res.status(404).json({ error: "org_not_found" });

    let orgAdminCredentials: { email: string; tempPassword: string } | null = null;
    if (parsed.data.decision === "approve") {
      const tempPassword = `Temp#${crypto.randomUUID().slice(0, 8)}`;
      const email = `admin+${org.orgId}@docverify.local`;
      await store.createOrgAdmin(org.orgId, email, tempPassword);
      orgAdminCredentials = { email, tempPassword };
      await enqueueChainJob("org-register", { orgId: org.orgId });
    }
    return res.json({ org, orgAdminCredentials });
  });

  app.post("/api/certificates/issue", requireRole(["org_admin"]), async (req, res) => {
    const parsed = issueSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const certUuid = crypto.randomUUID();
    const certHash = stableCertHash(parsed.data.orgId, parsed.data.certType, parsed.data.identifierValue);
    const identifierMasked =
      parsed.data.identifierValue.length <= 4
        ? "****"
        : `${parsed.data.identifierValue.slice(0, 2)}****${parsed.data.identifierValue.slice(-2)}`;
    const cert = await store.createCertificate({
      certUuid,
      orgId: parsed.data.orgId,
      certType: parsed.data.certType,
      certHash,
      issueDate: parsed.data.issueDate,
      txHash: "PENDING_CHAIN_WRITE",
      holderNameEncrypted: encryptPII(parsed.data.holderName),
      holderDobEncrypted: encryptPII(parsed.data.holderDob),
      identifierMasked
    });
    await enqueueChainJob("certificate-issue", {
      certUuid: cert.certUuid,
      orgId: cert.orgId,
      certHash: cert.certHash,
      certType: cert.certType
    });
    return res.status(201).json({
      certUuid: cert.certUuid,
      certHash: cert.certHash,
      status: cert.status
    });
  });

  app.post("/api/certificates/revoke", requireRole(["org_admin", "super_admin"]), async (req, res) => {
    const parsed = revokeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const cert = await store.revokeCertificate(parsed.data.certUuid, parsed.data.reason);
    if (!cert) return res.status(404).json({ status: "not_found" });
    return res.json({
      status: cert.status,
      certUuid: cert.certUuid,
      revokedAt: cert.revokedAt
    });
  });

  app.get("/api/public/verify/:uuid", verifyLimiter, async (req, res) => {
    const cert = await store.findCertificateByUuid(req.params.uuid);
    if (!cert) return res.status(404).json({ status: "not_found" });
    return res.json({
      status: cert.status,
      orgId: cert.orgId,
      certType: cert.certType,
      issueDate: cert.issueDate,
      txHash: cert.txHash,
      revokedAt: cert.revokedAt,
      pii: { holderName: "REDACTED", holderDob: "REDACTED", identifier: cert.identifierMasked }
    });
  });

  app.post("/api/public/verify", verifyLimiter, async (req, res) => {
    const parsed = publicLookupSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const certHash = stableCertHash(parsed.data.orgId, parsed.data.certType, parsed.data.identifierValue);
    const cert = await store.findCertificateByHash(parsed.data.orgId, certHash);
    if (!cert) return res.status(404).json({ status: "not_found" });
    return res.json({
      status: cert.status,
      certUuid: cert.certUuid,
      orgId: cert.orgId,
      certType: cert.certType,
      issueDate: cert.issueDate,
      txHash: cert.txHash,
      revokedAt: cert.revokedAt,
      pii: { holderName: "REDACTED", holderDob: "REDACTED", identifier: cert.identifierMasked }
    });
  });

  app.post("/internal/chain/org-registered", async (req, res) => {
    if (req.header("x-chain-worker-token") !== env.CHAIN_WORKER_TOKEN) {
      return res.status(401).json({ error: "unauthorized_worker" });
    }
    const payload = z
      .object({ orgId: z.string().min(1), txHash: z.string().min(10), txMeta: chainTxMetaSchema.optional() })
      .safeParse(req.body);
    if (!payload.success) return res.status(400).json({ error: payload.error.flatten() });
    console.log(
      `[backend-api] chain callback org-registered orgId=${payload.data.orgId} txHash=${payload.data.txHash} provider=${
        payload.data.txMeta?.blockchainProvider ?? "n/a"
      } gasUsed=${payload.data.txMeta?.gasUsed ?? "n/a"} gasPriceGwei=${
        payload.data.txMeta?.gasPriceGwei ?? "n/a"
      } totalFeeEth=${payload.data.txMeta?.totalFeeEth ?? "n/a"} block=${
        payload.data.txMeta?.blockNumber ?? "n/a"
      } confirmations=${payload.data.txMeta?.confirmations ?? "n/a"}`
    );
    await store.markOrgChainRegistered(payload.data.orgId, payload.data.txHash);
    return res.json({ ok: true });
  });

  app.post("/internal/chain/certificate-issued", async (req, res) => {
    if (req.header("x-chain-worker-token") !== env.CHAIN_WORKER_TOKEN) {
      return res.status(401).json({ error: "unauthorized_worker" });
    }
    const payload = z
      .object({ certUuid: z.string().uuid(), txHash: z.string().min(10), txMeta: chainTxMetaSchema.optional() })
      .safeParse(req.body);
    if (!payload.success) return res.status(400).json({ error: payload.error.flatten() });
    console.log(
      `[backend-api] chain callback certificate-issued certUuid=${payload.data.certUuid} txHash=${payload.data.txHash} provider=${
        payload.data.txMeta?.blockchainProvider ?? "n/a"
      } gasUsed=${payload.data.txMeta?.gasUsed ?? "n/a"} gasPriceGwei=${
        payload.data.txMeta?.gasPriceGwei ?? "n/a"
      } totalFeeEth=${payload.data.txMeta?.totalFeeEth ?? "n/a"} block=${
        payload.data.txMeta?.blockNumber ?? "n/a"
      } confirmations=${payload.data.txMeta?.confirmations ?? "n/a"}`
    );
    await store.markCertificateChainIssued(payload.data.certUuid, payload.data.txHash);
    return res.json({ ok: true });
  });

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: "internal_error", message: err.message });
  });

  return app;
}
