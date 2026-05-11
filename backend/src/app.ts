import crypto from "node:crypto";
import cors from "cors";
import express from "express";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { z } from "zod";
import { chainWriteQueue } from "./queues.js";
import { uploadJsonToIpfs } from "./ipfs.js";
import { canonicalJsonStringify, encryptPII, sha256HexUtf8, stableCertHash } from "./security.js";
import { createStore, type CertRecord, type Store, Role } from "./store.js";

type BootstrapOrgAccount = {
  orgId: string;
  name: string;
  city: string;
  domain: string;
  adminEmail: string;
  adminPassword: string;
};

const defaultBootstrapOrgAccounts: BootstrapOrgAccount[] = [
  {
    orgId: "org-northbridge-academy",
    name: "Northbridge Academy",
    city: "Pune",
    domain: "northbridgeacademy.edu",
    adminEmail: "registrar@northbridgeacademy.edu",
    adminPassword: "Northbridge#2026"
  },
  {
    orgId: "org-crestview-institute",
    name: "Crestview Institute of Technology",
    city: "Mumbai",
    domain: "crestviewit.edu",
    adminEmail: "cert-office@crestviewit.edu",
    adminPassword: "Crestview#2026"
  },
  {
    orgId: "org-riverdale-college",
    name: "Riverdale College",
    city: "Bengaluru",
    domain: "riverdalecollege.edu",
    adminEmail: "controller@riverdalecollege.edu",
    adminPassword: "Riverdale#2026"
  }
];

