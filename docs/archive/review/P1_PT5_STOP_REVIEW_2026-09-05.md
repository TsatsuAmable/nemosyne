# P1-PT5 STOP Review — Catalogue, Investigation Journey and UX Convergence

**Date:** 5 September 2026  
**Status:** VERIFIED COMPLETE / STOP FOR THE BOUNDED SOFTWARE-PATH PT5 MISSION  
**Integration base reviewed:** `main@a69f0fe62e3e77236947499311e6b31a04b23af0`

## Decision

**STOP PT5's bounded software implementation mission and advance the forward implementation stream to PT6.**

PT5 required Nemosyne to consume the governed `nemosyne-data` catalogue, make ordinary dataset loading and semantic correction usable in XR, converge desktop/XR investigation actions on NIL, make the Notice -> Question -> Hypothesis -> Investigation -> Understanding -> Validation -> Discovery lifecycle usable and observable, make investigations saveable/reopenable/recoverable, remove desktop-modal dependencies from the normal XR journey, and begin the live UX/fix-forward loop.

Those software-path requirements are now implemented and independently exercised. This STOP decision deliberately does **not** claim that physical-headset comfort, reachability, target acquisition, typing ergonomics, hand/controller tracking, fatigue, or human discovery benefit are complete or validated. Those remain empirical product/device evidence under QV5/QV6 and repeated UX refinement.

## Requirement-by-requirement evidence

### 1. Governed catalogue ingestion and immutable dataset identity

PT5A / #642 reconnects the ordinary product loader to the canonical governed `nemosyne-data` catalogue and pins the corpus revision/schema. It rejects mutable or non-governed catalogue entries, malformed measurement metadata, unsafe paths, size/row drift, byte-count drift and SHA-256 drift before publication of the loaded dataset. Product and qualification clients consume the same corpus contract, while Atlas/Rust remains the parser, topology and analytical authority.

### 2. XR browse/load/schema and semantic-correction parity

PT5B / #643 adds the in-headset Dataset Library through the same governed loader rather than creating an XR-specific parser or dataset authority. Governed datasets can be refreshed, browsed and opened in XR; candidate/retired datasets remain unavailable; parsed row-count agreement is checked before publication; friendly presentation vocabulary does not mutate analytical semantics.

### 3. One canonical investigation journey through NIL

PT5C / #644 establishes the progressive researcher journey across desktop and XR through one `InvestigationJourneyController` and sequenced `NilExecutor`. Notice, Question, Hypothesis, Investigation, Understanding, Validation and Discovery durable meaning converge on Atlas / `DiscoveryReasoningService` / `DiscoveryEpisodeStore` / InvestigationGraph rather than modality-specific domain commands. Validation requires explicit researcher judgement and same-dataset analytical evidence; failed preflight does not partially mutate durable investigation state.

### 4. Save, checkpoint, export, verified reopen and recovery

PT5D / #645 converges continuity on one `InvestigationContinuityController`, reusing existing session, archive, package and replay authorities. Portable reopen verifies the `.nemosyne` package and embedded resumable snapshot before mutating the current investigation, checks identity/integrity against canonical digests, and rolls back if restore fails after mutation begins. Desktop and XR expose the same governed continuity semantics.

### 5. Normal XR authoring no longer depends on desktop browser modals

PT5E / #646 replaces normal `window.prompt()` investigation authoring with bounded in-panel spatial text entry for Notice, Question, Hypothesis and Understanding. Editing remains ephemeral until explicit submit; bounds and cancellation are fail-closed; scientific digits/comparison symbols are supported; semantic submission continues through the shared journey controller/NIL path.

### 6. Cross-cutting hardening did not create parallel authorities

#647 and #655 adversarially hardened the landed PT5 substrate around replay/provenance, selection restore, persistence, telemetry, degraded-kernel handling, browser activation, storage growth, local-recovery warnings and export privacy. These changes preserved Rust/WASM analytical authority, canonical replay/package semantics and one product persistence boundary rather than papering over PT5 defects with compatibility fallbacks.

### 7. Governed live-device UX/fix-forward loop has begun

#656 closes the headset-validation plumbing required to run attributable guided `quest-ux` sessions: launcher/browser/sink identity must agree on exact build, lane, worktree and machine-captured device identity; persisted sink artifacts own counted evidence; guided UX submissions use a bounded task vocabulary and semantic outcomes; governed starts require deliberate arm/confirm interaction.

