# Nemosyne Interaction Vocabulary

Nemosyne defines a small set of **metaphor-accurate** interactions: every gesture performs a dataset operation _and_ a matching VR artefact transform.

---

## Core Interaction Loop

1. **Orient** — Enter the memory palace generated from the dataset.
2. **Probe** — Point at a node and inspect its real data values.
3. **Query** — Highlight matching records across the space.
4. **Compare** — See the same layout under different encodings or filters.
5. **Annotate** — Drop a beacon on a finding.
6. **Share** — Export the current palace state as a JSON view spec.

---

## Data Operation → Artefact Transform Mapping

| Intent                   | Dataset operation                               | VR artefact transform                                                                                                                           | Input                                                                   |
| ------------------------ | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **Inspect**              | —                                               | Holographic inspector appears near the active hand; node brightens and elevates                                                                 | Point + pinch/select on node                                            |
| **Filter**               | `WASM Kernel filter`                            | Non-matching nodes shrink, fade, and fall below the DatumPlane                                                                                  | Wheel menu, filter ring, or `pinchTogether` gesture                     |
| **Aggregate**            | `WASM Kernel aggregate`                         | Grouped crystals merge into a larger Orb or Column                                                                                              | Wheel menu or `pinchApart` gesture                                      |
| **Compare**              | `AtlasCore / WASM compare`                      | A compact group-summary view exposes means, counts, and differences for the selected measures                                                   | Canonical 2D precision view; VR guidance foundation                     |
| **Sort**                 | `WASM Kernel sort`                              | Nodes reorder along an arc or spiral                                                                                                            | Wheel menu or `sliceUp` gesture                                         |
| **Time Slice**           | `WASM Kernel slice`                             | A cut plane moves through the ribbon; older data dims                                                                                           | Wheel menu or `sliceDown` gesture                                       |
| **Cluster**              | `WASM Kernel cluster`                           | Similar nodes attract into a Zone ring                                                                                                          | Pinch-drag a node near another                                          |
| **Hierarchical Cluster** | `WASM Kernel hierarchical`                      | Dendrogram arcs arranged by linkage distance                                                                                                    | Wheel menu Hierarchical button                                          |
| **Density Cluster**      | `WASM Kernel dbscan`                            | Dense groups become clouds; noise sinks below plane                                                                                             | Wheel menu Density button                                               |
| **Anomaly Highlight**    | `WASM Kernel anomaly`                           | Outliers lift and pulse with magenta halos                                                                                                      | Wheel menu Highlight outliers button                                    |
| **Outlier Lens**         | `applyOutlierLens`                              | Outliers swarm around the pointing hand                                                                                                         | Hold pinch on an outlier cluster                                        |
| **Live Preview**         | `AtlasCore preview`                             | Transient markers show which rows will be kept, removed, reordered, or flagged as outliers before the operation is applied                      | Hover an operation in the wheel menu or an in-place handle              |
| **Reset**                | `AtlasCore reset`                               | All artefacts return to the solved layout                                                                                                       | Wheel menu Reset button or `pushForward` gesture with pinched hands     |
| **Reset View**           | —                                               | Camera returns to the overview anchor without undoing history                                                                                   | `pushForward` gesture with open hands, or `R` on desktop                |
| **Pause / Resume Input** | —                                               | All gestures are ignored while paused; locomotion and scene selection are disabled                                                              | Hold both hands pinched close together for ~1 second, or `P` on desktop |
| **Mark Moment**          | `MarkMomentAction` / `AtlasCore`                | Captures 3D observer position, rotation, active slice, and focal cluster into an attributable Observation entity with visual beacon and haptics | Wheel menu `📍 Mark Moment` button                                      |
| **Undo / Redo**          | `AnalysisHistory` rewinds or replays operations | Artefact rebuilds from the stored dataset                                                                                                       | `rotateCCW` / `rotateCW` gestures or `Ctrl+Z` / `Ctrl+Y`                |

---

## Pointer Ray Smoothing & Precision Acquisition

