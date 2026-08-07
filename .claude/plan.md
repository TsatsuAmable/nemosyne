# Plan — Incremental TypeScript Migration

## Goal

Convert the entire Nemosyne JavaScript source tree to TypeScript module by module, while keeping the app runnable and the test suite green after each increment. The migration is a prerequisite for the Rust/WASM Phase 1 host bridge work: a typed JS host makes the `(ptr, len)` / handle ABI easier to verify and maintain, and shared types (`DatasetJSON`, `OperationSpec`, etc.) reduce bugs at the WASM boundary.

## Status

- [x] Tooling: `tsconfig.json`, `eslint.config.js`, `vitest.config.js`, and `package.json` scripts support `.ts` alongside `.js`.
- [x] Shared types module: `src/data/types.ts` centralizes `DatasetJSON`, `ColumnSchema`, `ColumnTypeValue`, `OperationName`, `OperationSpec`, and related interfaces.
- [x] WASM host bridge: `src/wasm/RuntimeBridge.ts` is fully typed and uses the shared types.
- [x] Phase 1 data layer: all core data modules converted to TypeScript.
  - `src/data/Dataset.ts`
  - `src/data/Parsers.ts`
  - `src/data/DatasetOperations.ts`
  - `src/data/SampleDatasets.ts`
  - `src/data/SyntheticData.ts`
  - `src/data/ImportError.ts`
  - `src/data/AnalysisHistory.ts`
  - `src/data/TopologyInference.ts`
  - `src/data/SessionStore.ts`
  - `src/data/connectors/DataConnector.ts`
  - `src/data/connectors/normalize.ts`
  - `src/data/connectors/PollingAdapter.ts`
  - `src/data/connectors/WebSocketAdapter.ts`
  - `src/data/connectors/OpenDataSources.ts`
- [x] Integration test: `tests/wasm-runtime.test.ts` imports shared types and exercises the WASM bridge.
- [x] Remaining data-layer JS files: `src/data/Encodings.ts`, `src/data/DefaultTour.ts`, `src/data/AnalysisTemplates.ts`, `src/data/serializers/index.ts`, `src/data/serializers/ArrowSerializer.ts`, `src/data/serializers/FlatBuffersSerializer.ts`, `src/data/serializers/MessagePackSerializer.ts`.
- [x] `src/draco/` layer converted to TypeScript.
  - `src/draco/types.ts` (shared Draco/artefact types)
  - `src/draco/ConstraintEngine.ts`
  - `src/draco/VRTopologyTranslator.ts`
  - `src/draco/DracoTopologyNode.ts`
  - `src/draco/DracoDiagnosticHUD.ts`
  - `src/draco/TDAGlyphs.ts`
  - `src/draco/layouts/LayoutBase.ts`
  - `src/draco/layouts/GridLayout3D.ts`
  - `src/draco/layouts/ForceDirected3D.ts`
  - `src/draco/layouts/RadialTreeLayout.ts`
  - `src/draco/layouts/GeoSurfaceLayout.ts`
  - `src/draco/layouts/TimeSeriesRibbonLayout.ts`
  - `src/draco/layouts/StreamlineLayout.ts`
  - `src/draco/layouts/index.ts`
- [x] `src/vr/coordinators/*.js` → `.ts`.
- [x] `src/vr/input/*.js` → `.ts`.
  - PointerEventMachine, PointerRegistry, InteractableRegistry, SystemGestureDetector, ControllerGestureBridge, SelectionDispatcher.
- [x] `src/vr/interactions/*.js` → `.ts`.
  - ControllerGestureMapper, HandGestureRecognizer, DataOperations, ClusterTransforms, AnomalyTransforms, LivePreview, InPlaceOperationHandles, MetaphorActions.
- [x] `src/vr/artifacts/`, `src/vr/ui/`, `src/vr/audio/`.
  - [x] Wave 1: MovablePanel, PanelManager, VRConsole, OperationLogPanel.
  - [x] Wave 2: VRMenu, HandWheelMenu, SettingsPanel.
  - [x] Wave 3: TelemetryPanel, PerformancePanel, NetworkPanel, ChartPlanePanel, DashboardManager + ReviewBundle export button.
  - [x] Wave 4: InteractionCoach, NarrativeStrip, MiniOverview, PeerPresenceHUD, TooltipManager, GuidedTour.
- [x] Core VR runtime: `src/vr/Engine.ts`, `src/vr/Locomotion.ts`, `src/vr/DesktopControls.ts`, `src/vr/VRButton.ts`, `src/vr/WorldTheme.ts`.
- [x] Coupled VR facade: `src/vr/World.ts`, `src/vr/InputRouter.ts`, `src/vr/Controllers.ts`, `src/vr/Hands.ts`, `src/vr/InputTelemetry.ts`.
- [x] Increment 7: `src/vr/scalability/*.ts` (`index.ts`, `InstancedPointCloud.ts`, `LODManager.ts`, `SpatialIndex.ts`).
- [x] Increment 8: `src/utils/*.ts` (`Accessibility`, `Dispose`, `Download`, `PerformanceBudget`, `SeededRandom`, `Telemetry`, `GestureMapping`, `EventBus`, `ReviewBundle`).
- [x] Increment 9: `src/network/*.ts` (NetworkManager, Room, SignallingChannel, SignallingServerCore).
- [x] Increment 10: `src/analytics/TDAMapper.ts` and `src/ui/FileLoader.ts`.
- [x] Increment 11: `src/main.ts`.

## Migration standards

1. **One module at a time.** Rename `.js` → `.ts`, add types, run `npm run typecheck`, then run the relevant Vitest tests.
2. **Keep JS fallbacks where needed.** Files that the WASM bridge or legacy tests import with `.js` extensions may need import paths updated to `.ts` extensions (allowed by `allowImportingTsExtensions`).
3. **Use shared types.** Any type that crosses module boundaries (especially dataset JSON, operation specs, column schemas) must come from `src/data/types.ts`.
4. **Preserve runtime behavior.** Do not change logic during conversion unless a type error reveals a real bug; fix those bugs in separate commits.
5. **Update tests.** Rename `.test.js` to `.test.ts` when the module under test becomes `.ts`; import shared types from `.ts` sources.
6. **Verify before moving on.** Required checks after each increment:
   - `npm run typecheck`
   - `npm run lint`
   - `npx vitest run` (or the affected test files)
   - `npm run build`

## Next increment: `src/vr/artifacts/`, `src/vr/ui/`, `src/vr/audio/`

The data, Draco, coordinator, input, and interaction layers are now fully typed and green. The next increment is the artefact, UI, and audio subsystems. These are the largest remaining consumers of the typed coordinator and input classes, and they directly produce the rendered scene and panels.

- `src/vr/artifacts/DatumPlane.ts`
- `src/vr/artifacts/TechnoCoreNode.ts`
- `src/vr/artifacts/FarcasterPortal.ts`
- `src/vr/artifacts/HolographicInspector.ts`
- `src/vr/artifacts/DataCard.ts`
- `src/vr/artifacts/ChartPlane.ts`
- `src/vr/artifacts/TDAPlanes.ts`
- `src/vr/artifacts/IceVaultNode.ts`
- `src/vr/ui/MovablePanel.ts`
- `src/vr/ui/PanelManager.ts`
- `src/vr/ui/VRMenu.ts`
- `src/vr/ui/HandWheelMenu.ts`
- `src/vr/ui/VRConsole.ts`
- `src/vr/ui/DashboardManager.ts`
- `src/vr/ui/ChartPlanePanel.ts`
- `src/vr/ui/NetworkPanel.ts`
- `src/vr/ui/OperationLogPanel.ts`
- `src/vr/ui/PerformancePanel.ts`
- `src/vr/ui/TelemetryPanel.ts`
- `src/vr/ui/SettingsPanel.ts`
- `src/vr/ui/InteractionCoach.ts`
- `src/vr/ui/NarrativeStrip.ts`
- `src/vr/ui/MiniOverview.ts`
- `src/vr/ui/PeerPresenceHUD.ts`
- `src/vr/ui/TooltipManager.ts`
- `src/vr/ui/GuidedTour.ts`
- `src/vr/audio/index.ts`
- `src/vr/audio/SelectionFeedback.ts`

These modules are the renderable output of Nemosyne. Typing them will let us remove the remaining `LooseOptions` casts in `WorldUIManager.ts` and `WorldSceneComposer.ts`, and will prepare the way for the `ReviewBundle` export UI button.

### Success criteria

- `npm run typecheck` reports zero new errors.
- `npx vitest run` passes (especially `tests/world.test.js`, `tests/movable-panel.test.ts`, `tests/technocore-node.test.js`, `tests/chart-plane.test.js`).
- `npm run build` succeeds.
- No runtime regressions in panels, artefacts, or audio feedback.

## Following increments (rough order)

1. Core VR runtime: `src/vr/Engine.ts`, `src/vr/Locomotion.ts`, `src/vr/DesktopControls.ts`, `src/vr/VRButton.ts`, `src/vr/WorldTheme.ts`.
2. Coupled VR facade: `src/vr/World.ts`, `src/vr/InputRouter.ts`, `src/vr/Controllers.ts`, `src/vr/Hands.ts`, `src/vr/InputTelemetry.ts`.
3. `src/vr/scalability/*.js`.
4. `src/utils/*.js`.
5. `src/network/*.js`.
6. `src/analytics/TDAMapper.js`, `src/ui/FileLoader.js`, `src/main.js`.
7. Update `docs/ARCHITECTURE.md` and `CLAUDE.md` to state that Nemosyne is now TypeScript-first.
8. **Deferred:** Run an IWSDK hand/input helper spike. Defer any Meta Immersive Web SDK (or other external spatial UI library) spike until the TypeScript migration is complete, the UI layer is fully typed, and a lightweight visual-refinement evaluation has compared custom canvas-panel polish against third-party components.

---

# Plan — Expand `docs/index.html` applications and use cases

## Goal

The `nemosyne.world` landing page (`docs/index.html`) is the first place visitors learn what Nemosyne does. Right now the "Applications" and "Use Cases" sections describe aspirational domains (DICOM, FIX trading, molecular PDB, etc.) that are not backed by built-in sample datasets. This plan updates the page so every showcased example is directly reproducible in the live app today.

