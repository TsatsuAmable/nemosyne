# QCA4 — WebXR Rendering Fast Wins

**Status:** READY AFTER QCA0  
**Purpose:** attack GPU/draw-call/frame-pacing costs directly rather than assuming CPU compilation is the limiting factor.

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
