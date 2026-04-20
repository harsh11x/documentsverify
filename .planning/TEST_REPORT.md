# Test Report

## Scope
Full workspace verification run after security hardening and Stitch route integration.

## Command
`AES_256_KEY=12345678901234567890123456789012 npm run test:everything`

## Results
- backend-api: PASS (`vitest`, 3 tests)
- blockchain: PASS (`hardhat`, 2 tests)
- workers: PASS (TypeScript build)
- frontend: PASS (`next build`, static routes generated)
- admin-panel: PASS (`next build`)

## Verified Coverage
- API health endpoint and request validation
- Certificate issue and public verification redaction behavior
- Public verify rate limiting
- Contract owner/issuer authorization gates
- Contract revoke authorization constraints
- Monorepo production build viability
- Live smoke flow: issue -> verify -> revoke -> verify(revoked) via running API

## Latest Update
- backend-api tests increased to 4 test cases (adds org+identifier verification and revoke flow).

## Known Notes
- Hardhat warns Node v25 is unsupported; switch to Node 20/22 LTS for deployment-grade reliability.

## GSD Tracking
- Recorded as milestone test sweep artifact.
- Next recommended workflow step: `$gsd-verify-work 1` for interactive UAT checkpoints.
