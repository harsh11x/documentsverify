# DocVerifyBlock Complete System Guide

This document explains how the full system works end-to-end:
- **complete flowcharts** (signup, org approval, issuance, public verify) — see Section 2
- blockchain and smart contracts
- Hyperledger Fabric mode
- backend and workers flow
- certificate verification lifecycle
- organization registration/onboarding
- setup, run, and credentials configuration

---

## 1) What This Project Is

DocVerifyBlock is a decentralized certificate verification platform where:
- organizations issue certificates
- proof/state is written to blockchain (EVM or Fabric gateway mode)
- sensitive PII is kept off-chain and encrypted in the backend database
- public users can verify certificate validity without seeing raw personal data

Main services:
- `app` -> public/front app (`localhost:3000`)
- `admin-panel` -> admin UI (`localhost:3001`)
- `backend` -> API + business logic (`localhost:4000`)
- `workers` -> async chain-write jobs + callback updates
- `blockchain` -> Solidity contracts (`OrgRegistry`, `CertificateRegistry`)
- `infra` -> local Postgres + Redis via Docker Compose

---

## 2) Complete End-to-End Flowchart

Traditional flowchart notation (ISO-style shapes in Mermaid):

| Shape | Meaning | Mermaid syntax |
|-------|---------|----------------|
| **Oval** | Start / End (terminator) | `([text])` |
| **Rectangle** | Process / action | `[text]` |
| **Diamond** | Decision (yes/no branch) | `{text}` |
| **Gray rectangle** | Input or output (labels start with `INPUT:` or `OUTPUT:`) | `["INPUT: ..."]` |
| **Cylinder** | Data store (database, IPFS, blockchain) | `[("DB: ...")]` |
| **Purple rectangle** | Document / file produced | `["DOC: ..."]` |

> **Note:** Avoid Mermaid parallelogram syntax (`[/text/]`) when labels contain slashes (e.g. `/signup/`) — it breaks rendering. Use quoted rectangles instead.

