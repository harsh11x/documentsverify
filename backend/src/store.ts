import crypto from "node:crypto";
import { hash, compare } from "bcryptjs";
import { Pool } from "pg";

export type Role = "super_admin" | "org_admin";
export type OrgStatus = "pending_review" | "approved" | "rejected";
export type OrgAccessState = "active" | "blocked" | "cooloff";
export type CertStatus = "pending_approval" | "verified" | "denied" | "revoked";
export type VoteDecision = "approve" | "deny";

export type UserRecord = {
  userId: string;
  email: string;
  passwordHash: string;
  role: Role;
  orgId: string | null;
};

export type OrgRecord = {
  orgId: string;
  name: string;
  city: string;
  orgType: "GOV" | "PVT";
  sector: string;
  domain: string;
  status: OrgStatus;
  reviewReason: string | null;
  chainTxHash: string | null;
  accessState: OrgAccessState;
  accessReason: string | null;
  coolOffUntil: string | null;
};

export type CertRecord = {
  certUuid: string;
  orgId: string;
  certType: string;
  certHash: string;
  issueDate: string;
  txHash: string;
  status: CertStatus;
  holderNameEncrypted: string;
  holderDobEncrypted: string;
  identifierMasked: string;
  /** SHA-256 (hex) of canonical JSON manifest pinned to IPFS when upload succeeds. */
  manifestDigest: string;
  /** IPFS CID (v0 Qm… or v1 bafy…) of the manifest JSON; null if upload skipped or failed. */
  ipfsCid: string | null;
  revokedAt: string | null;
  revokeReason: string | null;
};

export type CertVoteRecord = {
  voteId: string;
  certUuid: string;
  reviewerOrgId: string;
  decision: VoteDecision;
  reason: string;
  createdAt: string;
};

export type OrgVoteRecord = {
  voteId: string;
  orgId: string;
  reviewerOrgId: string;
  decision: VoteDecision;
  reason: string;
  createdAt: string;
};

export type OrgReviewView = OrgRecord & {
  adminEmail: string | null;
  certificateCount: number;
};

export interface Store {
  initialize(): Promise<void>;
  createSuperAdmin(email: string, password: string): Promise<void>;
  authenticate(email: string, password: string): Promise<UserRecord | null>;
  createOrgApplication(
    input: Omit<OrgRecord, "status" | "reviewReason" | "chainTxHash" | "accessState" | "accessReason" | "coolOffUntil">
  ): Promise<OrgRecord>;
  listApprovedOrgs(): Promise<OrgRecord[]>;
  listPendingOrgs(): Promise<OrgRecord[]>;
  listPendingOrgsForReview(orgId: string): Promise<OrgRecord[]>;
  listRejectedOrgs(): Promise<OrgRecord[]>;
  getOrgById(orgId: string): Promise<OrgRecord | null>;
  listOrgReviewViewsByStatus(status: OrgStatus): Promise<OrgReviewView[]>;
  setOrgAccessState(
    orgId: string,
    accessState: OrgAccessState,
    reason: string,
    coolOffUntil?: string | null
  ): Promise<OrgRecord | null>;
  decideOrg(orgId: string, decision: "approve" | "reject", reason: string): Promise<OrgRecord | null>;
  markOrgChainRegistered(orgId: string, txHash: string): Promise<void>;
  createOrgAdmin(orgId: string, email: string, password: string): Promise<UserRecord>;
  createCertificate(input: Omit<CertRecord, "status" | "revokedAt" | "revokeReason">): Promise<CertRecord>;
  markCertificateChainIssued(certUuid: string, txHash: string): Promise<void>;
  listCertificatesByOrg(orgId: string): Promise<CertRecord[]>;
  listCertificatesForReview(orgId: string): Promise<CertRecord[]>;
  listAllCertificates(): Promise<CertRecord[]>;
  findCertificateByUuid(certUuid: string): Promise<CertRecord | null>;
  findCertificateByHash(orgId: string, certHash: string): Promise<CertRecord | null>;
  listEligibleReviewerOrgIds(excludingOrgId: string): Promise<string[]>;
  recordCertificateVote(input: Omit<CertVoteRecord, "voteId" | "createdAt">): Promise<CertVoteRecord>;
  listCertificateVotes(certUuid: string): Promise<CertVoteRecord[]>;
  listVotesByReviewerOrg(orgId: string): Promise<CertVoteRecord[]>;
  recordOrgVote(input: Omit<OrgVoteRecord, "voteId" | "createdAt">): Promise<OrgVoteRecord>;
  listOrgVotes(orgId: string): Promise<OrgVoteRecord[]>;
  listOrgVotesByReviewerOrg(orgId: string): Promise<OrgVoteRecord[]>;
  updateCertificateStatus(certUuid: string, status: Extract<CertStatus, "verified" | "denied">): Promise<void>;
  revokeCertificate(certUuid: string, reason: string): Promise<CertRecord | null>;
}