WebXR pointers utilize `PointerRayFilter` (adaptive 1-Euro smoothing filter) across both controller and hand tracking rays. At slow speeds/dwell, micro-jitter and physiological hand tremor are dampened by $>50\%$ to facilitate single-datum and small cluster selection at distances of $2\text{m}–5\text{m}$. At high angular velocities, smoothing decreases dynamically ($\beta=0.5$) for zero-lag gesture sweeps.

## Dual-Hand Gesture Commands

`src/vr/interactions/HandGestureRecognizer.ts` reads both tracked hands each frame and maps simple pose patterns to analysis commands. Gestures are deliberately conservative: each has a cooldown and a clear displacement threshold so accidental motion does not spam commands.

| Gesture                   | Hands                                                 | Mapped action                                                                                  |
| ------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **bothPinched**           | Both hands pinch simultaneously                       | System toggle: show/hide the launcher ring                                                     |
| **pinchTogether**         | Both hands pinched and moving closer                  | Apply **filter**                                                                               |
| **pinchApart**            | Both hands pinched and moving apart                   | Apply **aggregate**                                                                            |
| **swipeRight**            | Dominant open-hand swipe right                        | Next dataset                                                                                   |
| **swipeLeft**             | Dominant open-hand swipe left                         | Previous dataset                                                                               |
| **sliceUp**               | Dominant open-hand slice up                           | Apply **sort**                                                                                 |
| **sliceDown**             | Dominant open-hand slice down                         | Apply **timeSlice**                                                                            |
| **scoopUp**               | Both palms up, rising together                        | Toggle the **statistical lens** (TDA summary + correlation matrix); in flight mode, **ascend** |
| **scoopDown**             | Both palms down, lowering together                    | In flight mode, **descend**                                                                    |
| **pushForward (pinched)** | Both palms forward, pushing away                      | **Reset** data operations                                                                      |
| **pushForward (open)**    | Both open palms forward, pushing away                 | **Reset** view to overview                                                                     |
| **rotateCW**              | Cupped hands twisting clockwise                       | **Redo** the last undone analysis operation                                                    |
| **rotateCCW**             | Cupped hands twisting counter-clockwise               | **Undo** the last analysis operation                                                           |
| **okSign**                | Dominant pinch while non-dominant is open             | Toggle the **settings panel**                                                                  |
| **pauseResume**           | Pinch both index fingers close together and hold ~1 s | **Pause / resume** all input                                                                   |

The recognizer is used by `World._updateGestures()`; the resulting intent is handled by `World._onGesture()`.

---

## Analysis History & Undo/Redo

Every data operation is recorded in an `AnalysisHistory` stack (`src/data/AnalysisHistory.ts`). Each frame stores:

- `operation` — the command name (e.g. `filter`, `sort`, `aggregate`).
- `datasetBefore` / `datasetAfter` — deep clones of the dataset on each side of the operation.
- `parameters` — optional replay parameters.
- `timestamp` — when the frame was recorded.

The stack is pointer-based. Undo returns the dataset before the current frame; redo returns the dataset after the next frame. A new operation after an undo discards the redo branch. The stack is capped at 50 frames by default.

You can step through history with:

- `rotateCCW` / `rotateCW` hand gestures.
- `Ctrl+Z` and `Ctrl+Y` (or `Ctrl+Shift+Z`) on the desktop keyboard.

## Settings Panel

`src/vr/ui/SettingsPanel.ts` is a movable, camera-rig-attached panel that lets analysts customize:

| Section              | Options                                                          |
| -------------------- | ---------------------------------------------------------------- |
| **Statistical Lens** | Toggle the TDA summary group and/or the correlation matrix panel |
| **Feedback**         | Enable/disable audio, haptic, and visual feedback independently  |
| **Gestures**         | Enable/disable the dual-hand gesture recognizer                  |

Settings are persisted to `localStorage` under `nemosyne-vr-settings` and applied immediately via `World._onSettingChanged()`.

---

## Gesture Details

### Point + pinch / select

- **Controller**: trigger click while pointing.
- **Hand tracking**: extend index finger and pinch thumb+index.
- Used for inspect, menu selection, and button presses.

### Two-hand pinch + pull

