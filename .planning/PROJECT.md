# Project: Blockchain-Based Certificate Verification System

## What This Is
Decentralized platform for organizations to issue tamper-proof certificates on Polygon and let the public verify them without exposing PII.

## Core Value
Trustworthy verification with privacy by design: proof on-chain, personal data off-chain and encrypted.

## Users
- Super Admin
- Organization Admin
- Public Verifier

## Requirements

### Validated
(None yet - greenfield)

### Active
- [ ] Organization onboarding with approval workflow and branch management
- [ ] Certificate issuance (single + bulk), on-chain anchoring, and revocation
- [ ] Public verification by org+identifier and by QR UUID with PII redaction
- [ ] Certificate PDF generation with QR and transaction reference

### Out of Scope
- Advanced analytics and anomaly detection in MVP
- Cross-chain support in MVP

## Key Decisions
| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Polygon for chain | EVM compatibility and low gas fees | Accepted |
| PII off-chain encrypted | GDPR/IT Act safety and erasure support | Accepted |
| API-layer org uniqueness checks | Cheaper and more flexible than on-chain string checks | Accepted |
| BullMQ for bulk processing | Async retries and throughput for chain writes | Accepted |
