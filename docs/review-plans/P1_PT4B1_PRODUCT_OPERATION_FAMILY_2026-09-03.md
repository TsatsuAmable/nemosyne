# P1-PT4B1 Product Operation Family Pre-Implementation Review

**Date:** 3 September 2026  
**Base:** `main@e8fa724ec2b92fd50ebb8b653900d9d7ec9dc129`  
**Programme:** P1-PT4B  
**Risk:** high, because this activates the first production-governed event family and fixes privacy/authorization semantics consumed by the later data plane.

## Invariant

The first PT4B family is exactly `product.operation-applied.v1`. It may represent only the successful operation name from the post-commit production `OPERATION_APPLIED` event. It must not carry datasets, row counts, investigation/discovery references, arbitrary source metadata or a second analytical claim. Its consent, retention and authority meaning is pinned to immutable reviewed artifacts and must fail closed if those artifacts drift without a version/digest change.

## Authority and production path

`src/governance` owns the closed family definition and projection. The authoritative source remains the successful production `OPERATION_APPLIED` event emitted only after Atlas/Rust operation commit. This tranche deliberately does not yet authorize capture, build envelopes, issue consent receipts, persist events or add a network endpoint. Later PT4B service/client tranches must consume this registry and projection rather than re-declare the family.

## Failure modes attacked

1. Forwarding the rich `OPERATION_APPLIED` object and leaking row counts or before/after datasets.
2. Registering more than the single RFC-authorized family.
3. Permitting investigation/discovery/dataset identity on a product-interaction event.
4. Dropping required application/deployment/UI/platform runtime provenance or accidentally requiring analytical-runtime identities that RFC 0004 forbids for this family.
5. Treating the existing telemetry boolean as consent.
6. Letting consent or retention prose change under a stable version/digest.
7. Silently accepting a new operation token not reviewed by RFC 0004.
8. Creating a default global registry that activates production collection for unrelated producers.

## Cheapest falsifying evidence

- Registry contains exactly one family with exact purpose, class, mode, identity/runtime requirements and lifecycle coordinates.
- Projection tests feed rich source objects and prove the output contains exactly `operation`.
- Every allowed RFC operation projects; unknown/case-mutated/malformed values refuse.
- Pinned immutable-reference digest tests make artifact drift fail immediately.
- Existing PT3B registry/admission tests remain green.
- Typecheck, lint, architecture and ordinary exact-head CI remain authoritative before promotion.

## Non-goals and dependencies

This is PT4B1, not the complete PT4B production path. It makes no claim for durable consent, OIDC/JWT authentication, capture authorization, NDJSON ingestion, SQLite replay/storage, restart durability, export, erasure, retention execution or deployed collection. Those remain subsequent PT4B sub-tranches and must not be inferred from this family activation.