- Pinch an artefact with each hand, then pull hands apart or together.
- Pulling apart expands/untangles; pulling together aggregates.

### Horizontal / vertical hand swipe

- Swipe horizontally across the palace to cycle sort keys.
- Swipe vertically to move a time-slice plane forward/backward.

### Body-locked constellation wheel menu

- Pinch the menu hand to toggle a two-level constellation wheel that floats body-locked in front of the chest at ~0.55 m.
- Inner ring: categories (Templates, Panels, Views, Live, Collab, Ops).
- Outer ring: actions within the hovered or selected category.
- Faint connector lines link the active category to its actions, building spatial muscle memory.
- Dominant-hand index ray hovers to preview and pinch to confirm.
- Hovering a node brightens and scales it slightly; selecting an action plays a confirm tone and closes the wheel.
- Hovering an operation in the **Ops** ring triggers a **live preview** of the result.

---

## In-Place Operation Handles

For common topologies, small world-space badges appear near the data palace so you can act without opening the wheel menu:

| Topology                    | Handles      | Badge  |
| --------------------------- | ------------ | ------ |
| **TABULAR** / **HIERARCHY** | Filter, Sort | 🔎, 📶 |
| **TIME_SERIES**             | Time Slice   | 🕒     |

The handles fade in when your pointer or hand is nearby and are hidden in expert mode. Selecting a handle applies the same operation as the wheel menu.

---

## Spatial HUDs

Two lightweight, analyst-anchored HUDs help you stay oriented and aware of collaborators:

- **Mini-overview** — a top-down map of the palace with a cone showing your current horizontal view direction. Toggle from the wheel menu (Views → Overview) or Settings.
- **Peer-presence HUD** — lists connected collaborators with colored dots and, when they broadcast their position, a direction arrow relative to your forward vector. Toggle from the wheel menu (Views → Peers) or Settings.

---

## Analysis Templates

Ready-made **analysis stories** (`src/data/AnalysisTemplates.js`) bundle a sample dataset, an atmosphere preset, and a guided tour into a single entry point. They let a new analyst start from a credible scenario instead of an empty palace.

Open the **Templates** category in the constellation wheel menu and pick a story:

| Template                  | Dataset                 | Theme           | Tour          |
| ------------------------- | ----------------------- | --------------- | ------------- |
| Factory Floor Monitoring  | IoT sensor stream       | `coolDepth`     | first dataset |
| Fraud Investigation       | Fraud transaction graph | `warmAnomaly`   | first dataset |
| Sales Performance Review  | Sales table             | `daylightGlobe` | first dataset |
| Organizational Cost Audit | Org chart               | `neonMidnight`  | first dataset |
| Market Session Replay     | Financial candle series | `daylightGlobe` | first dataset |
| Geospatial Benchmark      | Global cities           | `coolDepth`     | first dataset |

A template loads the dataset, applies the matching visual theme, and starts the default guided tour so the gesture and operation vocabulary are introduced in context.

---

## Cross-Platform Continuity

Nemosyne shares key preferences and the latest analysis story between desktop and VR sessions through IndexedDB (`shared-settings`). When a setting changes in either mode, it is written to the shared store and restored the next time the app launches.

In addition, a **Desktop Preview** mode lets you inspect the palace on a monitor before putting on a headset:

- Toggle from the wheel menu: **Views → Preview**.
- Outside VR, this switches from first-person mouse/keyboard controls to an orbit camera centered on the palace.
- Your first-person pose is saved so you can return to it with the same menu action.

This is useful for preparing a dataset, configuring settings, or demonstrating the workspace without a headset.

---

## System Controls