class MemoryStore implements Store {
  private users = new Map<string, UserRecord>();
  private orgs = new Map<string, OrgRecord>();
  private certs = new Map<string, CertRecord>();
  private votes = new Map<string, CertVoteRecord>();
  private orgVotes = new Map<string, OrgVoteRecord>();

  async initialize() {}

  async createSuperAdmin(email: string, password: string) {
    const existing = [...this.users.values()].find((u) => u.email === email);
    if (existing) return;
    const passwordHash = await hash(password, 10);
    const userId = crypto.randomUUID();
    this.users.set(userId, {
      userId,
      email,
      passwordHash,
      role: "super_admin",
      orgId: null
    });
  }

  async authenticate(email: string, password: string) {
    const user = [...this.users.values()].find((u) => u.email === email);
    if (!user) return null;
    if (!(await compare(password, user.passwordHash))) return null;
    return user;
  }

  async createOrgApplication(
    input: Omit<OrgRecord, "status" | "reviewReason" | "chainTxHash" | "accessState" | "accessReason" | "coolOffUntil">
  ) {
    const org: OrgRecord = {
      ...input,
      status: "pending_review",
      reviewReason: null,
      chainTxHash: null,
      accessState: "active",
      accessReason: null,
      coolOffUntil: null
    };
    this.orgs.set(org.orgId, org);
    return org;
  }

  async listPendingOrgs() {
    return [...this.orgs.values()].filter((o) => o.status === "pending_review");
  }

  async listApprovedOrgs() {
    return [...this.orgs.values()].filter((o) => o.status === "approved");
  }

  async listRejectedOrgs() {
    return [...this.orgs.values()].filter((o) => o.status === "rejected");
  }

  async listPendingOrgsForReview(orgId: string) {
    const votedOrgIds = new Set(
      [...this.orgVotes.values()].filter((v) => v.reviewerOrgId === orgId).map((v) => v.orgId)
    );
    return [...this.orgs.values()].filter(
      (o) => o.orgId !== orgId && o.status === "pending_review" && !votedOrgIds.has(o.orgId)
    );
  }

  async getOrgById(orgId: string) {
    return this.orgs.get(orgId) ?? null;
  }

  async listOrgReviewViewsByStatus(status: OrgStatus) {
    const orgs = [...this.orgs.values()].filter((o) => o.status === status);
    return orgs.map((org) => {
      const admin =
        [...this.users.values()].find((u) => u.role === "org_admin" && u.orgId === org.orgId)?.email ?? null;
      const certificateCount = [...this.certs.values()].filter((c) => c.orgId === org.orgId).length;
      return { ...org, adminEmail: admin, certificateCount };
    });
  }

  async decideOrg(orgId: string, decision: "approve" | "reject", reason: string) {
    const org = this.orgs.get(orgId);
    if (!org) return null;
    org.status = decision === "approve" ? "approved" : "rejected";
    org.reviewReason = reason;
    this.orgs.set(orgId, org);
    return org;
  }

  async setOrgAccessState(orgId: string, accessState: OrgAccessState, reason: string, coolOffUntil?: string | null) {
    const org = this.orgs.get(orgId);
    if (!org) return null;
    org.accessState = accessState;
    org.accessReason = reason;
    org.coolOffUntil = accessState === "cooloff" ? coolOffUntil ?? null : null;
    this.orgs.set(orgId, org);
    return org;
  }

  async markOrgChainRegistered(orgId: string, txHash: string) {
    const org = this.orgs.get(orgId);
    if (!org) return;
    org.chainTxHash = txHash;
    this.orgs.set(orgId, org);
  }

  async createOrgAdmin(orgId: string, email: string, password: string) {
    const existing = [...this.users.values()].find((u) => u.email === email);
    if (existing) return existing;
    const passwordHash = await hash(password, 10);
    const user: UserRecord = {
      userId: crypto.randomUUID(),
      email,
      passwordHash,
      role: "org_admin",
      orgId
    };
    this.users.set(user.userId, user);
    return user;
  }

