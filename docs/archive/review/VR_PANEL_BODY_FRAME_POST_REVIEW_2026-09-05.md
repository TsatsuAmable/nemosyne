# VR Panel Body-Frame / Manipulation Post-Implementation Review

**Date:** 5 September 2026  
**Base:** `main@10142893ad8b81c6b9ea367295188ccf8f47c784`  
**PR:** #658  
**Disposition:** **HIGH-RISK TREATMENT CHANGE — ADOPT after exact-head CI and promotion gates are green**

## Review scope

Adversarial re-review of the revision-5 body-frame and panel-manipulation changes across
`WorldSceneComposer`, `MovablePanel`, `BodyFrameState`, the participant-facing treatment
contract, and directly coupled tests. The review explicitly distinguishes automated
repository/browser evidence from physical Quest ergonomics and human usability evidence.

## Findings verified as resolved in the implementation

1. **World-origin counter-billboarding removed.** `MovablePanel` no longer calls
   `lookAt(0,0,0)` each frame. Reading yaw is computed in the panel parent's local body-frame
   coordinates toward the published viewer target.
2. **Physical HMD X/Z lean no longer owns workspace translation.** The body frame stays
   rig-relative and inherits actual locomotion through its `cameraGroup` parent.
3. **Raw gaze yaw no longer continuously swims the workspace.** Heading now requires an 18°
   departure sustained in one direction for 0.2 s, follows with delta-time-independent
   damping, and exits tracking inside an 8° hysteresis band.
4. **Current XR pose is preferred.** The composer consumes `XRFrame.getViewerPose()` when
   available before falling back to the camera state.
5. **Panel-distance offset rotates with accepted body heading.** It is no longer applied on a
   fixed rig/world -Z axis.
6. **Manipulation freezes the body frame.** A shared active-grab count prevents the coordinate
   frame from moving underneath a pointer during panel manipulation.
7. **Free-floating panel manipulation is direct and three-dimensional.** The production path
   uses the live ray at the captured grab distance, preserves the title-bar grab offset, and
   has no positional lerp.
8. **Anchored drag plane uses panel geometry.** The compatibility path captures the visible
   panel's own world normal rather than the parent anchor's forward vector.
9. **Distance safety no longer fights the pointer.** Free-floating safety bounds are enforced
   at release rather than every pointer event.
10. **Release commits the final target.** Pointer-up resolves and applies the final pointer
    pose before closing the grab.
11. **Visibility is distinct from reset.** `show()` preserves user placement;
    `resetToDefaultPosition()` / manager recenter remain explicit reset operations.
12. **Research-treatment identity is bumped.** Revision 5 is declared as
    `panel-layout/5+intent-wheel/1+frames/body-stable`; prior revision-4 study evidence is not
    silently reclassified.

## CI / adversarial fix-forward findings

The CI and independent review cycles were intentionally treated as adversarial evidence rather
than rerun noise. They found five concrete issues:

1. **Structural Group test doubles lacked `userData`.** `BodyFrameState` initially assumed a
   concrete Three.js `Object3D`; long-standing tests pass lightweight Group-like doubles.
   The coordination state now initializes a structural `userData` bag when absent without
   changing production behavior.
2. **New direct-manipulation tests used two different synthetic rays.** The raycaster hit and
   `PointerLike` ray must be the same physical ray in production. Tests now align them before
   asserting 1:1 controller/hand translation while preserving the off-centre grab offset.
3. **A collaborative-VR scenario preserved the rejected old authority.** It still asserted
   physical camera X/Z should become body-anchor X/Z. The scenario now asserts rig-relative
   body translation, viewer-derived torso height, and initial body heading.
4. **Promotion gate correctly refused an unreviewed high-risk head.** The approval gate
   reported that PR #658 lacked a post-implementation adversarial disposition. This record
   and the matching PR section provide that disposition; the gate must still rerun green on
   the final exact head.
5. **The sustained-turn gate initially accumulated magnitude across opposing gaze excursions.**
   Alternating left/right yaw beyond the 18° entry threshold could satisfy the 0.2 s timer even
   though no heading change persisted in one direction. The gate now resets its timer when the
   shortest-path yaw-error direction changes, with a regression test that alternates ±20°
   excursions and requires the body frame to remain fixed.

No finding was waived by lowering type, lint, architecture, coverage, or treatment-freeze
requirements.

## Residual / deliberately bounded findings

### Legacy anchored `PanelManager` path

Production `WorldUIManager` constructs `PanelManager` with `freeFloating: true`, so the user
reported manipulation path is the direct `MovablePanel` path fixed in this tranche. The
non-production anchored compatibility path still contains its own older spatial math:

- `_layoutPanel()` uses a Three.js `lookAt(...)` target rather than the new body-frame local
  orientation helper;
- `applyDragDelta()` transforms a delta using a full inverse matrix, which risks translation
  contamination because a displacement vector should be transformed as a direction;
- `_snapToComfortableDistance()` remains an anchored-layout placement policy.

This residual does **not** block the production fix because that path is bypassed by
`freeFloating:true`, but it should be retired or converged in a separate bounded cleanup
rather than becoming a second active spatial authority again.

### Empirical device boundary

Automated tests can demonstrate transform invariants, ray math, state ownership, build
integrity, and browser execution. They cannot demonstrate physical Quest 3S comfort,
reachability, hand/controller target acquisition, fatigue, motion perception, or whether the
18° / 0.2 s / lambda 2.5 heading parameters feel correct to a person in-headset. QV5/QV6 is
the required evidence path for those questions. No simulator/browser result in this PR is
promoted to physical-device proof.

## Promotion disposition

**ADOPT**, conditional on the final exact PR head passing the ordinary required CI, CodeQL,
approval/promotion controller, treatment-specific evidence workflows, and review-thread
checks with no main drift.

The implementation removes the identified transform contradictions without creating another
layout authority. The remaining anchored-mode compatibility math is explicitly recorded and
outside the production path. Physical-device ergonomics remains an open empirical boundary,
not a software-completion claim.
