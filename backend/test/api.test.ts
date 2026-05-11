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

async function registerOrg(app: ReturnType<typeof createApp>, suffix: string) {
  const res = await request(app).post("/api/org/register").send({
    name: `Org ${suffix}`,
    city: "Delhi",
    orgType: "PVT",
    sector: "Education",
    domain: `${suffix}.edu`,
    adminEmail: `${suffix}@test.local`
  });
  expect(res.status).toBe(201);
  return res.body.orgId as string;
}

async function approveOrgAsSuperAdmin(app: ReturnType<typeof createApp>, orgId: string) {
  const vote = await request(app)
    .post(`/api/orgs/${orgId}/vote`)
    .set("Authorization", `Bearer ${token("super_admin")}`)
    .send({ decision: "approve", reason: "bootstrap approval" });
  expect(vote.status).toBe(200);
}

describe("backend-api", () => {
  it("returns org self profile with registration vote progress", async () => {
    const app = createApp();
    const orgId = await registerOrg(app, "org-self-me");
    const res = await request(app)
      .get("/api/orgs/me")
      .set("Authorization", `Bearer ${token("org_admin", orgId)}`);
    expect(res.status).toBe(200);
    expect(res.body.org.orgId).toBe(orgId);
    expect(res.body.org.status).toBe("pending_review");
    expect(res.body.voteSummary).toMatchObject({
      approvals: 0,
      denials: 0,
      total: 0,
      requiredMajority: expect.any(Number),
      eligibleVoterCount: expect.any(Number)
    });
  });

  it("returns health status", async () => {
    const app = createApp();
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("does not expose encrypted PII fields in certificate list APIs", async () => {
    const app = createApp();
    const issuerOrgId = await registerOrg(app, "issuer-list");
    await approveOrgAsSuperAdmin(app, issuerOrgId);
    await request(app)
      .post("/api/certificates/issue")
      .send({
        orgId: issuerOrgId,
        branchId: "branch-1",
        certType: "Degree",
        identifierType: "Roll Number",
        identifierValue: "RN-999",
        holderName: "Secret Holder",
        holderDob: "2000-01-01",
        issueDate: "2026-04-13"
      })
      .set("Authorization", `Bearer ${token("org_admin", issuerOrgId)}`);

    const listRes = await request(app)
      .get("/api/certificates/mine")
      .set("Authorization", `Bearer ${token("org_admin", issuerOrgId)}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.items.length).toBeGreaterThan(0);
    const row = listRes.body.items[0];
    expect(row.holderNameEncrypted).toBeUndefined();
    expect(row.holderDobEncrypted).toBeUndefined();
  });

  it("issues certificate directly without peer approval", async () => {
    const app = createApp();
    const issuerOrgId = await registerOrg(app, "issuer-direct");
    await approveOrgAsSuperAdmin(app, issuerOrgId);
    const issueRes = await request(app).post("/api/certificates/issue").send({
      orgId: issuerOrgId,
      branchId: "branch-1",
      certType: "Degree",
      identifierType: "Roll Number",
      identifierValue: "RN-12345",
      holderName: "Alice Example",
      holderDob: "2000-01-01",
      issueDate: "2026-04-13"
    }).set("Authorization", `Bearer ${token("org_admin", issuerOrgId)}`);

    expect(issueRes.status).toBe(201);
    expect(issueRes.body.certUuid).toBeTruthy();
    expect(issueRes.body.certHash).toBeTruthy();
    expect(issueRes.body.status).toBe("verified");
    expect(issueRes.body.manifestDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(issueRes.body.ipfsCid).toMatch(/^Qm/);

    const verifyRes = await request(app).get(`/api/public/verify/${issueRes.body.certUuid}`);
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.pii.holderName).toBe("REDACTED");
    expect(verifyRes.body.pii.holderDob).toBe("REDACTED");
    expect(verifyRes.body.pii.identifier).toContain("****");
    expect(verifyRes.body.status).toBe("verified");
    expect(verifyRes.body.manifestDigest).toBe(issueRes.body.manifestDigest);
  });

  it("verifies by org and identifier, then revokes", async () => {
    const app = createApp();
    const issuerOrgId = await registerOrg(app, "issuer-revoke");
    await approveOrgAsSuperAdmin(app, issuerOrgId);
    const issueRes = await request(app).post("/api/certificates/issue").send({
      orgId: issuerOrgId,
      branchId: "branch-1",
      certType: "Employment",
      identifierType: "Employee ID",
      identifierValue: "EMP-887766",
      holderName: "Bob Example",
      holderDob: "1992-10-10",
      issueDate: "2026-04-13"
    }).set("Authorization", `Bearer ${token("org_admin", issuerOrgId)}`);

    const lookupRes = await request(app).post("/api/public/verify").send({
      orgId: issuerOrgId,
      certType: "Employment",
      identifierValue: "EMP-887766"
    });
    expect(lookupRes.status).toBe(200);
    expect(lookupRes.body.status).toBe("verified");

    const revokeRes = await request(app).post("/api/certificates/revoke").send({
      certUuid: issueRes.body.certUuid,
      reason: "Administrative revoke"
    }).set("Authorization", `Bearer ${token("org_admin", issuerOrgId)}`);
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

  it("finalizes org registration with decentralized majority vote", async () => {
    const app = createApp();

    const reviewerOne = await registerOrg(app, "reviewer-1");
    const reviewerTwo = await registerOrg(app, "reviewer-2");
    const candidateOrg = await registerOrg(app, "candidate");
    await approveOrgAsSuperAdmin(app, reviewerOne);
    await approveOrgAsSuperAdmin(app, reviewerTwo);

    const firstVote = await request(app)
      .post(`/api/orgs/${candidateOrg}/vote`)
      .set("Authorization", `Bearer ${token("org_admin", reviewerOne)}`)
      .send({ decision: "approve", reason: "Meets policy checks" });
    expect(firstVote.status).toBe(200);
    expect(firstVote.body.status).toBe("pending_review");

    const secondVote = await request(app)
      .post(`/api/orgs/${candidateOrg}/vote`)
      .set("Authorization", `Bearer ${token("super_admin")}`)
      .send({ decision: "approve", reason: "Admin node consensus vote" });
    expect(secondVote.status).toBe(200);
    expect(secondVote.body.status).toBe("approved");
  });

  it("supports org onboarding with majority flow and retires manual decision", async () => {
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
    expect(approveRes.status).toBe(410);

    const adminVote = await request(app)
      .post(`/api/orgs/${orgId}/vote`)
      .set("Authorization", `Bearer ${token("super_admin")}`)
      .send({ decision: "approve", reason: "Consensus bootstrap vote" });
    expect(adminVote.status).toBe(200);
    expect(["pending_review", "approved"]).toContain(adminVote.body.status);
  });
});