## Scope

### 1. `docs/index.html`

- **Hero copy** — replace the generic "Manipulate Reality" framing with the actual project identity: a three.js/WebXR spatial data analysis suite that turns tabular/hierarchical/graph/time-series/vector/geospatial data into interactive 3D memory palaces.
- **Quick Start code block** — replace the current snippet (which uses a non-existent `Dataset.fromJSON` API) with a working snippet based on the current `World` and `allSampleDatasets` exports.
- **Built-in datasets section** — add a concise reference table mapping each `allSampleDatasets` entry to its topology, primary artefact, and one supported operation.
- **Examples gallery** — refactor the 12 domain cards into topology-backed cards that map 1:1 to `src/data/SampleDatasets.js`. Each card lists the sample key, topology tag, generated artefacts, and a concrete interaction.
- **Use cases section** — expand from six generic blurbs into credible scenarios, each tied to a shipped sample dataset and a real feature (gesture operation, live stream, anomaly detection, chart plane, TDA summary, etc.).
- **Internal links** — link each gallery card to the matching `docs/examples/*.md` page and to `GETTING_STARTED.md` for the VR launch steps.

### 2. `docs/examples/*.md`

- Rewrite the existing example docs so they describe the matching built-in dataset, its columns, the topology the Draco engine infers, the artefacts `VRTopologyTranslator` produces, and a short walkthrough of supported operations.
- Remove or re-label "Extensions Required" lists. Only features that ship today (CSV/JSON import, live WebSocket adapter, gesture operations, clustering, anomaly detection, chart planes, TDA summary panels, session export) should be listed as current.
- Add any missing topology-specific docs so every gallery card has a resolving link.

### 3. Out of scope

- New sample datasets or parsers (CSV/Excel/Parquet/SQL connectors are roadmap work).
- URL query-parameter deep links to auto-load a dataset.
- Major CSS/theme redesign beyond what is needed to present the new content.

## Proposed built-in dataset mapping

Use this table to keep the gallery and example docs aligned with `src/data/SampleDatasets.js`.

| Sample key | Topology | Artefacts generated | Concrete operation to demo | Example doc |
|---|---|---|---|---|
| `supply-chain` | HIERARCHY | Conical tree nodes on plinth rings, beam parent-child edges | Filter by region, aggregate by region, anomaly on `riskScore` | `docs/examples/SUPPLY_CHAIN.md` |
| `fraud-graph` | GRAPH | Icosa nodes + beam edges, orb for high-influence hubs | Filter fraud nodes, anomaly on `amount`, k-means cluster | `docs/examples/FRAUD_GRAPH.md` |
| `sensor-stream` | TIME_SERIES | Time ribbon/trail with token markers | Time slice, live stream via `/__demo-stream`, anomaly on `vibration` | `docs/examples/INDUSTRIAL_IOT.md` |
| `sales-table` | TABULAR | Crystals on category plinths, auto-attached chart plane | Sort by `revenue`, aggregate by `region`, cluster | `docs/examples/SALES_TABLE.md` |
| `org-chart` | HIERARCHY | Radial tree on tiered rings | Aggregate by `level`, anomaly on `budget` | `docs/examples/EDUCATION.md` (or `ORG_CHART.md`) |
| `wind-field` | VECTOR_FIELD | Flow-ray streamlines + magnitude colour | Inspect magnitude, statistical lens (TDA summary) | `docs/examples/SCIENTIFIC_RESEARCH.md` |
| `social-graph` | GRAPH | Force-directed constellation | Filter by `group`, density cluster | `docs/examples/SOCIAL_GRAPH.md` |
| `financial-series` | TIME_SERIES | Time ribbon with OHLCV candle tokens | Time slice, anomaly on `close` | `docs/examples/FINANCIAL_MARKETS.md` |
| `geo-cities` | GEO | Geo-surface columns + zone boundaries | Filter by population, aggregate by region | `docs/examples/SMART_CITIES.md` |
| `flow-process` | GRAPH / FLOW | Process nodes + weighted beams/trails | Filter low-throughput stages | `docs/examples/FLOW_PROCESS.md` |

## Concrete use-case blurbs (all supported today)

1. **Factory floor monitoring** — Load `sensor-stream`, connect to the dev-server `wss://host/__demo-stream`, and watch temperature/vibration tokens update in the time ribbon. Use the wheel menu or `sliceDown` gesture to time-slice the stream and `Highlight outliers` to pulse magenta halos on anomalous readings.
2. **Fraud investigation** — Load `fraud-graph`. Fraudulent transactions lift as orbs with anomaly detection on `amount`. Filter non-fraud nodes with `pinchTogether` or the wheel menu to focus on the suspicious chain.
3. **Sales performance review** — Load `sales-table`. The Draco engine attaches a chart plane automatically. Sort by `revenue` (`sliceUp`), aggregate by `region`, and export the analysis story from the wheel menu.
4. **Organizational cost audit** — Load `org-chart`. Walk the radial tree, aggregate by `level`, and turn on the statistical lens (`scoopUp`) to see a correlation panel for `employees` vs `budget`.
5. **Market session replay** — Load `financial-series`. Scrub through the OHLCV ribbon with the time-slice operation to replay a trading session and spot volatility clusters.
6. **Geospatial benchmark** — Load `geo-cities`. Fly over room-scale lat/lon bars sized by `population` and coloured by `gdp`, then filter to the largest metros.

## Tasks

- [ ] Audit `src/data/SampleDatasets.js` and `src/data/SyntheticData.js` to confirm columns and operations for each entry.
- [ ] Rewrite hero subtitle and tagline in `docs/index.html`.
- [ ] Fix the Quick Start code block to use the real `World` + `allSampleDatasets` API.
- [ ] Add a "Built-in datasets" reference section to `docs/index.html`.
- [ ] Refactor the Examples Gallery into topology-backed cards using the mapping table above.
- [ ] Rewrite the Use Cases section with the six credible scenarios above.
- [ ] Create/rename example docs so every gallery card has a resolving page:
  - `docs/examples/SUPPLY_CHAIN.md`
  - `docs/examples/FRAUD_GRAPH.md`
  - `docs/examples/INDUSTRIAL_IOT.md` (rewrite)
  - `docs/examples/SALES_TABLE.md`
  - `docs/examples/ORG_CHART.md`
  - `docs/examples/SOCIAL_GRAPH.md`
  - `docs/examples/FINANCIAL_MARKETS.md` (rewrite)
  - `docs/examples/SCIENTIFIC_RESEARCH.md` (rewrite)
  - `docs/examples/SMART_CITIES.md` (rewrite)
  - `docs/examples/FLOW_PROCESS.md`
- [ ] Remove references to unsupported extensions (DICOM, FIX, PDB, OSM extrusion, etc.) from the rewritten example docs.
- [ ] Add/verify navigation anchors and internal links.
- [ ] Run `npm run build` in `nemosyne/` to ensure no static-file regressions.
- [ ] Optional: generate CSS list/table styles for the new reference section if the existing card grid is not suitable.

## Success criteria

- Every example and use case on `docs/index.html` maps to a sample dataset in `src/data/SampleDatasets.js`.
- No landing-page claim references unsupported formats or extensions.
- The Quick Start code block can be pasted into a local `nemosyne` build and produce a visible palace (modulo HTTPS certs).
- All gallery card links resolve to `docs/examples/*.md` files that describe shipped behaviour.
- The site still builds and renders without broken internal anchors.

---

# Plan — Rust/WASM Re-Architecture

## Goal

Move the heavy, GC-sensitive parts of Nemosyne into Rust-generated WebAssembly while keeping three.js as the WebGL/WebXR renderer. The JS host becomes a thin shell: it handles browser APIs, forwards input events, loads bytes into WASM memory, and flushes Rust-encoded command buffers to three.js each frame.

The desired characteristics are:

- **Rust, not C++**: use `wasm-bindgen`/`wasm-pack` and target `wasm32-unknown-unknown`.
- **Zero-copy / direct memory views**: JS reads layout, transform, and vertex data via typed-array views into the WASM memory buffer.
- **Command buffers**: Rust encodes per-frame draw/transform/audio/haptic/network commands into a packed binary stream in WASM memory; JS consumes the stream.
- **Integer handles / pointers**: entities, meshes, materials, buffers are referenced by `u32` IDs; JS keeps a lightweight ID→three.js object map.
- **Gradual replacement**: existing JS app keeps running while subsystems are ported one at a time.
- **Tests**: `cargo test` for pure Rust modules; `wasm-bindgen-test` for browser-facing modules; existing JS assertions are ported where practical.

## Why

Current runtime issues:

- JS-side GC pauses during large dataset operations and per-frame artefact updates.
- Large object churn in `DatasetOperations`, `VRTopologyTranslator`, and the animation loop.
- Deep object graphs in the three.js scene graph for large datasets.
- Repeated JS↔JS data copies when parsing live streams and serializing analysis stories.

Rust/WASM gives deterministic allocation, compact value types, SIMD-friendly math, and a single shared memory buffer. The command-buffer model lets JS spend most of its frame budget in browser APIs rather than application logic.

