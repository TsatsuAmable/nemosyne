# Architecture Decision Records

Architecture Decision Records preserve the small set of durable choices that future contributors and agents must not continually rediscover from PR history.

## Rules

- Accepted ADRs are historical records. Do not rewrite their decision to match later code.
- If a decision changes, add a new ADR with `Supersedes:` and mark the earlier record `Superseded by:` in a follow-up metadata-only edit.
- ADRs describe **why a durable boundary exists**, not implementation status. `docs/ROADMAP.md` remains the status authority.
- A proposal that changes an accepted ADR should normally pass through `docs/RFC_PROCESS.md` before implementation.

## Format

Each ADR contains:

- Status
- Date
- Context
- Decision
- Consequences
- Supersedes / Superseded by, when applicable

## Accepted decisions

- [ADR-0001: Rust/WASM analytical authority](0001-rust-wasm-analytical-authority.md)
- [ADR-0002: Runtime-local handles and durable identity](0002-runtime-local-handles-and-durable-identity.md)
- [ADR-0003: Production-path evidence](0003-production-path-evidence.md)
- [ADR-0004: Executable configuration is authoritative for machine facts](0004-executable-configuration-authority.md)
- [ADR-0005: Production persistence authorities](0005-production-persistence-authorities.md)
- [ADR-0006: Moneta stability-certificate authority and scientific abstention](0006-moneta-stability-certificate-authority-and-abstention.md)
- [ADR-0007: Rust-issued trustworthy evidence receipts and live resolution authority](0007-trustworthy-evidence-receipt-authority.md)

- [ADR-0008: Explicit receipt-bearing package and investigation digest](0008-receipt-bearing-package-and-digest.md) — bounded RFC 0009 package/digest infrastructure; the format grants no replay authority.
- [ADR-0009: AP-INV Architecture Preflight for FM1 Question-Aware Moneta](0009-ap-inv-fm1-question-aware-investigation.md) — defines investigation graph boundaries and versioned intent.
- [ADR-0010: AP-SEARCH Architecture Preflight for FM7 Representation Search and Synthesis](0010-ap-search-representation-search-and-synthesis.md) — defines grammar authority, objective model, Pareto search, deterministic baseline, and MCR7 genome handoff.