View these in GitHub, VS Code (Mermaid preview), paste into [mermaid.live](https://mermaid.live), or open the **interactive GUI**:

**[PROJECT_WORKFLOW_FLOWCHART.html](./PROJECT_WORKFLOW_FLOWCHART.html)** — double-click to open in your browser (sidebar navigation, zoom, shape legend, all three flows).

### 2.1 System overview (how the three flows connect)

```mermaid
flowchart LR
  A([START]) --> B["Flow A: Org signup and approval"]
  B --> C["Flow B: Issue certificate"]
  C --> D["Flow C: Public verify"]
  D --> E([END])
  style A fill:#e8f5e9,stroke:#2e7d32
  style E fill:#e8f5e9,stroke:#2e7d32
  style B fill:#e3f2fd,stroke:#1565c0
  style C fill:#fff3e0,stroke:#ef6c00
  style D fill:#f3e5f5,stroke:#7b1fa2
```

---

### 2.2 Flow A — Organization signup, login & network verification

```mermaid
flowchart TD
  S([START])
  S --> IN1["INPUT: Open signup page"]
  IN1 --> IN2["INPUT: Org details and admin credentials"]
  IN2 --> P1["POST api org register"]
  P1 --> D1[("DB: org pending_review")]
  P1 --> D2[("DB: create org_admin user")]
  P2["OUTPUT: Show orgId pending status"]
  D1 --> P2
  D2 --> P2
  P2 --> IN3["INPUT: Open login page"]
  IN3 --> IN4["INPUT: Email and password"]
  IN4 --> P3["POST api auth login"]
  P3 --> D3{"Credentials valid?"}
  D3 -->|No| OUT_ERR["OUTPUT: Login error"]
  OUT_ERR --> IN3
  D3 -->|Yes| OUT1["OUTPUT: Store JWT in browser"]
  OUT1 --> P4["Open dashboard"]
  P4 --> ROLE{"Who is logged in?"}
  ROLE -->|New org admin| P5["Wait for approval"]
  ROLE -->|Reviewer| P6["View pending applications"]
  P6 --> IN5["INPUT: Vote approve or deny"]
  IN5 --> P7["POST api orgs vote"]
  P7 --> D4[("DB: save vote")]
  D4 --> DEC1{"Approvals >= majority?"}
  DEC1 -->|Yes| P8["Set status approved"]
  DEC1 -->|No| DEC2{"Denials >= majority?"}
  DEC2 -->|Yes| P9["Set status rejected"]
  DEC2 -->|No| P10["Need more votes"]
  P10 --> P6
  P9 --> END_REJECT([END rejected])
  P8 --> P11["Enqueue org-register job"]
  P11 --> P12["Worker: blockchain register org"]
  P12 --> D5[("Chain: org tx")]
  P12 --> P13["Callback org-registered"]
  P13 --> D6[("DB: save chain_tx_hash")]
  D6 --> END_APPROVE([END approved])
  P5 --> DEC3{"Org approved yet?"}
  DEC3 -->|No| P5
  DEC3 -->|Yes| END_APPROVE
  style S fill:#c8e6c9,stroke:#1b5e20
  style END_APPROVE fill:#c8e6c9,stroke:#1b5e20
  style END_REJECT fill:#ffcdd2,stroke:#b71c1c
  style D1 fill:#bbdefb,stroke:#0d47a1
  style D2 fill:#bbdefb,stroke:#0d47a1
  style D4 fill:#bbdefb,stroke:#0d47a1
  style D5 fill:#ffe0b2,stroke:#e65100
  style D6 fill:#bbdefb,stroke:#0d47a1
  style DEC1 fill:#fff9c4,stroke:#f57f17
  style DEC2 fill:#fff9c4,stroke:#f57f17
  style DEC3 fill:#fff9c4,stroke:#f57f17
  style D3 fill:#fff9c4,stroke:#f57f17
  style ROLE fill:#fff9c4,stroke:#f57f17
  style IN1 fill:#cbd5e1,stroke:#475569
  style IN2 fill:#cbd5e1,stroke:#475569
  style IN3 fill:#cbd5e1,stroke:#475569
  style IN4 fill:#cbd5e1,stroke:#475569
  style IN5 fill:#cbd5e1,stroke:#475569
  style P2 fill:#e2e8f0,stroke:#475569
  style OUT1 fill:#e2e8f0,stroke:#475569
  style OUT_ERR fill:#e2e8f0,stroke:#475569
```

**Voting rule:** Eligible voters = every **already approved** org (except the applicant) + **super_admin**. Majority = `floor(eligibleNodes / 2) + 1`.

---

### 2.3 Flow B — Login, upload data & issue certificate

```mermaid
flowchart TD
  S([START])
  S --> IN1["INPUT: Org admin login"]
  IN1 --> IN2["INPUT: Email and password"]
  IN2 --> P1["POST api auth login"]
  P1 --> DEC1{"Org approved?"}
  DEC1 -->|No| END_BLOCK([END cannot issue])
  DEC1 -->|Yes| P2["Open issue certificate form"]
  P2 --> IN3["INPUT: Cert details and holder info"]
  IN3 --> IN4["INPUT: Optional supporting file"]
  IN4 --> P3["POST api certificates issue"]
  P3 --> DEC2{"Valid cert type?"}
  DEC2 -->|No| OUT_ERR["OUTPUT: invalid_cert_type"]
  OUT_ERR --> IN3
  DEC2 -->|Yes| P4["Compute certHash"]
  P4 --> P5["Encrypt PII AES-256"]
  P5 --> P6["Generate PDF with QR"]
  P6 --> P7["Pin PDF to IPFS"]
  P7 --> D1[("IPFS: certificate PDF")]
  P6 --> P8["Build manifest JSON"]
  P8 --> P9["Pin manifest to IPFS"]
  P9 --> D2[("IPFS: manifest JSON")]
  P9 --> P10["Insert certificate row"]
  P10 --> D3[("DB: encrypted PII")]
  P10 --> P11["Enqueue certificate-issue"]
  P11 --> P12["Worker: on-chain issue"]
  P12 --> D4[("Chain: cert proof")]
  P12 --> P13["Callback certificate-issued"]
  P13 --> D5[("DB: update tx_hash")]
  D5 --> DOC["DOC: Certificate PDF"]
  DOC --> OUT1["OUTPUT: certUuid and verify URL"]
  OUT1 --> OUT2["OUTPUT: Share PDF with holder"]
  OUT2 --> E([END ready to verify])
  style S fill:#c8e6c9,stroke:#1b5e20
  style E fill:#c8e6c9,stroke:#1b5e20
  style END_BLOCK fill:#ffcdd2,stroke:#b71c1c
  style D1 fill:#ffe0b2,stroke:#e65100
  style D2 fill:#ffe0b2,stroke:#e65100
  style D3 fill:#bbdefb,stroke:#0d47a1
  style D4 fill:#ffe0b2,stroke:#e65100
  style D5 fill:#bbdefb,stroke:#0d47a1
  style DEC1 fill:#fff9c4,stroke:#f57f17
  style DEC2 fill:#fff9c4,stroke:#f57f17
  style DOC fill:#e1bee7,stroke:#4a148c
  style IN1 fill:#cbd5e1,stroke:#475569
  style IN2 fill:#cbd5e1,stroke:#475569
  style IN3 fill:#cbd5e1,stroke:#475569
  style IN4 fill:#cbd5e1,stroke:#475569
  style OUT1 fill:#e2e8f0,stroke:#475569
  style OUT2 fill:#e2e8f0,stroke:#475569
  style OUT_ERR fill:#e2e8f0,stroke:#475569
```

**Upload note:** The optional file is hashed (SHA-256) into the manifest only; raw file bytes are not stored in Postgres.

---

### 2.4 Flow C — Public client verifies & retrieves document

```mermaid
flowchart TD
  S([START public verify])
  S --> DEC1{"Lookup method?"}
  DEC1 -->|QR link| IN1["INPUT: Open verify by UUID"]
  DEC1 -->|Web form| IN2["INPUT: Org and identifier"]
  DEC1 -->|Advanced| IN3["INPUT: UUID hash or txHash"]
  IN1 --> P1["GET api public verify uuid"]
  IN2 --> P2["POST api public verify"]
  IN3 --> P3["POST api public verify query"]
  P2 --> P4["Recompute certHash"]
  P4 --> P5[("DB lookup")]
  P1 --> P5
  P3 --> P5
  P5 --> DEC2{"Found?"}
  DEC2 -->|No| OUT_FAIL["OUTPUT: Not found"]
  OUT_FAIL --> E1([END])
  DEC2 -->|Yes| DEC3{"Revoked?"}
  DEC3 -->|Yes| OUT_REV["OUTPUT: REVOKED no PII"]
  DEC3 -->|No| OUT_OK["OUTPUT: VERIFIED plus links"]
  OUT_OK --> DEC4{"Download PDF?"}
  OUT_REV --> E2([END])
  DEC4 -->|No| E2
  DEC4 -->|Yes| P6["Open presentation URI"]
  P6 --> D1[("IPFS: branded PDF")]
  D1 --> DOC["DOC: Holder certificate"]
  DOC --> DEC5{"View manifest?"}
  DEC5 -->|Yes| D2[("IPFS: manifest JSON")]
  DEC5 -->|No| E3([END complete])
  D2 --> E3
  style S fill:#c8e6c9,stroke:#1b5e20
  style E1 fill:#ffcdd2,stroke:#b71c1c
  style E2 fill:#c8e6c9,stroke:#1b5e20
  style E3 fill:#c8e6c9,stroke:#1b5e20
  style P5 fill:#bbdefb,stroke:#0d47a1
  style D1 fill:#ffe0b2,stroke:#e65100
  style D2 fill:#ffe0b2,stroke:#e65100
  style DEC1 fill:#fff9c4,stroke:#f57f17
  style DEC2 fill:#fff9c4,stroke:#f57f17
  style DEC3 fill:#fff9c4,stroke:#f57f17
  style DEC4 fill:#fff9c4,stroke:#f57f17
  style DEC5 fill:#fff9c4,stroke:#f57f17
  style DOC fill:#e1bee7,stroke:#4a148c
  style IN1 fill:#cbd5e1,stroke:#475569
  style IN2 fill:#cbd5e1,stroke:#475569
  style IN3 fill:#cbd5e1,stroke:#475569
  style OUT_FAIL fill:#e2e8f0,stroke:#475569
  style OUT_REV fill:#e2e8f0,stroke:#475569
  style OUT_OK fill:#e2e8f0,stroke:#475569
```

**Privacy:** Public APIs always return `holderName: REDACTED`, `holderDob: REDACTED`, and a masked identifier only.

### 2.5 Role and URL quick reference

| Step | Who | UI | API |
|------|-----|-----|-----|
| Register org | Applicant | `/signup` | `POST /api/org/register` |
| Login | Org admin / super admin | `/login` | `POST /api/auth/login` |
| Vote on new org | Approved org admin, super admin | `/dashboard` | `POST /api/orgs/:orgId/vote` |
| Issue certificate | Approved org admin | `/dashboard` | `POST /api/certificates/issue` |
| Verify by UUID | Public | `/verify/[uuid]` | `GET /api/public/verify/:uuid` |
| Verify by identifier | Public | `/certificate-verification` | `POST /api/public/verify` |
| List issuers | Public | verification form dropdown | `GET /api/public/orgs` |

---

## 3) High-Level Architecture

1. Request hits backend API (org registration, certificate issue, verification, etc.).
2. Backend validates data, stores off-chain records in Postgres, and queues blockchain writes (`chain-write` queue in Redis).
3. Worker consumes queue job and submits transaction to:
   - EVM/Polygon via `ethers`, or
   - Hyperledger Fabric gateway via HTTP endpoints.
4. Worker calls backend internal callback endpoint with tx hash and metadata.
5. Backend updates DB record with blockchain transaction details.
6. Public verification APIs return status + redacted PII.

Why this split is used:
- API stays responsive (async transaction handling).
- Retry/failure handling is isolated in workers.
- Blockchain provider is swappable (EVM vs Fabric mode).

---

## 4) Smart Contracts (EVM Path)

Contracts live in `blockchain/contracts`.

### 4.1 `OrgRegistry.sol`
Purpose:
- register organizations
- mark active/inactive status
- authorize issuer addresses per organization

Core methods:
- `registerOrg(orgId, orgNameHash, sector, orgType, adminAddress)` (only owner)
- `deactivateOrg(orgId)` (only owner)
- `setOrgIssuer(orgId, issuer, isAuthorized)` (only owner)
- `isOrgActive(orgId)` view
- `isOrgIssuer(orgId, issuer)` view

### 4.2 `CertificateRegistry.sol`
Purpose:
- issue certificate state keyed by `certHash`
- revoke certificates
- verify existence/revocation/issue timestamp

Core methods:
- `issueCertificate(certHash, orgId, branchId, certType, metadataHash)`
- `revokeCertificate(certHash, reason)` (issuer or owner)
- `verifyCertificate(certHash)` view

Enforcement:
- issue requires active org in `OrgRegistry`
- issuer must be authorized in `OrgRegistry`

Important note:
- The backend worker currently calls contract methods for org registration and certificate issuance.
- Revocation in the current backend is off-chain status update in DB; no worker path currently writes revoke tx on-chain.

---

## 5) Hyperledger Fabric Mode (How It Works Here)

This project supports two blockchain provider modes:
- `BLOCKCHAIN_PROVIDER=evm` (default)
- `BLOCKCHAIN_PROVIDER=fabric`

In Fabric mode, worker does not use Solidity contracts directly. Instead it calls a Fabric gateway over HTTP:
- `POST {FABRIC_GATEWAY_URL}/transactions/register-org`
- `POST {FABRIC_GATEWAY_URL}/transactions/issue-certificate`

Request body sent by worker:
- `channel` -> `FABRIC_CHANNEL` (default `docverify`)
- `chaincode` -> `FABRIC_CHAINCODE` (default `certificates`)
- `payload` -> job payload (`org-register` or `certificate-issue`)

Expected response:
- JSON with `txHash` or `transactionId`

If gateway does not return a tx identifier, worker treats it as failure.

What this means practically:
- Fabric support in this repo is gateway-driven integration mode.
- You must run/provide a compatible Fabric gateway service that exposes the required endpoints.

---

## 6) Backend Internals

Backend entry point behavior:
- validates env
- creates store (`PostgresStore` when `DATABASE_URL` exists, else memory store)
- initializes schema tables if missing
- seeds super admin
- seeds bootstrap org accounts in non-production (unless overridden)

### 6.1 Security and privacy
- PII (`holderName`, `holderDob`) is encrypted using AES-256-GCM (`AES_256_KEY` required).
- Public verify endpoints never return raw PII (only masked identifier + redacted fields).
- Certificate lookup uses deterministic `stableCertHash(orgId|certType|identifierValue)` in lowercase trimmed form.
- JWT role auth controls admin actions.

### 6.2 Storage model (Postgres)
Main tables:
- `users`
- `organizations`
- `certificates`
- `certificate_votes`
- `org_registration_votes`

Key persisted chain references:
- organization chain tx hash -> `organizations.chain_tx_hash`
- certificate chain tx hash -> `certificates.tx_hash`
- manifest hash + CID -> `certificates.manifest_digest`, `certificates.ipfs_cid`

---

## 7) Worker Internals

Worker queue names:
- `bulk-certificate-import` (currently intentionally unsupported)
- `chain-write` (active blockchain write path)

Chain-write jobs:
- `org-register`
- `certificate-issue`

Execution path:
1. Read job payload from Redis queue.
2. Submit tx via provider mode:
   - EVM: `submitEvmTx()`
   - Fabric: `submitFabricTx()`
3. Callback to backend internal endpoint with `x-chain-worker-token`.
4. Backend verifies token and updates DB record.

Dev-only behavior:
- If live EVM config is missing and `ALLOW_SYNTHETIC_CHAIN_TX=true`, worker generates synthetic tx hash for local simulation.
- In production, synthetic tx path is blocked.

---

## 8) Full Lifecycle Flows

### 8.1 New organization registration and approval
1. Organization submits `POST /api/org/register`.
2. Backend stores org as `pending_review` and creates org admin account.
3. Eligible reviewers (`approved org admins` + `super_admin`) vote via `POST /api/orgs/:orgId/vote`.
4. Once majority reached:
   - approve -> org marked `approved`, `org-register` chain job enqueued.
   - deny -> org marked `rejected`.
5. Worker writes org registration to blockchain provider.
6. Worker calls `/internal/chain/org-registered` with tx hash.
7. Backend stores `chain_tx_hash` for org.

### 8.2 Certificate issuance
1. Org admin calls `POST /api/certificates/issue`.
2. Backend verifies role/org status and computes `certHash`.
3. Backend builds manifest, computes canonical SHA-256 digest, optionally pins JSON to IPFS.
4. Backend stores certificate row with encrypted PII.
5. Backend enqueues `certificate-issue` chain job.
6. Worker submits chain tx and callbacks `/internal/chain/certificate-issued`.
7. Backend updates `tx_hash` in certificate record.

### 8.3 Public verification
Verification endpoints:
- `GET /api/public/verify/:uuid`
- `POST /api/public/verify` (orgId + certType + identifierValue)
- `POST /api/public/verify/query` (uuid/hash/tx search)

What verifier gets:
- certificate status (`verified`/`revoked` etc.)
- orgId, certType, issueDate
- txHash
- certHash, manifestDigest, ipfsCid/manifestUri
- redacted PII fields (never raw encrypted payload)

---

## 9) Credentials and Environment Variables

Create `.env` from `.env.example` at repo root.

Important: do not commit real secrets. Values below are categories and examples only.

### 9.1 Required core backend/worker values
- `DATABASE_URL` (Postgres connection)
- `REDIS_URL` (Redis connection)
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `CHAIN_WORKER_TOKEN` (must match backend and workers)
- `AES_256_KEY` (minimum 32 chars)

### 9.2 Admin/bootstrap values
- `SUPER_ADMIN_EMAIL`
- `SUPER_ADMIN_PASSWORD`
- `ORG_ADMIN_EMAIL_DOMAIN`
- Optional `BOOTSTRAP_ORG_ACCOUNTS` JSON array (dev pre-approved org users)

### 9.3 EVM provider values
- `BLOCKCHAIN_PROVIDER=evm`
- `RPC_URL`
- `CHAIN_ID`
- `ORG_REGISTRY_ADDRESS`
- `CERT_REGISTRY_ADDRESS`
- `ISSUER_PRIVATE_KEY`

### 9.4 Fabric provider values
- `BLOCKCHAIN_PROVIDER=fabric`
- `FABRIC_GATEWAY_URL`
- `FABRIC_CHANNEL`
- `FABRIC_CHAINCODE`

### 9.5 IPFS values

Certificate issuance **requires** a successful manifest pin unless `IPFS_OPTIONAL_IN_DEV=true` in non-production (never in production). Set one of:

- `IPFS_KUBO_API_URL` — local Kubo (e.g. `http://127.0.0.1:5001` after `npm run infra:up`, which includes the `ipfs` service).
- `IPFS_PINATA_JWT` — Pinata `pinJSONToIPFS`.

Vitest uses a deterministic synthetic CID when no provider is configured.

- `IPFS_GATEWAY_PREFIX`

### 9.6 Frontend value
- `NEXT_PUBLIC_API_URL=http://localhost:4000`

### 9.7 Local infra defaults (from Docker compose)
- Postgres:
  - user: `postgres`
  - password: `postgres`
  - db: `docverify`
  - port: `5432`
- Redis:
  - port: `6379`

### 9.8 Existing sample/default credentials in codebase
For development only, backend seeds sample org accounts in non-production if not overridden. These are examples and should be changed in real deployments:
- `registrar@northbridgeacademy.edu` / `Northbridge#2026`
- `cert-office@crestviewit.edu` / `Crestview#2026`
- `controller@riverdalecollege.edu` / `Riverdale#2026`

Super admin defaults fall back if env not set:
- email: `admin@example.com`
- password: `change-me-in-env`

Use explicit secrets in `.env` for anything beyond local testing.

---

## 10) Setup and Run (Local)

From repository root:

1) Install dependencies
- `npm install`