| Function                               | Default input                                                                                 |
| -------------------------------------- | --------------------------------------------------------------------------------------------- |
| Toggle wheel menu                      | Controller grip (hold) or two-hand pinch                                                      |
| Toggle individual panel                | Wheel menu → panel button, or launcher ring                                                   |
| Drag panel                             | Point at title bar, hold trigger/pinch, move                                                  |
| Scroll dashboard                       | Wheel menu → Panels → Scroll Left / Right                                                     |
| Re-center panels                       | Wheel menu → Recenter                                                                         |
| Reset dashboard                        | Wheel menu → Panels → Reset Dashboard                                                         |
| Switch dataset                         | Wheel menu → Views → Dataset, or `swipeRight` / `swipeLeft` gesture                           |
| Connect live stream                    | Wheel menu → Live → Start/Stop Live                                                           |
| Toggle Farcaster portals               | Wheel menu → Views → Portals                                                                  |
| Cycle TechnoCore lens hub              | Point + pinch the TechnoCore                                                                  |
| Walk through Farcaster portal          | Step into a portal to warp + apply its data operation                                         |
| Toggle statistical lens                | `scoopUp` gesture (when not in flight mode), Settings Panel, or TechnoCore `statistical` lens |
| Cycle atmosphere theme                 | Wheel menu → Views → Cycle Theme                                                              |
| Undo / redo operation                  | `rotateCCW` / `rotateCW`, or `Ctrl+Z` / `Ctrl+Y`                                              |
| Open settings panel                    | `okSign` gesture                                                                              |
| Start guided tour                      | Wheel menu → Panels → Tour                                                                    |
| Filter / aggregate / sort / time-slice | `pinchTogether`, `pinchApart`, `sliceUp`, `sliceDown`                                         |
| Reset data operations                  | `pushForward` gesture with pinched hands                                                      |
| Reset view                             | `pushForward` gesture with open hands, or `R` on desktop                                      |
| Pause / resume input                   | Hold both hands pinched close together for ~1 s, or `P` on desktop                            |
| Toggle 3D flight mode                  | Wheel menu → Views → Toggle Flight                                                            |
| Ascend / descend in flight mode        | Right thumbstick up/down, or `scoopUp` / `scoopDown` gesture                                  |
| Drop to floor                          | Wheel menu → Views → Drop to Floor                                                            |

---

## Context-Aware Gesture Suppression

Nemosyne infers intent from the spatial context of your hands to reduce accidental commands:

- **Hand near a data artefact** — when the dominant hand is inside the palace's bounding volume, global gestures are suppressed and locomotion is disabled so you can adjust in-place handles or direct widgets without accidentally moving or triggering an operation.
- **Hand near the wheel menu** — when a hand is close to the body-locked constellation wheel, scene selection is suppressed for the other hand so you can operate the menu without selecting palace nodes through it.
- **Input paused** — while paused, all gestures, locomotion, and scene selection are ignored. Use this to reposition your hands or take a break without unintended commands.

These checks run each frame in `World._updateInputContext()` and update `InputRouter` and `Locomotion` suppression flags.

---

## Guided Tour

`src/vr/ui/GuidedTour.ts` plays a step-by-step spatial tutorial authored as JSON. The default tour (`src/data/DefaultTour.ts`) introduces the datum plane, represented investigation, node inspection, constellation wheel menu, two-hand gestures, settings panel and curved dashboard.

- Tours advance manually via `next()` / `previous()` or automatically when a step's condition is satisfied.
- Each step displays a camera-rig-attached instruction card and a pulsing highlight ring around the target.
- A narration tone plays per step when audio feedback is enabled.
- Start the tour from the wheel menu under **Panels → Tour** or programmatically with `world.startTour()`.

## Atmosphere & Theme Presets

`src/vr/WorldTheme.ts` controls the cyberspace mood: fog density/color, ambient/point light intensities, grid colors, and a slow ambient dust particle field. Each dataset load can request a preset so the environment matches the data's emotional register.

Available presets: `neonMidnight`, `daylightGlobe`, `coolDepth`, `warmAnomaly`, `deepNet`.

- Loading a sample dataset by key automatically applies a mapped preset (e.g., `fraud-graph` → `warmAnomaly`, `sensor-stream` → `coolDepth`).
- Walking through a Farcaster portal warps the camera, applies a zone-specific preset, and performs the portal's data operation.
- The **Cycle Theme** wheel-menu action lets the user browse presets manually; the current choice is logged to the VR Console.
- `TechnoCoreNode` and `FarcasterPortal` intensify their glow/pulse when data activity is high, tying the visuals to live or dynamic datasets.

---

## Functional Landmarks

