# RFC 0010 — Moneta semantic snapshot and Forma admission identity

**Status:** accepted<br>
**Date:** 3 October 2026<br>
**Reviewed base:** `8a5be7fdcb5b3c23ce11ea8cfd3db58f97b2e597`<br>
**Decision specification:** [A27-0 authority/version decision](../architecture/A27_0_AUTHORITY_VERSION_DECISION.md).<br>
**Dependencies:** RFC 0007, RFC 0009, ADR 0009 and the Moneta Evidence Protocol. ROADMAP owns execution order.

**Acceptance:** 3 October 2026 — project owner explicitly reviewed and accepted the A27-0 decision and RFC in the Codex task for [PR #927](https://github.com/TsatsuAmable/nemosyne/pull/927), instructing: “reviewed and accpted. Update the records so that it is implementation ready”. Acceptance applies to the contracts reviewed at `4cc007827e9103d0e8efd2ddcef8e025e5372dd6`; this update records that decision without changing the technical contract. Implementation starts from fresh main after this PR is integrated and remains subject to the lane prerequisites and evidence gates.

> **Subsequent proposal:** [RFC 0011](0011-dual-epistemic-embodiment-and-preservation.md) addresses dual epistemic purposes introduced by PR #929. This RFC remains accepted for its reviewed scope; the amendment is not yet accepted. Consult ROADMAP before freezing affected contracts.

## Context

The existing semantic graph requires a representation decision ID. It cannot supply presentation-independent truth identity without a changed contract. RepresentationGraph V1 has loose encoding/policy strings, and parsed spatial plans are not evidence of admission. Current V3 persistence commits governed receipts but not the future context/obligation/Forma closure. Human-study execution also needs purpose-scoped authorization distinct from production qualification.

A27-0 §2 records the source evidence. This RFC is an extension of accepted authorities, not a replacement analytical, evidence or NIL authority. Explicit project-owner acceptance is recorded above. The new trust/public-format contracts are authorized for implementation under the A27-0 handoff; acceptance does not bypass roadmap dependencies, exclusive leases or production-path verification.

## Decision requested

Accepted on 3 October 2026: the following bounded contract, specified in A27-0 §§3–11:

1. New immutable `SemanticSnapshotV1` projects Rust analytical outputs and exact governed evidence. Its domain-separated hash includes analytical content, methods, receipt/profile/policy identity, vocabulary, availability, approximation and limitations. Decision, perspective, model and device metadata are excluded. Keep SemanticEmbodimentGraphV1 unchanged for legacy compatibility.
2. Investigation owns committed context/perspective with stable DAG node IDs. Moneta derives fixed obligations from snapshot/context/pinned policy before candidate generation. Persist obligations inside the decision, not a separate mutable authority.
3. RepresentationGraph **2.0.0** makes typed semantic bindings and policy references mandatory. A single Forma admission/compiler delegates scientific checks to their owners, verifies fixed meaning and returns an immutable purpose-scoped result or typed refusal. Preserve V1 through explicit adapters, not provenance-string waivers.
4. Distinguish analytical disposition, perceptual qualification and permitted use (`PRODUCTION`, `STUDY_ONLY`, `REFUSED`). Unvalidated or contraindicated perceptual controls execute only under exact frozen study authorization, with valid analytical inputs and intact mechanical obligations. Invalid/abstained analytical claims cannot enter through a study bypass. Study success cannot promote a mapping.
5. Adopt package **V4**, `sha256-canonical-investigation-v4`, and reserved `investigation/forma.json` with a closed version-1 envelope. Commit exact semantic snapshot/context/DAG/obligation/proposal/knowledge/result/plan artifacts, versions, purpose and member digests. Reuse existing session custody and receipt bytes. Keep V1–V3 and their digest algorithms unchanged. First V4 scope remains one final analytical dataset/kernel context; historical nodes without captured states are inspectable, not executable.
6. Exact replay restores recorded results without mutable retrieval/inference/synthesis. Current execution eligibility is separately checked. Changed mappings/variants/backend semantics are explicit derived adaptations; unavailable or unsafe historical versions refuse. A self-consistent archive does not authenticate analytical issuance, study authorization or qualification.
7. KB0 is a pinned local manifest over closed transform/channel/recipe/qualification/contraindication artifacts and existing custody references. No service, model, evidence copy or new mutable knowledge authority.

New Forma context/binding/purpose identity also requires a versioned study-freeze extension before study execution. Runtime adoption binds the verified result to the current context activation epoch and runtime-local dataset registration; serialized results cannot mint capabilities. Changing context A→B→A must revoke pending A work.

## Options considered

- **Retain decision-coupled graph identity as upstream truth:** fewer types, but identical analytical meaning acquires new identity on presentation changes. Rejected.
- **Silently extend V1/V3 with optional mandatory-in-practice fields:** smaller migration, but older readers can ignore new authority and historical digest meanings drift. Rejected.
- **Independent services/registries for each conceptual record:** increases persistence and write authorities without a demonstrated capability. Rejected.
- **Versioned immutable values under existing owners:** selected. Requires explicit adapters and refusal on missing historical artifacts, while preserving old contracts.

## Consequences

- No new estimator or transfer of analytical/scientific authority; normalization cannot scan rows or infer absent semantics.
- Extra bounded artifact commitments and retained plans cost storage; share references within the existing archive rather than copy evidence per binding.
- New readers need explicit legacy/version dispatch; malformed V4 cannot fall back to V3. Adding Forma consumers must not retroactively require them in V3 archives.
- Exact historical records may be inspectable but not currently executable because of retraction, missing dependencies, unsafe old implementations, device mismatch or study restrictions.
- Human recoverability remains an empirical scoped claim; mechanical coverage alone cannot qualify production mappings.
- Source compatibility adapters retain existing graph/spatial/detail behavior. No production code, accepted ADR or downstream completion claim is delivered by this RFC.

## Verification plan

A27-0 §12 defines F01–F14 and §14 assigns non-overlapping contract slices followed by serialized production integration. Required evidence includes real analytical port → snapshot identity metamorphisms, candidate/profile weakening refusal, study-to-production leakage attempts, stale-context/ABA adoption, mandatory-channel failure, and real export → pack → clean-room replay → adoption with artifact substitution/downgrade/partial-failure attacks. Each refusal campaign includes an admitted positive control. Legacy digest fixtures must remain exact. Human/device claims additionally need their applicable governed evidence; fixture answers do not satisfy them.

Documentation checks validate this accepted decision's integrity, not the future runtime properties. The acceptance gate is satisfied; production-path evidence remains required.

## Resulting ADR

None yet. After implementation, record an immutable ADR linking this RFC and the implemented boundaries. ADR 0009 and RFC 0007/0009 remain in force meanwhile.
