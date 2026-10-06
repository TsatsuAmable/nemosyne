# P1-PT4B1 Product Operation Family Post-Implementation Review

**Date:** 3 September 2026  
**Scope:** first-family registry, immutable policy artifacts and rich-source-to-closed-payload projection only.

## Adversarial review

The implementation was reviewed against RFC 0004 rather than against its own abstractions.

### Findings

- **BLOCKER fixed:** the production `OPERATION_APPLIED` source is richer than the governed family. The implementation therefore exposes a dedicated projection that copies only the exact allowed operation token and returns `null` for unknown/malformed operations. Tests deliberately include row counts, before/after datasets and arbitrary metadata and prove none cross the boundary.
- **BLOCKER fixed:** consent/retention meaning could otherwise drift under stable IDs. The reviewed artifacts are canonicalized, hashed and compared with pinned SHA-256 values at module initialization. Drift without a version/digest update fails closed.
- **BLOCKER fixed:** the first-family registry is explicit rather than replacing the empty/default registry, preventing unrelated producers from becoming collection-enabled merely by importing governance.
- **DEFER:** this tranche does not yet subscribe the projection to the production event bus because RFC 0004 requires current server-issued capture authorization before an envelope may exist. Wiring a producer before that authority exists would create a misleading or temptingly queueable half-path.
- **DEFER:** durable consent, OIDC/JWT authentication, capture authorization, NDJSON ingestion, transactional SQLite replay/storage, restart durability, export, erasure and retention execution remain later PT4B sub-tranches.

## Disposition

**ADOPT only if exact-head typecheck, lint, focused tests, PT3B regressions, architecture checks and ordinary CI are green.**

This review does not promote PT4B itself to complete and makes no production-collection claim.
