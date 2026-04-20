import request from "supertest";
import { describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import { createApp } from "../src/app.js";

process.env.AES_256_KEY = process.env.AES_256_KEY || "12345678901234567890123456789012";
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "dev_access_secret_change_me";
(process.env as Record<string, string>).NODE_ENV = "test";

function token(role: "org_admin" | "super_admin", orgId: string | null = null) {
  return jwt.sign({ userId: "test-user", email: "test@local", role, orgId }, process.env.JWT_ACCESS_SECRET as string);
}

describe("backend-api", () => {
  it("returns health status", async () => {
    const app = createApp();
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("issues and verifies certificate without leaking PII", async () => {
    const app = createApp();
    const issueRes = await request(app).post("/api/certificates/issue").send({
      orgId: "org-1",
      branchId: "branch-1",
      certType: "Degree",
      identifierType: "Roll Number",
      identifierValue: "RN-12345",
      holderName: "Alice Example",
      holderDob: "2000-01-01",
      issueDate: "2026-04-13"
    }).set("Authorization", `Bearer ${token("org_admin", "org-1")}`);

    expect(issueRes.status).toBe(201);
    expect(issueRes.body.certUuid).toBeTruthy();
    expect(issueRes.body.certHash).toBeTruthy();

    const verifyRes = await request(app).get(`/api/public/verify/${issueRes.body.certUuid}`);
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.pii.holderName).toBe("REDACTED");
    expect(verifyRes.body.pii.holderDob).toBe("REDACTED");
    expect(verifyRes.body.pii.identifier).toContain("****");
  });

  it("verifies by org and identifier, then revokes", async () => {
    const app = createApp();
    const issueRes = await request(app).post("/api/certificates/issue").send({
      orgId: "org-2",
      branchId: "branch-1",
      certType: "Employment",
      identifierType: "Employee ID",
      identifierValue: "EMP-887766",
      holderName: "Bob Example",
      holderDob: "1992-10-10",
      issueDate: "2026-04-13"
    }).set("Authorization", `Bearer ${token("org_admin", "org-2")}`);

    const lookupRes = await request(app).post("/api/public/verify").send({
      orgId: "org-2",
      certType: "Employment",
      identifierValue: "EMP-887766"
    });
    expect(lookupRes.status).toBe(200);
    expect(lookupRes.body.status).toBe("queued");

    const revokeRes = await request(app).post("/api/certificates/revoke").send({
      certUuid: issueRes.body.certUuid,
      reason: "Administrative revoke"
    }).set("Authorization", `Bearer ${token("org_admin", "org-2")}`);
    expect(revokeRes.status).toBe(200);

    const verifyAfterRevoke = await request(app).get(`/api/public/verify/${issueRes.body.certUuid}`);
    expect(verifyAfterRevoke.status).toBe(200);
    expect(verifyAfterRevoke.body.status).toBe("revoked");
  });

  it("rate limits public verify after threshold", async () => {
    const app = createApp();
    for (let i = 0; i < 20; i++) {
      await request(app).get("/api/public/verify/non-existent");
    }
    const limited = await request(app).get("/api/public/verify/non-existent");
    expect(limited.status).toBe(429);
  });

  it("supports org onboarding and approval with auth", async () => {
    const app = createApp();
    const registerRes = await request(app).post("/api/org/register").send({
      name: "Test Institute",
      city: "Delhi",
      orgType: "PVT",
      sector: "Education",
      domain: "School",
      adminEmail: "owner@test.local"
    });
    expect(registerRes.status).toBe(201);

    const pendingRes = await request(app)
      .get("/api/super-admin/orgs/pending")
      .set("Authorization", `Bearer ${token("super_admin")}`);
    expect(pendingRes.status).toBe(200);
    expect(pendingRes.body.items.length).toBeGreaterThan(0);

    const orgId = registerRes.body.orgId;
    const approveRes = await request(app)
      .post(`/api/super-admin/orgs/${orgId}/decision`)
      .set("Authorization", `Bearer ${token("super_admin")}`)
      .send({ decision: "approve", reason: "All docs valid" });
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.org.status).toBe("approved");
  });
});
