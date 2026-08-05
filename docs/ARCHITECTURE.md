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

### 1b. Rust/WASM Core (`wasm/`)

A gradually expanding Rust runtime compiled to WebAssembly. Phase 0 establishes the build loop, shared memory, and a minimal ABI surface. Future phases port the data layer, scene graph, command buffers, Draco layouts, input state, and networking state machine into Rust while three.js remains the WebGL/WebXR renderer.

- **ABI** — exported functions return `u32` handles or `(ptr, len)` offsets; imported functions are limited to logging, timestamps, and telemetry.
- **Memory** — shared `WebAssembly.Memory` starts at 128 MB and grows to 512 MB; JS reads typed arrays directly from the WASM buffer.
- **Command buffer** — packed, 4-byte-aligned `u8` stream with a versioned header and opcode/payload structure; JS `CommandApplier` consumes it once per frame.
- **Bridge** — `src/wasm/RuntimeBridge.js` loads `wasm/pkg/nemosyne_wasm_bg.wasm`, exposes `allocBytes` / `readBytes`, and forwards per-frame `update(delta, time)` calls.

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

- **DataOperations.ts** — maps dataset operations (filter, sort, aggregate, cluster, slice) to artefact transforms.
- **MetaphorActions.ts** — Phase 7 transient spatial effects: Resonance Pulse, Fork Plane, Chrono Dial, Constellation, Beacon, Aleph.

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

- ES modules only; Vite is required for serving and bundling.
- `npm run dev` and `npm run build` invoke `wasm-pack` first to compile the Rust crate in `wasm/`.
- Three.js loaded via import map (`three@0.168.0`).
- WebXR uses `local-floor` reference space with optional `hand-tracking`.
- `XRInputSourceArray` is normalized with `Array.from()` because Quest Browser's array-like object lacks `Array.prototype` methods.
- Panels, dashboard, and wheel menu are parented to a dedicated `analystAnchor` under the camera rig so the workspace clusters around the user while remaining draggable in local space.

---

## Testing

- Vitest with jsdom.
- `tests/setup.js` provides a robust WebGL/Canvas 2D mock.
- `cargo test --manifest-path wasm/Cargo.toml` for pure Rust modules.
- `wasm-pack test --headless --chrome` for browser-facing Rust modules (added as the WASM surface grows).
- Unit tests cover: data parsing, Draco engine, live connectors, panel system, VR interactions, WebXR lifecycle, and the WASM bridge.

---

## Extension Points

- New artefacts: add geometries to `VRTopologyTranslator` and behaviours/interactions to `VRChannels`.
- New constraints: register rules in `ConstraintEngine`; expose new facts in `extractFacts`.
- New scalable renderers: add them under `src/vr/scalability/` and reference them in `VRTopologyTranslator`.
- New live sources: add entries to `OpenDataSources.js`.
- New interactions: extend `DataOperations.ts`, `MetaphorActions.ts`, and the hand wheel menu.
