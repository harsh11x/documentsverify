# DocVerifyBlock

Blockchain-based certificate verification system scaffolded with a GSD-compatible workflow.

## Services
- `backend-api`: Express + TypeScript API skeleton
- `workers`: BullMQ background workers
- `blockchain`: Hardhat contracts (`OrgRegistry`, `CertificateRegistry`)
- `frontend`: Next.js public verification shell
- `admin-panel`: Next.js super admin shell
- `infra`: Docker Compose for Postgres + Redis

## Blockchain Provider Modes
- `BLOCKCHAIN_PROVIDER=evm` (default): workers write to EVM/Polygon contracts using `RPC_URL`, `ORG_REGISTRY_ADDRESS`, and `CERT_REGISTRY_ADDRESS`.
- `BLOCKCHAIN_PROVIDER=fabric`: workers call a Fabric gateway API using:
  - `FABRIC_GATEWAY_URL` (example: `http://localhost:8080`)
  - `FABRIC_CHANNEL` (default `docverify`)
  - `FABRIC_CHAINCODE` (default `certificates`)
- In Fabric mode, workers POST to:
  - `/transactions/register-org`
  - `/transactions/issue-certificate`
  The gateway should return either `txHash` or `transactionId`.

## Quick Start
1. Copy `.env.example` to `.env`.
2. Start infra:
   - `docker compose -f infra/docker-compose.yml up -d`
3. Install deps:
   - `npm install`
4. Run API:
   - `npm run dev -w backend-api`
5. Run all apps:
   - `AES_256_KEY=12345678901234567890123456789012 npm run dev:all`
6. Run full stack with infra + workers:
   - `AES_256_KEY=12345678901234567890123456789012 npm run run:beast`
   - If Redis is unavailable, run API/frontends only with:
     - `DISABLE_QUEUES=true AES_256_KEY=12345678901234567890123456789012 npm run dev:all`
5. Run blockchain tests:
   - `npm run test -w blockchain`
6. Run full verification:
   - `AES_256_KEY=12345678901234567890123456789012 npm run test:everything`

## GSD Artifacts
- `.planning/PROJECT.md`
- `.planning/config.json`
- `.planning/REQUIREMENTS.md`
- `.planning/ROADMAP.md`
- `.planning/STATE.md`
- `CLAUDE.md`

## Key API Flow (Implemented)
- `POST /api/auth/login`
- `POST /api/org/register`
- `GET /api/super-admin/orgs/pending`
- `POST /api/super-admin/orgs/:orgId/decision`
- `POST /api/certificates/issue`
- `POST /api/certificates/revoke`
- `POST /api/public/verify`
- `GET /api/public/verify/:uuid`
