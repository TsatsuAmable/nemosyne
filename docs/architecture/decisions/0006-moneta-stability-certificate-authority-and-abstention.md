# ADR-0006: Moneta stability-certificate authority and scientific abstention

**Status:** Accepted
**Date:** 2026-09-14
**Supersedes:** none
**Superseded by:** none

## Context

RFC 0006 established that `p >= n` representation admission is a scientific and trust boundary, not an ordinary scoring input. A certificate-shaped object supplied by a candidate or caller cannot establish admissibility: the claim must bind the analytical evidence, exact arbitration context, trust root and governing policy, and it must be verified before synchronous Moneta arbitration.

The implementation tranche found no Rust/WASM artifact that authoritatively establishes candidate-specific effective dimensionality and no scientifically justified governing policy that can promote bounded perturbation evidence. Inventing either in TypeScript would violate analytical authority and scientific-honesty boundaries.

The pre-existing Moneta transport also represented scientific non-admissibility through the same `INFEASIBLE` path used for hard structural failure. That erased a distinction investigators and replay must retain.

## Decision

### Certificate and trust authority

`StabilityCertificateV1` is a closed, canonically SHA-256-hashed, Ed25519-signed envelope. It binds the exact dataset fingerprint, representation candidate and family, ordered effective-feature reference, perturbation protocol and run set, evidence artifact and run count, governing policy, analytical/runtime/model identity, and replay scope.

Ed25519 encoding, signing and verification primitives are shared with signed model-deployment manifests. A single generic trusted-key registry owns key identity and active/retired status for certificate verification. The verifier resolves keys from that registry; verification call sites cannot supply a public key.

The asynchronous verifier alone creates `VerifiedStabilityAdmissionClaimV1`. The claim is a frozen runtime-local capability, so a serialized, cloned or caller-constructed lookalike has no authority. Moneta validates its dataset, candidate, family and runtime binding again at the synchronous admission gate.

### Governing policy and effective dimensionality

The policy registry accepts immutable policy identity/version/digest records. This tranche exposes only `VERIFIED_NON_PROMOTABLE`; it accepts no caller callback, threshold or promotable disposition.

Candidate-specific effective dimensionality remains a closed `RUST_WASM_EFFECTIVE_FEATURE_REFERENCE` contract with `REFERENCE_ONLY` status. It is not a Rust validation receipt and cannot promote. Dataset-wide `columnCount` therefore remains the authoritative conservative `p` used by the production gate.

A future promotable path requires both a real Rust/WASM authority artifact and an accepted scientifically justified policy. It must not be enabled by widening the current TypeScript union or changing the current false promotion gate in isolation.

### Decision semantics

- `ELIGIBLE` production decisions continue to use the existing decisive, ambiguous and underdetermined ranking states after structural and scientific admission.
- `ABSTAIN` means at least one representation is structurally feasible, but current scientific evidence or authority cannot promote it. Ranked near-misses remain inspectable, but no chosen candidate, active spatial strategy, representation graph or rendered topology is produced.
- `INFEASIBLE` remains the outcome for structural, resource or representation hard-constraint failure.
- `INVALID` remains the certificate-verifier outcome for malformed, contradictory, tampered or context-mismatched evidence.

Learned utility ranking has no authority to upgrade `ABSTAIN`. Investigator-facing assessment and epistemic state present abstention separately from NIL/infeasibility.

### Persistence and replay

Session and portable-investigation restore preserve the stored decision disposition and provenance. Restore does not invoke certificate verification or Moneta arbitration, so a newly available certificate cannot silently upgrade history. Explicit re-adjudication is not introduced by this tranche.

Certificates and verifier capabilities are not added to the `.nemosyne` package format. A portable decision may record the digest and non-promotable disposition of a certificate that was considered, but runtime-local verification authority is never serialized.

## Consequences

1. Signed and exact-context evidence can be distinguished from unverified input without being mistaken for scientific promotion authority.
2. Cross-dataset, cross-candidate, effective-feature, protocol, evidence, run-count, policy, runtime/model and replay substitution fail closed before a claim reaches Moneta.
3. Unknown and retired signing keys fail closed; no fallback key or policy is selected.
4. `p >= n` remains non-promotable until separate Rust/WASM and governing-policy authorities exist.
5. Existing historical NIL/`INFEASIBLE` outcomes are not reinterpreted as `ABSTAIN`.
6. The current verifier has no durable verification cache. If caching is later introduced, cache identity must include certificate digest, trust/key lifecycle version, policy identity and the full arbitration/replay context.

## Evidence

The RFC 0006 implementation tests exercise the certificate verifier, adversarial context binding, key lifecycle, non-promotable policy, runtime-local claim authenticity, conservative dimensionality, production admission semantics, rendering/graph guards and session restore. Mutation checks demonstrate that removing dataset binding or bypassing non-promotable admission causes the focused suite to fail.

Implementation status and any future promotion-authority programme remain governed by `docs/ROADMAP.md`.
