# FM1/FM2 exit qualification through the direct loop

**Status:** ACTIVE. **Risk tier:** high-risk posture (per #999: interaction grammar + representation-authority routing). Downgrades to verification-only if the battery passes with zero source changes.
**Depends on:** #999 plan, #1000/#1012/#1015 implementation, FM6-R6/FM7-R7 battery precedent. **Not a diary:** implementation evidence belongs in the PR.

## Goal

Prove the FM1/FM2 plan exits end-to-end through the NIL → aggregate → view-model → V4 direct-loop product path: two materially different intents yield appropriately different provenance-bearing direct decisions (or explicit no-change), and alternatives can be compared, branched, or deferred without losing provenance, with either branch replayable.

## Pre-implementation adversarial contract

- **Invariant:** exit clauses hold on the direct-loop path, not only the legacy stack; display never promotes; replay reproduces exact framing.
- **Authority/production path:** `InvestigationAggregate` direct compilation, `AtlasNilBindings` NIL verbs, `DirectLoopViewModels` getters, `EvidenceLedger`/V4 packaging. Rust/WASM stays analytical authority — tests use mock kernels headless, so no analytical-truth claims.
- **Failure modes:** battery exercises legacy stack while direct loop diverges; mocks mistaken for analytical proof; preview auto-promotes; intent replay drifts; defer drops lineage; V4 drops links; NIL semantic change needed (STOP for RFC/ADR per #999).
- **Falsifying evidence:** the battery below — every test routes NIL→aggregate; negative/refusal cases; legacy-vs-direct divergence watch via unmodified existing suites.
- **Non-goals:** VR rendering/comprehension (device lane); analytical validity from mocks; NIL semantic changes unless a gap is proven.

## Battery scope (`tests/fm1-fm2-exit-qualification-direct.test.ts`)

FM1: distinct-intent distinct-decision with intent identities in provenance; identical-intent replay identity; irrelevant-wording metamorphic identity; explicit no-change when requirements coincide.
FM2: NIL COMPARE preserves active decision; NIL PREFER branches with parent lineage + V4 capture; compare-only defer leaves decision/lineage/alternatives intact and replayable; preview non-mutating on the direct path; replay of either branch from packaged lineage.

## Exit / STOP

Exit when the battery is green with zero source changes (verification-only tranche) or with behavior fixes under this contract. STOP and escalate to RFC/ADR if a gap requires NIL semantic or authority-routing changes.
