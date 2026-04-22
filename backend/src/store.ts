import crypto from "node:crypto";
import { hash, compare } from "bcryptjs";
import { Pool } from "pg";

export type Role = "super_admin" | "org_admin";
export type OrgStatus = "pending_review" | "approved" | "rejected";
export type CertStatus = "queued" | "verified" | "revoked";

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
  revokedAt: string | null;
  revokeReason: string | null;
};

export interface Store {
  initialize(): Promise<void>;
  createSuperAdmin(email: string, password: string): Promise<void>;
  authenticate(email: string, password: string): Promise<UserRecord | null>;
  createOrgApplication(input: Omit<OrgRecord, "status" | "reviewReason" | "chainTxHash">): Promise<OrgRecord>;
  listPendingOrgs(): Promise<OrgRecord[]>;
  decideOrg(orgId: string, decision: "approve" | "reject", reason: string): Promise<OrgRecord | null>;
  markOrgChainRegistered(orgId: string, txHash: string): Promise<void>;
  createOrgAdmin(orgId: string, email: string, password: string): Promise<UserRecord>;
  createCertificate(input: Omit<CertRecord, "status" | "revokedAt" | "revokeReason">): Promise<CertRecord>;
  markCertificateChainIssued(certUuid: string, txHash: string): Promise<void>;
  listCertificatesByOrg(orgId: string): Promise<CertRecord[]>;
  listAllCertificates(): Promise<CertRecord[]>;
  findCertificateByUuid(certUuid: string): Promise<CertRecord | null>;
  findCertificateByHash(orgId: string, certHash: string): Promise<CertRecord | null>;
  revokeCertificate(certUuid: string, reason: string): Promise<CertRecord | null>;
}

class MemoryStore implements Store {
  private users = new Map<string, UserRecord>();
  private orgs = new Map<string, OrgRecord>();
  private certs = new Map<string, CertRecord>();

  async initialize() {}

  async createSuperAdmin(email: string, password: string) {
    const existing = [...this.users.values()].find((u) => u.email === email);
    if (existing) return;
    const passwordHash = await hash(password, 10);
    this.users.set(crypto.randomUUID(), {
      userId: crypto.randomUUID(),
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

  async createOrgApplication(input: Omit<OrgRecord, "status" | "reviewReason" | "chainTxHash">) {
    const org: OrgRecord = { ...input, status: "pending_review", reviewReason: null, chainTxHash: null };
    this.orgs.set(org.orgId, org);
    return org;
  }

  async listPendingOrgs() {
    return [...this.orgs.values()].filter((o) => o.status === "pending_review");
  }

  async decideOrg(orgId: string, decision: "approve" | "reject", reason: string) {
    const org = this.orgs.get(orgId);
    if (!org) return null;
    org.status = decision === "approve" ? "approved" : "rejected";
    org.reviewReason = reason;
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
    const cert: CertRecord = { ...input, status: "queued", revokedAt: null, revokeReason: null };
    this.certs.set(cert.certUuid, cert);
    return cert;
  }

  async markCertificateChainIssued(certUuid: string, txHash: string) {
    const cert = this.certs.get(certUuid);
    if (!cert) return;
    cert.txHash = txHash;
    cert.status = "verified";
    this.certs.set(certUuid, cert);
  }

  async listCertificatesByOrg(orgId: string) {
    return [...this.certs.values()].filter((c) => c.orgId === orgId);
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
        chain_tx_hash TEXT NULL
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
        revoked_at TEXT NULL,
        revoke_reason TEXT NULL
      );
    `);
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

  async createOrgApplication(input: Omit<OrgRecord, "status" | "reviewReason" | "chainTxHash">) {
    const status: OrgStatus = "pending_review";
    await this.pool.query(
      `INSERT INTO organizations (org_id,name,city,org_type,sector,domain,status,review_reason,chain_tx_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [input.orgId, input.name, input.city, input.orgType, input.sector, input.domain, status, null, null]
    );
    return { ...input, status, reviewReason: null, chainTxHash: null };
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
    };
  }

  async markOrgChainRegistered(orgId: string, txHash: string) {
    await this.pool.query("UPDATE organizations SET chain_tx_hash=$1 WHERE org_id=$2", [txHash, orgId]);
  }

  async createOrgAdmin(orgId: string, email: string, password: string) {
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
    const cert: CertRecord = { ...input, status: "queued", revokedAt: null, revokeReason: null };
    await this.pool.query(
      `INSERT INTO certificates
       (cert_uuid,org_id,cert_type,cert_hash,issue_date,tx_hash,status,holder_name_encrypted,holder_dob_encrypted,identifier_masked,revoked_at,revoke_reason)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
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
        cert.revokedAt,
        cert.revokeReason
      ]
    );
    return cert;
  }

  async markCertificateChainIssued(certUuid: string, txHash: string) {
    await this.pool.query("UPDATE certificates SET tx_hash=$1,status='verified' WHERE cert_uuid=$2", [txHash, certUuid]);
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
      revokedAt: c.revoked_at,
      revokeReason: c.revoke_reason
    } as CertRecord;
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
      revokedAt: c.revoked_at,
      revokeReason: c.revoke_reason
    } as CertRecord;
  }
}

export function createStore(databaseUrl?: string): Store {
  if (!databaseUrl) return new MemoryStore();
  return new PostgresStore(new Pool({ connectionString: databaseUrl }));
}
