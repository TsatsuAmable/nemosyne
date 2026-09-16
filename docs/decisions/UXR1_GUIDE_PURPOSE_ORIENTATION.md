# UXR1 GUIDE Purpose & Comprehension Treatment

**Decision date:** 16 September 2026
**Base:** `main@cc1807d294090e724700578ca2312a24e50450a6`
**Owning finding:** #745
**Prior implementation:** #746

## Decision

Keep GUIDE as the single participant-facing capability-orientation seam, but extend
`What can I do here?` so it answers three questions before presenting capability
inventory:

1. **What is Nemosyne for?** Investigating governed analytical structure through
   inspectable spatial representations while preserving a path back to evidence.
2. **How should I interpret the space?** `dataset -> representation -> structure ->
   question -> investigation -> evidence`; a representation is a governed view, not
   the dataset itself and not truth merely because it is visible.
3. **What should I do next?** Project one action from live context rather than asking
   the user to know the menu taxonomy.

## Authority boundaries

- Global capability inventory remains derived from the live `WheelMenuCategory[]`.
- Selected-object availability and next-step choice remain derived from
  `INVESTIGATOR_TASKS` plus `ContextualTaskSurface.taskAvailability`.
- Dataset presence comes from canonical `AtlasCore.hasDataset`, not the dataset getter's
  empty sentinel; promoted-representation presence comes from `RepresentationSurface`.
- A fresh investigation resolves the live `DATA/data-sources` action rather than a
  duplicated capability registry. A loaded dataset with no promoted representation
  routes to canonical `More` context/constraints instead of inventing selectable geometry.
- While GUIDE is open, a compact signature of those live authorities refreshes the
  rendered orientation/buttons only when context changes; GUIDE owns no shadow state.
- GUIDE remains transient and dismissible; no persistent onboarding panel is added.
- No analytical, representation, evidence or investigation authority moves into UI.
- This participant-facing semantic change bumps treatment identity to
  `panel-layout/5+intent-wheel/3+frames/body-stable`.

## Evidence and falsification

Repository tests must fail if purpose/mental-model orientation disappears, if the
selected next step stops following canonical task availability, or if the treatment
identity is not bumped.

Software evidence is necessary but cannot close #745. Closure requires a governed
physical owner-operated Quest retest, without taxonomy coaching, showing that the user
can discover GUIDE, explain the product purpose and representation-as-view model,
identify an available and unavailable action plus the reason, state the next step and
execute a chosen capability. Failure keeps #745 open.

A successful owner retest resolves the reported regression only. It does not substitute
for later independent-user or population-level usability evidence.