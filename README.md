# DocVerifyBlock

Decentralized certificate verification platform.

The short version:
- organizations issue certificates
- certificate proofs go on-chain
- personal data stays off-chain (encrypted/masked)
- anyone can verify certificate validity through public APIs/UI

---

## What This Project Is

DocVerifyBlock is a full-stack system for tamper-resistant certificate issuance and verification.

- **Backend (`backend`)** handles auth, organization onboarding, certificate lifecycle, and public verification endpoints.
- **Workers (`workers`)** run async jobs and write proof data to blockchain providers.
- **Blockchain (`blockchain`)** contains smart contracts that store organization/certificate proof state.
- **Web apps (`app`, `admin-panel`)** provide public verification and admin workflows.
- **Infra (`infra`)** provides local Postgres and Redis via Docker Compose.

---

## Monorepo Structure (What Code Does What)

- `backend`: Express + TypeScript API. Core business logic and DB access.
- `workers`: BullMQ workers. Picks queued chain-write jobs and sends transactions/callbacks.
- `blockchain`: Hardhat project with Solidity contracts:
  - `OrgRegistry.sol`
  - `CertificateRegistry.sol`
- `app`: main Next.js app (public-facing pages and dashboards).
- `admin-panel`: separate Next.js admin app on port `3001`.
- `infra`: local infrastructure config (`docker-compose.yml` for Postgres + Redis).
- `frontend`: build/cache artifacts directory (currently no active app source code).

---

## System Architecture In Plain English

1. User/org actions hit the **backend API**.
2. Backend validates input, writes records to DB, and queues blockchain jobs (`chain-write` queue).
3. **Workers** read queue jobs, submit transactions (EVM/Polygon or Fabric), then call backend internal callbacks.
4. Backend updates records with final transaction metadata.
5. Public verify APIs/UI return verification status while keeping PII redacted.

Why this split exists:
- API stays responsive (no waiting on blockchain transaction finality).
- retries and async processing are isolated in workers.
- chain interactions are centralized and provider-switchable.

---

## Backend Responsibilities (`backend`)

The backend is the orchestration layer:
- auth + role-based access (`super_admin`, `org_admin`)
- organization registration and approval flow
- certificate issue/revoke APIs
- public verification APIs
- internal callbacks from workers for chain transaction updates

Important behavior:
- PII fields (holder name/DOB) are encrypted before storage.
- public endpoints only return redacted PII.
- cert lookup uses deterministic cert hash (`stableCertHash`) for privacy-preserving verification.
- queue enqueue failures surface as API errors (fail-fast behavior).

Core endpoints:
- `POST /api/auth/login`
- `POST /api/org/register`
- `GET /api/super-admin/orgs/pending`
- `POST /api/super-admin/orgs/:orgId/decision`
- `POST /api/certificates/issue`
- `POST /api/certificates/revoke`
- `POST /api/public/verify`
- `GET /api/public/verify/:uuid`
- internal callbacks:
  - `POST /internal/chain/org-registered`
  - `POST /internal/chain/certificate-issued`

---

## Blockchain Responsibilities (`blockchain`)

Smart contracts capture proof/validity state on-chain.

### `OrgRegistry.sol`
- registers organizations
- tracks active/inactive org status
- controls authorized issuer addresses per org

### `CertificateRegistry.sol`
- issues certificates against a `certHash`
- verifies certificates (exists + revoked status)
- allows issuer/owner revocation
- enforces org status and issuer authorization through `OrgRegistry`

This means:
- on-chain = integrity + verification state
- off-chain = richer app data and encrypted sensitive fields

---

## Worker Responsibilities (`workers`)

Workers process queue workloads with production-safe behavior:
- `bulk-certificate-import` is intentionally disabled until implemented
- `chain-write` is the active chain transaction flow

For `chain-write`, workers:
- submit org/certificate transactions to configured provider
- support provider modes:
  - `evm` (default): uses `ethers` + RPC + deployed contract addresses
  - `fabric`: uses HTTP gateway endpoints
- send callback payloads (tx hash + optional gas/fee metadata) back to backend

---

## Blockchain Provider Modes

- `BLOCKCHAIN_PROVIDER=evm` (default)
  - needs: `RPC_URL`, `ISSUER_PRIVATE_KEY`, `ORG_REGISTRY_ADDRESS`, `CERT_REGISTRY_ADDRESS`
- `BLOCKCHAIN_PROVIDER=fabric`
  - needs: `FABRIC_GATEWAY_URL`, `FABRIC_CHANNEL`, `FABRIC_CHAINCODE`
  - gateway endpoints:
    - `/transactions/register-org`
    - `/transactions/issue-certificate`

Synthetic chain tx mode is disabled by default and must be explicitly enabled with `ALLOW_SYNTHETIC_CHAIN_TX=true` for local simulations.

---

## Local Run Commands

From repo root:

1. Install dependencies:
   - `npm install`
2. Start infra:
   - `npm run infra:up`
3. Run API + web apps:
   - `AES_256_KEY=12345678901234567890123456789012 npm run dev:all`
4. Run full local stack (includes workers):
   - `AES_256_KEY=12345678901234567890123456789012 npm run run:beast`
5. Start workers only when Redis and chain configuration are available.

Ports:
- public app: `http://localhost:3000`
- admin panel: `http://localhost:3001`
- backend API: `http://localhost:4000`

---

## Test Commands

- backend + blockchain tests:
  - `npm run test`
- full build/test sweep:
  - `AES_256_KEY=12345678901234567890123456789012 npm run test:everything`
- blockchain tests only:
  - `npm run test -w blockchain`

---

## Security and Privacy Model

- Personal identifiers are encrypted or masked in backend storage.
- Public verification never exposes raw PII.
- Blockchain stores proof and status, not user-sensitive personal records.
- Role-based access controls issuance/admin actions.

---

## GSD Workflow Artifacts

- `.planning/PROJECT.md`
- `.planning/config.json`
- `.planning/REQUIREMENTS.md`
- `.planning/ROADMAP.md`
- `.planning/STATE.md`
- `CLAUDE.md`