2) Start local infra (Postgres + Redis)
- `npm run infra:up`

3) Create `.env` from `.env.example` and fill secrets

4) Run backend + public app + admin panel
- `AES_256_KEY=12345678901234567890123456789012 npm run dev:all`

5) Run full stack including workers
- `AES_256_KEY=12345678901234567890123456789012 npm run run:beast`

Service URLs:
- Public app: `http://localhost:3000`
- Admin panel: `http://localhost:3001`
- Backend API: `http://localhost:4000`

Health check:
- `GET http://localhost:4000/health`

---

## 11) EVM Contract Deployment Notes

The `blockchain` workspace includes contracts and Hardhat config, but no deploy script in this repository by default.

Typical path:
1. Add/develop deployment scripts under `blockchain/scripts`.
2. Compile/test:
   - `npm run build -w blockchain`
   - `npm run test -w blockchain`
3. Deploy and capture addresses.
4. Set `ORG_REGISTRY_ADDRESS` and `CERT_REGISTRY_ADDRESS` in `.env`.
5. Ensure issuer wallet is authorized in `OrgRegistry` for intended orgs (`setOrgIssuer`).

Without valid deployed addresses/authorization, EVM chain writes will fail (unless synthetic tx is enabled in dev).

---

## 12) How Verification Is Stored and Proven