## Target architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  JS host layer (thin, browser-only)                                  │
│  - WebXR session, XRFrame, XRInputSourceArray                        │
│  - three.js renderer, materials, geometries, WebGL objects           │
│  - ID mapping: WASM handle → three.js Object3D / Mesh / BufferGeometry│
│  - InputRouter forwards raw events as integer streams               │
│  - CSV/JSON/WebSocket bytes copied into WASM memory                   │
│  - Audio / haptic output from command buffers                         │
│  - DOM panel rendering driven by Rust content commands              │
├──────────────────────────────────────────────────────────────────────┤
│  wasm-bindgen interface                                              │
│  - exported functions return (ptr, len) or integer handles          │
│  - imported functions only for logging / timestamp / crypto           │
├──────────────────────────────────────────────────────────────────────┤
│  Rust runtime                                                        │
│  - ECS/scene graph (Entity, Transform, MeshRef, MaterialRef)         │
│  - Math: Vec3, Quat, Mat4, AABB, spatial hash                        │
│  - Dataset, encodings, parsers, operations, clustering, anomaly     │
│  - Draco constraint engine + layout generators                     │
│  - Command encoder: draw, transform, audio, haptic, panel            │
│  - Spatial index, LOD, culling                                       │
│  - Input state machine + gesture recognizer                          │
│  - Networking state machine (room, presence, data channels)          │
└──────────────────────────────────────────────────────────────────────┘
```

## Crate layout

Add a `wasm/` directory at the project root:

```
wasm/
├── Cargo.toml
├── Cargo.lock
├── src/
│   ├── lib.rs                    # wasm-bindgen entry point
│   ├── memory.rs                 # Allocator, bump/ring buffers, view helpers
│   ├── math.rs                   # Vec3, Quat, Mat4, AABB, color
│   ├── scene/
│   │   ├── entity.rs             # ECS: Entity, Generation, ComponentMask
│   │   ├── transform.rs          # Local/world matrices, hierarchy
│   │   ├── graph.rs              # SceneGraph, parent/child relations
│   │   └── command_encoder.rs    # CommandBuffer, draw/transform/audio/panel ops
│   ├── data/
│   │   ├── dataset.rs            # Typed rows, column metadata
│   │   ├── encodings.rs          # Color/size/pulse/value mappers
│   │   ├── parsers.rs            # CSV/JSON → Dataset
│   │   ├── operations.rs         # filter, sort, aggregate, cluster, anomaly, slice
│   │   ├── synthetic.rs          # Sample dataset generators
│   │   └── topology.rs           # Topology inference facts
│   ├── draco/
│   │   ├── facts.rs              # Statistical / topology fact extraction
│   │   ├── constraints.rs        # Hard/soft constraints and scoring
│   │   ├── layouts.rs            # Grid, force-directed, radial tree, geo, ribbon
│   │   └── translator.rs         # Spec → SceneGraph command list
│   ├── input/
│   │   ├── state.rs              # Controller/hand/desktop pose state
│   │   ├── gestures.rs           # Pinch, slice, scoop, rotate recognizers
│   │   └── router.rs             # Map raw input to intents
│   ├── net/
│   │   ├── room.rs               # Peer, room, signalling state
│   │   └── protocol.rs           # Message serialization
│   ├── analysis/
│   │   ├── history.rs            # Undo/redo stack
│   │   ├── session.rs            # Saved session serde
│   │   └── tda.rs                # Lightweight TDA summaries
│   └── tests/                    # wasm-bindgen-test modules
├── pkg/                          # wasm-pack output (gitignored)
└── build.sh                      # wasm-pack --target web --out-dir pkg
```

Top-level workspace: `Cargo.toml` in `wasm/` only for now; later we may add a `crates/` workspace.

## Memory model

1. **Shared `WebAssembly.Memory`** initialized to 128 MB, growable to 512 MB.
2. **Rust owns the allocator** inside the module. JS does not allocate in WASM memory except through exported `alloc`/`dealloc` helpers.
3. **Row-major typed arrays** for numeric data:
   - `f32` vertices: `(x, y, z, nx, ny, nz, u, v)` interleaved.
   - `u16` indices.
   - `f32` transform matrices: 16 consecutive floats.
   - `u8` command stream.
4. **Stable handles**:
   - `Entity(u32)` — never re-used within a session (or generation-indexed).
   - `Mesh(u32)` — maps to a `THREE.BufferGeometry` on the JS side.
   - `Material(u32)` — maps to a `THREE.Material` on the JS side.
   - `Texture(u32)` — still loaded by JS; Rust references it by handle.
5. **Zero-copy reads from JS**:
   ```javascript
   const mem = wasm.memory;
   const ptr = wasm.get_transform_ptr(entity);
   const matrix = new Float32Array(mem.buffer, ptr, 16);
   // update three.js Object3D.matrix.fromArray(matrix) directly
   ```
6. **Ring buffers for live streams**:
   - A fixed-capacity row ring buffer in WASM memory.
   - JS copies only new bytes from the WebSocket message into the ring tail.
   - Rust processes the tail into the dataset and emits incremental scene commands.

## Command buffer design

Rust writes commands into a `u8` ring buffer in WASM memory. Each command is a small header plus payload.

```rust
#[repr(u8)]
enum Cmd {
    Clear = 0,
    SetTransform = 1,      // entity_id: u32, matrix_ptr: u32
    SetVisibility = 2,     // entity_id: u32, visible: u8
    DrawMesh = 3,          // entity_id: u32, mesh_id: u32, material_id: u32, layer_mask: u32
    UpdateVertices = 4,    // mesh_id: u32, ptr: u32, count: u32
    UpdateIndices = 5,     // mesh_id: u32, ptr: u32, count: u32
    SetInstanceMatrices = 6, // mesh_id: u32, ptr: u32, count: u32
    PlayTone = 7,          // freq: f32, duration_ms: u32, volume: f32
    PlayHaptic = 8,        // hand: u8, intensity: f32, duration_ms: u32
    SetPanelText = 9,      // panel_id: u32, ptr: u32, len: u32
    SetCameraRig = 10,     // position_ptr: u32, rotation_ptr: u32
    NetworkBroadcast = 11, // ptr: u32, len: u32
}
```

JS reads the command stream once per frame, applies transforms/visibility, updates geometry buffers, and issues draw calls. three.js retains object identity; only data changes.

## JS host responsibilities

| Responsibility | Notes |
|---|---|
| WebXR session lifecycle | `navigator.xr.requestSession`, `XRWebGLLayer`, reference spaces. |
| three.js renderer setup | Renderer, camera, scene root, lights (or command-driven lights). |
| ID ↔ object mapping | `Map<u32, THREE.Object3D>`, `Map<u32, THREE.BufferGeometry>`, `Map<u32, THREE.Material>`. |
| Input event forwarding | Each frame, write controller/hand poses and button states into WASM memory, then call `wasm.input_update()`. |
| Asset loading | Fetch CSV/JSON/WebSocket bytes, copy into WASM `alloc`ed region, call `wasm.data_load_bytes(topology, ptr, len)`. |
| Command flush | After `wasm.update(delta_ms, time_ms)`, read the command buffer and apply to three.js. |
| Audio/haptics | JS owns `AudioContext` and XR haptic actuators; executes commands. |
| DOM panels | A small panel manager that receives `SetPanelText` / `SetPanelPose` commands. |
| Telemetry / console | Forward Rust log messages via imported `js_log(level, ptr, len)`. |

## What stays in JS initially

- `Engine.js` shrinks to WebXR + renderer setup + command loop.
- `World.js` becomes a coordinator: create WASM runtime, load default dataset, wire input.
- `VRButton.js`, `DesktopControls.js`, and panel DOM code remain.
- `Parsers.js` is kept as a fallback until Rust CSV/JSON parsers are proven.
- Live WebSocket adapter stays in JS; it copies raw bytes into WASM.

## Phased migration plan

### Phase 0 — Tooling and foundation (1–2 weeks)

- [ ] Install Rust toolchain: `rustup target add wasm32-unknown-unknown` + `cargo install wasm-pack`.
- [ ] Create `wasm/Cargo.toml` with workspace + crate dependencies.
- [ ] Add a Vite plugin to invoke `wasm-pack` and serve `.wasm` files.
- [ ] Add `wasm-bindgen` and `js-sys` dependencies.
- [ ] Create a minimal `lib.rs` exposing `init(runtime_ptr)`, `memory()`, and a health-check ping.
- [ ] Add a JS host module `src/wasm/RuntimeBridge.js` that:
  - loads `wasm/pkg/nemosyne_wasm_bg.wasm`,
  - provides `alloc_bytes` / `read_bytes` helpers,
  - exposes `call('update', delta, time)`.
- [ ] Add `npm run wasm` and `npm run build:wasm` scripts.

**Success criteria:** `console.log(wasm.ping())` works in the browser; build passes.

### Phase 1 — Data layer in Rust (2–3 weeks)

Port the core data model and operations first; they are the easiest to test in isolation and deliver immediate value.

- [ ] Port `Dataset`, `ColumnType`, `Encodings` to `wasm/src/data/`.
- [ ] Port CSV/JSON parsers to Rust using `csv` and `serde_json` crates.
- [ ] Port `DatasetOperations` (filter, sort, aggregate, cluster, hierarchical, dbscan, anomaly, slice).
- [ ] Port `SampleDatasets` / synthetic generators.
- [ ] Port topology inference (`TopologyInference`).
- [ ] Add `wasm-bindgen-test` tests that mirror `tests/data.test.js`, `tests/dataset-operations.test.js`, `tests/parsers.test.js`, `tests/topology-inference.test.js`.
- [ ] Add JS bridge method `wasm.data_load_csv(ptr, len)` returning a dataset handle.
- [ ] Replace `src/data/Dataset.js`, `src/data/Parsers.js`, `src/data/DatasetOperations.js` usage in `World.js` with calls into WASM, while keeping the files for fallback.

**Success criteria:** All existing data/operation tests have Rust equivalents; JS app can still load sample datasets but the computation happens in WASM.

### Phase 2 — Scene graph and command buffers (3–4 weeks)

- [ ] Implement ECS in `wasm/src/scene/` with `Entity`, `Transform`, `LocalToWorld`, `MeshRef`, `MaterialRef`.
- [ ] Implement `CommandEncoder` that builds a packed command stream per frame.
- [ ] Add JS `CommandApplier` that reads the stream and updates three.js objects.
- [ ] Port `DatumPlane`, `TechnoCoreNode`, `FarcasterPortal` logic to Rust entity setup; JS keeps three.js assets.
- [ ] Port simple artefacts (Crystal, Column, Orb) to Rust command generation.
- [ ] Keep complex artefacts (ChartPlane, TDAPlanes, panels) in JS initially, driven by Rust data.
- [ ] Port `tests/movable-panel.test.js` and `tests/world.test.js` relevant parts to integration tests.

**Success criteria:** A simple scene (datum plane + 3 artefacts) renders via command buffers from Rust with no JS-side per-frame scene-graph traversal.

### Phase 3 — Draco layout engine in Rust (3–4 weeks)

- [ ] Port `ConstraintEngine` facts and constraints to `wasm/src/draco/`.
- [ ] Port layout generators: `GridLayout3D`, `ForceDirected3D`, `RadialTreeLayout`, `GeoSurfaceLayout`, `TimeSeriesRibbonLayout`, `StreamlineLayout`.
- [ ] Port `VRTopologyTranslator` to generate scene commands from a solved spec.
- [ ] Port `DracoTopologyNode` lifecycle (solve → synthesize → place → update).
- [ ] Add `wasm-bindgen-test` tests for each layout and the full Draco solve path.
- [ ] Add JS integration tests replacing `tests/draco.test.js` and `tests/draco-layouts.test.js`.

**Success criteria:** Loading a sample dataset produces the same palace layout via Rust-generated commands as the current JS version.

### Phase 4 — Input and interaction state machine (2–3 weeks)

- [ ] Port `HandGestureRecognizer` to Rust.
- [ ] Port `ControllerGestureMapper` pose/button state to Rust.
- [ ] Port `InputRouter` intent dispatch to Rust.
- [ ] Port `DataOperations.js` interaction transforms (filter fade, aggregate merge, sort reorder, etc.) to Rust command generation.
- [ ] Port `AnalysisHistory` undo/redo stack.
- [ ] Keep JS-only: WebXR pose polling, haptic/audio execution.

**Success criteria:** Hand and controller gestures produce the same operations as today; undo/redo is driven by Rust.

### Phase 5 — Networking and live streams (2–3 weeks)

- [ ] Move WebSocket adapter state machine and message normalization to Rust.
- [ ] Parse binary payloads (MessagePack, Arrow IPC, FlatBuffers) in Rust into the dataset ring buffer.
- [ ] Move room/signalling state to Rust (`NetworkManager`, `Room`, `SignallingChannel`).
- [ ] Emit network broadcast commands from Rust; JS sends them via the WebSocket/RTC channel.
- [ ] Keep JS-only: actual WebSocket and RTCDataChannel objects.

**Success criteria:** Live stream demo (`/__demo-stream`) updates the Rust dataset and emits scene commands; collaboration presence works through Rust state.

### Phase 6 — Polish, performance, test parity (2–3 weeks)

- [ ] Port remaining utility modules: `SeededRandom`, `PerformanceBudget`, `Telemetry`, `SessionStore`.
- [ ] Remove or archive the JS modules that are fully replaced.
- [ ] Profile Quest Browser frame time; optimize command buffer size and layout hot paths.
- [ ] Ensure `cargo test` passes and `wasm-pack test --headless --chrome/firefox` passes.
- [ ] Re-run full integration test suite; fix regressions.
- [ ] Update `README.md`, `docs/ARCHITECTURE.md`, and `CLAUDE.md` with the new architecture.

**Success criteria:**
- `cargo test` passes.
- `npm test` passes with comparable or better coverage.
- Production bundle size ≤ current 865 KB minified JS (WASM included).
- Frame time on Quest Browser ≤ 13.33 ms for the default dataset.

## Test strategy

- **Rust unit tests**: `cargo test` for pure modules (`data`, `math`, `draco`, `analysis`).
- **WASM browser tests**: `wasm-pack test --headless --chrome` for modules that touch memory or `wasm-bindgen`.
- **JS integration tests**: keep Vitest for end-to-end host behaviour; replace module-level tests with Rust equivalents.
- **Porting rule**: for every JS test file removed, add either a Rust test module or a JS integration test that exercises the same behaviour through the new bridge.

## Toolchain requirements

The current environment has Node.js but no Rust toolchain. To start Phase 0:

```bash
# Windows
winget install Rustlang.Rustup
rustup default stable
rustup target add wasm32-unknown-unknown
cargo install wasm-pack