  async createCertificate(input: Omit<CertRecord, "status" | "revokedAt" | "revokeReason">) {
    const cert: CertRecord = { ...input, status: "verified", revokedAt: null, revokeReason: null };
    this.certs.set(cert.certUuid, cert);
    return cert;
  }

  async markCertificateChainIssued(certUuid: string, txHash: string) {
    const cert = this.certs.get(certUuid);
    if (!cert) return;
    cert.txHash = txHash;
    this.certs.set(certUuid, cert);
  }

  async listCertificatesByOrg(orgId: string) {
    return [...this.certs.values()].filter((c) => c.orgId === orgId);
  }

  async listCertificatesForReview(orgId: string) {
    const votedCertUuids = new Set(
      [...this.votes.values()].filter((v) => v.reviewerOrgId === orgId).map((v) => v.certUuid)
    );
    return [...this.certs.values()].filter(
      (c) => c.orgId !== orgId && c.status === "pending_approval" && !votedCertUuids.has(c.certUuid)
    );
  }

  async listAllCertificates() {
    return [...this.certs.values()];
  }

  async findCertificateByUuid(certUuid: string) {
    return this.certs.get(certUuid) ?? null;
  }

  async findCertificateByHash(orgId: string, certHash: string) {
    return [...this.certs.values()].find((c) => c.orgId === orgId && c.certHash === certHash) ?? null;
  }

  async listEligibleReviewerOrgIds(excludingOrgId: string) {
    const unique = new Set<string>();
    for (const user of this.users.values()) {
      if (user.role === "org_admin" && user.orgId && user.orgId !== excludingOrgId) {
        unique.add(user.orgId);
      }
    }
    return [...unique];
  }

  async recordCertificateVote(input: Omit<CertVoteRecord, "voteId" | "createdAt">) {
    const vote: CertVoteRecord = {
      voteId: crypto.randomUUID(),
      certUuid: input.certUuid,
      reviewerOrgId: input.reviewerOrgId,
      decision: input.decision,
      reason: input.reason,
      createdAt: new Date().toISOString()
    };
    this.votes.set(vote.voteId, vote);
    return vote;
  }

  async listCertificateVotes(certUuid: string) {
    return [...this.votes.values()].filter((v) => v.certUuid === certUuid);
  }

  async listVotesByReviewerOrg(orgId: string) {
    return [...this.votes.values()].filter((v) => v.reviewerOrgId === orgId);
  }

  async recordOrgVote(input: Omit<OrgVoteRecord, "voteId" | "createdAt">) {
    const vote: OrgVoteRecord = {
      voteId: crypto.randomUUID(),
      orgId: input.orgId,
      reviewerOrgId: input.reviewerOrgId,
      decision: input.decision,
      reason: input.reason,
      createdAt: new Date().toISOString()
    };
    this.orgVotes.set(vote.voteId, vote);
    return vote;
  }

  async listOrgVotes(orgId: string) {
    return [...this.orgVotes.values()].filter((v) => v.orgId === orgId);
  }

  async listOrgVotesByReviewerOrg(orgId: string) {
    return [...this.orgVotes.values()].filter((v) => v.reviewerOrgId === orgId);
  }

  async updateCertificateStatus(certUuid: string, status: Extract<CertStatus, "verified" | "denied">) {
    const cert = this.certs.get(certUuid);
    if (!cert) return;
    cert.status = status;
    this.certs.set(certUuid, cert);
  }

  async revokeCertificate(certUuid: string, reason: string) {
    const cert = this.certs.get(certUuid);
    if (!cert) return null;
    if (cert.status === "revoked") return cert;
    cert.status = "revoked";
    cert.revokeReason = reason;
    cert.revokedAt = new Date().toISOString();
    this.certs.set(certUuid, cert);
    return cert;
  }
}

class PostgresStore implements Store {
  constructor(private pool: Pool) {}

