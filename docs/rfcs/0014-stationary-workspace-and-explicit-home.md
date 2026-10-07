# RFC 0014 — Stationary workspace and explicit Home

**Status:** accepted as product direction by the project owner on 7 October 2026; detailed specification below awaits written review before implementation planning.
**Implementation:** not implemented or physically qualified by this RFC.
**Authority:** subordinate to the Definitive Vision and roadmap; changes the target spatial interaction model, not frozen study conditions.

## Context and intent

Quest wearer reports describe Settings and Telemetry moving/rotating during head movement, obscuring the wheel, and lacking obvious dismissal. Revision 5 separates physical lean from accepted heading, but sustained head turns still infer an instruction to move the workspace. Looking at data is not necessarily a request to move tools.

The owner approved stationary work panels, an on-demand command wheel, data-attached annotations, brief critical alerts, explicit Close/Move/Bring workspace here controls, optional following, and separate world origin, Home and session arrival. Success means a researcher can look away, inspect data and return to the same stable tools without chasing controls or losing their arrangement.

## Decision

### 1. Frame ownership

- Settings, Telemetry and other persistent reading/precision panels default to `WORLD_LOCKED` in the investigation workspace, independent of the locomotion rig and physical head pose.
- First opening places a panel once near the current working view, upright and facing the opening viewpoint. Subsequent gaze, lean, turn and locomotion do not reposition or billboard it.
- Reopening preserves an existing placement. If it is out of view, expose a reachable explicit bring action; do not silently reset it or report success through sound alone.
- `Follow` is optional, visibly indicated and off by default for new panels. It uses the body-frame policy, never rigid head lock. Grabbing a following panel freezes motion and commits a stationary placement. Turning Follow off preserves the current world pose.
- Dataset annotations remain object/semantic-attached. Bringing tools or returning Home must not detach annotations or move analytical coordinates.
- The wheel is summoned on demand in a reachable, unobscured location. Its placement is stable during selection; successful selection dismisses it, while unavailable actions retain an explanation. A resulting panel must not intercept the selection's release event.
- Head-locked presentation is reserved for brief critical comfort/system alerts. Routine errors and analytical UI must not trap the view.

### 2. Explicit controls

- Every movable work panel has visible `Close` and `Move` controls, with equivalent ray/controller and supported hand actions. Move exposes the existing direct-manipulation operation, not a hidden gesture requirement.
- Close changes visibility, not investigation state or telemetry consent. Hide/show preserves placement and content.
- `Bring workspace here` places open personal work panels near the current viewpoint as a deliberate batch operation. Preserve their relative arrangement where safe; clearly disclose any collision/reach adjustment. Keep them stationary afterwards and leave closed panels closed.
- Placement must avoid the active command surface and focused data feature. If no clear arrangement exists, expose the requested panel first and retain access to other tools instead of silently stacking opaque panels.
- Reference-frame changes preserve world position, orientation and scale at the switch. Do not apply layout dimensions twice when reparenting UIKit roots. Explicit placement animations must not create unwanted camera motion; manipulation itself is direct, with no pursuit lag.
- Capture has a single owner. Defer placement/recenter actions during an active press/grab, or cancel cleanly before executing them; never orphan a pressed control.

### 3. World origin, Home and session entry

- **World origin** is the investigation's logical coordinate reference. It is not a universal panel facing target or a promise of a persistent physical-room location.
- **Home** is a recognisable safe overview viewpoint relative to the investigation. `Go Home` changes the navigation viewpoint, not dataset coordinates or tool arrangements. It remains reachable through the command surface.
- **Session entry** is an explicit choice when saved work exists: `Resume workspace` or `Start at Home`. A new investigation starts at Home. Starting at Home does not erase the saved layout.
- Resume restores investigation-relative organisation, panel visibility and reference-frame preference through the existing persistence authority. Restore a saved viewpoint only after mapping/validating it for the current XR space; disclose a safe Home fallback when it cannot be restored.
- Treat the XR tracking reference space as session-local. Handle reference-space reset explicitly, preserving logical relationships where a valid transform exists. Without a reliable transform, stop automatic placement and offer explicit safe recovery; do not invent room-anchor continuity.
- Keep `Go Home`, `Bring workspace here`, and device tracking recenter distinct in labels and behaviour. None resets analytical state or mutates durable findings.

## Options considered

1. **Retain default body-following:** keeps tools nearby but cannot reliably distinguish looking from workspace relocation. Rejected as the default; retained as an explicit option.
2. **Stationary panels with explicit summons/recovery (selected):** supports stable reading and spatial memory; requires discoverable bring/close/move controls and honest session recovery.
3. **Rigid head-locked dashboard:** always visible but obstructs data and cannot be escaped by looking away. Rejected for routine work.

## Architecture and delivery boundaries

TypeScript owns presentation, navigation and input; Rust/WASM analytical authority is unchanged. Reuse WorldSceneComposer for frame ownership, WorkspaceSurfaceManager for visibility/layout lifecycle, SpatialPanel/MovablePanel for transforms/manipulation, and existing session persistence ports for durable layout. Do not add a parallel workspace database or mutate canonical investigation semantics to save UI state.

Separate implementation into two reviewable deliveries: (A) stationary panels, shared controls, wheel coexistence and explicit bring/follow; (B) Home/Resume entry and validated session-space restoration. Neither delivery may claim the other is complete. Read the actual persistence contracts before deciding whether a schema migration is necessary; this RFC does not authorize an unreviewed public package-format change.

## Consequences and compatibility

- This changes foundational interaction grammar and is high-risk under AGENTS.md. The normative UI guides now describe this target; current code and the revision-5 treatment remain accurately documented as legacy behaviour pending implementation.
- Bump the executable UI treatment identity and its declaration together with runtime rollout, not in this documentation-only adoption. Record the resulting immutable ADR then. Existing frozen studies retain their original treatment; obtain research review before introducing the new condition.
- Old saved layouts must not be silently reinterpreted as world transforms. Validate/migrate them explicitly or preserve the original and offer a new layout. Do not automatically overwrite saved work during recovery.
- No new collection, network transmission, telemetry opt-in, or analytical computation is introduced. Placement work must remain bounded by the number of UI surfaces, not dataset size.
- Exact distances and target sizes require device evidence. This policy does not claim comfort or accessibility qualification from software checks alone.

## Pre-implementation falsifiers and acceptance evidence

1. Real production panel opening and registry paths: open each work panel, then lean, turn, move the rig and hide/show; world pose remains unchanged unless an explicit action requests motion.
2. Reparent under translated/rotated/scaled ancestors: switching Follow preserves world dimensions and pose; grab/press capture always releases, including tracking loss and close/recenter attempts.
3. Controller/hand rays through real rendered geometry: Close, Move, Follow, bring and wheel selection work without obscured targets, click-through, unintended toggles or overlap-induced loss.
4. Long enabled reports and forms at supported accessibility scales: text clips/scrolls inside bounds; chrome and actions remain legible and reachable.
5. Session resume, Start at Home, missing/corrupt legacy layout and tracking-origin reset: no data/annotation displacement, silent layout loss, fabricated anchor continuity or unsafe viewpoint restoration.
6. Fresh-build Quest wearer pass: look away and return, read/interact for a sustained period, bring tools after locomotion, return Home and resume an investigation. Record exact build/treatment and observed failures; passing simulator tests is not physical sign-off.

## Resulting ADR

No implementation ADR exists yet. Create and link it when the architecture is implemented; do not rewrite the revision-5 decision or retroactively relabel its evidence.
