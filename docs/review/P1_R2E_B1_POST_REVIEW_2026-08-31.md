# P1-R2E B1 Post-Implementation Adversarial Review — 31 August 2026

**Reviewed base:** `main@1ea2920` (B1 originally landed via merge `924a34e`, PR #598)  
**Promotion PR:** #607 (`stream-b/b1-promotion`)  
**Reviewer:** independent adversarial agent, distinct from the implementing agent  
**Scope:** B1 scientific/authority contract for source-authoritative `RELATIONSHIP_GRAPH`  
**Programme doc:** `docs/roadmap/P1_R2E_RELATIONSHIP_GRAPH.md`  
**Scientific authority:** `docs/rfcs/0002-source-relationship-graph-authority.md`

## Verdict

**PROMOTE, subject to #607 exact-head gates.** No BLOCKER findings remain in the bounded B1 scope. The production-path evidence rule (`AGENTS.md`) is satisfied for graph admission and the node/edge arbitration envelope: `MonetaHypothesisEngine.checkHardConstraints` is the rank-admission boundary on the production arbitration routes, and the Moneta-path falsifiers drive `MonetaHypothesisEngine.arbitrate` itself rather than only isolated helpers.

The independent review was performed from `main@1ea2920`; that base identity is not itself claimed as the exact head of #607. Exact-head promotion evidence belongs to #607's unchanged final head and must be green before merge. PR #598's historical gates establish the original B1 landing evidence; #607 must independently pass its current CI/CodeQL/architecture/approval/Q9 gates after the fix-forward changes in this promotion PR.

## Falsification attempts that failed

- **Admission bypass:** every reviewed production arbitration route funnels through `arbitrate`; the hard-constraint gate is keyed on candidate identity and runs before scoring; the pinned learned runtime cannot resurrect a disqualified candidate.
- **Envelope ordering:** authority/edge-count and node/edge envelope checks execute in `checkHardConstraints` before `scoreCandidateWithModel`, short-circuiting with `graph-authority-required` / `graph-resource-envelope` codes.
- **Provenance:** numeric bootstrap weights are unchanged; the graph admission semantics remain under the already-minted v5 treatment/provenance identity.
- **B2 leak:** #607 adds no WASM graph payload, worker graph transport or rendering cutover. `RELATIONSHIP_GRAPH` therefore remains unavailable as a governed production representation until B2/B3.
- **Inference fallback:** no correlation, k-NN or layout/proximity-derived edge authority is introduced by this tranche.
- **Strict authority validation:** the original B1 implementation duplicated the six authority-field checks inline and therefore ignored unknown runtime fields. #607 fixes that by routing the live engine hard-constraint check through `validateSourceRelationshipGraphAuthority`; the new engine-path falsifier proves an unknown field fails closed.
- **Source-edge signature binding:** #607 adds an executable `Dataset -> buildDatasetSignature -> arbitrate` fixture proving `edgeCount` follows the real `Dataset.edges` input in both positive and absent-edge cases.

## Findings and disposition

### B1-RF-01 — 2 MiB payload bound is vocabulary-only — DEFER B2

Only node/edge limits can be enforced before a graph payload exists. The 2 MiB payload ceiling is frozen contract vocabulary in B1, but B2 must enforce it at the resident Rust/WASM authority before returning READY. B1 must not claim runtime payload-byte enforcement.

### B1-RF-02 — unknown authority fields bypassed live engine validation — RESOLVED IN #607

The original engine reimplemented the authority predicate inline and silently ignored unknown fields. #607 routes the live hard-constraint path through `validateSourceRelationshipGraphAuthority` and adds a direct arbitration falsifier. B2 must preserve this fail-closed validation when it wires an actual production graph-requirements surface; it must not recreate a weaker parallel parser.

### B1-RF-03 — pre-existing silent edge-drop paths contradict REFUSE — DEFER B3/B4

`src/moneta/layouts/ForceDirected3D.ts`, `src/moneta/embodiment/TopologyLayoutEmbodiment.ts`, and `src/data/Dataset.ts` contain pre-existing presentation/dataset behaviors that can drop unresolved edges. They are not governed graph-payload authority today, but B3 must either remove/fail-close those paths for `RELATIONSHIP_GRAPH` or prove them unreachable once the governed payload is active. B4 must falsify missing-endpoint behavior through the product path.

### B1-RF-04 — source-edge binding was inspection-only — PARTIALLY RESOLVED IN #607 / DEFER RESIDENT PATH TO B2

#607 closes the hand-built-signature weakness at the control-plane layer with a real `Dataset -> buildDatasetSignature -> arbitrate` fixture. It does **not** prove the later resident execution route. B2 still needs a full production-path fixture through the actual `AtlasCore`/analytical Worker/resident Rust boundary so source edges, endpoint identity and resource bounds cannot diverge after arbitration.

## Non-blocking suggestions disposition

- Shared graph-authority validator in `checkHardConstraints`: **addressed in #607**.
- Single exported Moneta engine version constant: **addressed in #607**.
- Consumer-facing public API import for the B1 contract test: **addressed in #607**.
- Named no-correlation/k-NN/proximity fallback falsifier: still optional for B1; B2/B3 should add a production-path falsifier when governed graph execution becomes reachable.

## Final bounded claim

B1 may be `VERIFIED COMPLETE` only for the scientific/admission contract: explicit `SOURCE_EDGES` authority, declared directionality and identity policy, strict authority validation, source-edge presence, node/edge arbitration limits, ontology narrowing and versioned rank semantics. It does **not** claim the resident graph payload, 2 MiB runtime payload enforcement, endpoint resolution, production topology fidelity, row-free graph rendering or missing-endpoint product behavior.

**Disposition:** promote B1 after #607's exact unchanged head passes the required repository gates. B2 owns B1-RF-01, the resident-path remainder of B1-RF-04, and preservation of the strict validation invariant closed by B1-RF-02. B3/B4 own B1-RF-03.
