# Nemosyne — Features

> A personal, experimental WebXR spatial data analysis project — not a maintained
> product. Status below is honest: **shipped** means it runs and is tested;
> **experimental** means it runs but is rough or incomplete; **planned** means the
> scaffolding exists but is not wired in. See [ROADMAP.md](./docs/ROADMAP.md) for
> detail and current status.

Nemosyne maps multi-dimensional datasets into interactive 3D "memory palaces" using
three.js / WebGL / WebXR, a Draco-style constraint recommender, a (gradually
migrating) Rust/WASM compute layer, and an experimental WebRTC collaboration layer.

---

## Core Features

### 1. WebXR Spatial Render Engine — _shipped_
- Direct three.js + WebXR core; frame budget targeting steady frame rate on standalone Meta Quest headsets.
- Cockpit-style semicircle dashboard (`DashboardManager`) — curved workspace wall with fixed angular columns, billboard orientation, and snap-to-zone dragging.
- Body-locked radial wheel menu (`HandWheelMenu`) — muscle-memory radial menu anchored at chest height.
- Diegetic holographic inspector — hand-following slate for deep row metadata inspection.
- Spatial audio feedback (`SelectionFeedback`) — Web Audio selection/hover tones.

### 2. Draco Constraint Recommender & Layout — _shipped_
- Symbolic constraint engine (`ConstraintEngine`) that evaluates 3,168 candidate visual specifications from dataset facts provided by `AtlasCore` (a Draco-style recommender, not a heavyweight optimizer).
- 3D spatial layout generators: `Grid3D`, `ForceDirected3D`, `RadialTreeLayout`, `TimeSeriesRibbonLayout`, `StreamlineLayout`, `GeoSurfaceLayout` — with native WASM layout algorithms (`wasm/src/layouts/`).
- Interactive representation carousel with diegetic weight sliders.

### 3. Data Operations & History — _shipped_
- Pure dataset operations executed in the native Rust WASM kernel: filter, sort, aggregate, cluster (k-means++, DBSCAN, hierarchical), time-slice, anomaly detection.
- Undo/redo history stack with gesture and keyboard shortcuts.
- Live-stream connectors (WebSocket / REST polling) feeding incremental palace updates.

### 4. Scalability — _shipped_
- `InstancedMesh` / GPU point cloud / `SpatialIndex` / `LODManager` paths by dataset size.
- Geometry & material object pooling (`ObjectPool`) and time-sliced batch execution to reduce load-time frame spikes.

### 5. Rust / WASM Compute Layer (Analytical Kernel) — _shipped (sole analytical authority)_
- Native Rust crate (`wasm/`) running data parsing (CSV, JSON, Arrow IPC stream), statistical profiling, clustering, anomaly detection, TDA Mapper graph synthesis, and layout simulation.
- All analytical operations execute in WebAssembly with cryptographic provenance side-channel envelopes (`{ kernel, kernelVersion, operation, parameters, inputFingerprint, outputFingerprint, timestamp }`).
- JS analytical fallback was completely removed; Rust is the sole analytical authority.

### 6. Gesture Recognition & JIT Hints (Analyst Cockpit) — _shipped_
- 3D joint-trajectory gesture classifier with biomechanical auto-calibration and just-in-time hints.
- 4-mode authoritative interaction FSM (`NAVIGATE | INTERACT | TRANSFORM | OBSERVE`).
- 3-level radial HandWheel navigation (`ANALYSE | VIEW | DATA | STUDY | COLLABORATE | SYSTEM`) with gaze intent acquisition and pinch confirmation.
- Ephemeral transient context cards and contextual task surfaces.

### 7. WebRTC Multi-User Collaboration — _experimental_
- `NetworkManager` / `SignallingChannel` peer-to-peer data channels sharing camera pose and room presence (data stays local — each peer sees their own dataset).
- Optional shared-secret token gate and duplicate-peerId rejection on the signalling server (see [GETTING_STARTED.md](./docs/GETTING_STARTED.md)).
- User-presence HUD radar and peer presence indicators.

### 8. Topological Data Analysis — _shipped_
- Native Rust WASM TDA kernel computing 1D Mapper graphs, 1D-persistence barcode intervals, and Betti-0 radius sample curves (`wasm/src/data/topology.rs`).
- Diegetic world-space TDA canvas panels (`TDAPlanes.ts`).

### 9. First-Class Evidence Entities & In-VR "Mark Moment" — _shipped_
- Formal evidence domain models (`Observation`, `Finding`, `Annotation`) preserving 3D observer spatial perspective (`[x, y, z]` coordinates, orientation, active dataset version, focal targets).
- Append-only `EvidenceLedger` recording attributable investigation provenance and queryable evidence graphs.
- Diegetic in-VR "Mark Moment" workflow with haptic pulse feedback, visual beacon animation, and HandWheel menu integration.

### 10. Adaptive Pointer Smoothing & Jitter Suppression — _shipped_
- Velocity-adaptive 1-Euro `PointerRayFilter` smoothing controller/hand rays in WebXR.
- Eliminates physiological tremor and sensor noise during long-range pointing at 50k point clouds on Meta Quest 3S while maintaining zero perceptible lag during rapid sweeps.

### 11. Headless Investigation Replay & `.nemosyne` Packaging — _shipped_
- Deterministic `.nemosyne` ZIP package archiving and streaming extraction with `valibot` schema-validated integrity manifests.
- Clean-room `InvestigationReplayRunner` replaying investigations headlessly against the Rust/WASM kernel and asserting 100% bit-for-bit analytical and evidence parity without WebGL or DOM dependencies.

---

## Technical Quality

- **Type safety**: 100% Pure TypeScript (`tsc --noEmit` → 0 errors; `@typescript-eslint/no-explicit-any` enforced as error in `src/`).
- **Tests**: Vitest suite with 234 test files and 1,512 passing tests (0 failures).
- **CI**: GitHub Actions matrix; lint and typecheck are blocking gates; `npm run build` must pass.
- **Rust unit tests**: `cargo test --manifest-path wasm/Cargo.toml` (85 unit tests passing).

---

## License

MIT © Tsatsu Amable