Off-chain (Postgres):
- full operational record
- encrypted PII
- status/revocation metadata
- tx hash and manifest digest/CID references

On-chain / Fabric ledger:
- immutable registration/issuance proof data
- transaction traceability via tx hash

Public verification is the combined outcome of:
- backend certificate status
- deterministic certificate hash matching
- blockchain transaction references
- optional IPFS manifest digest/CID linkage

---

## 13) Common Troubleshooting

- `Missing AES_256_KEY` or short key:
  - set `AES_256_KEY` to at least 32 characters.
- Chain callbacks unauthorized:
  - ensure backend + worker use same `CHAIN_WORKER_TOKEN`.
- Queue enqueue failures:
  - confirm Redis is up and `REDIS_URL` is correct.
- No chain tx hash updates:
  - verify worker process is running and callback URL/token are correct.
- EVM errors `evm_chain_config_missing`:
  - set RPC/private key/contract addresses or enable synthetic tx for dev only.
- Fabric errors:
  - ensure gateway URL is reachable and endpoints return `txHash`/`transactionId`.

---

## 14) Production Security Checklist

- rotate all secrets from `.env.example`
- never use default/sample passwords
- disable synthetic tx mode (`ALLOW_SYNTHETIC_CHAIN_TX=false`)
- use strong JWT and worker tokens
- restrict CORS origins
- secure Postgres/Redis/network boundaries
- enforce HTTPS and key management for env secrets

