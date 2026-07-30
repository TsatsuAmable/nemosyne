# Nemosyne Architecture

This document describes the architecture of the Nemosyne Spatial Data Analysis Suite runtime.

---

## System Overview

```
Raw Data (CSV/JSON/Live Stream)
         ↓
   Parsers / Connectors
         ↓
      Dataset
         ↓
  Draco Constraint Engine  ←── VR diagnostic HUD soft-weight tuner
         ↓
   Layout/Geometry/Behavior Spec
         ↓
   VRTopologyTranslator
         ↓
   Scalability (InstancedMesh / SpatialIndex / LOD)
         ↓
   three.js World (Crystal/Artefact meshes)
         ↓
   Controller / Hand Input
         ↓
   Inspect / Filter / Aggregate / Sort / Cluster / Annotate / Metaphor
```

---

## Layers

### 1. Data Layer (`src/data/`)

- **Dataset.js** — typed in-memory dataset with column metadata (numeric, categorical, temporal).
- **Parsers.js** — CSV/JSON parsing and type inference.
- **Encodings.js** — maps data values to color, size, and pulse.
- **SampleDatasets.js** / **SyntheticData.js** — built-in examples.
- **DatasetOperations.js** — pure functions for filter, sort, aggregate, cluster, slice.
- **connectors/** — live data adapters:
  - `DataConnector.js` — base class with callbacks.
  - `WebSocketAdapter.js` — auto-reconnecting WebSocket with subscriptions.
  - `PollingAdapter.js` — HTTP polling adapter.
  - `OpenDataSources.js` — registry of curated public feeds.
  - `normalize.js` — helpers to convert live messages into `Dataset` rows.

### 2. Draco Layer (`src/draco/`)

- **ConstraintEngine.js** — symbolic recommender.
  - Extracts facts from a dataset + topology hint.
  - Applies hard constraints to eliminate invalid specs.
  - Scores remaining specs with weighted soft constraints.
  - Returns the best `{ layout, geometry, behavior, interaction }` spec.
- **VRTopologyTranslator.js** — turns the spec into a Three.js artefact group.
  - Builds grid, force-directed, radial, streamline, or time-ribbon layouts.
  - Binds data values to geometry, color, size, and motion.
  - Returns interaction callbacks (hover/unhover/select).
- **DracoTopologyNode.js** — manages the lifecycle: solve → synthesize → place in scene → update.
- **DracoDiagnosticHUD.js** — floating VR panel for tuning soft-constraint weights.

### 3. VR Runtime Layer (`src/vr/`)

- **Engine.js** — Three.js scene, renderer, WebXR session management, animation loop.
- **WorldTheme.js** — fog, lights, atmosphere.
- **World.js** — composes the full scene: datumplane, landmarks, Draco palace, HUD, menu, live connectors.
- **InputRouter.js** — normalizes controller and hand input sources, routes raycasts and gestures.
- **Controllers.js** — Quest controller laser pointer.
- **Hands.js** — hand tracking, joint normalization, pinch detection.
- **Locomotion.js** — teleport anchors, ground-constrained movement, and toggleable 3D flight mode.
- **DesktopControls.js** — keyboard/mouse fallback for non-VR use.
- **VRButton.js** — WebXR entry button with manual `XRWebGLLayer` binding for Quest Browser.

### 4. Artefacts (`src/vr/artifacts/`)

- **DatumPlane.js** — pulsing neon grid floor.
- **IceVaultNode.js** — interactive data node metaphor.
- **TechnoCoreNode.js** — megasphere landmark with orbital rings.
- **FarcasterPortal.js** — zone transition portal.
- **DataCard.js** — world-space data inspector.

### 5. UI Layer (`src/vr/ui/`)

- **MovablePanel.js** — base class for analyst-anchored canvas panels.
- **PanelManager.js** — registers panels, independent toggles, launcher ring; reparents the HUD cluster to an explicit analyst anchor.
- **DashboardManager.js** — curved, scrollable, snap-zone workspace for chart and diagnostic panels.
- **ChartPlanePanel.js** — dashboard cell hosting a `ChartPlane`.
- **VRConsole.js** — intercepts `console.*` and renders recent messages to a panel.
- **VRMenu.js** — dataset switching, portal toggle, live source connection.
- **HandWheelMenu.js** — body-locked radial menu (not wrist-attached) for stable Meta Quest control.
- **TooltipManager.js** — pooled gaze and pointer-hit tooltips for data nodes and visual elements.
- **GuidedTour.js** — step-by-step spatial onboarding with highlight rings.

### 6. Interaction Layer (`src/vr/interactions/`)

- **DataOperations.js** — maps dataset operations (filter, sort, aggregate, cluster, slice) to artefact transforms.
- **MetaphorActions.js** — Phase 7 transient spatial effects: Resonance Pulse, Fork Plane, Chrono Dial, Constellation, Beacon, Aleph.

### 7. Scalability Layer (`src/vr/scalability/`)

- **InstancedPointCloud.js** — `THREE.InstancedMesh` wrapper for large point datasets.
- **SpatialIndex.js** — uniform-grid spatial index for radius and ray queries.
- **LODManager.js** — distance/gaze level-of-detail predicates.

### 8. Audio Feedback (`src/vr/audio/`)

- **SelectionFeedback.js** — Web Audio API tones + pointer-ray flashes for hover/select.

### 9. Utilities (`src/utils/`)

- **SeededRandom.js** — deterministic RNG for reproducible layouts.
- **Dispose.js** — Three.js object disposal helper.

---

## Data Flow

### Static dataset

1. User uploads CSV/JSON or selects a sample dataset.
2. `Parsers` produce a `Dataset`.
3. `ConstraintEngine.solve(dataset)` produces a spec.
4. `VRTopologyTranslator.synthesizeArtifact(spec, dataset)` builds the artefact group.
5. `World.loadDataset()` places the group in the scene and wires interactions.

### Live stream

1. `WebSocketAdapter` or `PollingAdapter` receives messages.
2. `normalize.rowsToDataset()` converts messages to rows.
3. `Dataset.updateRows()` appends/replaces rows.
4. `World._flushLiveUpdate()` calls `loadDataset()` or an incremental update path.
5. The Draco palace re-solves (or updates incrementally) and the new data appears in VR.

---

## Runtime Conventions

- ES modules only; no build required for development (Vite optional for HTTPS serving).
- Three.js loaded via import map (`three@0.168.0`).
- WebXR uses `local-floor` reference space with optional `hand-tracking`.
- `XRInputSourceArray` is normalized with `Array.from()` because Quest Browser's array-like object lacks `Array.prototype` methods.
- Panels, dashboard, and wheel menu are parented to a dedicated `analystAnchor` under the camera rig so the workspace clusters around the user while remaining draggable in local space.

---

## Testing

- Vitest with jsdom.
- `tests/setup.js` provides a robust WebGL/Canvas 2D mock.
- Unit tests cover: data parsing, Draco engine, live connectors, panel system, VR interactions, WebXR lifecycle.

---

## Extension Points

- New artefacts: add geometries to `VRTopologyTranslator` and behaviours/interactions to `VRChannels`.
- New constraints: register rules in `ConstraintEngine`; expose new facts in `extractFacts`.
- New scalable renderers: add them under `src/vr/scalability/` and reference them in `VRTopologyTranslator`.
- New live sources: add entries to `OpenDataSources.js`.
- New interactions: extend `DataOperations.js`, `MetaphorActions.js`, and the hand wheel menu.
