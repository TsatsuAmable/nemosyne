# P1 PT5C — Canonical Investigation Journey Pre-Review

**Base:** `main@ff03ad2d06befcfc9f54deee104967e699921a6a`  
**Risk:** high — investigation semantics, NIL production execution, evidence lineage, desktop/XR parity

## Goal

Make one real researcher journey usable through the existing authorities:

`Notice -> Question -> Hypothesis -> Investigation -> Understanding -> Validation -> Discovery`

The tranche must reuse `Observation`, `AnalysisResult`, `Finding`, `DiscoveryEpisode`, `InvestigationGraph`, NIL and the existing Memory Palace/export paths. It must not create a second reasoning store or analytical path.

## Authority rules

1. Rust/WASM remains analytical truth. UI and NIL may request or cite analytical results, never manufacture them.
2. Atlas remains authority for observations, findings, analytical results and investigation aggregate state.
3. `DiscoveryEpisodeStore` remains authority for discovery lifecycle state.
4. `InvestigationGraph` is explicit lineage/presentation state. Spatial proximity must not imply epistemic relations.
5. NIL is the modality-independent command seam. Desktop and XR authoring must terminate at the same NIL handlers.
6. A terminal validation requires existing analytical evidence and an investigator-authored understanding/finding.
7. Friendly labels are presentation only. They must not alter NIL verbs, validation statuses or scientific semantics.

## One-shot implementation

- production-wire one `NilExecutor` in the application composition root;
- preserve existing Atlas NIL handlers for `OBSERVE`, `ANNOTATE`, and generic `CONCLUDE`;
- add discovery NIL handlers for `QUESTION`, `HYPOTHESISE`, `SUPPORT`, `REFUTE`, and bounded inconclusive validation;
- extend `DiscoveryReasoningService` with progressive lifecycle methods while keeping the C4 compatibility methods;
- use Atlas `Finding` as the explicit Understanding record before validation;
- add one application controller that emits sequenced NIL commands for both desktop and XR;
- replace the desktop reasoning rail's combined start/test interaction with human-friendly staged actions;
- add an XR Investigation panel using the same controller. Text entry may use the browser's user-text prompt surface as a current WebXR portability bridge, but no XR-specific domain command is allowed;
- keep DiscoveryEpisode persistence/export/replay through existing investigation/session infrastructure;
- add falsifiers for out-of-order stages, missing analytical evidence, foreign/mismatched findings, failed NIL commands not consuming sequence, modality parity, and replay/persistence compatibility.

## Promotion blockers

Do not promote if any of the following remain true:

- desktop or XR writes DiscoveryEpisode state directly;
- a terminal discovery can exist without analytical result evidence;
- a terminal discovery can exist without an explicit investigator understanding/finding;
- a finding from a different dataset can validate the discovery;
- NIL sequence advances after a rejected semantic action;
- XR and desktop produce materially different domain transitions for the same inputs;
- raw enum vocabulary becomes the primary user-facing workflow language;
- the new production NIL executor duplicates or bypasses existing application analytical intent authority;
- existing `.nemosyne` replay/export loses discovery episodes or digest stability without an explicit schema decision.

## Claim boundary

This tranche claims software-path desktop/XR semantic parity and durable investigation lifecycle authoring. It does not claim physical-headset keyboard ergonomics, voice dictation quality, formal-study validity, or complete PT5/private-preview qualification.