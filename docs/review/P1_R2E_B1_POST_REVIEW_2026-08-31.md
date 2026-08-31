# P1-R2E B1 Post-Implementation Adversarial Review — 31 August 2026

**Reviewed head:** `main@1ea2920` (B1 landed via merge `924a34e`, PR #598)
**Reviewer:** independent adversarial agent, distinct from the implementing agent
**Scope:** B1 scientific/authority contract for source-authoritative `RELATIONSHIP_GRAPH`
**Programme doc:** `docs/roadmap/P1_R2E_RELATIONSHIP_GRAPH.md`
**Scientific authority:** `docs/rfcs/0002-source-relationship-graph-authority.md`

## Verdict

**PROMOTE.** No BLOCKER findings. All 11 B1 contract points survived falsification
attempts against the live production call graph. The production-path evidence rule
(`AGENTS.md`) is satisfied for the admission and node/edge envelope properties: the
enforcement boundary is `MonetaHypothesisEngine.checkHardConstraints`
(`src/moneta/representation/MonetaHypothesisEngine.ts:708-738`), which sits on every
production arbitration route (legacy MonetaFacts path, canonical V3 evidence path via
`EvidenceBackedMoneta`, and the learned runtime pass-through), and the Moneta-path
falsifiers drive `MonetaHypothesisEngine.arbitrate` itself rather than the isolated
helper.

Full default integration suite at the reviewed head: 384 files / 2228 tests green.
Exact-head CI/CodeQL/architecture/approval gates: green on PR #598 and on
`main@1ea2920`.

## Falsification attempts that failed

- **Admission bypass:** every production arbitration route funnels through
  `arbitrate`; the hard-constraint gate is keyed on candidate identity and runs before
  scoring; the pinned learned runtime cannot resurrect a disqualified candidate.
- **Envelope ordering:** authority/edge-count gate and node/edge envelope execute in
  `checkHardConstraints`, before `scoreCandidateWithModel`, short-circuiting with
  `graph-authority-required` / `graph-resource-envelope` codes.
- **Provenance:** numeric weights unchanged; the only rank-effective change is that
  GRAPH-family structure credit now requires explicit `SOURCE_EDGES` authority with
  `edgeCount > 0`. v5 provenance minting is consistent and asserted.
- **Test weakening:** all five pre-existing test edits are version bumps plus explicit
  authority injection; the one behavioral rename (`trace-lineage` to
  `relationship-discovery`) is semantically correct and preserves the GRAPH-family
  assertion.
- **B2 leak:** no wasm/, worker transport, or rendering changes in the merge;
  `graphAuthority` is set nowhere in `src/` outside contract files, so
  `RELATIONSHIP_GRAPH` is unconditionally disqualified in production today — the
  promised B1 exit.
- **Inference fallback:** no k-NN/correlation/layout-derived edge creation exists in
  `src/`; `edgeCount` is source-bound in both signature paths
  (`SignatureBuilder.ts:410`, `wasm/src/data/profile.rs:601`).

## DEFER findings (recorded; owned by B2/B3)

1. **2 MiB payload bound is vocabulary-only.** Only node/edge limits are enforced at
   arbitration; `payloadBytes` exists solely in the uncalled helper. RFC point 9
   assigns payload-byte enforcement to **B2**, which must enforce all three bounds at
   the Rust/WASM authority.
2. **Unknown-field rejection is not enforced on the live path.** The engine
   re-implements the authority check inline, checking only the six known fields and
   silently ignoring extras; `validateRepresentationRequirements` has zero production
   callers. Unreachable today (no production caller sets `graphAuthority`), but **B2**
   must route a production requirements surface through the shared validator (or have
   the engine call `validateSourceRelationshipGraphAuthority`) before wiring one.
3. **Silent edge-drop paths contradict REFUSE and remain live in the
   presentation/dataset layers** (pre-existing, assigned by the RFC to B2/B3):
   `src/moneta/layouts/ForceDirected3D.ts:38-43`,
   `src/moneta/embodiment/TopologyLayoutEmbodiment.ts:249-266`,
   `src/data/Dataset.ts:101-116`. B1's `missingEndpointPolicy: 'REFUSE'` is declared
   vocabulary, not runtime behavior. **B3/B4 falsifiers must cover these paths.**
4. **Signature inputs in the falsifiers are hand-built.** The property "edgeCount Moneta
   sees is always derived from source edges" is established by code reading, not an
   executable full-path test. **B2** payload falsifiers must include a full-path fixture
   (real `Dataset` with `edges` -> evidence -> `AtlasCore.arbitrateRepresentation*`).

## SUGGESTION findings (non-blocking)

1. Have `checkHardConstraints` call `validateSourceRelationshipGraphAuthority` instead
   of duplicating field checks inline (also closes DEFER-2).
2. Export one constant for the hardcoded engine version string before the next bump.
3. Confirm the intended "public API" barrel boundary for
   `tests/p1r-r2e-b1-public-api.test.ts` versus the app-level surface covered by
   `tests/rf062c-representation-surface.test.ts`.
4. Optionally add a named falsifier for the "no correlation/proximity fallback"
   property (currently established by inspection).

## Disposition

B1 is **`VERIFIED COMPLETE`** at its reviewed scope. B2 is unblocked and must carry
DEFER-1, DEFER-2 and DEFER-4 as contract obligations; B3 must carry DEFER-3.
