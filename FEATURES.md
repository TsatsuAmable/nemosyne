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
- Symbolic constraint engine (`ConstraintEngine`) that recommends layout, geometry, behavior, and interaction from data topology (a Draco-style recommender, not a heavyweight optimizer).
- 3D spatial layout generators: `Grid3D`, `ForceDirected3D`, `RadialTree` — currently computed in JS, with native WASM implementations present and under migration.
- Interactive representation carousel with diegetic weight sliders.

### 3. Data Operations & History — _shipped_
- Pure dataset operations: filter, sort, aggregate, cluster (k-means++, DBSCAN, hierarchical), time-slice, anomaly.
- Undo/redo history stack with gesture and keyboard shortcuts.
- Live-stream connectors (WebSocket / REST polling) feeding incremental palace updates.

### 4. Scalability — _shipped_
- `InstancedMesh` / GPU point cloud / `SpatialIndex` / `LODManager` paths by dataset size.
- Geometry & material object pooling (`ObjectPool`) and time-sliced batch execution to reduce load-time frame spikes.

### 5. Rust / WASM Compute Layer — _experimental, in migration_
- A Rust crate (`wasm/`) with native data parsing, operations, clustering, topology, and layout is being migrated in phases; JS fallbacks remain until each phase's capability flag is enabled.
- **Command buffer / C-ABI hot path is planned, not yet wired** into the render loop (the `CommandApplier` and opcode definitions exist; the live per-frame command-buffer consumption is a follow-up).

### 6. Gesture Recognition & JIT Hints — _experimental_
- 3D joint-trajectory gesture classifier with biomechanical auto-calibration.
- ONNX runtime bridge is scaffolded with a **heuristic fallback** when no model asset is present; on-device weight retraining is experimental.
- Just-in-time diegetic gesture hints.

### 7. WebRTC Multi-User Collaboration — _experimental_
- `NetworkManager` / `SignallingChannel` peer-to-peer data channels sharing camera pose and room presence (data stays local — each peer sees their own dataset).
- Optional shared-secret token gate and duplicate-peerId rejection on the signalling server (see [GETTING_STARTED.md](./docs/GETTING_STARTED.md#shared-secret-token-optional-recommended-for-non-local-use)).
- User-presence HUD; user-cloud-avatar scaffolding.

### 8. Topological Data Analysis — _experimental_
- TDA mapper graph computation (JS `TDAMapper` and native WASM topology); persistence-barcode / Betti-number tooling is partial and under development.

---

## Technical Quality

- **Type safety**: full TypeScript (`tsc --noEmit` → 0 errors).
- **Tests**: Vitest + E2E suite, **1191 pass / 9 skip** — see [TEST_READY.md](./TEST_READY.md) for the current breakdown.
- **CI**: GitHub Actions matrix (Node 20 & 22); lint is a required gate; `npm run build` must pass.
- **Rust unit tests**: `cargo test --manifest-path wasm/Cargo.toml` (28 tests).

---

## License

MIT © Tsatsu Amable