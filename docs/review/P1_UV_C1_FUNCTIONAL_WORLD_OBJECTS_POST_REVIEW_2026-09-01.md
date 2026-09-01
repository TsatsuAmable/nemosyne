# P1-UV C1 Functional World Objects — post-implementation adversarial review

**Date:** 2026-09-01  
**Base:** `main@232d9524158ab3b7982f580c9afa7c2741f69041` (#612 merged, Stream B Relationship Graph V1 STOP)  
**PR:** #613 `P1-UV C1: make persistent world objects functional`  
**Risk:** high — persistent spatial UI, investigator-visible epistemic semantics, navigation/recovery state  
**Disposition:** **ADOPT / C1 BOUNDED REVIEW CLOSED**, subject to the unchanged final PR head passing ordinary CI, CodeQL, architecture policy and the dedicated C1 production-browser evidence workflow.

## Reviewed invariant

Persistent C1 world objects may project, inspect or navigate authoritative investigator state, but may not become a second analytical or epistemic authority.

The review re-checked the production composition path, focused falsifiers, architecture policy and retained browser evidence against the pre-implementation contract in `review-plans/P1_UV_C1_FUNCTIONAL_WORLD_OBJECTS_PRE_REVIEW_2026-09-01.md`.

## What landed

### TechnoCore

- `TechnoCoreNode` accepts the exact categorical Moneta representation state (`DECISIVE | AMBIGUOUS | UNDERDETERMINED | INFEASIBLE`, plus presentation-only `PENDING`).
- The state is communicated by non-numeric ring/core geometry and pose as well as colour. No score is translated into a faux probability/confidence gauge.
- On the configured production path, selecting TechnoCore opens the existing RecommendationPanel guidance surface instead of cycling the statistical/anomaly lens.
- The historical lens-cycle path remains only as an isolated compatibility fallback when no C1 composition hook is installed.
- Preview/committed identity and decision ID are projected from the existing Moneta decision objects rather than invented by C1.

### Evidence Vault and Farcaster portals

- Vault state follows the existing `VaultPanel` archive list and wraps the existing freeze/restore/delete callbacks only to refresh presentation state.
- Restore presentation exposes a bounded `restoring` state without replacing `VaultArchiveStore` as authority.
- The Overview Farcaster advertises navigation-only overview semantics.
- The Saved Investigation Farcaster advertises availability from the actual archive count and refuses the fiction of an available destination when no archive exists.
- C1 does not add analytical operations to portal traversal.

### Memory Palace

- `MemoryPalaceWorldView` is a bounded presentation projection over explicit ResearchContext, Atlas observations/findings and typed InvestigationGraph records.
- Maximum visible epistemic objects are capped at 48 and contextual relationship lines at 24.
- Relationships are drawn only when an explicit InvestigationGraph edge connects two currently projected source IDs and is incident to the selected object.
- `branch_point` presentation markers are derived only from explicit `branches_from` edge identity; proximity, colour, layout and recommendation rank cannot create them.
- Unsupported InvestigationGraph node kinds remain absent rather than being promoted into stronger epistemic claims.
- Selection uses durable source IDs (or deterministic IDs derived from an explicit source edge for the branch marker), never transient mesh indexes.
- The existing `MemoryPalaceController` authoring path remains deliberately offline. Its placeholder provenance, random identifiers and incomplete interaction lifecycle are not promoted by C1.

## Production evidence reviewed

The dedicated production-browser artifact from run `33481738970` was inspected directly. It is bound to source/checkout head `81d224bb3d9e815b3beda3936586e43998926265`, production bundle SHA-256 `53c0037fa40e681f2bb92617dff65faa3774e24fc758d7d30bc750d590b10b89`, and WASM SHA-256 `7ffc5211dc63e86ceab81f42ee33292611ab757f868826388be4e6c8a3fba483`.

That run demonstrated through the real bootstrap/product path:

- an initial `AMBIGUOUS` TechnoCore state bound to decision `decision_MATRIX_FIELD_2dd7b43d`;
- TechnoCore selection opened representation guidance while `lensEnabled` remained false and `analysisResultCount` remained zero;
- a real recorded observation appeared in the Memory Palace under the exact returned observation ID;
- a real archive freeze changed Vault from `empty`/0 to `frozen`/1 and changed the saved-investigation portal from `unavailable` to `available`;
- the evidence classified physical Quest evidence as false and made no analytical-authority or inferred-relationship claim.

The dedicated C1 workflow also passed again on implementation head `4e491e2839de637345a5f8b08567e4fe812e6aed` after the stale post-M4 structural assertion was repaired. Because this review/roadmap closure changes the PR head, promotion still requires the same evidence to succeed again on the final unchanged head.

## Adversarial findings and fix-forward

### C1-RF-01 — evidence diagnostics initially violated RF-062 composition direction

**Finding:** the first diagnostics helper imported `World` from a feature module, creating `src/app/c1ProductEvidenceDiagnostics.ts -> src/vr/World.ts` and failing the architecture pilot.

**Fix:** replace the `World` dependency with the minimum structural evidence-host contract. Architecture policy subsequently passed. No RF-062 exemption or threshold weakening was introduced.

**Disposition:** CLOSED.

### C1-RF-02 — stale source-spelling assertion blocked the coverage shard

**Finding:** `post-m4-fix-forward.test.ts` required the literal string `queueMicrotask(handler)`. C1 correctly inserted presentation synchronization into the same deferred microtask before invoking `handler`, so the old test failed despite preserving the original semantic invariant.

**Fix:** assert the invariant instead: dataset context remains deferred until World has completed the logical dataset transition, and the deferred callback still invokes `handler()` after any presentation-only synchronization.

**Disposition:** CLOSED.

### C1-RF-03 — persistent-authoring temptation around dormant Memory Palace machinery

**Finding:** the repository already contains a richer Memory Palace authoring controller, but it still contains placeholder provenance/random identity/incomplete interaction behavior. Activating it would create a second epistemic authority and violate the C1 contract.

**Fix:** C1 uses a separate read-only bounded projection and does not instantiate the dormant authoring controller.

**Disposition:** CLOSED FOR C1. Any future authoring activation requires its own production-safe identity/provenance/lifecycle contract and review.

### C1-RF-04 — visual hierarchy is functional but not yet converged

**Finding:** retained screenshots prove that the landmarks and guidance surfaces are visible, but they also show that legacy world scale, landmark salience and panel composition can still compete with the dataset. The Memory Palace is sparse, yet overall scene hierarchy is not the final sparse/data-first product treatment.

**Disposition:** NOT A C1 AUTHORITY/FUNCTION BLOCKER. Carry forward into C2 investigation-state legibility and C4 visible-product convergence. Do not use C1 evidence to claim final information hierarchy, desktop/XR parity, comfort, or physical Quest fitness.

## Falsifier disposition

| Falsifier | Result |
| --- | --- |
| Exact categorical TechnoCore state, no numeric reclassification | PASS |
| TechnoCore selection opens guidance without lens/analysis mutation | PASS |
| Vault state follows real archive lifecycle | PASS |
| Saved portal availability follows real archive availability | PASS |
| Memory Palace renders only explicit supported records | PASS |
| Relationship lines are explicit-edge and focus/context driven | PASS |
| Object/relationship presentation is bounded | PASS |
| Epistemic selection is source-identity based | PASS |
| Dormant Memory Palace authoring controller remains offline | PASS |
| Production browser path exercises visible state changes | PASS |
| RF-062 architecture boundary remains enforced | PASS after fix-forward |
| Final exact-head CI/CodeQL/C1 evidence | REQUIRED PROMOTION CONDITION |

## Deliberate non-claims

C1 does **not** establish:

- final visual hierarchy or salience quality;
- complete investigation-state legibility;
- complete desktop/controller/ray/direct-touch parity;
- physical Quest comfort, readability or interaction qualification;
- a production-safe Memory Palace authoring model;
- inferred contradiction, causality, support, evidence strength or scientific confidence;
- a new persistence schema or new analytical computation.

Those remain owned by later Stream C/D checkpoints.

## Closure

C1 satisfies its bounded architectural/product-function objective: the persistent TechnoCore, Vault, Farcaster and Memory Palace surfaces now have investigator-facing production semantics instead of being merely ambient geometry, while analytical and epistemic authority stays upstream.

**Review disposition: ADOPT.** Merge #613 only after the unchanged final head passes the required exact-head gates. After merge and fresh-main sync, the next forward checkpoint is **C2 — investigation-state legibility**.
