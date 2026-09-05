# VR Panel Body-Frame / Manipulation Pre-Implementation Review

**Date:** 5 September 2026  
**Base:** `main@10142893ad8b81c6b9ea367295188ccf8f47c784`  
**Scope:** `WorldSceneComposer`, `MovablePanel`, BODY_LOCKED reference-frame policy, panel placement persistence, and directly coupled tests/docs.

## Findings

1. **World-origin billboarding is wrong.** `MovablePanel.update()` uses `mesh.lookAt(0,0,0)` while the comment calls that target parent-local. Three.js interprets the target in world coordinates, so a panel can counter-rotate toward the playspace origin as the body/workspace anchor moves.
2. **The torso anchor is actually a filtered head follower.** `WorldSceneComposer` copies camera X/Z every frame and uses `delta * 0.15` yaw convergence. Physical lean translates the persistent workspace; gaze scanning continually perturbs its heading; damping changes with refresh rate.
3. **XR pose timing is ambiguous.** The composer runs before `renderer.render()`, while current XR frame/ref-space data are already available on `Engine`. Depending only on the camera transform can consume a pose that Three.js has not yet refreshed for the current frame.
4. **Panel-distance translation is applied in raw rig Z.** The configured workspace offset does not rotate with accepted body heading.
5. **Free-floating drag is not meaningfully 3D.** A drag plane normally wins over the ray fallback, so pointer depth changes are suppressed. The plane normal comes from the parent rather than the visible panel.
6. **Manipulation adds synthetic lag.** `position.lerp(..., 0.35)` makes placement trail the hand/controller and is refresh/event-rate dependent.
7. **Safety clamping fights the pointer.** `_clampDistance()` runs after every drag move instead of at commit.
8. **Release stops short.** The final pointer target is not explicitly committed before drag state is cleared.
9. **Visibility restoration can reset placement.** `MovablePanel.show()` copies `defaultPosition`, conflating show with reset-to-home.
10. **Reference-frame policy is research treatment.** Fixing these semantics changes participant-facing spatial behavior and must bump `UI_TREATMENT_VERSION`; automated tests cannot be represented as physical Quest ergonomics evidence.

## Design constraints

- Do not create a second panel-position authority.
- Keep `PANEL_LAYOUT` as defaults only and user drag pose as the post-drag authority.
- Keep analytics/Moneta/data authority untouched.
- BODY_LOCKED must follow locomotion/body-heading changes while resisting ordinary head lean/gaze scanning.
- Freeze the body frame while a grab is active so the manipulation coordinate system is stable.
- Prefer current `XRFrame` viewer pose where available.
- Keep physical-device comfort and usability claims empirical.

## Planned falsifiers

- Translate the HMD X/Z without moving the rig; anchor X/Z must stay fixed.
- Scan ±12° repeatedly; anchor yaw must remain fixed.
- Sustain a 90° turn; heading must begin only after the intent gate and converge similarly at 36 Hz and 72 Hz.
- Start a panel grab, then change viewer height/yaw; anchor transform must remain unchanged until release.
- Move a free-floating grab ray origin forward/back; panel depth must change.
- Move beyond the max radius; position may exceed the bound during the grab but must be bounded after release.
- Move/rotate the parent in world space; panel local reading yaw must not change merely because world origin moved.
- Hide/show a repositioned panel; pose must survive. Explicit reset must still restore the default slot.
