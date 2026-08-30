# B-U2 — Journey completeness (counterevidence, representation compare/revert, freeze wiring, status legibility, onboarding)

**Date:** 2026-08-29
**Stream:** B (Product UX) fix-forward wave after B4/B5 + B-U1
**Base expectation:** `main` after #545 (B-U1) and #546 (S1) merge
**Status:** PLANNED — pre-implementation adversarial contract (no code yet)

## Purpose

Close the remaining VERIFIED journey-completeness BLOCKERs from the adversarial UI review that were deliberately deferred out of B4/B5/B-U1 scope. This checkpoint makes the canonical journeys walkable through the real production path without requiring hidden panels, memorised gestures, or dead controls.

## Scope

This checkpoint resolves four verified BLOCKERs:

1. **Counterevidence / constraints are not discoverable.** The only counterevidence surface is the hidden `RecommendationPanel` (constraints tab), summonable only via wheel `STUDY → Guidance`. Journey B ("view counterevidence/constraints") is not walkable in the normal path.
2. **No representation comparison, no representation revert, remediation has no preview/commit distinction.** `Compare` is a data-group op; `revert` is data-op undo/reset only; `_applyRemediation` re-arbitrates and commits immediately (`World.ts:1307-1340`). Journey B compare/accept/reject/revert is not walkable.
3. **Freeze/archive is broken through the UI.** `_freezeInvestigation` (`World.ts:1496-1501`) only lists archives and shows the vault panel; it never calls `VaultArchiveStore.freezeInvestigation` (`src/session/VaultArchiveStore.ts:43`), whose only caller is a unit test. Portal-B restore therefore always warns "no frozen archives". Journey D freeze/return is not walkable.
4. **Status/epistemic state is not legible.** `StatusStripController.formatStripText()` has no production caller; `semanticEmbodimentStatus = 'REFUSED'|'INVALID'` is written only to `group.userData`, so a refused/empty palace has no visible explanation. GuidedTour is stale (references retired VRMenu + nonexistent `ops` wheel category; restarts every boot).

## Pre-implementation adversarial contract

### 1. Invariant

For each journey, the normal production path (desktop DOM + XR wheel/contextual surface) lets an investigator complete the step with investigator vocabulary, no hidden panel, no memorised gesture, and no dead control, while (a) never inventing analytical truth, (b) never creating a second command/analytical authority, and (c) keeping refusal/unknown states explicit.

### 2. Authority and production path

- **Counterevidence:** `RecommendationPanel` (constraints/alternatives) is the existing analytical-constraint surface; the fix makes it reachable and renames its presentation from hidden task panel to the canonical constraints locus without computing anything new. `World.generateGuidance` / `AtlasCore.generateRecommendation` remain the authority for what constraints exist.
- **Representation compare/revert:** `LivePreview` (`src/vr/interactions/LivePreview.ts`) already previews data ops; the new surface must reuse existing re-arbitration (`RepresentationState` / `World._applyRemediation`) with a preview→commit distinction, NOT a new Moneta/analytical path. Moneta remains the authority for decisions.
- **Freeze:** `VaultArchiveStore.freezeInvestigation` is the authoritative archive writer; the fix wires `World._freezeInvestigation` → `archiveStore.freezeInvestigation` (real snapshot write) then `vaultPanel.setArchives`. Restore already routes through `archiveStore.loadArchive`.
- **Status/onboarding:** `StatusStripController` is the existing (unrendered) status model; the fix renders it into the analyst anchor. `GuidedTour`/`DefaultTour` are the onboarding authority; the fix corrects stale targets/vocabulary and completion persistence.

### 3. Failure modes

- **Decorative counterevidence:** a new surface that shows hardcoded or TS-invented constraints instead of consuming `AtlasCore`/`RecommendationPanel` evidence.
- **Second analytical authority:** a representation compare/revert path that re-runs Moneta arbitration in the UI or reimplements remediation.
- **Freeze writes but never restores, or restores silently corrupt:** archive write path diverges from the read path; failed freeze leaves no explicit state.
- **Preview/commit collapse:** preview toggle that is actually an immediate commit (the exact defect being fixed) or a commit that is not reversible.
- **Status strip becomes chrome that competes with data** instead of a subdued grounding line.
- **Tour fix regresses discovery** or teaches the retired vocabulary again.
- **Production-path evidence laundering:** unit tests on helpers (e.g. testing `VaultArchiveStore` directly) treated as proof that the UI journey works.

### 4. Falsifying evidence (cheapest authoritative checks)

- A production-path Playwright smoke drives Journey B and D steps via the actual DOM/wheel controls and asserts the surface/state changes at each step (constraints visible; representation previewed vs committed; archive created; archive restored; status line legible).
- Focused tests assert: `_freezeInvestigation` invokes `archiveStore.freezeInvestigation` (spy on the real store) and the vault panel lists the frozen archive; a refused/empty semantic payload renders an explicit in-world explanation (not an empty palace with no state); `StatusStripController` is added to the analyst anchor and updated; `DefaultTour` contains no reference to `VRMenu`, `ops`, or Load-Test panel, and completion persists across boot.
- Regression: existing B3/B4/B5/UV0 smoke evidence stays green (evidence classes kept distinct).

### 5. Non-goals / dependencies

- NO new analytical computation, no Moneta/representation math change, no Rust/WASM change.
- NO B-U1 command-authority work (merged #545) — reuse the single dispatcher.
- NO B-V1 visual-token restyle (separate later checkpoint).
- NO P1-UV3 epistemic-object redesign (TechnoCore/IceVault/portal state encoding) — out of scope here except where StatusStrip legibility overlaps.
- No `ContextualTaskSurface.ts`/UV0-evidence file changes unless a journey requires it (justify if touched).
- No physical Quest qualification claims.

## File ownership (draft)

| Surface | Files | Owner seam |
|---|---|---|
| Counterevidence reachable | `RecommendationPanel.ts`, `WheelMenuBuilder.ts` (STUDY→Guidance already exists; make constraints reachable from contextual locus), `WorldUIManager.ts` (role/budget) | Stream B |
| Representation compare/revert + preview/commit | `LivePreview.ts`, `World.ts` (`_applyRemediation` seam), new small preview surface | Stream B |
| Freeze wiring | `World.ts` (`_freezeInvestigation`), `VaultArchiveStore.ts` (verify write path), `VaultPanel.ts` | Stream B |
| Status strip | `StatusStripController.ts`, `WorldUIManager.ts`, `World.ts` (update registration) | Stream B |
| Tour fix | `DefaultTour.ts`, `GuidedTourController.ts`, `WorldSessionController.ts` (completion persist) | Stream B |

## Stream-rail collisions

- `World.ts` is collision-sensitive; changes limited to the named seams (`_freezeInvestigation`, `_applyRemediation` callers, status-strip registration), justified in the PR.
- `package.json`/`vite.config.ts`/`docs/ROADMAP.md` untouched.
- One open Stream B PR at a time: B-U2 starts only after #545 merges and #546 is resolved/merged.

## Exit gate

B-U2 is complete when Journey B (challenge → counterevidence → representation compare → accept/reject/revert) and Journey D (freeze → continue → restore → export → replay) are demonstrably walkable through the real production path in browser smoke evidence, freeze actually persists and restores, refused states are explicit in-world, and the tour teaches current vocabulary with persisted completion. Then B-V1 (visual cohesion) is the next checkpoint.