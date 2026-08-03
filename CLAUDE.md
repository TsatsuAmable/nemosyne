# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

This repository contains the canonical Nemosyne runtime. The application code, tests, and build configuration all live at the repository root.

- `package.json` — Node.js project metadata and npm scripts.
- `vite.config.js` — Vite dev/build configuration; also mounts the demo WebSocket stream and the collaboration signalling endpoint.
- `vitest.config.js` — Test configuration (jsdom environment, `tests/setup.js`).
- `index.html` — Application entry point.
- `src/` — Application source.
- `tests/` — Vitest test files.
- `docs/` — Project documentation, GitHub Pages website, and design system.

## Development commands

All commands below are relative to the repository root.

```bash
npm install
npm run dev      # Vite dev server on https://localhost:5173 plus network IP
npm run build    # Production bundle -> dist/
npm run preview  # Preview the production bundle
npm test         # Run all Vitest tests once
npm run test:coverage
```

Run a single test file:

```bash
npx vitest run tests/parsers.test.js
```

Run tests in watch mode during development:

```bash
npx vitest
```

## Local WebXR development

WebXR requires a secure origin. The Vite dev server uses HTTPS certificates from `certs/` when present.

Generate self-signed certs with OpenSSL:

```bash
mkdir -p certs
openssl req -x509 -newkey rsa:2048 -keyout certs/key.pem -out certs/cert.pem -subj "/CN=localhost" -nodes
```

On a Meta Quest, open `https://<your-computer-ip>:5173` in Meta Quest Browser, or use ADB port forwarding:

```bash
adb forward tcp:5173 tcp:5173
# Then open https://localhost:5173 in the Quest Browser
```

## Build and deploy

- Production build: `npm run build` emits to `dist/`.
- Netlify configuration in `netlify.toml`: build command `npm run build`, publish directory `dist`.
- Deployment scripts: `npm run deploy:netlify` and `npm run deploy:vercel` build and deploy in one step.

## Architecture overview

Nemosyne is a three.js/WebXR spatial data analysis runtime. It maps multi-dimensional datasets into interactive 3D "memory palaces" using a Draco-style constraint recommender and an artefact taxonomy.

High-level data flow:

```
Raw Data (CSV/JSON/Live Stream)
         ↓
   Parsers / Connectors
         ↓
      Dataset
         ↓
  Draco Constraint Engine
         ↓
   Layout / Geometry / Behavior Spec
         ↓
   VRTopologyTranslator
         ↓
   Scalability (InstancedMesh / SpatialIndex / LOD)
         ↓
   three.js World (Crystal / Artefact meshes)
         ↓
   Controller / Hand Input
         ↓
   Inspect / Filter / Aggregate / Sort / Cluster / Annotate / Metaphor
```

### Source layers

- `src/data/` — `Dataset`, CSV/JSON `Parsers`, `Encodings`, `DatasetOperations` (filter, sort, aggregate, cluster, slice, anomaly), and live connectors (`WebSocketAdapter`, `PollingAdapter`, `OpenDataSources`).
- `src/draco/` — `ConstraintEngine` (symbolic recommender), `VRTopologyTranslator` (spec → three.js artefact group), `DracoTopologyNode` (solve → synthesize → place), `DracoDiagnosticHUD` (soft-weight tuner), and layout generators under `src/draco/layouts/`.
- `src/vr/` — Core WebXR runtime.
  - `Engine.js` — three.js scene, renderer, XR session, animation loop, updatables.
  - `World.js` — composes the scene: datum plane, landmarks, Draco palace, HUD, menu, live connectors.
  - `InputRouter.js`, `Controllers.js`, `Hands.js` — normalized controller, hand-tracking, and desktop input.
  - `Locomotion.js` — teleport anchors, ground movement, and flight mode.
  - `DesktopControls.js` — mouse/keyboard fallback.
- `src/vr/ui/` — World-space panels: `MovablePanel`, `PanelManager`, `HandWheelMenu`, `DashboardManager`, `VRConsole`, `VRMenu`, `GuidedTour`, etc.
- `src/vr/interactions/` — `DataOperations` and `MetaphorActions` (Resonance Pulse, Fork Plane, Chrono Dial, Constellation, Beacon, Aleph).
- `src/vr/artifacts/` — Scene landmarks and data artefacts (`DatumPlane`, `TechnoCoreNode`, `FarcasterPortal`, `DataCard`, `HolographicInspector`, `ChartPlane`, `TDAPlanes`).
- `src/vr/scalability/` — `InstancedPointCloud`, `SpatialIndex`, `LODManager`.
- `src/vr/audio/` — `SelectionFeedback` for hover/select audio tones.
- `src/network/` — WebRTC/WebSocket collaboration (`NetworkManager`, `SignallingChannel`, `Room`, `SignallingServerCore`).
- `src/analytics/` — `TDAMapper` for topological data analysis artefacts.
- `src/utils/` — `SeededRandom`, `Dispose`, `Telemetry`, `PerformanceBudget`, `Accessibility`, `Download`, `GestureMapping`.
- `src/ui/` — 2D DOM file loader (`FileLoader.js`).

