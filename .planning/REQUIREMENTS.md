# REQUIREMENTS

## v1 Requirements
- [ ] **ORG-01**: Organization can submit registration with required documents and signatory details.
- [ ] **ORG-02**: Super admin can approve/reject organization requests with reason.
- [ ] **ORG-03**: Approved organization can manage multiple branches.
- [ ] **CERT-01**: Organization can issue a certificate with identifier and metadata.
- [ ] **CERT-02**: System writes certificate hash and metadata hash on-chain.
- [ ] **CERT-03**: Organization can revoke an issued certificate with reason.
- [ ] **VER-01**: Public user can verify via org + identifier lookup without login.
- [ ] **VER-02**: Public user can verify via QR URL (`/verify/[uuid]`).
- [ ] **VER-03**: Public response always redacts/masks PII.
- [ ] **PDF-01**: System generates certificate PDF containing QR and transaction snippet.

## v2 Requirements
- [ ] **VER-04**: Time-limited one-time reveal token for PII.
- [ ] **ANA-01**: Analytics dashboard for issuance/verification patterns.

## Out of Scope
- Hyperledger implementation in v1
- Multi-chain issuance in v1

## Traceability
- ORG-* -> Phase 1, 3, 7
- CERT-* -> Phase 2, 3, 4
- VER-* -> Phase 3, 6
- PDF-* -> Phase 4
