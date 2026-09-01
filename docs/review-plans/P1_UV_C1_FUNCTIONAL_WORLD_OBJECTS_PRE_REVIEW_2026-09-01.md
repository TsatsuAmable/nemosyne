# P1-UV C1 Functional World Objects — pre-implementation adversarial review

**Date:** 2026-09-01  
**Base:** `main@232d9524158ab3b7982f580c9afa7c2741f69041` (#612 merged)  
**Branch:** `stream-c/c1-functional-world-objects`  
**Risk:** high — persistent spatial UI, investigator-visible epistemic semantics, navigation/recovery state

## Invariant

Every persistent C1 world object must earn its volume by projecting or navigating an existing authoritative investigator state. A renderer, landmark or UI adapter may change presentation and interaction affordance, but it must not infer scientific or epistemic facts from geometry, colour, proximity, ranking heuristics or presentation state.

In particular:

- TechnoCore presents the exact Moneta investigator outcome (`DECISIVE | AMBIGUOUS | UNDERDETERMINED | INFEASIBLE`) and opens the existing governed guidance/alternatives/constraints/remediation surface. Its visual state is categorical, not statistical confidence.
- Evidence Vault presents the real archive lifecycle and delegates freeze/restore/export/delete to the existing `VaultArchiveStore` path.
- Farcaster portals expose their semantic destination before traversal and remain navigation only; they do not perform ordinary analytical mutation.
- Memory Palace presentation may embody only explicit Atlas/investigation-graph entities and relationships. Missing contradictions, hypotheses, evidence links or branches remain absent rather than being invented from visual appearance.

## Authority and production path

Analytical and epistemic truth remains upstream:

`Rust/WASM + Moneta + Atlas/EvidenceLedger/InvestigationGraph + VaultArchiveStore`

C1 consumes that truth through the production composition root:

`bootstrapApp -> World facade/read-only authoritative state -> C1 presentation projection -> TechnoCore/Vault/Portal/Memory-Palace Three.js surfaces`

TechnoCore interaction routes to the existing `RecommendationPanel`, which already exposes guidance, alternatives, constraints and remediation and carries the heuristic-rank disclaimer. Statistical-lens commands remain available through the canonical intent vocabulary rather than being hidden inside the TechnoCore landmark.

Memory Palace creation must not activate the dormant `MemoryPalaceController` as currently written. That controller contains placeholder provenance, random IDs and incomplete raycast/update behavior. C1 may project existing authoritative Atlas/InvestigationGraph records but may not silently promote those dormant creation helpers to production authority.

## Primary failure modes

1. A colour/pulse/intensity scale is read as confidence or probability even though Moneta exposes categorical decision state and uncalibrated heuristic rank.
2. Selecting TechnoCore performs an analytical/lens mutation instead of inspecting representation reasoning.
3. Vault appears frozen when no archive exists, remains visually empty after a real freeze, or advertises restore while the selected/latest archive is absent.
4. Portal preview and traversal disagree, or a portal applies an analysis operation while claiming semantic navigation.
5. Memory Palace invents a contradiction/support relation from a rejected recommendation, layout, colour, rank or proximity.
6. Dormant Memory Palace placeholder provenance (`unknown`) or `Math.random()` identifiers become live persisted identity.
7. Epistemic objects or relationship lines grow without a bounded presentation envelope and crowd out the data.
8. Presentation identity is tied to transient mesh indexes so representation replacement/replay silently changes the epistemic referent.
9. A unit-test-only helper passes while the real bootstrap/product path still shows decorative landmarks.

## Falsifying evidence

The implementation is disproved if any of these checks fail:

- exact decision-state identity reaches TechnoCore without numerical reclassification;
- TechnoCore selection opens guidance and does not dispatch anomaly/statistical-lens mutation on the production-configured path;
- Vault state follows the real archive list and operation lifecycle;
- saved-investigation portal preview reflects actual archive availability and semantic target identity;
- Memory Palace projection renders only supported Atlas/InvestigationGraph node/edge kinds and omits unsupported/invented relationships;
- epistemic rendering is explicitly bounded and relationship visibility is focus/context driven rather than permanent graph clutter;
- persistent epistemic selection uses durable source IDs;
- production-build browser evidence demonstrates visible state changes through the real bootstrap path;
- ordinary CI/typecheck/lint/architecture checks remain green.

## Non-goals / dependencies

- no new Rust/WASM analysis, Moneta treatment, ranking rule or scientific inference;
- no new `.nemosyne` persistence schema in C1;
- no inferred contradiction/community/causal/evidence claim;
- no replacement of the existing RecommendationPanel, VaultArchiveStore, Farcaster semantic-target contract or Stream-A semantic drill-down contract;
- no physical-Quest comfort/legibility claim; that remains later P1-U9/D evidence;
- no activation of dormant Memory Palace authoring helpers until their identity/provenance/lifecycle contract is separately made production-safe.

## Initial disposition

**ADOPT, bounded.** Reuse the already-functional guidance, archive and semantic-navigation machinery and add a thin presentation projection. For Memory Palace, project authoritative existing state only. Do not turn the dormant controller into a second source of epistemic truth.