# macOS/Linux
curl --proto '=https' --tlsv1.2 -sSf https://rustup.rs | sh
rustup target add wasm32-unknown-unknown
cargo install wasm-pack
```

## Build integration

Add to `package.json`:

```json
{
  "scripts": {
    "wasm": "wasm-pack build wasm --target web --out-dir pkg",
    "wasm:dev": "wasm-pack build wasm --target web --out-dir pkg --dev",
    "dev": "npm run wasm:dev && vite --host",
    "build": "npm run wasm && vite build",
    "test": "cargo test --manifest-path wasm/Cargo.toml && vitest run"
  }
}
```

Update `vite.config.js` to:
- copy `wasm/pkg/*.wasm` into `dist/`,
- treat `.wasm` as assets,
- serve `wasm/pkg/` during dev.

## Risks and mitigation

| Risk | Mitigation |
|---|---|
| WASM bundle size grows too large | Use `wasm-opt -Os`, LTO, and `wee_alloc` or `lol_alloc`; measure before/after. |
| `wasm-bindgen` API ergonomics slow iteration | Wrap low-level calls in `src/wasm/RuntimeBridge.js` so JS callers stay simple. |
| Debugging is harder | Keep source maps (`wasm-pack --debug` for dev) and a JS fallback path for each module. |
| Porting 69 Vitest test files takes too long | Port test files incrementally; keep JS tests running as regression harness. |
| WebXR pose latency from extra JS↔WASM hop | Batch poses once per frame; keep pose reading in JS, decision logic in Rust. |
| SharedArrayBuffer requires COOP/COEP | Already configured in `vite.config.js`; verify production headers. |

## Decision summary

You confirmed:
1. Rust over C++.
2. Keep three.js as WebGL renderer (no custom renderer).
3. Gradual replacement, not a big-bang rewrite.
4. `cargo test` + `wasm-bindgen-test`; port existing assertions.

This plan implements those choices. The first actionable step is installing the Rust toolchain and creating the `wasm/` crate + Vite integration. I recommend starting with Phase 0 only, validating the build loop before committing to Phase 1.

---

# Critique Response — Technical Standards for the Rust/WASM Migration

The original plan described *what* to port and *why*. This section records the gaps found during critique and defines the concrete technical solutions and standards the implementation must follow.

## 1. ABI surface — `(ptr, len)` and integer handles only

The `wasm-bindgen` boundary is intentionally narrow. Rust exposes a small set of exports; JS exposes a small set of imports. No `String`, `Vec`, or complex objects cross the boundary on hot paths.

### Exported functions (Rust → JS)

| Function | Return | Purpose |
|---|---|---|
| `init(seed: u64) -> RuntimeHandle` | `u32` | Create runtime, return handle. |
| `memory() -> Memory` | `WebAssembly.Memory` | Shared memory reference. |
| `alloc(len: u32) -> u32` | `u32` | Bump/heap allocate `len` bytes; return offset. |
| `dealloc(ptr: u32, len: u32)` | `()` | Free a previous `alloc`. |
| `data_load_csv(ptr: u32, len: u32) -> DatasetHandle` | `u32` | Parse CSV bytes in shared memory. |
| `data_load_json(ptr: u32, len: u32) -> DatasetHandle` | `u32` | Parse JSON bytes in shared memory. |
| `dataset_solve(handle: u32) -> SpecHandle` | `u32` | Run Draco on a dataset. |
| `scene_build(spec: u32) -> SceneHandle` | `u32` | Generate scene commands from a spec. |
| `update(delta_ms: f32, time_ms: f64) -> u32` | `u32` | Per-frame tick; returns command-buffer byte count. |
| `input_write(ptr: u32, len: u32)` | `()` | Copy input event/pose bytes into Rust. |
| `command_buffer_ptr() -> u32` | `u32` | Offset of the current frame command buffer. |
| `string_ptr(handle: u32) -> (u32, u32)` | two `u32` | (ptr, len) for a Rust-managed string/buffer. |
| `destroy(handle: u32)` | `()` | Release a handle and its Rust-owned resources. |

### Imported functions (JS → Rust)

| Function | Purpose |
|---|---|
| `js_log(level: u8, ptr: u32, len: u32)` | Forward Rust `log!` to browser console. |
| `js_now() -> f64` | High-resolution timestamp. |
| `js_random() -> f64` | Cryptographically-weak random for deterministic fallback. |
| `js_warn_discard(ptr: u32, len: u32)` | Telemetry: report dropped command bytes. |

### Rules

1. **No `wasm-bindgen` `String`/`Vec` on the frame hot path.** Use `(ptr, len)` pairs into shared memory.
2. **Handles are opaque `u32`.** JS keeps a `Map<u32, Object>` for three.js objects; Rust owns the generation/validity bits.
3. **Lifetime contract:** any pointer returned by `alloc` must be paired with `dealloc`, or be explicitly documented as transferred to Rust (e.g., dataset bytes).
4. **Endianness:** all multi-byte values are little-endian, matching WASM and the host platform.

## 2. Allocator strategy — two-tier, deterministic

A single global allocator is not enough for a real-time renderer. Use two tiers:

### Tier A — Per-frame bump allocator (`FrameArena`)

- One arena per thread of execution (single-threaded in WASM).
- Reset at the start of `update()`.
- Used for: command buffer, transform scratch arrays, pose state, transient strings.
- Size: 8 MB initially, growable to 32 MB. If an allocation fails, emit a `PlayTone` error beep and a telemetry warning; never panic on the render thread.

### Tier B — Long-lived heap allocator

- Used for: datasets, scene graph nodes, ECS tables, history stack, session store.
- Default choice: `dlmalloc` (stable, standard). Switch to `lol_alloc` only after measuring and confirming equivalent correctness.
- Avoid `wee_alloc`; it has known fragmentation issues on long-running sessions.

### Memory layout constants

```rust
pub const INITIAL_MEMORY_PAGES: u32 = 2048;      // 128 MiB
pub const MAX_MEMORY_PAGES: u32 = 8192;          // 512 MiB
pub const FRAME_ARENA_SIZE: usize = 8 * 1024 * 1024;
pub const COMMAND_RING_SIZE: usize = 2 * 1024 * 1024;
```

## 3. Command buffer wire format

The command stream is a packed `u8` stream. It must be 4-byte aligned at the start of each command so JS can read `u32`/`f32` values safely.

### Stream header (per frame)

```
0..4  magic      u32   0x4E4D5359 ('NMSY')
4..8  version    u16   major, u16 minor  (e.g., 0x0001)
8..12  byte_count u32   number of payload bytes following the header
12..16 checksum   u32   CRC32 of payload (optional in dev builds)
```

### Command structure

Each command begins with an 8-byte header:

```
0..1  opcode     u8    Cmd enum value
1..4  reserved   u8[3] zeroed, reserved for future flags
4..8  payload_len u32  bytes after the header (multiple of 4)
```

Followed by `payload_len` bytes of little-endian fields.

### Revised opcode table

```rust
#[repr(u8)]
#[derive(Copy, Clone, Debug)]
enum Cmd {
    Clear            = 0,   // no payload; clears the applier state
    SetTransform     = 1,   // entity_id: u32, matrix: [f32; 16]
    SetVisibility    = 2,   // entity_id: u32, visible: u8, pad[3]
    DrawMesh         = 3,   // entity_id: u32, mesh_id: u32, material_id: u32, layer_mask: u32
    UpdateVertices   = 4,   // mesh_id: u32, ptr: u32, count: u32, layout: u8
    UpdateIndices    = 5,   // mesh_id: u32, ptr: u32, count: u32, index_type: u8
    SetInstanceMatrices = 6, // mesh_id: u32, ptr: u32, count: u32
    PlayTone         = 7,   // freq: f32, duration_ms: u32, volume: f32, waveform: u8
    PlayHaptic       = 8,   // hand: u8, intensity: f32, duration_ms: u32
    SetPanelText     = 9,   // panel_id: u32, ptr: u32, len: u32
    SetPanelPose     = 10,  // panel_id: u32, position: [f32; 3], rotation: [f32; 4]
    SetCameraRig     = 11,  // position: [f32; 3], rotation: [f32; 4]
    NetworkBroadcast = 12,  // channel_id: u32, ptr: u32, len: u32
    DestroyEntity    = 13,  // entity_id: u32
    SetScissor       = 14,  // x, y, w, h: u32
    EnableLayer      = 15,  // layer_mask: u32, enable: u8
}
```

### Applier rules

- JS `CommandApplier` reads the stream once per frame, in order.
- Unknown opcodes are logged and skipped using the payload length.
- Commands that reference unknown entity/material/mesh handles are ignored (defensive, for async destruction).
- The command buffer is a ring; Rust writes one frame ahead while JS consumes the previous frame. Double-buffered to avoid stalls.

## 4. Scene graph split — Rust owns existence and local transforms, three.js owns world matrices

The biggest architectural risk is duplicating the full scene graph in Rust. The split must be explicit:

### Rust side (ECS in `wasm/src/scene/`)

- `Entity(u32)` — existence bit, generation counter.
- `LocalTransform` — position, rotation, scale.
- `Parent(u32)` — parent entity handle.
- `MeshRef(u32)`, `MaterialRef(u32)`, `LayerMask(u32)`.
- `Visibility(bool)`.
- Systems run each frame: `propagate_transforms`, `compute_world_matrices`, `cull_frustum`.

### JS side (three.js retained mode)

- `Object3D` tree mirrors the Rust parent/child graph only for entities that have a `MeshRef`.
- JS does **not** recompute world matrices; it copies the precomputed 4×4 matrix from Rust via `object.matrix.fromArray(...)` and sets `object.matrixWorldNeedsUpdate = true`.
- Parent/child relationships are updated only when commands `SetParent` / `DestroyEntity` arrive, not every frame.

### Handle allocation rules

1. `Entity` IDs are allocated sequentially from a pool; generation counter stored in a side table.
2. `Mesh` and `Material` IDs are allocated by Rust but the actual three.js object is created lazily on first `DrawMesh` command.
3. Reusing a destroyed handle must increment its generation; JS checks generation before applying commands.

## 5. Instancing and GPU point-cloud thresholds

To keep the JS side from creating thousands of draw calls:

| Entity count | Strategy |
|---|---|
| ≤ 256 unique meshes | Individual `THREE.Mesh` objects; fine for interaction. |
| 257 – 8,192 similar artefacts | `THREE.InstancedMesh` with per-instance matrix/color buffer updated via `SetInstanceMatrices`. |
| 8,193 – 65,536 points | GPU point cloud: one `THREE.Points` system, vertex attributes updated via `UpdateVertices`. |
| > 65,536 points | LOD + spatial indexing; emit aggregate representations (bins, histogram bars, TDA mapper graphs). |

### Standard thresholds (tunable per dataset)

```rust
pub const INTERACTIVE_MESH_LIMIT: usize = 256;
pub const INSTANCED_MESH_LIMIT: usize = 8_192;
pub const POINT_CLOUD_LIMIT: usize = 65_536;
```

The Draco translator chooses the representation based on `dataset.row_count()` and topology.

## 6. Capability flags — gradual cutover registry

Because this is a gradual migration, both JS and Rust implementations of a subsystem will coexist. Use runtime capability flags so the app can switch safely.

```rust
bitflags! {
    pub struct Capabilities: u32 {
        const DATASET_RUST      = 1 << 0;
        const PARSER_RUST       = 1 << 1;
        const OPERATIONS_RUST   = 1 << 2;
        const DRACO_RUST        = 1 << 3;
        const SCENE_RUST        = 1 << 4;
        const INPUT_RUST        = 1 << 5;
        const NETWORK_RUST      = 1 << 6;
        const COMMAND_BUFFER    = 1 << 7; // enabled once Scene is Rust
        const INSTANCING        = 1 << 8;
        const WASM_TELEMETRY    = 1 << 9;
    }
}
```

Default capability set for each phase:

- Phase 0: none.
- Phase 1: `DATASET_RUST | PARSER_RUST | OPERATIONS_RUST`.
- Phase 2: add `SCENE_RUST | COMMAND_BUFFER | INSTANCING`.
- Phase 3: add `DRACO_RUST`.
- Phase 4: add `INPUT_RUST`.
- Phase 5: add `NETWORK_RUST`.
- Phase 6: add `WASM_TELEMETRY`.

`World.js` reads `wasm.capabilities()` at startup and routes work accordingly. If a capability is off, the JS fallback module is used.

## 7. Bundle size targets — realistic phased goals

The original plan claimed “≤ current 865 KB minified JS (WASM included).” That is unrealistic for a Rust + `wasm-bindgen` build. Use these targets instead:

| Phase | Target size | Measured as |
|---|---|---|
| Phase 0 | ≤ 1.1 MB total | `wasm/pkg/*.wasm` gzipped + JS wrapper. |
| Phase 1 | ≤ 1.4 MB total | After data layer in Rust. |
| Phase 2 | ≤ 1.7 MB total | After scene + command buffer. |
| Phase 3 | ≤ 2.1 MB total | After Draco layouts. |
| Phase 6 | ≤ 2.5 MB total | Full migration, `wasm-opt -Os`, LTO. |

### Size budget by subsystem

- Runtime + allocator + math: ≤ 300 KB gzipped.
- Data + parsers + operations: ≤ 400 KB gzipped.
- Draco + layouts: ≤ 500 KB gzipped.
- Scene + command encoder: ≤ 300 KB gzipped.
- Input + networking: ≤ 300 KB gzipped.

Use `twiggy` and `wasm-objdump` to attribute bytes. Revisit features if a subsystem exceeds its budget by > 20%.

## 8. Profiling baseline — required before Phase 1

Do not start porting without measuring the current JS runtime. Record:

1. **Load time** — from `World.start()` to first palace render for each sample dataset.
2. **Frame time** — median / p95 / p99 on Quest Browser for the default dataset.
3. **GC pressure** — count and duration of major GC pauses during a 60-second session.
4. **Memory high watermark** — JS heap + GPU memory after loading the largest sample.
5. **Command buffer byte count** — estimated bytes JS would need to write today if it were command-buffer-driven.

Add a `PerformanceBaseline.md` under `docs/engineering/` with the numbers. The Phase 6 success criteria are:

- Frame time p95 ≤ baseline p95 × 0.80.
- Major GC pause count ≤ baseline × 0.50.
- Total bundle size ≤ 2.5 MB gzipped.
- Startup time ≤ baseline × 1.20 (WASM initialization is allowed to add up to 20%).

## 9. Networking scope — reduce Phase 5, defer binary protocols

The original Phase 5 was too broad. Adopt this narrower scope:

### In scope for Phase 5

- Move room/signalling state machine to Rust (`Room`, peer presence, last-seen timestamps).
- Move message serialization/deserialization for the existing JSON protocol to Rust.
- Emit `NetworkBroadcast` commands from Rust; JS only calls `WebSocket.send` / `RTCDataChannel.send`.
- Keep live WebSocket byte copying in JS; only the parsed rows are pushed to Rust via `data_push_rows(ptr, len)`.

### Deferred to post-Phase 6 / future roadmap

- Binary payload formats (MessagePack, Arrow IPC, FlatBuffers).
- Custom signalling server protocol beyond the existing JSON.
- Rust-owned WebSocket/RTC objects (requires `web-sys` imports that can be brittle).

This keeps Phase 5 focused on state and serialization, avoiding the instability of browser networking APIs in WASM.

## 10. Crate layout — mirror JS source tree, keep it flat

The original nested layout under `wasm/src/scene/`, `wasm/src/data/`, etc., is fine, but the Draco layouts should mirror the JS directory structure so that porting is mechanical.

Revised `wasm/src/` layout:

```
wasm/src/
├── lib.rs
├── memory.rs
├── math.rs
├── capabilities.rs
├── commands.rs          # opcode enum + command encoder
├── applier_protocol.rs  # header + ring buffer spec
├── data/
│   ├── dataset.rs
│   ├── column.rs
│   ├── encodings.rs
│   ├── parsers.rs
│   ├── operations.rs
│   ├── synthetic.rs
│   └── topology.rs
├── draco/
│   ├── facts.rs
│   ├── constraints.rs
│   ├── translator.rs
│   └── layouts/
│       ├── grid.rs
│       ├── force_directed.rs
│       ├── radial_tree.rs
│       ├── geo_surface.rs
│       ├── time_series_ribbon.rs
│       └── streamline.rs
├── scene/
│   ├── entity.rs
│   ├── transform.rs
│   ├── graph.rs
│   ├── handle.rs
│   └── cull.rs
├── input/
│   ├── state.rs
│   ├── gestures.rs
│   └── router.rs
├── net/
│   ├── room.rs
│   └── protocol.rs
└── analysis/
    ├── history.rs
    ├── session.rs
    └── tda.rs
```

Top-level `wasm/Cargo.toml` is a single crate. Convert to a workspace only if a second crate (e.g., a native benchmark harness) is added.

## 11. Test porting standards

For every existing Vitest file, one of three outcomes is required:

1. **Port to Rust unit test** (`#[test]` in `wasm/src/*/mod.rs` or `tests/*.rs`) if the module has no JS dependency.
2. **Port to `wasm-bindgen-test`** if the module touches shared memory, handles, or command buffers.
3. **Keep as JS integration test** through `RuntimeBridge.js` if the behaviour is host-specific (WebXR session, audio, haptics, file loading).

### Porting checklist per subsystem

- [ ] List all `tests/*.test.js` files and map each to outcome 1, 2, or 3.
- [ ] Preserve assertion semantics; do not weaken tests to make them pass.
- [ ] Add Rust tests for edge cases JS could not easily test (empty datasets, NaN handling, duplicate handles).
- [ ] Run `cargo test` and `wasm-pack test --headless --chrome` in CI before merging any Phase.

### Example mapping

| JS test | Rust target | Notes |
|---|---|---|
| `tests/parsers.test.js` | `wasm/src/data/parsers.rs` unit tests | CSV/JSON edge cases. |
| `tests/dataset-operations.test.js` | `wasm/src/data/operations.rs` unit tests | filter, sort, aggregate, cluster, anomaly. |
| `tests/draco-layouts.test.js` | `wasm/src/draco/layouts/*.rs` + `wasm-bindgen-test` | Verify handle outputs and matrix counts. |
| `tests/world.test.js` | JS integration via `RuntimeBridge.js` | Requires three.js + jsdom mock canvas. |

## 12. Build and CI standards

- `npm run dev` must build the WASM dev target first.
- `npm run build` must run `wasm-pack --release` and `vite build`.
- `npm test` must run `cargo test --manifest-path wasm/Cargo.toml` before Vitest.
- Add `.github/workflows/ci.yml` jobs:
  - `cargo fmt --check`
  - `cargo clippy --target wasm32-unknown-unknown -- -D warnings`
  - `cargo test`
  - `wasm-pack test --headless --chrome` (optional while headless Chrome is flaky)
  - `npm run build`
  - `npm test`
- Pin `wasm-pack` version in `package.json` `devDependencies` via a `postinstall` script or document the required version.

## 13. Documentation standards

- Every exported Rust function must have a rustdoc comment explaining its lifetime contract and handle semantics.
- Every command opcode must be documented with payload layout in `wasm/src/commands.rs`.
- `RuntimeBridge.js` must expose a typed JSDoc interface for every exported function.
- Update `docs/ARCHITECTURE.md` and `CLAUDE.md` at the end of each phase to reflect new capabilities.

## Updated decision summary

1. Rust over C++.
2. three.js remains the WebGL/WebXR renderer.
3. Gradual replacement via capability flags.
4. `cargo test` + `wasm-bindgen-test`; port existing assertions without weakening them.
5. Zero-copy memory views and integer handles only on the ABI.
6. Two-tier allocator (bump arena + stable heap).
7. Packed, aligned, versioned command buffer with a JS applier.
8. Scene graph split: Rust owns ECS/world matrices, three.js mirrors only renderable objects.
9. Instancing thresholds defined and enforced by the Draco translator.
10. Realistic bundle-size budgets per phase.
11. Profiling baseline required before any porting begins.
12. Networking Phase 5 reduced to state/serialization; binary protocols deferred.

Start with Phase 0 and the profiling baseline. Do not proceed to Phase 1 until the build loop, ABI, allocator, and command-buffer wire format have been reviewed and tested in isolation.

---

# Plan — UI/UX Refactor: Break God Classes into Loosely-Coupled Subsystems

## Goal

The UI/UX layer has grown a pair of God classes that absorb too many responsibilities:

- `src/vr/World.ts` (≈2,200 lines) composes the scene, creates every HUD panel, routes gestures, applies data operations, manages sessions, collaboration, live streams, settings, tours, themes, and analysis history.
- `src/vr/InputRouter.ts` (≈490 lines) mixes controller polling, hand tracking, panel raycasts, hover state, dwell selection, drag capture, and system-gesture detection.

This plan refactors them into smaller, single-responsibility classes connected by an event bus and clear delegation patterns. The refactor is not just cleanup: it is the enabling foundation for the research-backed UI/UX improvements already identified (direct manipulation, progressive disclosure, comfort settings, narrative scaffolding, collaboration-first UI, occlusion management, accessibility, live previews, and intent inference). Smaller, loosely-coupled classes make each of those improvements testable, swappable, and safe to iterate on. The public `World` API must stay backward-compatible so the existing Vitest suite continues to pass.

## Research takeaways (why the refactor matters)

The original UI/UX improvement plan was grounded in immersive-analytics research. The refactor keeps those goals but treats architectural separation as the *enabling work* for each of them:

- **Starblood Arena / cockpit HUD** — a modular HUD requires a `WorldUIManager` that owns panels independently of scene geometry and a `ComfortSettingsController` that can shift UI into focus/peripheral zones.
- **3D Radar Chart / gestural analytics** — direct manipulation and context-aware suppression need a clean `WorldInputCoordinator` and a split `InputRouter` state machine, not gesture logic buried in a 2,200-line class.
- **Tableau Vision Pro / novice-vs-expert split** — `UserModeController` (State pattern) can apply mode-specific behavior to the coach, tour, and tooltips without `World.js` branching on strings.
- **Google VR Constellation Menu** — icon-first wheel menus and guard angles are easier to evolve when `HandWheelMenu` is not also responsible for input polling and global gesture suppression.
- **VR UI best practices (Displays 2026)** — comfort, viewing distance, and lower-field placement are the domain of `ComfortSettingsController` and `WorldUIManager`, not ad-hoc logic in `World.js`.

## Scope

### In scope

- Extract cohesive subsystems from `World.js` into new coordinator/controller classes.
- Extract input-state management from `InputRouter.js` into focused state-machine classes.
- Introduce a lightweight `WorldEventBus` for cross-cutting concerns (interaction logging, auto-save, telemetry, settings broadcasts).
- Apply design patterns: Facade, Mediator, Strategy, State, Observer, Builder.
- Preserve every public property/method accessed by `tests/world.test.js`, `tests/world-coverage.test.js`, `tests/input-router.test.js`, and related UI tests.
- Run the full test suite after each extraction and fix regressions.

### Out of scope

- Refactoring non-UI subsystems (Draco engine, parsers, network internals).
- WASM migration work.
- Documentation/landing-page content updates.

## Current state assessment

| Component | Status | What's next |
|---|---|---|
| `HandWheelMenu` | Implemented; icons + guard angles + hover delay already ship | Keep behavior; make it a pure rendering/input widget owned by `WorldUIManager` |
| `MovablePanel` | Implemented; drag, minimize, accessibility exist | Extract rendering helpers; consider a newspaper/head-locked mode later |
| `VRMenu` | Implemented | Move button registry and operation dispatch out of `World.js` into `WorldUIManager` |
| `GuidedTour` | Implemented | Keep; let `UserModeController` decide when to start it |
| `InteractionCoach` | Implemented | Subscribe to `WorldEventBus` `'interaction'` events instead of being called directly |
| `NarrativeStrip` | Implemented | Subscribe to `'operation:applied'` / `'history:seek'` events |
| `MiniOverview` | Implemented | Owned by `WorldUIManager` |
| `PeerPresenceHUD` | Implemented | Owned by `WorldUIManager` |
| `DashboardManager` | Implemented | Owned by `WorldUIManager` |
| `PanelManager` | Implemented | Owned by `WorldUIManager` |
| `InPlaceOperationHandles` / `LivePreview` | Implemented | Driven by `DataOperationController` events |
| `Engine` / `World` | God-class risk | Refactor into facade + coordinators |
| `InputRouter` | God-class risk | Split into state-machine helpers |

## Responsibilities to split

| Responsibility | Currently in | New home |
|---|---|---|
| Scene landmark composition (datum plane, core, portals, inspector) | `World.js` constructor | `WorldSceneComposer` |
| HUD panel creation & lifecycle (VRMenu, console, settings, log, metrics, perf, network, coach, narrative strip) | `World.js` constructor | `WorldUIManager` |
| Dashboard creation & panel registration | `World.js` constructor | `WorldUIManager` |
| Hand wheel menu construction | `World.js` `_buildWheelMenu` | `WorldUIManager` |
| Gesture/context routing, pause/resume, reset view | `World.js` `_onGesture`, `_updateGestures`, `_updateInputContext` | `WorldInputCoordinator` |
| Data operation apply/preview/reset/history wiring | `World.js` `applyDataOperation`, `previewDataOperation`, `resetDataOperation` | `DataOperationController` |
| User-mode effects (tour auto-start, coach visibility, tooltip policy) | `World.js` `_applyUserModeSettings` | `UserModeController` |
| Comfort/panel-distance settings application | `World.js` `_applyComfortSettings`, `_applyPanelDistance` | `ComfortSettingsController` |
| Interaction logging, auto-save trigger, telemetry notifications | scattered in `World.js` | `WorldEventBus` + subscribers |
| Pointer hover/down/up/drag/dwell state machine | `InputRouter.js` | `PointerStateMachine` + `DwellSelectionController` |
| Controller/hand polling and system toggle detection | `InputRouter.js` | `InputPoller` |
| Selection dispatch (hover/leave/select callbacks) | `InputRouter.js` | `SelectionDispatcher` |

## Proposed class design

### New utility

#### `src/utils/EventBus.js` — `WorldEventBus`

A tiny typed pub/sub:

```js
export class WorldEventBus {
  on(topic, handler)
  off(topic, handler)
  emit(topic, payload)
  once(topic, handler)
}
```

Topics used by the UI refactor:
- `'interaction'` — `{ action, gesture, controller, result }`
- `'settings:changed'` — `{ key, value, all }`
- `'dataset:loaded'` — `{ entry }`
- `'operation:applied'` — `{ operation, rowCount }`
- `'operation:preview'` — `{ operation, previewDataset, originalDataset }`
- `'operation:clear-preview'`
- `'history:seek'` — `{ index, operation }`
- `'session:autosave-request'`

### New coordinators under `src/vr/coordinators/`

#### `WorldUIManager`

Owns every HUD object except the runtime scene landmarks. Provides the public surface that `World.js` currently exposes directly:

```js
export class WorldUIManager {
  constructor(engine, analystAnchor, eventBus, callbacks)
  get panelManager()
  get dashboard()
  get handWheelMenu()
  get vrMenu()
  get vrConsole()
  get settingsPanel()
  get operationLogPanel()
  get metricsPanel()
  get performancePanel()
  get networkPanel()
  get interactionCoach()
  get narrativeStrip()
  get miniOverview()
  get peerPresenceHUD()

  buildWheelMenu(actions)
  toggleSettingsPanel()
  togglePanel(panel)
  showPanel(panel)
  hidePanel(panel)
  recenterPanels()
  applyAccessibility(options)
  updateNarrativeStrip(history)
  updateOperationLog(entries)
}
```

Internally it constructs `PanelManager`, `DashboardManager`, all `MovablePanel` subclasses, `HandWheelMenu`, `MiniOverview`, `PeerPresenceHUD`, and wires them to the engine updatables and input panels.

#### `WorldInputCoordinator`

Receives gesture names from `HandGestureRecognizer` and `ControllerGestureMapper`, resolves intent, applies context-aware suppression (hand near artefact/wheel menu), and delegates to the right subsystem via callbacks or events.

```js
export class WorldInputCoordinator {
  constructor(engine, eventBus, options)
  setHandlers({
    onApplyOperation,
    onPreviewOperation,
    onClearPreview,
    onCycleDataset,
    onResetView,
    onResetData,
    onUndo,
    onRedo,
    onTogglePause,
    onToggleSettings,
    onTogglePanels,
    onToggleStatisticalLens,
    onToggleMiniOverview,
    onTogglePeerPresence,
    onToggleDesktopPreview,
    onLoadTemplate,
  })
  update(delta, time)
  onGesture(name, ctx)
}
```

Moves `_updateGestures`, `_updateInputContext`, `_onGesture`, `_togglePauseInput`, `_resetView` out of `World.js`.

#### `DataOperationController`

Encapsulates the strategy for each data operation. Owns `_originalDataset`, `_transformedDataset`, and pushes to `AnalysisHistory`. Emits events so `WorldUIManager` can update the narrative strip, operation log, dashboard, and TDA summary.

```js
export class DataOperationController {
  constructor(eventBus, options)
  setOriginalDataset(dataset)
  get originalDataset()
  get transformedDataset()
  apply(operation)
  preview(operation)
  clearPreview()
  reset()
  undo()
  redo()
  seekHistory(index)
  get analysisHistory()
}
```

Operations are dispatched through a `OperationStrategyRegistry` (Strategy pattern):

```js
class OperationStrategyRegistry {
  register(name, strategy)
  computeDataset(operation, current, original)
  applyVisual(operation, artifact, dataset, original)
}
```

Strategies are small objects:

```js
const FilterStrategy = {
  computeDataset: (current, original) => computeFilter(current),
  applyVisual: (artifact, dataset) => applyFilter(artifact, dataset),
};
```

#### `WorldSceneComposer`

Builds shared scene landmarks and exposes them as properties. Keeps the `World.js` constructor from directly instantiating artefacts.

```js
export class WorldSceneComposer {
  constructor(engine)
  get datum()
  get core()
  get portals()
  get inspector()
  get analystAnchor()
}
```

#### `UserModeController`

State-pattern controller for `novice | intermediate | expert`. Applies effects to the guided tour, interaction coach, and tooltip manager.

```js
export class UserModeController {
  constructor(eventBus, options)
  setMode(mode)
  get mode()
}
```

#### `ComfortSettingsController`

Applies comfort-related settings to `Engine` and `Locomotion`, and repositions the analyst anchor for panel distance.

```js
export class ComfortSettingsController {
  constructor(engine, analystAnchor)
  apply(settings)
}
```

### `InputRouter.js` split

Keep `InputRouter` as a thin facade. Move internals into:

#### `src/vr/input/PointerStateMachine.js`

Tracks hover, down pointer, captured panel, drag state, and dwell target.

#### `src/vr/input/InputPoller.js`

Polls XR `inputSources`, maintains `controllerTriggerPressed`, `controllerGripPressed`, `lastHandPinched`, detects system toggles.

#### `src/vr/input/SelectionDispatcher.js`

Executes `onSelect` callbacks on hovered interactables and HUD click handlers, plays feedback.

#### `src/vr/input/DwellSelectionController.js`

Manages dwell timer and threshold for motor-accessibility selection.

## Mapping research-backed improvements to the new architecture

| # | Improvement | Enabling refactor | New/changed files |
|---|---|---|---|
| 1 | Icon-first wheel menu with guard angles | `HandWheelMenu` becomes a rendering widget owned by `WorldUIManager`; input guards move to `WorldInputCoordinator` | `src/vr/ui/HandWheelMenu.ts`, `src/vr/ui/IconAtlas.js` |
| 2 | Diegetic, in-place data operations | `DataOperationController` emits preview/apply events; `InPlaceOperationHandles` listens | `src/vr/interactions/InPlaceOperationHandles.js`, `src/vr/coordinators/DataOperationController.ts` |
| 3 | Progressive disclosure: novice/expert modes | `UserModeController` (State pattern) applies mode effects | `src/vr/coordinators/UserModeController.ts` |
| 4 | Better information hierarchy and comfort | `ComfortSettingsController` + `WorldUIManager` focus-zone logic | `src/vr/coordinators/ComfortSettingsController.ts`, `src/vr/Engine.ts` |
| 5 | Narrative scaffolding and breadcrumbs | `NarrativeStrip` subscribes to `WorldEventBus` | `src/vr/ui/NarrativeStrip.ts` |
| 6 | Collaboration-first UI | `PeerPresenceHUD` owned by `WorldUIManager`; `CollaborationCoordinator` already extracted | `src/vr/ui/PeerPresenceHUD.ts` |
| 7 | Occlusion management | `MiniOverview` owned by `WorldUIManager`; future gaze-occlusion logic in `WorldInputCoordinator` | `src/vr/ui/MiniOverview.ts` |
| 8 | Accessibility and cross-platform continuity | `ComfortSettingsController` applies settings; event bus syncs state | `src/utils/EventBus.js`, `src/vr/ui/MovablePanel.ts` |
| 9 | Live previews and contextual help | `DataOperationController` emits preview events; `LivePreview` already extracted | `src/vr/interactions/LivePreview.js` |
| 10 | Harden menu robustness and intent inference | `WorldInputCoordinator` context check; split `InputRouter` state machine | `src/vr/InputRouter.ts`, `src/vr/input/*.ts` |

## Public API compatibility strategy

`World.ts` becomes a facade that delegates to the new classes but keeps the legacy properties:

```js
this.uiManager = new WorldUIManager(...);
this.panelManager = this.uiManager.panelManager;
this.dashboard = this.uiManager.dashboard;
this.handWheelMenu = this.uiManager.handWheelMenu;
// etc.
```

Methods like `applyDataOperation(operation)` delegate to `dataOperationController.apply(operation)`. `_onGesture(name, ctx)` delegates to `inputCoordinator.onGesture(name, ctx)`. `_buildWheelMenu()` delegates to `uiManager.buildWheelMenu(actions)`.

Tests that spy on internal methods (e.g. `vi.spyOn(world, 'loadDataset')`) continue to work because the public method still exists.

## Event-driven cross-cutting

Replace direct calls like:

```js
this._logInteraction('Filter', { result: '12 rows' });
this._captureSession();
this._updateOperationLog();
this._updateNarrativeStrip();
```

With a single event:

```js
this.eventBus.emit('operation:applied', { operation, rowCount });
```

Subscribers:
- `InteractionCoach` logs the interaction.
- `OperationLogPanel` refreshes.
- `NarrativeStrip` re-renders.
- `World` queues an auto-save.
- `TelemetryCollector` records the operation.

This decouples the operation controller from UI panels and logging.

## Implementation order

### Phase A — Structural refactor (foundation)

1. **Add `WorldEventBus`** — pure utility, no existing code changes.
2. **Extract `DataOperationController`** — move `applyDataOperation`, `previewDataOperation`, `resetDataOperation`, history wiring. Keep `World.applyDataOperation` as a delegate. Run `npm test`.
3. **Extract `WorldUIManager`** — move panel/dashboard/wheel-menu construction. Keep all `world.*` references. Run tests.
4. **Extract `WorldInputCoordinator`** — move gesture/context code. Run tests.
5. **Extract `WorldSceneComposer`** — move landmark composition. Run tests.
6. **Extract `UserModeController` and `ComfortSettingsController`** — move settings-effect code. Run tests.
7. **Refactor `InputRouter.js`** — split into state machine / poller / dispatcher / dwell controller. Run tests.
8. **Wire the event bus** — replace scattered `_logInteraction` / `_captureSession` / `_updateNarrativeStrip` calls with events. Run full test suite.

### Phase B — Research-backed improvements (build on the refactor)

9. **Icon-first wheel menu** — replace remaining text-only labels; finalize guard-angle tuning.
10. **In-place operation handles** — extend topology coverage once `DataOperationController` events are stable.
11. **FOV focus zones and newspaper panel mode** — add to `WorldUIManager` / `ComfortSettingsController`.
12. **Advanced intent inference** — tighten context checks in `WorldInputCoordinator`.

## Success criteria

- `npm test` passes with no new failures.
- `World.js` is under 1,000 lines.
- `InputRouter.js` is under 250 lines as a facade.
- Every new class has a dedicated Vitest test file under `tests/`.
- Public `World` API remains backward-compatible: `tests/world.test.js` and `tests/world-coverage.test.js` pass without modification.
- No circular imports between new coordinator classes.
- The research-backed improvements already shipped (wheel menu icons, guard angles, novice/expert mode, narrative strip, mini-overview, peer presence, live preview, in-place handles, comfort settings) continue to work after the refactor.

## Risks and mitigation

| Risk | Mitigation |
|---|---|
| Tests rely on `world.*` internals | Keep facade properties and delegate methods; only move bodies. |
| Circular dependencies between coordinators | Pass `eventBus` and small callback objects, not the whole `World`. |
| Refactor is too large to land safely | Land one extraction at a time; run tests after each. |
| Event bus adds indirection that makes debugging harder | Keep topic names in a `WorldTopics` constant; log emissions in dev builds. |
| `InputRouter` refactor breaks hand/controller input | Keep original behavior in the facade; add characterization tests before splitting. |

---

# Plan — External SDK and Telemetry Review

## Goal

Make two architecture/product decisions that affect the next phase of Nemosyne:

1. **Meta Web SDK (IWSDK) evaluation** — decide whether to adopt, reject, or selectively borrow from Meta’s Immersive Web SDK.
2. **Telemetry / user-data review pipeline** — design a privacy-first mechanism that lets the user export a reviewable bundle of runtime telemetry and dataset/session metadata so we can base improvements on real evidence rather than assumptions.

Both decisions are recorded here and feed into the TypeScript migration and the UI/UX refactor already in progress.

## 1. Meta Immersive Web SDK (IWSDK) evaluation

### What it is

Meta’s toolkit is now called the **Immersive Web SDK (IWSDK)** (`@iwsdk/core`, `@iwsdk/create`). It is an open-source, Vite-based framework for building WebXR experiences. The GitHub repo is `facebook/immersive-web-sdk`, written in TypeScript, and explicitly “Powered by Three.js.”

- **License:** MIT (Copyright Meta Platforms, Inc. and affiliates).
- **Runtime target:** WebXR-compatible browsers; Meta lists Quest, Apple Vision Pro, Pico, Android XR, HTC Vive, and desktop emulators.
- **Key features:** VR/AR session management, hand tracking, one/two-hand and distance grabbing, locomotion, optional Havok physics, AR scene understanding, spatial UI via UIKitML, optional Meta Spatial Editor integration, and AI-assisted dev tooling.
- **Dependencies:** Node ≥20.19 <21, ≥22.12 <23, or ≥24; Vite-based build.

### Usefulness for Nemosyne

| Nemosyne need | IWSDK fit | Notes |
|---|---|---|
| WebXR session setup | Medium | Nemosyne already has a working `Engine.js` session layer. IWSDK would mainly reduce boilerplate. |
| Hand/controller input | High | Hand tracking, grab, and distance-interaction helpers could accelerate the `InputRouter` refactor and the new `PointerStateMachine`. |
| Spatial UI panels | Medium | UIKitML components might replace some `MovablePanel` canvas code, but Nemosyne’s panels are heavily data-driven and may not map cleanly. |
| Locomotion/comfort | Low–Medium | `Locomotion.js` already handles teleport anchors, ground movement, and flight mode; IWSDK’s helpers are generic. |
| Physics for artefact interactions | Medium | Optional Havok is interesting for future “physics-savvy” data operations, but not needed now. |
| Draco layout / data visualization | None | IWSDK has no opinion on constraint-driven layouts or data-to-artefact mapping; the core value of Nemosyne stays custom. |

### Openness and vendor lock-in

- **Runtime lock-in: low.** Output is a plain WebXR/three.js web app, hostable anywhere, shareable by URL. Meta and third-party reviewers agree the result is not tied to Quest.
- **Code lock-in: low.** MIT license permits forking or extracting isolated helpers. Source is on GitHub with active 2026 commits.
- **Ecosystem lock-in: medium if we go deep.** Optional dependencies create soft coupling:
  - Meta Spatial Editor for scene authoring.
  - UIKitML for spatial UI widgets.
  - Meta Horizon Store / PWA distribution policies.
  - Havok physics licensing (separate from the open-source IWSDK core).
- **Standards posture: good.** Meta docs recommend runtime feature detection, not user-agent sniffing, and point to the W3C Immersive Web Working Group and Interop 2026.

### Recommendation

**Adopt selectively, not wholesale.** Nemosyne should keep its own Engine, World, Draco, and artefact pipeline, but can borrow or lightly wrap IWSDK helpers for:

1. Hand-tracked grabbing and pointer abstractions during the `InputRouter` / `PointerStateMachine` refactor.
2. Spatial UI primitives if `MovablePanel` canvas rendering becomes a bottleneck.
3. A reference implementation for locomotion comfort defaults.

Before any code dependency is added, run a spike: add `@iwsdk/core` to a throwaway branch, replace one interaction helper (e.g., hand pinch/scroll), and measure bundle size and Quest Browser frame time. If the spike adds >150 KB gzipped or any frame-time regression, drop it and copy the pattern instead.

### Sources

- [Meta WebXR overview](https://developers.meta.com/horizon/documentation/web/webxr-overview/)
- [Meta IWSDK project setup](https://developers.meta.com/horizon/documentation/iwsdk/guides/01-project-setup/)
- [facebook/immersive-web-sdk on GitHub](https://github.com/facebook/immersive-web-sdk/)
- [IWSDK MIT LICENSE](https://github.com/facebook/immersive-web-sdk/blob/main/LICENSE)
- [VIVERSE: XR Blocks vs Meta IWSDK comparison](https://news.viverse.com/post/vibe-coding-webxr-xr-blocks-vs-iwsdk)
- [SkarredGhost hands-on review of Meta AI + IWSDK](https://skarredghost.com/2026/04/23/meta-ai-agentic-webxr-how-to/)
- [VR.org: WebXR Interop 2026 cross-browser standard](https://vr.org/articles/webxr-interop-2026-cross-browser-standard)
- [Metaverse Standards Forum: Open Metaverse Browser Initiative](https://metaverse-standards.org/news/blog/introducing-open-metaverse-browser-initiative/)

## 2. Telemetry / user-data review pipeline

### Current state

`src/utils/Telemetry.js` (`TelemetryCollector`) is an opt-in, in-memory collector. By design it **never transmits data externally**. It records:

- Frame-time histograms.
- Dropped-frame counts.
- Active dataset name and topology.
- Operation and gesture counters.
- Error/warning counts and the most recent error.

`src/utils/PerformanceBudget.js` tracks budget violations (frame time, draw calls, triangles, interactables, etc.) and is already wired into the runtime. `src/data/SessionStore.ts` can serialize a session snapshot (dataset, history, settings) to IndexedDB.

### What the user wants

A way to send telemetry and user data back to the supervisor so improvements can be grounded in real usage. This must not violate the existing privacy-first design.

### Proposed design: Analysis Review Bundle (ARB)

Introduce an explicit, user-initiated export called the **Analysis Review Bundle**. It is not an automatic upload; it is a file the user can review, redact, and then attach to a message to the supervisor.

#### Bundle schema (version 1)

```ts
interface AnalysisReviewBundle {
  version: 1;
  generatedAt: number;
  appVersion: string;
  privacyLevel: 'telemetry-only' | 'metadata' | 'full-session';
  telemetry: TelemetryReport;           // from TelemetryCollector.getReport()
  performance: PerformanceViolation[];  // from PerformanceBudget.getViolations()
  metadata?: {
    datasetName: string;
    datasetTopology: string;
    rowCount: number;
    columnSchema: ColumnSchema[];       // names + types only, no values
    sessionDurationSeconds: number;
    operations: Record<string, number>;
    gestures: Record<string, number>;
  };
  session?: SessionSnapshot;            // only if privacyLevel === 'full-session'
  userNotes?: string;                   // free-text context from the user
}
```

#### Privacy levels

| Level | Data included | Use case |
|---|---|---|
| `telemetry-only` | Frame times, errors, operation/gesture counts, active dataset name/topology. | Baseline performance and UX flow review. No row data. |
| `metadata` | Above plus column names/types, row count, performance violations. | Design better encodings and defaults for similar dataset shapes. No row values. |
| `full-session` | Above plus the full `SessionSnapshot` (dataset rows, history, settings). | Deep debugging or reproducing a specific analysis story. Requires explicit user review. |

#### Implementation sketch

1. **Export utility** `src/utils/ReviewBundle.js`:
   - `buildReviewBundle({ collector, performanceBudget, sessionStore, privacyLevel, userNotes })`.
   - Sanitizes telemetry: removes raw `lastError` stack traces if they contain URLs or file paths; keeps only the message.
   - Validates bundle schema; throws if required fields are missing.

2. **In-VR export flow** (added to `TelemetryPanel` or `SettingsPanel`):
   - User selects privacy level.
   - A preview screen shows exactly what will be exported.
   - User clicks “Download Review Bundle” → `downloadText(JSON.stringify(bundle, null, 2), 'nemosyne-review-bundle.json')`.
   - User can then paste the file into the chat with the supervisor.

3. **No automatic transmission.** The app does not know the supervisor’s endpoint. There is no `fetch`, WebSocket, or RTC send for bundles. This preserves the existing `Telemetry.js` guarantee and avoids GDPR/CCPA/health-data concerns.

#### Security and consent safeguards

- **Opt-in per export:** not a blanket “upload always” toggle.
- **No PII by default:** no user id, IP, browser fingerprint, or location at `telemetry-only` or `metadata` levels.
- **Row values only with explicit `full-session` selection** and the user can still redact before sending.
- **Local-only generation:** bundle is built in the browser and downloaded, not sent to a server.
- **Encrypted share optional:** future enhancement could encrypt the bundle to the supervisor’s public key before download.

### Recommendation

1. Create `src/utils/ReviewBundle.js` and a minimal `ReviewBundle.test.ts`.
2. Add a “Export Review Bundle” button to `TelemetryPanel.js`/`SettingsPanel.ts` after the current TypeScript migration reaches `src/vr/ui/`.
3. Do not add any network endpoint or auto-upload path.

### Relation to roadmap gaps

This directly addresses ROADMAP.md Evaluation Checkpoint gap #7 (“No user studies, task benchmarks, or telemetry to prove spatial analysis improves insight speed/accuracy over 2D tools”). The ARB gives us the evidence base without collecting user data automatically.

## Status

- [x] Meta Web SDK researched and evaluated.
- [ ] Add spike task to test IWSDK hand/input helper (deferred until after TypeScript migration of `src/vr/input/`).
- [x] Telemetry/user-data review mechanism designed.
- [x] Implement `src/utils/ReviewBundle.js`.
- [x] Add "Export Review Bundle" UI button to `TelemetryPanel.ts` and `SettingsPanel.ts`.