const envSchema = z.object({
  CORS_ORIGINS: z.string().default("http://localhost:3000,http://localhost:3001"),
  DATABASE_URL: z.string().optional(),
  JWT_ACCESS_SECRET: z.string().min(12).optional(),
  CHAIN_WORKER_TOKEN: z.string().min(12).optional(),
  ORG_ADMIN_EMAIL_DOMAIN: z.string().min(3).default("example.com"),
  SUPER_ADMIN_EMAIL: z.string().email().optional(),
  SUPER_ADMIN_PASSWORD: z.string().min(8).optional(),
  BOOTSTRAP_ORG_ACCOUNTS: z.string().optional(),
  IPFS_GATEWAY_PREFIX: z.string().default("https://ipfs.io/ipfs")
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

const reviewDecisionSchema = z.object({
  decision: z.enum(["approve", "deny"]),
  reason: z.string().min(3)
});
const orgAccessSchema = z.object({
  action: z.enum(["block", "cooloff", "restore"]),
  reason: z.string().min(3),
  coolOffDays: z.number().int().positive().max(365).optional()
});

const publicLookupSchema = z.object({
  orgId: z.string().min(1),
  certType: z.string().min(1),
  identifierValue: z.string().min(1)
});
const publicQuerySchema = z.object({
  query: z.string().min(3)
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

function ipfsGatewayUrl(prefix: string, cid: string | null): string | null {
  if (!cid) return null;
  const base = prefix.replace(/\/$/, "");
  return `${base}/${cid}`;
}

async function orgRegistrationVoteProgress(store: Store, targetOrgId: string) {
  const votes = await store.listOrgVotes(targetOrgId);
  const approvedOrgs = await store.listApprovedOrgs();
  const eligibleReviewerOrgIds = approvedOrgs.map((o) => o.orgId).filter((id) => id !== targetOrgId);
  const votingNodes = new Set<string>(["__super_admin__", ...eligibleReviewerOrgIds]);
  const requiredMajority = Math.floor(votingNodes.size / 2) + 1;
  const approvals = votes.filter((v) => v.decision === "approve").length;
  const denials = votes.filter((v) => v.decision === "deny").length;
  return {
    approvals,
    denials,
    total: votes.length,
    requiredMajority,
    eligibleVoterCount: votingNodes.size
  };
}

/** Never expose ciphertext fields (holderNameEncrypted, holderDobEncrypted) in list APIs. */
async function toCertificateListItems(_store: Store, certificates: CertRecord[], gatewayPrefix: string) {
  return certificates.map((cert) => {
    return {
        certUuid: cert.certUuid,
        orgId: cert.orgId,
        certType: cert.certType,
        certHash: cert.certHash,
        issueDate: cert.issueDate,
        txHash: cert.txHash,
        status: cert.status,
        identifierMasked: cert.identifierMasked,
        manifestDigest: cert.manifestDigest,
        ipfsCid: cert.ipfsCid,
        manifestUri: ipfsGatewayUrl(gatewayPrefix, cert.ipfsCid),
        revokedAt: cert.revokedAt,
        revokeReason: cert.revokeReason
      };
    });
}

function parseBootstrapOrgAccounts(source?: string): BootstrapOrgAccount[] {
  if (!source) return defaultBootstrapOrgAccounts;
  try {
    const parsed = JSON.parse(source);
    const schema = z.array(
      z.object({
        orgId: z.string().min(3),
        name: z.string().min(2),
        city: z.string().min(2),
        domain: z.string().min(3),
        adminEmail: z.string().email(),
        adminPassword: z.string().min(8)
      })
    );
    return schema.parse(parsed);
  } catch {
    throw new Error("BOOTSTRAP_ORG_ACCOUNTS must be valid JSON array");
  }
}

async function seedBootstrapOrganizations(store: Store, accounts: BootstrapOrgAccount[]) {
  const [approved, pending] = await Promise.all([store.listApprovedOrgs(), store.listPendingOrgs()]);
  const knownOrgIds = new Set<string>([...approved.map((org) => org.orgId), ...pending.map((org) => org.orgId)]);

  for (const account of accounts) {
    if (!knownOrgIds.has(account.orgId)) {
      await store.createOrgApplication({
        orgId: account.orgId,
        name: account.name,
        city: account.city,
        orgType: "PVT",
        sector: "Education",
        domain: account.domain
      });
      await store.decideOrg(account.orgId, "approve", "Bootstrap approved private education institute");
      knownOrgIds.add(account.orgId);
    }
    await store.createOrgAdmin(account.orgId, account.adminEmail, account.adminPassword);
  }
}

export function createApp() {
  const rawEnv = envSchema.parse(process.env);
  const isProduction = process.env.NODE_ENV === "production";
  const env = {
    ...rawEnv,
    JWT_ACCESS_SECRET: rawEnv.JWT_ACCESS_SECRET ?? "test_only_access_secret",
    CHAIN_WORKER_TOKEN: rawEnv.CHAIN_WORKER_TOKEN ?? "test_only_chain_worker_token",
    SUPER_ADMIN_EMAIL: rawEnv.SUPER_ADMIN_EMAIL ?? "admin@example.com",
    SUPER_ADMIN_PASSWORD: rawEnv.SUPER_ADMIN_PASSWORD ?? "change-me-in-env"
  };
  const isTest = process.env.NODE_ENV === "test";
  if (!isTest && !env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is required so certificate and verification data persist. Start Postgres and set DATABASE_URL."
    );
  }
  if (isProduction && !env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required in production");
  }
  if (isProduction && !rawEnv.JWT_ACCESS_SECRET) {
    throw new Error("JWT_ACCESS_SECRET is required in production");
  }
  if (isProduction && !rawEnv.CHAIN_WORKER_TOKEN) {
    throw new Error("CHAIN_WORKER_TOKEN is required in production");
  }
  if (isProduction && !rawEnv.SUPER_ADMIN_EMAIL) {
    throw new Error("SUPER_ADMIN_EMAIL is required in production");
  }
  if (isProduction && !rawEnv.SUPER_ADMIN_PASSWORD) {
    throw new Error("SUPER_ADMIN_PASSWORD is required in production");
  }
  if (isProduction && process.env.DISABLE_QUEUES === "true") {
    throw new Error("DISABLE_QUEUES cannot be true in production");
  }

  const allowlist = env.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean);
  const store = createStore(env.DATABASE_URL);
  void store.initialize().then(async () => {
    await store.createSuperAdmin(env.SUPER_ADMIN_EMAIL, env.SUPER_ADMIN_PASSWORD);
    if (!isProduction && process.env.NODE_ENV !== "test") {
      const bootstrapAccounts = parseBootstrapOrgAccounts(env.BOOTSTRAP_ORG_ACCOUNTS);
      await seedBootstrapOrganizations(store, bootstrapAccounts);
    }
  });
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
    if (process.env.DISABLE_QUEUES === "true") {
      throw new Error("Queueing disabled; cannot enqueue chain jobs");
    }
    try {
      console.log(`[backend-api] enqueue chain job=${name}`, payload);
      await Promise.race([
        chainWriteQueue.add(name, payload),
        new Promise((_, reject) => setTimeout(() => reject(new Error("queue_timeout")), 1500))
      ]);
    } catch (error) {
      throw new Error(`chain_enqueue_failed:${error instanceof Error ? error.message : "unknown"}`);
    }
  }

  function requireRole(roles: Role[], opts?: { allowNonApprovedOrgRead?: boolean }) {
    return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
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
        if (decoded.role === "org_admin" && decoded.orgId) {
          const org = await store.getOrgById(decoded.orgId);
          if (!org) return res.status(403).json({ error: "org_not_found" });
          if (!opts?.allowNonApprovedOrgRead && org.status !== "approved") {
            return res.status(403).json({ error: "org_not_approved" });
          }
          if (org.accessState === "blocked") return res.status(403).json({ error: "org_blocked" });
          if (org.accessState === "cooloff") {
            const coolOffUntilMs = org.coolOffUntil ? Date.parse(org.coolOffUntil) : NaN;
            if (!Number.isNaN(coolOffUntilMs) && coolOffUntilMs > Date.now()) {
              return res.status(403).json({ error: "org_in_cooloff", coolOffUntil: org.coolOffUntil });
            }
          }
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

  app.get("/api/orgs/me", requireRole(["org_admin"], { allowNonApprovedOrgRead: true }), async (req, res) => {
    const user = (req as express.Request & { user: { orgId: string | null } }).user;
    if (!user.orgId) return res.status(400).json({ error: "org_context_missing" });
    const org = await store.getOrgById(user.orgId);
    if (!org) return res.status(404).json({ error: "org_not_found" });
    const voteSummary = await orgRegistrationVoteProgress(store, org.orgId);
    return res.json({ org, voteSummary });
  });

  app.get("/api/certificates/mine", requireRole(["org_admin"], { allowNonApprovedOrgRead: true }), async (req, res) => {
    const user = (req as express.Request & { user: { orgId: string | null; role: Role } }).user;
    if (!user.orgId) return res.status(400).json({ error: "org_context_missing" });
    const certificates = await store.listCertificatesByOrg(user.orgId);
    const items = await toCertificateListItems(store, certificates, env.IPFS_GATEWAY_PREFIX);
    return res.json({ items });
  });

  app.get("/api/certificates", requireRole(["super_admin"]), async (_req, res) => {
    const certificates = await store.listAllCertificates();
    const items = await toCertificateListItems(store, certificates, env.IPFS_GATEWAY_PREFIX);
    return res.json({ items });
  });

  app.get("/api/super-admin/orgs/pending", requireRole(["super_admin"]), async (_req, res) => {
    const pending = await store.listPendingOrgs();
    return res.json({ items: pending });
  });

  app.get("/api/public/orgs", async (_req, res) => {
    const approved = await store.listApprovedOrgs();
    return res.json({
      items: approved.map((org) => ({
        orgId: org.orgId,
        name: org.name,
        orgType: org.orgType
      }))
    });
  });

  app.post("/api/super-admin/orgs/:orgId/decision", requireRole(["super_admin"]), async (_req, res) => {
    return res.status(410).json({
      error: "manual_org_decision_retired",
      message: "Organization approval now happens via registered-node majority voting."
    });
  });

  app.post("/api/super-admin/orgs/:orgId/access", requireRole(["super_admin"]), async (req, res) => {
    const parsed = orgAccessSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const accessState = parsed.data.action === "block" ? "blocked" : parsed.data.action === "cooloff" ? "cooloff" : "active";
    const coolOffUntil =
      parsed.data.action === "cooloff"
        ? new Date(Date.now() + (parsed.data.coolOffDays ?? 7) * 24 * 60 * 60 * 1000).toISOString()
        : null;
    const org = await store.setOrgAccessState(req.params.orgId, accessState, parsed.data.reason, coolOffUntil);
    if (!org) return res.status(404).json({ error: "org_not_found" });
    return res.json({ org });
  });

  app.post("/api/certificates/issue", requireRole(["org_admin"]), async (req, res) => {
    const parsed = issueSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const user = (req as express.Request & { user: { orgId: string | null; role: Role } }).user;
    if (!user.orgId) return res.status(400).json({ error: "org_context_missing" });
    if (user.orgId !== parsed.data.orgId) return res.status(403).json({ error: "issuer_org_mismatch" });
    const approvedOrgs = await store.listApprovedOrgs();
    if (!approvedOrgs.some((org) => org.orgId === user.orgId)) {
      return res.status(403).json({ error: "org_not_approved" });
    }
    const certUuid = crypto.randomUUID();
    const certHash = stableCertHash(parsed.data.orgId, parsed.data.certType, parsed.data.identifierValue);
    const identifierMasked =
      parsed.data.identifierValue.length <= 4
        ? "****"
        : `${parsed.data.identifierValue.slice(0, 2)}****${parsed.data.identifierValue.slice(-2)}`;
    const manifest = {
      schema: "docverify-certificate-manifest/v1",
      certUuid,
      orgId: parsed.data.orgId,
      branchId: parsed.data.branchId,
      certType: parsed.data.certType,
      identifierType: parsed.data.identifierType,
      certHash,
      issueDate: parsed.data.issueDate,
      identifierMasked
    };
    const manifestDigest = sha256HexUtf8(canonicalJsonStringify(manifest));
    const ipfsResult = await uploadJsonToIpfs(manifest, `cert-${certUuid}.json`);
    let ipfsCid = ipfsResult?.cid ?? null;
    const ipfsOptionalDev =
      process.env.IPFS_OPTIONAL_IN_DEV === "true" &&
      process.env.NODE_ENV !== "production" &&
      process.env.NODE_ENV !== "test";
    if (!ipfsCid && !ipfsOptionalDev) {
      return res.status(503).json({
        error: "ipfs_publish_failed",
        message:
          "Certificate manifest could not be pinned to IPFS. Run `npm run infra:up` (includes Kubo), set IPFS_KUBO_API_URL (e.g. http://127.0.0.1:5001), or set IPFS_PINATA_JWT. For local backend-only experiments you may set IPFS_OPTIONAL_IN_DEV=true."
      });
    }
    if (!ipfsCid && ipfsOptionalDev) {
      console.warn("[backend-api] certificate issue: IPFS_OPTIONAL_IN_DEV=true — storing manifest digest without ipfsCid");
    }
    const cert = await store.createCertificate({
      certUuid,
      orgId: parsed.data.orgId,
      certType: parsed.data.certType,
      certHash,
      issueDate: parsed.data.issueDate,
      txHash: "",
      holderNameEncrypted: encryptPII(parsed.data.holderName),
      holderDobEncrypted: encryptPII(parsed.data.holderDob),
      identifierMasked,
      manifestDigest,
      ipfsCid
    });
    await enqueueChainJob("certificate-issue", {
      certUuid: cert.certUuid,
      orgId: cert.orgId,
      certHash: cert.certHash,
      certType: cert.certType,
      manifestDigest: cert.manifestDigest,
      ipfsCid: cert.ipfsCid
    });
    return res.status(201).json({
      certUuid: cert.certUuid,
      certHash: cert.certHash,
      status: cert.status,
      manifestDigest: cert.manifestDigest,
      ipfsCid: cert.ipfsCid,
      manifestUri: ipfsGatewayUrl(env.IPFS_GATEWAY_PREFIX, cert.ipfsCid)
    });
  });

  app.get("/api/orgs/review/incoming", requireRole(["org_admin", "super_admin"], { allowNonApprovedOrgRead: true }), async (req, res) => {
    const user = (req as express.Request & { user: { orgId: string | null; role: Role } }).user;
    const reviewerId = user.role === "super_admin" ? "__super_admin__" : user.orgId;
    if (!reviewerId) return res.status(400).json({ error: "org_context_missing" });
    const items = await store.listPendingOrgsForReview(reviewerId);
    return res.json({
      items: await Promise.all(items.map(async (org) => {
        const votes = await store.listOrgVotes(org.orgId);
        const approvals = votes.filter((v) => v.decision === "approve").length;
        const denials = votes.filter((v) => v.decision === "deny").length;
        return {
          orgId: org.orgId,
          name: org.name,
          city: org.city,
          sector: org.sector,
          orgType: org.orgType,
          status: org.status,
          voteSummary: { approvals, denials, total: votes.length }
        };
      }))
    });
  });

  app.get("/api/orgs/review/history", requireRole(["org_admin", "super_admin"], { allowNonApprovedOrgRead: true }), async (req, res) => {
    const user = (req as express.Request & { user: { orgId: string | null; role: Role } }).user;
    const reviewerId = user.role === "super_admin" ? "__super_admin__" : user.orgId;
    if (!reviewerId) return res.status(400).json({ error: "org_context_missing" });
    const votes = await store.listOrgVotesByReviewerOrg(reviewerId);
    const items = await Promise.all(
      votes.map(async (vote) => {
        const pending = await store.listPendingOrgs();
        const approved = await store.listApprovedOrgs();
        const org = [...pending, ...approved].find((item) => item.orgId === vote.orgId) ?? null;
        return {
          orgId: vote.orgId,
          orgName: org?.name ?? "Unknown",
          finalStatus: org?.status ?? "rejected",
          yourDecision: vote.decision,
          reason: vote.reason,
          decidedAt: vote.createdAt
        };
      })
    );
    return res.json({ items });
  });

  app.post("/api/orgs/:orgId/vote", requireRole(["org_admin", "super_admin"]), async (req, res) => {
    const parsed = reviewDecisionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const user = (req as express.Request & { user: { orgId: string | null; role: Role } }).user;
    const reviewerId = user.role === "super_admin" ? "__super_admin__" : user.orgId;
    if (!reviewerId) return res.status(400).json({ error: "org_context_missing" });
    if (req.params.orgId === reviewerId) return res.status(403).json({ error: "self_review_not_allowed" });
    const pending = await store.listPendingOrgs();
    const targetOrg = pending.find((org) => org.orgId === req.params.orgId);
    if (!targetOrg) return res.status(404).json({ error: "org_not_pending_review" });
    const approvedOrgs = await store.listApprovedOrgs();
    const eligibleReviewerOrgIds = approvedOrgs.map((org) => org.orgId).filter((id) => id !== req.params.orgId);
    const votingNodes = new Set<string>(["__super_admin__", ...eligibleReviewerOrgIds]);
    if (!votingNodes.has(reviewerId)) return res.status(403).json({ error: "not_eligible_reviewer" });

    const existingVotes = await store.listOrgVotes(req.params.orgId);
    if (existingVotes.some((vote) => vote.reviewerOrgId === reviewerId)) {
      return res.status(409).json({ error: "already_voted" });
    }

    await store.recordOrgVote({
      orgId: req.params.orgId,
      reviewerOrgId: reviewerId,
      decision: parsed.data.decision,
      reason: parsed.data.reason
    });

    const votes = await store.listOrgVotes(req.params.orgId);
    const requiredMajority = Math.floor(votingNodes.size / 2) + 1;
    const approvals = votes.filter((vote) => vote.decision === "approve").length;
    const denials = votes.filter((vote) => vote.decision === "deny").length;

    let finalStatus: "pending_review" | "approved" | "rejected" = "pending_review";
    if (requiredMajority > 0 && approvals >= requiredMajority) {
      finalStatus = "approved";
      await store.decideOrg(req.params.orgId, "approve", "Approved by majority org vote");
      await enqueueChainJob("org-register", { orgId: req.params.orgId });
    } else if (requiredMajority > 0 && denials >= requiredMajority) {
      finalStatus = "rejected";
      await store.decideOrg(req.params.orgId, "reject", "Rejected by majority org vote");
    }

    return res.json({
      orgId: req.params.orgId,
      status: finalStatus,
      voteSummary: {
        approvals,
        denials,
        total: votes.length,
        requiredMajority
      }
    });
  });

  app.get("/api/orgs/review/pending", requireRole(["org_admin", "super_admin"], { allowNonApprovedOrgRead: true }), async (_req, res) => {
    const items = await store.listOrgReviewViewsByStatus("pending_review");
    const enriched = await Promise.all(
      items.map(async (org) => ({
        ...org,
        voteSummary: await orgRegistrationVoteProgress(store, org.orgId)
      }))
    );
    return res.json({ items: enriched });
  });
  app.get("/api/orgs/review/approved", requireRole(["org_admin", "super_admin"], { allowNonApprovedOrgRead: true }), async (_req, res) => {
    const items = await store.listOrgReviewViewsByStatus("approved");
    const enriched = await Promise.all(
      items.map(async (org) => ({
        ...org,
        voteSummary: await orgRegistrationVoteProgress(store, org.orgId)
      }))
    );
    return res.json({ items: enriched });
  });
  app.get("/api/orgs/review/rejected", requireRole(["org_admin", "super_admin"], { allowNonApprovedOrgRead: true }), async (_req, res) => {
    const items = await store.listOrgReviewViewsByStatus("rejected");
    const enriched = await Promise.all(
      items.map(async (org) => ({
        ...org,
        voteSummary: await orgRegistrationVoteProgress(store, org.orgId)
      }))
    );
    return res.json({ items: enriched });
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
      certHash: cert.certHash,
      manifestDigest: cert.manifestDigest,
      ipfsCid: cert.ipfsCid,
      manifestUri: ipfsGatewayUrl(env.IPFS_GATEWAY_PREFIX, cert.ipfsCid),
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
      certHash: cert.certHash,
      manifestDigest: cert.manifestDigest,
      ipfsCid: cert.ipfsCid,
      manifestUri: ipfsGatewayUrl(env.IPFS_GATEWAY_PREFIX, cert.ipfsCid),
      pii: { holderName: "REDACTED", holderDob: "REDACTED", identifier: cert.identifierMasked }
    });
  });

  app.post("/api/public/verify/query", verifyLimiter, async (req, res) => {
    const parsed = publicQuerySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const query = parsed.data.query.trim();

    const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(query);
    if (uuidLike) {
      const cert = await store.findCertificateByUuid(query);
      if (!cert) return res.status(404).json({ status: "not_found" });
      return res.json({
        status: cert.status,
        certUuid: cert.certUuid,
        orgId: cert.orgId,
        certType: cert.certType,
        issueDate: cert.issueDate,
        txHash: cert.txHash,
        revokedAt: cert.revokedAt,
        certHash: cert.certHash,
        manifestDigest: cert.manifestDigest,
        ipfsCid: cert.ipfsCid,
        manifestUri: ipfsGatewayUrl(env.IPFS_GATEWAY_PREFIX, cert.ipfsCid),
        pii: { holderName: "REDACTED", holderDob: "REDACTED", identifier: cert.identifierMasked }
      });
    }

    const all = await store.listAllCertificates();
    const normalized = query.toLowerCase();
    const cert = all.find(
      (item) =>
        item.certHash.toLowerCase() === normalized ||
        item.txHash.toLowerCase() === normalized ||
        item.certUuid.toLowerCase() === normalized
    );
    if (!cert) return res.status(404).json({ status: "not_found" });
    return res.json({
      status: cert.status,
      certUuid: cert.certUuid,
      orgId: cert.orgId,
      certType: cert.certType,
      issueDate: cert.issueDate,
      txHash: cert.txHash,
      revokedAt: cert.revokedAt,
      certHash: cert.certHash,
      manifestDigest: cert.manifestDigest,
      ipfsCid: cert.ipfsCid,
      manifestUri: ipfsGatewayUrl(env.IPFS_GATEWAY_PREFIX, cert.ipfsCid),
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