The TechnoCore and Farcaster portals are no longer purely decorative set dressing; they are part of the analysis workflow.

### TechnoCore — Lens Hub

`src/vr/artifacts/TechnoCoreNode.js`

- **Pinch/select** the core to cycle the lens mode: `off` → `statistical` → `anomaly` → `off`.
- Each mode tints the core, megasphere, and rings with a distinct color:
  - `off` — cyan
  - `statistical` — teal (`statistical lens` on)
  - `anomaly` — magenta (`anomaly` data operation applied)
- The core's pulse intensity scales with the amount of analysis history (`analysisHistory.length / maxFrames`), so a busy session literally glows brighter.
- Lens-mode changes emit a dedicated core tone and a short haptic pulse.

### Farcaster Portals — Data-Transformation Gates

`src/vr/artifacts/FarcasterPortal.js`

- Each portal carries a registered data operation (e.g., `anomaly`, `reset`, `filter`).
- **Step through** a portal to warp to its target zone and apply that operation to the dataset.
- Portals preview their active state: when the user is within ~2.5 m, the ring, horizon, and halo brighten, signaling that the gate is armed.
- After a warp the portal plays a zone-specific tone and a stronger haptic pulse.
- Current wiring:
  - **Portal A (Deep Net)** — applies the `anomaly` operation and warps to the deep-net zone.
  - **Portal B (Local Matrix)** — applies `reset` and returns the camera to the origin.

---

## Phase 7 Interaction Metaphors

Beyond the core operations, Nemosyne defines six spatial metaphors for reasoning about data. They are available as `interaction` spec values and are triggered on node selection.

| Metaphor            | Effect                                                                                 | Best For                     |
| ------------------- | -------------------------------------------------------------------------------------- | ---------------------------- |
| **RESONANCE_PULSE** | Expanding rings travel from the selected node to its graph neighbours.                 | Graphs / networks            |
| **FORK_PLANE**      | A translucent plane bisects the artefact, highlighting the selected item's half-space. | Tabular / spatial partitions |
| **CHRONO_DIAL**     | A rotating clock-face ring appears around a time-series point.                         | Time-series                  |
| **CONSTELLATION**   | Ephemeral lines connect the selected node to up to eight related nodes.                | Networks / similarity        |
| **BEACON**          | A vertical light column rises from the selected point.                                 | Geo / dense tabular spaces   |
| **ALEPH**           | All other visible nodes briefly flash a connection to the selected node.               | Dense graphs                 |

The metaphors are implemented in `src/vr/interactions/MetaphorActions.ts` and wired into `VRTopologyTranslator`. By default the constraint engine still prefers base interactions (`TRAVERSE_EDGE`, `INSPECT_CELL`, etc.); tuning the metaphor soft-constraint weights selects them.

## Holographic Inspector

`src/vr/artifacts/HolographicInspector.js` replaces the old flat `DataCard` with a gravity-glove-style slate:

- Appears near the active pointer hand when a node is selected, then smoothly follows the hand.
- Always faces the user's head so text stays readable.
- Renders the node's title, category badge, and key/value fields on a dark scanlined slate.
- Dismissed by a quick downward flick of the pointing hand or by looking away for more than ~0.8 s.
- Plays a short confirm tone and a transient hit marker on open, and a release tone on close.

This matches the diegetic UI pattern used in Half-Life: Alyx and No Man's Sky: information lives in the world, attached to the user's body, rather than as a fixed HUD element.

---

## Contextual Gaze Tooltips

`src/vr/ui/TooltipManager.ts` keeps label clutter low with a pooled set of world-space gaze tooltips:

- A compact label fades in when you look at a node for more than ~400 ms.
- Nodes within arm's reach show labels immediately via the existing `LODManager` rules.
- Tooltips billboards toward your eyes and float just above the node, so they stay readable from any angle.
- They fade out as soon as you look away or the node is no longer visible.

Only a small pool of tooltips is active at once, so dense datasets do not turn into a wall of text.

---

## Spatial Dashboard (Curved, Scrollable Workspace)

`src/vr/ui/DashboardManager.ts` now lays out 2D `ChartPlane`s and diagnostic panels on a curved, scrollable grid in front of the analyst:

- The dashboard is attached to the camera rig and wraps around the user in a front-facing semi-circle (default radius 1.35 m, 180° arc), so panels stay readable without turning around.
- The grid has angular columns and vertical rows. More panels than fit in the visible arc are parked just off-screen and roll into view when the carousel is scrolled.
- Faint wireframe snap zones appear while a panel is being dragged; the nearest zone highlights in magenta.
- Dropping a panel near a zone snaps it into place, orients it toward the analyst, and scales it to fit the cell.
- Dropping a panel into an off-screen zone auto-scrolls the carousel to bring that zone into view.
- Chart panels are created automatically from the active dataset (`ChartPlanePanel.ts`) and update when data operations run.
- The constellation wheel menu provides **Scroll Left**, **Scroll Right**, and **Reset Dashboard** actions under Panels.

This borrows the cockpit-style panel layout from _Elite Dangerous_ and _No Man's Sky_ (information arranged in world space around the pilot) and the carousel paging common in VR game menus (_Echo VR_, console radial menus). The grid itself is inspired by the Google VR Constellation Menu and _Starblood Arena_ circular HUD: a regular angular arrangement that builds spatial muscle memory.

---

## Analyst Anchor

The analyst (the user's head / camera rig) is now the explicit anchor for all HUD elements:

- `PanelManager`, `DashboardManager`, and `HandWheelMenu` are parented to a dedicated `analystAnchor` group under the camera rig.
- Movable panels, the launcher ring, the curved dashboard, and the constellation wheel menu all travel with the analyst instead of floating at fixed world positions.
- This keeps pointer rays, panels, and menu nodes clustered in the user's personal space, so the workspace is readable from any position in the memory palace.
- The datum plane, TechnoCore landmark, and Farcaster portals remain world-anchored — they are the memory-palace substrate.

The anchor is exposed as `world.analystAnchor` and can be offset programmatically if a particular body-locked position (chest, belt, shoulder) works better for a deployment.

---

## 3D Flight Navigation

A toggleable flight mode adds full 3D translation (X, Y, Z) to the standard ground-constrained locomotion:

- **Toggle**: Wheel menu → Views → Toggle Flight (or `Locomotion.toggleFlight()`).
- **Horizontal**: Left thumbstick continues to strafe and move forward/back relative to headset yaw.
- **Vertical**: Right thumbstick up/down moves the analyst up and down.
- **Gestures**: When flight mode is active, `scoopUp` ascends and `scoopDown` descends.
- **Drop to Floor**: Wheel menu → Views → Drop to Floor instantly returns the analyst to floor level.
- Flight mode and teleport mode are mutually exclusive — enabling one disables the other.

---

## Feedback

Every data operation, selection, and recognized gesture provides multi-modal feedback via `src/vr/audio/SelectionFeedback.js`:

- **Visual** — artefact scale/position/color change; pointer ray flashes white on select and gesture.
- **Audio** — procedural Web Audio API tones: subtle tick on hover, two-tone confirm chirp on select, and a unique short tone for each gesture command.
- **Haptic** — controller vibration (Quest native) on select/drag/gesture, with a fallback to `navigator.vibrate` when no XR haptic actuator is available.
- **UI** — VR Console logs the operation and affected row count.

Each channel can be toggled independently in the **Settings Panel** or programmatically through `SelectionFeedback.setToggles({ audio, haptic, visual })`.

---

## Design Rationale

The goal is to make data operations feel like physical actions in a place:

- **Filtering** should feel like _removing_ objects from view.
- **Aggregating** should feel like _merging_ objects.
- **Sorting** should feel like _rearranging_ objects on a shelf.
- **Time-slicing** should feel like _cutting through_ a stream.
- **Clustering** should feel like _gathering_ similar objects; hierarchical clustering unfolds like a dendrogram, while density clustering separates dense clouds from noise.
- **Anomaly highlighting** should feel like _spotlights_ on records that break the pattern.
- **Outlier lens** should feel like pulling suspects to the front of the room for inspection.

This spatial-motor mapping is intended to offload working memory to the body and the environment.