  async initialize() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id UUID PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL,
        org_id TEXT NULL
      );
      CREATE TABLE IF NOT EXISTS organizations (
        org_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        city TEXT NOT NULL,
        org_type TEXT NOT NULL,
        sector TEXT NOT NULL,
        domain TEXT NOT NULL,
        status TEXT NOT NULL,
        review_reason TEXT NULL,
        chain_tx_hash TEXT NULL,
        access_state TEXT NOT NULL DEFAULT 'active',
        access_reason TEXT NULL,
        cool_off_until TEXT NULL
      );
      CREATE TABLE IF NOT EXISTS certificates (
        cert_uuid UUID PRIMARY KEY,
        org_id TEXT NOT NULL,
        cert_type TEXT NOT NULL,
        cert_hash TEXT NOT NULL,
        issue_date TEXT NOT NULL,
        tx_hash TEXT NOT NULL,
        status TEXT NOT NULL,
        holder_name_encrypted TEXT NOT NULL,
        holder_dob_encrypted TEXT NOT NULL,
        identifier_masked TEXT NOT NULL,
        manifest_digest TEXT NOT NULL DEFAULT '',
        ipfs_cid TEXT NULL,
        revoked_at TEXT NULL,
        revoke_reason TEXT NULL
      );
      CREATE TABLE IF NOT EXISTS certificate_votes (
        vote_id UUID PRIMARY KEY,
        cert_uuid UUID NOT NULL,
        reviewer_org_id TEXT NOT NULL,
        decision TEXT NOT NULL,
        reason TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS org_registration_votes (
        vote_id UUID PRIMARY KEY,
        org_id TEXT NOT NULL,
        reviewer_org_id TEXT NOT NULL,
        decision TEXT NOT NULL,
        reason TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
    await this.pool.query(`ALTER TABLE certificates ADD COLUMN IF NOT EXISTS manifest_digest TEXT NOT NULL DEFAULT ''`);
    await this.pool.query(`ALTER TABLE certificates ADD COLUMN IF NOT EXISTS ipfs_cid TEXT NULL`);
    await this.pool.query(`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS access_state TEXT NOT NULL DEFAULT 'active'`);
    await this.pool.query(`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS access_reason TEXT NULL`);
    await this.pool.query(`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS cool_off_until TEXT NULL`);
  }

  async createSuperAdmin(email: string, password: string) {
    const existing = await this.pool.query("SELECT 1 FROM users WHERE email=$1", [email]);
    if (existing.rowCount) return;
    await this.pool.query(
      "INSERT INTO users (user_id,email,password_hash,role,org_id) VALUES ($1,$2,$3,$4,$5)",
      [crypto.randomUUID(), email, await hash(password, 10), "super_admin", null]
    );
  }

  async authenticate(email: string, password: string) {
    const result = await this.pool.query(
      "SELECT user_id as \"userId\", email, password_hash as \"passwordHash\", role, org_id as \"orgId\" FROM users WHERE email=$1 LIMIT 1",
      [email]
    );
    if (!result.rowCount) return null;
    const user = result.rows[0] as UserRecord;
    if (!(await compare(password, user.passwordHash))) return null;
    return user;
  }

  async createOrgApplication(
    input: Omit<OrgRecord, "status" | "reviewReason" | "chainTxHash" | "accessState" | "accessReason" | "coolOffUntil">
  ) {
    const status: OrgStatus = "pending_review";
    await this.pool.query(
      `INSERT INTO organizations (org_id,name,city,org_type,sector,domain,status,review_reason,chain_tx_hash,access_state,access_reason,cool_off_until)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [input.orgId, input.name, input.city, input.orgType, input.sector, input.domain, status, null, null, "active", null, null]
    );
    return {
      ...input,
      status,
      reviewReason: null,
      chainTxHash: null,
      accessState: "active" as OrgAccessState,
      accessReason: null,
      coolOffUntil: null
    };
  }

  async listPendingOrgs() {
    const result = await this.pool.query(
      "SELECT org_id,name,city,org_type,sector,domain,status,review_reason,chain_tx_hash FROM organizations WHERE status='pending_review'"
    );
    return result.rows.map((r) => ({
      orgId: r.org_id,
      name: r.name,
      city: r.city,
      orgType: r.org_type,
      sector: r.sector,
      domain: r.domain,
      status: r.status,
      reviewReason: r.review_reason,
      chainTxHash: r.chain_tx_hash,
      accessState: r.access_state,
      accessReason: r.access_reason,
      coolOffUntil: r.cool_off_until
    })) as OrgRecord[];
  }

  async listApprovedOrgs() {
    const result = await this.pool.query(
      "SELECT org_id,name,city,org_type,sector,domain,status,review_reason,chain_tx_hash FROM organizations WHERE status='approved'"
    );
    return result.rows.map((r) => ({
      orgId: r.org_id,
      name: r.name,
      city: r.city,
      orgType: r.org_type,
      sector: r.sector,
      domain: r.domain,
      status: r.status,
      reviewReason: r.review_reason,
      chainTxHash: r.chain_tx_hash,
      accessState: r.access_state,
      accessReason: r.access_reason,
      coolOffUntil: r.cool_off_until
    })) as OrgRecord[];
  }

  async listRejectedOrgs() {
    const result = await this.pool.query(
      "SELECT org_id,name,city,org_type,sector,domain,status,review_reason,chain_tx_hash,access_state,access_reason,cool_off_until FROM organizations WHERE status='rejected'"
    );
    return result.rows.map((r) => ({
      orgId: r.org_id,
      name: r.name,
      city: r.city,
      orgType: r.org_type,
      sector: r.sector,
      domain: r.domain,
      status: r.status,
      reviewReason: r.review_reason,
      chainTxHash: r.chain_tx_hash,
      accessState: r.access_state,
      accessReason: r.access_reason,
      coolOffUntil: r.cool_off_until
    })) as OrgRecord[];
  }

  async listPendingOrgsForReview(orgId: string) {
    const result = await this.pool.query(
      `SELECT o.org_id,name,city,org_type,sector,domain,status,review_reason,chain_tx_hash
       FROM organizations o
       WHERE o.status='pending_review'
         AND o.org_id <> $1
         AND NOT EXISTS (
           SELECT 1 FROM org_registration_votes v
           WHERE v.org_id = o.org_id AND v.reviewer_org_id = $1
         )`,
      [orgId]
    );
    return result.rows.map((r) => ({
      orgId: r.org_id,
      name: r.name,
      city: r.city,
      orgType: r.org_type,
      sector: r.sector,
      domain: r.domain,
      status: r.status,
      reviewReason: r.review_reason,
      chainTxHash: r.chain_tx_hash
    })) as OrgRecord[];
  }

  async decideOrg(orgId: string, decision: "approve" | "reject", reason: string) {
    const status = decision === "approve" ? "approved" : "rejected";
    const result = await this.pool.query(
      "UPDATE organizations SET status=$1, review_reason=$2 WHERE org_id=$3 RETURNING org_id,name,city,org_type,sector,domain,status,review_reason,chain_tx_hash",
      [status, reason, orgId]
    );
    if (!result.rowCount) return null;
    const r = result.rows[0];
    return {
      orgId: r.org_id,
      name: r.name,
      city: r.city,
      orgType: r.org_type,
      sector: r.sector,
      domain: r.domain,
      status: r.status,
      reviewReason: r.review_reason,
      chainTxHash: r.chain_tx_hash
      ,
      accessState: r.access_state,
      accessReason: r.access_reason,
      coolOffUntil: r.cool_off_until
    };
  }

  async getOrgById(orgId: string) {
    const result = await this.pool.query(
      "SELECT org_id,name,city,org_type,sector,domain,status,review_reason,chain_tx_hash,access_state,access_reason,cool_off_until FROM organizations WHERE org_id=$1 LIMIT 1",
      [orgId]
    );
    if (!result.rowCount) return null;
    const r = result.rows[0];
    return {
      orgId: r.org_id,
      name: r.name,
      city: r.city,
      orgType: r.org_type,
      sector: r.sector,
      domain: r.domain,
      status: r.status,
      reviewReason: r.review_reason,
      chainTxHash: r.chain_tx_hash,
      accessState: r.access_state,
      accessReason: r.access_reason,
      coolOffUntil: r.cool_off_until
    } as OrgRecord;
  }

  async listOrgReviewViewsByStatus(status: OrgStatus) {
    const result = await this.pool.query(
      `SELECT o.org_id,o.name,o.city,o.org_type,o.sector,o.domain,o.status,o.review_reason,o.chain_tx_hash,o.access_state,o.access_reason,o.cool_off_until,
              (SELECT u.email FROM users u WHERE u.role='org_admin' AND u.org_id=o.org_id ORDER BY u.user_id ASC LIMIT 1) AS admin_email,
              (SELECT COUNT(1) FROM certificates c WHERE c.org_id=o.org_id) AS certificate_count
       FROM organizations o
       WHERE o.status=$1
       ORDER BY o.name ASC`,
      [status]
    );
    return result.rows.map((r) => ({
      orgId: r.org_id,
      name: r.name,
      city: r.city,
      orgType: r.org_type,
      sector: r.sector,
      domain: r.domain,
      status: r.status,
      reviewReason: r.review_reason,
      chainTxHash: r.chain_tx_hash,
      accessState: r.access_state,
      accessReason: r.access_reason,
      coolOffUntil: r.cool_off_until,
      adminEmail: r.admin_email ?? null,
      certificateCount: Number(r.certificate_count ?? 0)
    })) as OrgReviewView[];
  }

  async setOrgAccessState(orgId: string, accessState: OrgAccessState, reason: string, coolOffUntil?: string | null) {
    const result = await this.pool.query(
      `UPDATE organizations
       SET access_state=$1, access_reason=$2, cool_off_until=$3
       WHERE org_id=$4
       RETURNING org_id,name,city,org_type,sector,domain,status,review_reason,chain_tx_hash,access_state,access_reason,cool_off_until`,
      [accessState, reason, accessState === "cooloff" ? (coolOffUntil ?? null) : null, orgId]
    );
    if (!result.rowCount) return null;
    const r = result.rows[0];
    return {
      orgId: r.org_id,
      name: r.name,
      city: r.city,
      orgType: r.org_type,
      sector: r.sector,
      domain: r.domain,
      status: r.status,
      reviewReason: r.review_reason,
      chainTxHash: r.chain_tx_hash,
      accessState: r.access_state,
      accessReason: r.access_reason,
      coolOffUntil: r.cool_off_until
    } as OrgRecord;
  }

  async markOrgChainRegistered(orgId: string, txHash: string) {
    await this.pool.query("UPDATE organizations SET chain_tx_hash=$1 WHERE org_id=$2", [txHash, orgId]);
  }

  async createOrgAdmin(orgId: string, email: string, password: string) {
    const existing = await this.pool.query(
      "SELECT user_id as \"userId\", email, password_hash as \"passwordHash\", role, org_id as \"orgId\" FROM users WHERE email=$1 LIMIT 1",
      [email]
    );
    if (existing.rowCount) {
      return existing.rows[0] as UserRecord;
    }
    const user: UserRecord = {
      userId: crypto.randomUUID(),
      email,
      passwordHash: await hash(password, 10),
      role: "org_admin",
      orgId
    };
    await this.pool.query(
      "INSERT INTO users (user_id,email,password_hash,role,org_id) VALUES ($1,$2,$3,$4,$5)",
      [user.userId, user.email, user.passwordHash, user.role, user.orgId]
    );
    return user;
  }

  async createCertificate(input: Omit<CertRecord, "status" | "revokedAt" | "revokeReason">) {
    const cert: CertRecord = { ...input, status: "verified", revokedAt: null, revokeReason: null };
    await this.pool.query(
      `INSERT INTO certificates
       (cert_uuid,org_id,cert_type,cert_hash,issue_date,tx_hash,status,holder_name_encrypted,holder_dob_encrypted,identifier_masked,manifest_digest,ipfs_cid,revoked_at,revoke_reason)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        cert.certUuid,
        cert.orgId,
        cert.certType,
        cert.certHash,
        cert.issueDate,
        cert.txHash,
        cert.status,
        cert.holderNameEncrypted,
        cert.holderDobEncrypted,
        cert.identifierMasked,
        cert.manifestDigest,
        cert.ipfsCid,
        cert.revokedAt,
        cert.revokeReason
      ]
    );
    return cert;
  }

  async markCertificateChainIssued(certUuid: string, txHash: string) {
    await this.pool.query("UPDATE certificates SET tx_hash=$1 WHERE cert_uuid=$2", [txHash, certUuid]);
  }

  async listCertificatesByOrg(orgId: string) {
    const result = await this.pool.query("SELECT * FROM certificates WHERE org_id=$1 ORDER BY issue_date DESC", [orgId]);
    return result.rows.map((c) => ({
      certUuid: c.cert_uuid,
      orgId: c.org_id,
      certType: c.cert_type,
      certHash: c.cert_hash,
      issueDate: c.issue_date,
      txHash: c.tx_hash,
      status: c.status,
      holderNameEncrypted: c.holder_name_encrypted,
      holderDobEncrypted: c.holder_dob_encrypted,
      identifierMasked: c.identifier_masked,
      manifestDigest: c.manifest_digest ?? "",
      ipfsCid: c.ipfs_cid ?? null,
      revokedAt: c.revoked_at,
      revokeReason: c.revoke_reason
    })) as CertRecord[];
  }

  async listAllCertificates() {
    const result = await this.pool.query("SELECT * FROM certificates ORDER BY issue_date DESC");
    return result.rows.map((c) => ({
      certUuid: c.cert_uuid,
      orgId: c.org_id,
      certType: c.cert_type,
      certHash: c.cert_hash,
      issueDate: c.issue_date,
      txHash: c.tx_hash,
      status: c.status,
      holderNameEncrypted: c.holder_name_encrypted,
      holderDobEncrypted: c.holder_dob_encrypted,
      identifierMasked: c.identifier_masked,
      manifestDigest: c.manifest_digest ?? "",
      ipfsCid: c.ipfs_cid ?? null,
      revokedAt: c.revoked_at,
      revokeReason: c.revoke_reason
    })) as CertRecord[];
  }

  async listCertificatesForReview(orgId: string) {
    const result = await this.pool.query(
      `SELECT c.* FROM certificates c
       WHERE c.org_id <> $1
         AND c.status = 'pending_approval'
         AND NOT EXISTS (
           SELECT 1 FROM certificate_votes v
           WHERE v.cert_uuid = c.cert_uuid AND v.reviewer_org_id = $1
         )
       ORDER BY c.issue_date DESC`,
      [orgId]
    );
    return result.rows.map((c) => ({
      certUuid: c.cert_uuid,
      orgId: c.org_id,
      certType: c.cert_type,
      certHash: c.cert_hash,
      issueDate: c.issue_date,
      txHash: c.tx_hash,
      status: c.status,
      holderNameEncrypted: c.holder_name_encrypted,
      holderDobEncrypted: c.holder_dob_encrypted,
      identifierMasked: c.identifier_masked,
      manifestDigest: c.manifest_digest ?? "",
      ipfsCid: c.ipfs_cid ?? null,
      revokedAt: c.revoked_at,
      revokeReason: c.revoke_reason
    })) as CertRecord[];
  }

  async findCertificateByUuid(certUuid: string) {
    const result = await this.pool.query("SELECT * FROM certificates WHERE cert_uuid=$1 LIMIT 1", [certUuid]);
    if (!result.rowCount) return null;
    const c = result.rows[0];
    return {
      certUuid: c.cert_uuid,
      orgId: c.org_id,
      certType: c.cert_type,
      certHash: c.cert_hash,
      issueDate: c.issue_date,
      txHash: c.tx_hash,
      status: c.status,
      holderNameEncrypted: c.holder_name_encrypted,
      holderDobEncrypted: c.holder_dob_encrypted,
      identifierMasked: c.identifier_masked,
      manifestDigest: c.manifest_digest ?? "",
      ipfsCid: c.ipfs_cid ?? null,
      revokedAt: c.revoked_at,
      revokeReason: c.revoke_reason
    } as CertRecord;
  }

  async findCertificateByHash(orgId: string, certHash: string) {
    const result = await this.pool.query(
      "SELECT * FROM certificates WHERE org_id=$1 AND cert_hash=$2 LIMIT 1",
      [orgId, certHash]
    );
    if (!result.rowCount) return null;
    const c = result.rows[0];
    return {
      certUuid: c.cert_uuid,
      orgId: c.org_id,
      certType: c.cert_type,
      certHash: c.cert_hash,
      issueDate: c.issue_date,
      txHash: c.tx_hash,
      status: c.status,
      holderNameEncrypted: c.holder_name_encrypted,
      holderDobEncrypted: c.holder_dob_encrypted,
      identifierMasked: c.identifier_masked,
      manifestDigest: c.manifest_digest ?? "",
      ipfsCid: c.ipfs_cid ?? null,
      revokedAt: c.revoked_at,
      revokeReason: c.revoke_reason
    } as CertRecord;
  }

  async listEligibleReviewerOrgIds(excludingOrgId: string) {
    const result = await this.pool.query(
      "SELECT DISTINCT org_id FROM users WHERE role='org_admin' AND org_id IS NOT NULL AND org_id <> $1",
      [excludingOrgId]
    );
    return result.rows.map((r) => r.org_id as string);
  }

  async recordCertificateVote(input: Omit<CertVoteRecord, "voteId" | "createdAt">) {
    const vote: CertVoteRecord = {
      voteId: crypto.randomUUID(),
      certUuid: input.certUuid,
      reviewerOrgId: input.reviewerOrgId,
      decision: input.decision,
      reason: input.reason,
      createdAt: new Date().toISOString()
    };
    await this.pool.query(
      `INSERT INTO certificate_votes (vote_id, cert_uuid, reviewer_org_id, decision, reason, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [vote.voteId, vote.certUuid, vote.reviewerOrgId, vote.decision, vote.reason, vote.createdAt]
    );
    return vote;
  }

  async listCertificateVotes(certUuid: string) {
    const result = await this.pool.query(
      "SELECT vote_id, cert_uuid, reviewer_org_id, decision, reason, created_at FROM certificate_votes WHERE cert_uuid=$1 ORDER BY created_at ASC",
      [certUuid]
    );
    return result.rows.map((v) => ({
      voteId: v.vote_id,
      certUuid: v.cert_uuid,
      reviewerOrgId: v.reviewer_org_id,
      decision: v.decision,
      reason: v.reason,
      createdAt: v.created_at
    })) as CertVoteRecord[];
  }

  async listVotesByReviewerOrg(orgId: string) {
    const result = await this.pool.query(
      "SELECT vote_id, cert_uuid, reviewer_org_id, decision, reason, created_at FROM certificate_votes WHERE reviewer_org_id=$1 ORDER BY created_at DESC",
      [orgId]
    );
    return result.rows.map((v) => ({
      voteId: v.vote_id,
      certUuid: v.cert_uuid,
      reviewerOrgId: v.reviewer_org_id,
      decision: v.decision,
      reason: v.reason,
      createdAt: v.created_at
    })) as CertVoteRecord[];
  }

  async recordOrgVote(input: Omit<OrgVoteRecord, "voteId" | "createdAt">) {
    const vote: OrgVoteRecord = {
      voteId: crypto.randomUUID(),
      orgId: input.orgId,
      reviewerOrgId: input.reviewerOrgId,
      decision: input.decision,
      reason: input.reason,
      createdAt: new Date().toISOString()
    };
    await this.pool.query(
      `INSERT INTO org_registration_votes (vote_id, org_id, reviewer_org_id, decision, reason, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [vote.voteId, vote.orgId, vote.reviewerOrgId, vote.decision, vote.reason, vote.createdAt]
    );
    return vote;
  }

  async listOrgVotes(orgId: string) {
    const result = await this.pool.query(
      "SELECT vote_id, org_id, reviewer_org_id, decision, reason, created_at FROM org_registration_votes WHERE org_id=$1 ORDER BY created_at ASC",
      [orgId]
    );
    return result.rows.map((v) => ({
      voteId: v.vote_id,
      orgId: v.org_id,
      reviewerOrgId: v.reviewer_org_id,
      decision: v.decision,
      reason: v.reason,
      createdAt: v.created_at
    })) as OrgVoteRecord[];
  }

  async listOrgVotesByReviewerOrg(orgId: string) {
    const result = await this.pool.query(
      "SELECT vote_id, org_id, reviewer_org_id, decision, reason, created_at FROM org_registration_votes WHERE reviewer_org_id=$1 ORDER BY created_at DESC",
      [orgId]
    );
    return result.rows.map((v) => ({
      voteId: v.vote_id,
      orgId: v.org_id,
      reviewerOrgId: v.reviewer_org_id,
      decision: v.decision,
      reason: v.reason,
      createdAt: v.created_at
    })) as OrgVoteRecord[];
  }

  async updateCertificateStatus(certUuid: string, status: Extract<CertStatus, "verified" | "denied">) {
    await this.pool.query("UPDATE certificates SET status=$1 WHERE cert_uuid=$2", [status, certUuid]);
  }

  async revokeCertificate(certUuid: string, reason: string) {
    const revokedAt = new Date().toISOString();
    const result = await this.pool.query(
      "UPDATE certificates SET status='revoked',revoke_reason=$1,revoked_at=$2 WHERE cert_uuid=$3 RETURNING *",
      [reason, revokedAt, certUuid]
    );
    if (!result.rowCount) return null;
    const c = result.rows[0];
    return {
      certUuid: c.cert_uuid,
      orgId: c.org_id,
      certType: c.cert_type,
      certHash: c.cert_hash,
      issueDate: c.issue_date,
      txHash: c.tx_hash,
      status: c.status,
      holderNameEncrypted: c.holder_name_encrypted,
      holderDobEncrypted: c.holder_dob_encrypted,
      identifierMasked: c.identifier_masked,
      manifestDigest: c.manifest_digest ?? "",
      ipfsCid: c.ipfs_cid ?? null,
      revokedAt: c.revoked_at,
      revokeReason: c.revoke_reason
    } as CertRecord;
  }
}

export function createStore(databaseUrl?: string): Store {
  if (!databaseUrl) return new MemoryStore();
  return new PostgresStore(new Pool({ connectionString: databaseUrl }));
}