### Key runtime conventions

- ES modules only; three.js is loaded via import map pointing at `three@0.168.0`.
- `Engine` owns an `updatables` array; anything with an `.update(delta, time)` method is ticked each frame.
- `World` creates an `analystAnchor` under the camera rig; HUD panels, dashboard, and wheel menu are parented there so the workspace clusters around the user while remaining draggable in local space.
- `InputRouter` is the single source of truth for interactables across controllers, hands, and desktop input.
- `Dataset` holds typed columns and metadata; `DatasetOperations` are pure functions that produce new datasets.
- `ConstraintEngine.solve(dataset)` returns a spec; `VRTopologyTranslator.synthesizeArtifact(spec, dataset)` returns a three.js group with interaction callbacks.
- Live streams feed `Dataset.updateRows()`; `World._flushLiveUpdate()` re-solves or incrementally updates the palace.

## Rust/WASM migration standards

Nemosyne is gradually moving compute-sensitive subsystems into Rust-generated WebAssembly while keeping three.js as the WebGL/WebXR renderer. The full migration plan and technical standards live in `.claude/plan.md`. When working on or near the WASM boundary, follow these rules:

- **ABI surface is `(ptr, len)` and integer handles only.** Exported functions return `u32` handles or `(ptr, len)` pairs; imported functions are limited to logging, timestamps, and telemetry. No `String`/`Vec` cross the hot path.
- **Shared memory layout:** `WebAssembly.Memory` starts at 128 MB and grows to 512 MB. JS reads typed arrays directly from the WASM buffer. All multi-byte values are little-endian.
- **Two-tier allocation:** a per-frame bump arena (8–32 MB) for command buffers and transient scratch; a stable heap (`dlmalloc` by default) for datasets, ECS tables, and history.
- **Command buffer:** packed, 4-byte-aligned `u8` stream with a versioned header and opcode/payload structure. JS `CommandApplier` consumes it once per frame and maps handles to three.js objects.
- **Scene graph split:** Rust owns the ECS, local transforms, and world-matrix computation. three.js owns the renderable object tree and GPU resources; JS copies precomputed matrices into `Object3D.matrix`.
- **Instancing thresholds:** ≤ 256 unique meshes use individual `THREE.Mesh`; 257–8,192 use `InstancedMesh`; 8,193–65,536 use a GPU point cloud; larger datasets are binned/LOD'd by the Rust spatial index.
- **Capability flags:** `World.js` reads `wasm.capabilities()` at startup and routes work to Rust or JS fallbacks. Flags are enabled phase by phase; never enable `COMMAND_BUFFER` before `SCENE_RUST`.
- **Testing porting rule:** every JS test removed must be replaced by a Rust unit test, a `wasm-bindgen-test`, or a JS integration test through `RuntimeBridge.js` that exercises the same behaviour.
- **Bundle budgets:** target ≤ 2.5 MB total gzipped at the end of the migration; measure each phase with `twiggy`/`wasm-objdump`.

## Vite plugins

`vite.config.js` registers two custom plugins that run only during `serve`/`preview`:

- `demoStreamPlugin` — mounts `wss://<host>/__demo-stream`, emitting mock time-series sensor rows once per second.
- `signallingPlugin` — mounts `wss://<host>/__signal` for local multiplayer signalling; uses `createRoomRegistry()` from `src/network/SignallingServerCore.js`.

For a standalone signalling server in production:

```bash
node src/network/SignallingServer.mjs --port=8080
```

## Testing

- Framework: Vitest with jsdom environment.
- Setup: `tests/setup.js` replaces `HTMLCanvasElement.prototype.getContext` to provide a mock WebGL/Canvas 2D context, allowing three.js to initialize in jsdom.
- Test files live next to source layers (e.g. `tests/draco.test.js`, `tests/parsers.test.js`, `tests/world.test.js`).
- Tests use `vitest run` (one-shot). Pass a path to run a single file: `npx vitest run tests/world.test.js`.

## User-facing documentation

- `README.md` — Quick start, build/test commands, deployment notes.
- `docs/GETTING_STARTED.md` — Detailed Quest setup, first interactions, gestures, session saving, telemetry, collaboration, and CSV import format.
- `docs/ARCHITECTURE.md` — Layer-by-layer architecture and data-flow descriptions.
- `ARCHITECTURE_BRIDGE.md` — Maps the upstream `nemosyne.world` concepts to this runtime.
- `docs/DESIGN_SYSTEM.md` — Color palette, typography, artefact specifications, animation timing, and spacing tokens.
- `docs/ROADMAP.md` — Phase-by-phase roadmap and current evaluation checkpoint.

When making changes, keep these documents aligned if they mention the feature, file, or command you touch.