#658 then fixes a concrete participant-facing spatial treatment class: head-following workspace wobble and frustrating panel repositioning. It makes body translation rig-relative, uses current XR viewer pose where available, introduces bounded heading intent/hysteresis, freezes the body frame while grabbing, makes production free-floating dragging direct in 3D, preserves placement across hide/show, and removes world-origin counter-billboarding. Independent review additionally found and fixed a false-turn bug where alternating left/right out-of-deadband gaze excursions could satisfy the sustained-turn timer; the final implementation requires directional persistence and has a regression falsifier.

This is sufficient to show that the PT5 UX loop is operational as a software/product-development process. It is **not** sufficient to claim human or physical-device success; the governed persisted sessions remain the authority for those claims.

## STOP-review attacks

### Attack: Are catalogue loading and XR loading two separate dataset authorities?

**No.** PT5B is presentation around the PT5A governed loader. The same immutable catalogue/integrity admission boundary feeds Atlas/Rust, and XR cannot invent a second parser or analytical dataset representation.

### Attack: Did desktop and XR create separate investigation semantics?

**No.** Both converge on the shared investigation controller and NIL sequence before durable Atlas/Discovery mutation. Presentation mechanics differ; semantic commands do not.

### Attack: Can a portable investigation mutate live state before it is verified?

**No for the PT5D boundary.** Package replay/integrity and embedded snapshot identity are checked before committed reopen, with rollback for failures after mutation starts.

### Attack: Does in-headset text entry make typing ergonomics "solved"?

**No.** PT5E removes the hard desktop-modal dependency and proves bounded software-path authoring. High-volume text entry, voice input, accessibility completeness and physical-headset ergonomics remain later product evidence/refinement.

### Attack: Does #658 prove the body-frame constants are comfortable for users?

**No.** Automated evidence proves transform/state invariants only. The 18° entry deadband, 8° exit deadband, 0.2 s directional intent gate and damping treatment remain empirical parameters. QV5/QV6 and live sessions decide whether they are comfortable/useful.

### Attack: Is PT5 being closed merely because many PRs merged?

**No.** The closure criterion is the bounded product path: governed catalogue -> loaded dataset -> shared NIL investigation lifecycle -> evidence-backed understanding/validation/discovery -> durable continuity/reopen, available across desktop and simulator-testable XR, with an attributable device UX feedback lane and demonstrated fix-forward. Merged PR count and green CI are supporting evidence, not the completion definition.

## Residual work, explicitly re-scoped

The following remain open without keeping PT5's bounded software implementation tranche alive:

1. **Physical/live-human UX qualification:** repeated governed Quest/device sessions, comfort/reachability/target-acquisition evidence, and further treatment tuning remain QV5/QV6 and cross-cutting product refinement.
2. **Panel compatibility cleanup:** the non-production anchored `PanelManager` path retains older transform math and should be converged/retired separately rather than becoming a second active spatial authority.
3. **Deployment/operations:** managed production-service qualification, backup/recovery, capacity/alerting and provider-level lifecycle obligations remain production-readiness work.
4. **Broader input ergonomics:** voice/dictation, high-volume authoring and accessibility refinements remain product work, not a reason to reopen the canonical discovery semantics.
5. **Future learning collection:** gesture features, raw trajectories and labels require PT6-specific consent, provenance and user-disjoint snapshot contracts. They must not inherit PT4 product-analytics consent or PT5 UX evidence by implication.
6. **Formal human-outcome claims:** no claim that Nemosyne improves scientific discovery, reasoning quality or retention is established by PT5 software evidence. Such claims require governed studies.

## PT6 entry boundary

PT6 may now implement the gesture-learning collection pipeline, but must preserve the authorities established before it:

```text
physical input
  -> perception / gesture feature extraction
    -> InteractionIntent
      -> NIL
        -> semantic operation
```

Learning collection may observe governed derived features and researcher confirmations/corrections under explicit consent. It may not bypass NIL, reinterpret durable investigations, treat Product Mode telemetry as training consent, or create a second gesture semantic authority.

The first PT6 implementation should therefore freeze the consent/label-provenance/training-snapshot contract before wiring broad collection.

## Disposition

**VERIFIED COMPLETE / STOP for PT5's bounded software-path catalogue, investigation-journey, continuity and XR-authoring mission.**

Continue physical/live-human UX refinement as an ongoing evidence-driven product loop. Advance the one forward implementation stream to **PT6 — governed gesture-learning collection and immutable user-disjoint training snapshots**.
