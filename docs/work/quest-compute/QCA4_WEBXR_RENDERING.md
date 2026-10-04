# QCA4 — WebXR Rendering Fast Wins

**Status:** BOUNDED CHANGES LANDED / PHYSICAL COMPARISON OPEN
**Purpose:** attack GPU/draw-call/frame-pacing costs directly rather than assuming CPU compilation is the limiting factor.

Low-triangle observation markers merged in #979; operator glyph hygiene merged in #986.
These establish software changes, not measured Quest improvement. Controlled physical frame-time,
legibility and selection comparisons remain required before adopting a performance claim.

## Work

From the QCA0 scene, test bounded changes independently:

- instancing for repeated geometry/material families;
- mesh/material batching where semantic interaction boundaries permit;
- culling and representation-aware LOD;
- WebXR Layers for static/slow-changing compositor-owned surfaces where appropriate;
- multiview/foveation capabilities already supported by the target browser/runtime;
- removal of per-frame allocations and avoidable scene-graph churn.

Each experiment must preserve semantic identity, selection/provenance interaction and visual legibility.

## Exit

Retain only changes that improve representative Quest frame-time or GPU/CPU render cost without harming comprehension or interaction.

**STOP:** no measurable gain or semantic/UX regression.  
**ADOPT:** independently measured frame-budget improvement.
