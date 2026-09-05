# VR Panel Body Frame — Revision 5 Decision

**Date:** 5 September 2026  
**Parent decision:** `docs/decisions/VR_PANEL_SPATIAL_LAYOUT.md` revisions 1–4  
**Treatment:** `panel-layout/5+intent-wheel/1+frames/body-stable`  
**Classification:** CONTROLLED-TREATMENT MODIFICATION

## Problem

The revision-3 BODY_LOCKED policy was correct in intent but not in runtime semantics.
`WorldSceneComposer.analystAnchor` copied headset X/Z translation every frame and chased
raw headset yaw with a fixed `0.15` per-frame lerp. `MovablePanel` then called
`lookAt(0, 0, 0)` every frame, which is a world-space target in Three.js despite the
comment describing it as parent-local. Free-floating panel dragging preferred a
parent-facing plane, lerped motion by `0.35`, clamped every pointer move, and `show()`
reset placement to `defaultPosition`.

The combination made a supposedly body-fixed workspace behave as a filtered head-following
HUD and made direct manipulation feel elastic. Physical head lean could translate the
workspace; gaze yaw could rotate it; panel facing could counter-rotate toward the playspace
origin; drag depth was effectively unavailable; safety clamping fought the pointer; and
visibility restoration could erase placement.

## Decision

BODY_LOCKED now has an explicit operational meaning:

1. **Locomotion rig owns translation.** `analystAnchor` remains a child of
   `engine.cameraGroup`; physical HMD X/Z translation is not copied into the anchor.
2. **Current XR pose first.** When `Engine.xrFrame` and `xrRefSpace` exist, the current
   `XRFrame.getViewerPose()` supplies viewer height and physical heading before render.
   Desktop/simulator paths fall back to the camera transform.
3. **Stable heading estimate.** Head yaw inside an 18° deadband is treated as gaze scanning.
   A heading change must persist for 0.2 s before the body frame follows. Accepted turns use
   `1 - exp(-lambda * dt)` damping (`lambda = 2.5`) and stop tracking inside an 8° release
   band. This makes damping independent of refresh rate.
4. **Manipulation freezes the frame.** Any active `MovablePanel` grab increments shared
   body-frame drag state. `WorldSceneComposer` leaves the anchor transform unchanged until
   the final grab ends.
5. **Panel distance follows heading.** The configured workspace offset is applied along
   accepted body-frame forward, not the rig's original -Z axis.
6. **Panel facing is local.** Persistent panels calculate yaw toward the body viewer target
   expressed in parent-local coordinates. No panel billboards toward literal world origin.
7. **Direct 3D grab.** Production free-floating panels use a ray-parametric target at the
   captured grab distance. Physical controller/hand translation therefore moves the panel
   in X/Y/Z. The anchored delta path retains a plane, but its normal is the panel's own
   world normal captured at grab time.
8. **No positional lag.** Active panel manipulation is 1:1 rather than `position.lerp`.
9. **Commit-time safety.** Distance bounds are applied once when a free-floating grab ends,
   not every pointer event.
10. **Visibility is not reset.** `show()` restores visibility only. Returning a panel to its
    layout slot is the explicit `resetToDefaultPosition()`/recenter operation.

## Authority boundaries

- `WorldSceneComposer` owns body-frame transform policy.
- `BodyFrameState` is coordination state only: current body viewer target and active panel
  grab count. It contains no layout or analytical authority.
- `MovablePanel` owns manipulation and local reading orientation for legacy canvas panels.
- `PANEL_LAYOUT` continues to own default slots only.
- User-authored panel pose remains the placement authority after a drag; visibility changes
  do not overwrite it.
- World-locked landmarks and analytical/data authority are unchanged.

## Evidence

Repository tests cover:

- physical HMD X/Z lean does not translate the body frame;
- current XRFrame viewer pose takes precedence over stale camera state;
- gaze yaw inside the deadband does not move the workspace;
- sustained heading change is accepted and damping is approximately frame-rate independent;
- active panel manipulation freezes body-frame pose;
- panel-distance translation follows accepted body heading;
- panel yaw is invariant to parent movement in world space;
- free-floating drag supports depth, follows the pointer directly, clamps only on release,
  and commits the final pointer target;
- hide/show preserves user placement and reset is explicit.

This is automated repository/simulator evidence. It is **not** physical Quest comfort,
reachability, fatigue, or target-acquisition evidence. QV5/QV6 remains the empirical path
for those claims.

## Research safeguard

This changes participant-facing reference-frame behavior and therefore bumps
`UI_TREATMENT_VERSION`. Studies frozen to revision 4 remain frozen to revision 4. Revision 5
must not be silently mixed into an existing study condition.
