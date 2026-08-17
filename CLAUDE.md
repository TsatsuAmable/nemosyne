# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Picking up where you left off

**Read the "Current Status" block at the top of `docs/ROADMAP.md` FIRST.** It is the
single source of truth for branch, working-tree state, last gate result, the next
task, and blockers — across any model or harness. Before you stop, refresh that block
with current truth. Other docs (this file, `.agents/`) point to it and do not
duplicate state.

## Model routing (cross-tool)

Provider selection for coding-agent work is standardized in the committed `.ai/model-routing/`
folder — `model-routes.json` (four provider groups: `ollama-cloud`, `google`, `opencode-go`,
`opencode-zen`; task-class routing + switch triggers), `README.md` (decision procedure), and
`tool-mappings.md` (per-tool wiring). Shared with OpenCode and Antigravity via `AGENTS.md`.
**Manifest only — your Claude Code dispatch is unchanged.** Consult it before heavy
sub-agent fan-out (prefer `ollama-cloud` for bulk work, fall to `google`/`opencode-zen` on
429 or for reasoning/long-context). Model IDs are editable placeholders — confirm per provider.

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
npm run wasm:dev # Compile Rust/WASM crate in dev mode -> wasm/pkg/
npm run wasm     # Compile Rust/WASM crate for release -> wasm/pkg/
npm run dev      # Vite dev server ONLY (no wasm-pack; WASM lazy-loaded at runtime) on https://localhost:5173
npm run dev:wasm # wasm-pack dev build + Vite dev server (use this for full WASM dev)
npm run build    # Vite production bundle -> dist/ (WASM externalized; succeeds without wasm/pkg)
npm run preview  # Preview the production bundle
npm test         # all Vitest tests once (JS only; no Rust toolchain required)
npm run test:all # cargo test for wasm/ + all Vitest tests once
npm run test:coverage
```

Run a single test file:

```bash
npx vitest run tests/world.test.js
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
- Deployment: Netlify is canonical (`netlify.toml` carries COOP/COEP/CSP). `npm run deploy:netlify` builds and deploys in one step. (`deploy:vercel` was removed in Wave 0.)

## Architecture overview

Nemosyne is a three.js/WebXR spatial data analysis runtime. It maps multi-dimensional datasets into interactive 3D "memory palaces" using a Draco-style constraint recommender and an artefact taxonomy.

High-level data flow:

```
Raw Data (CSV/JSON/Live Stream)
         ↓
   Rust/WASM Analytical Kernel (parse · infer topology/encodings · operations · statistics · TDA · provenance envelope)
         ↓
   Dataset (TS projection over kernel DatasetJSON)
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
   Inspect / Filter / Aggregate / Sort / Cluster / Annotate / Metaphor  (each op → kernel + provenance envelope)
```

### Source layers

- `src/data/` — `Dataset` (thin typed projection over kernel `DatasetJSON`), `Encodings` (three.js visual mapping only — `categoricalColor`/`numericColor`/`normalize`; analytical `inferEncodings` lives in the kernel), `AnalysisHistory` (undo/redo cursor), `SessionStore` (IndexedDB KV), `SampleDatasets`, `types`, and live connectors (`WebSocketAdapter`, `PollingAdapter`, `OpenDataSources`). Parsing and analytical operations are NO longer implemented here — they run in the Rust kernel.
- `src/wasm/` — `RuntimeBridge.ts` (typed JS wrappers over the Rust/WASM kernel; production code calls these wrappers, not the kernel directly) and `CommandApplier.ts` (dormant command-buffer consumer).
- `src/atlas/` and `src/session/` — the authoritative session substrate (`DatasetSpace` is the renderer-independent, versioned, FNV-1a-fingerprinted datum substrate; `AtlasCore` + `NemosyneSession` are the authoritative analytical-authority + logical-session layer). See `docs/ROADMAP.md` §Current Status for build/wire status.
- `src/draco/` — `ConstraintEngine` (symbolic recommender), `VRTopologyTranslator` (spec → three.js artefact group), `DracoTopologyNode` (solve → synthesize → place), and layout generators under `src/draco/layouts/`. (The `DracoDiagnosticHUD` soft-weight tuner now lives in `src/vr/ui/`.)
- `src/vr/` — Core WebXR runtime.
  - `Engine.ts` — three.js scene, renderer, XR session, animation loop, updatables.
  - `World.ts` — composes the scene: datum plane, landmarks, Draco palace, HUD, menu, live connectors.
  - `InputRouter.ts`, `Controllers.ts`, `Hands.ts` — normalized controller, hand-tracking, and desktop input.
  - `Locomotion.ts` — teleport anchors, ground movement, and flight mode.
  - `DesktopControls.ts` — mouse/keyboard fallback.
- `src/vr/ui/` — World-space panels: `MovablePanel`, `PanelManager`, `HandWheelMenu`, `DashboardManager`, `VRConsole`, `VRMenu`, `GuidedTour`, etc.
- `src/vr/interactions/` — `DataOperations` and `MetaphorActions` (Resonance Pulse, Fork Plane, Chrono Dial, Constellation, Beacon, Aleph).
- `src/vr/artifacts/` — Scene landmarks and data artefacts (`DatumPlane`, `TechnoCoreNode`, `FarcasterPortal`, `DataCard`, `HolographicInspector`, `ChartPlane`, `TDAPlanes`).
- `src/vr/scalability/` — `InstancedPointCloud`, `SpatialIndex`, `LODManager`, `ObjectPool` (reusable geometry/material mesh pools and time-sliced batch execution).
- `src/vr/audio/` — `SelectionFeedback` for hover/select audio tones.
- `src/network/` — WebRTC/WebSocket collaboration (`NetworkManager`, `SignallingChannel`, `Room`, `SignallingServerCore`).
- `src/analytics/` — `TDAMapper` for topological data analysis artefacts.
- `src/utils/` — `SeededRandom`, `Dispose`, `Telemetry`, `UXFrustrationAnalyzer` (on-device friction pattern detection & low-token UX digests), `PerformanceBudget`, `Accessibility`, `Download`, `GestureMapping`.
- `src/ui/` — 2D DOM file loader (`FileLoader.ts`).

> `src/analytics/` was removed (Wave 3) — TDA now runs in the Rust kernel.

### Key runtime conventions

- TypeScript-first: all source under `src/` is `.ts` (import maps + Vite; `npm run typecheck` / `tsc --noEmit` is a required CI gate). Only config and test-harness files (`vite.config.js`, `vitest.config.js`, `tests/setup.js`, `vite-wasm-pack-plugin.js`) and individual `.test.js`/`.spec.ts` files remain `.js`/`.mjs`.
- ES modules only; three.js is loaded via import map pointing at `three@0.168.0`.
- `Engine` owns an `updatables` array; anything with an `.update(delta, time)` method is ticked each frame.
- `World` creates an `analystAnchor` under the camera rig; HUD panels, dashboard, and wheel menu are parented there so the workspace clusters around the user while remaining draggable in local space.
- `InputRouter` is the single source of truth for interactables across controllers, hands, and desktop input.
- `Dataset` is a thin typed projection over kernel `DatasetJSON` (columns, rows, metadata); it performs NO analytical computation. Analytical operations (filter/sort/aggregate/compare/cluster/hierarchical/dbscan/anomaly/slice) execute in the Rust kernel via `RuntimeBridge`, never in TypeScript.
- **The Rust/WASM kernel is the sole analytical engine.** No TS analytical implementation exists and no production code chooses between analytical paths at runtime; capability flags are telemetry-only. Every kernel analytical result carries a provenance envelope (`{ kernel, kernelVersion, operation, parameters, inputFingerprint, outputFingerprint, timestamp }`).
- `ConstraintEngine.solve(dataset)` returns a spec; `VRTopologyTranslator.synthesizeArtifact(spec, dataset)` returns a three.js group with interaction callbacks.
- Live streams feed `Dataset.updateRows()`; `World` re-solves or incrementally updates the palace on the live flush.

## Rust/WASM migration standards

Nemosyne has committed to Rust/WASM as the **canonical analytical engine** — the TypeScript analytical layer (`DatasetOperations`, `Parsers`, `CSVDataParser`, `ArrowBinaryParser`, `TopologyInference`, `TDAMapper`) was deleted; three.js remains the WebGL/WebXR renderer. The active **Rust/WASM commitment sprint** (branch `rust-kernel-commitment`) is tracked in `docs/ROADMAP.md` §Current Status and the plan at `.claude/plans/groovy-mixing-wolf.md`; the **technical standards** (ABI, memory model, command-buffer wire format, instancing thresholds) live in `.claude/plan.md` (working memory). When working on or near the WASM boundary, follow these rules:

- **ABI surface is `(ptr, len)` and integer handles only.** Exported functions return `u32` handles or `(ptr, len)` pairs; imported functions are limited to logging, timestamps, and telemetry. No `String`/`Vec` cross the hot path.
- **Shared memory layout:** `WebAssembly.Memory` starts at 128 MB and grows to 512 MB. JS reads typed arrays directly from the WASM buffer. All multi-byte values are little-endian.
- **Two-tier allocation:** a per-frame bump arena (8–32 MB) for command buffers and transient scratch; a stable heap (`dlmalloc` by default) for datasets, ECS tables, and history.
- **Command buffer:** packed, 4-byte-aligned `u8` stream with a versioned header and opcode/payload structure. JS `CommandApplier` consumes it once per frame and maps handles to three.js objects.
- **Scene graph split:** Rust owns the ECS, local transforms, and world-matrix computation. three.js owns the renderable object tree and GPU resources; JS copies precomputed matrices into `Object3D.matrix`.
- **Instancing thresholds:** ≤ 256 unique meshes use individual `THREE.Mesh`; 257–8,192 use `InstancedMesh`; 8,193–65,536 use a GPU point cloud; larger datasets are binned/LOD'd by the Rust spatial index.
- **Capability flags are telemetry-only.** `World.ts` reads `wasm.capabilities()` once at startup for diagnostics; no production code routes between Rust and JS analytical paths (there is no JS analytical fallback). Never reintroduce an `if (caps & …)` routing branch. Keep the ordering invariant (`COMMAND_BUFFER` requires `SCENE_RUST`) for when those flags are wired.
- **Testing porting rule:** every JS test removed must be replaced by a Rust unit test, a `wasm-bindgen-test`, or a JS integration test through `RuntimeBridge.ts` that exercises the same behaviour.
- **Build loop:** `npm run dev` / `npm run build` invoke `wasm-pack` via `vite-wasm-pack-plugin.js`. Run `npm run wasm` for a manual release build; `cargo test --manifest-path wasm/Cargo.toml` runs the Rust unit tests.
- **Bundle budgets:** target ≤ 2.5 MB total gzipped at the end of the migration; measure each phase with `twiggy`/`wasm-objdump`.

## Vite plugins

`vite.config.js` registers five custom plugins that run only during `serve`/`preview`:

- `demoStreamPlugin` — mounts `wss://<host>/__demo-stream`, emitting mock time-series sensor rows once per second.
- `signallingPlugin` — mounts `wss://<host>/__signal` for local multiplayer signalling; uses `createRoomRegistry()` from `src/network/SignallingServerCore.ts`.
- `remoteLogsPlugin` / `loadtestResultsPlugin` / `uxTracePlugin` — dev-only POST ingest endpoints (`/__remote-logs`, `/__loadtest-results`, `/__ux-trace`), body/depth/rate bounded (Wave 0). Slated to move out of Vite into a separate process (Wave 7).

For a standalone signalling server in production:

```bash
node src/network/SignallingServer.mjs --port=8080
```

## Testing

- Framework: Vitest with jsdom environment.
- Setup: `tests/setup.js` replaces `HTMLCanvasElement.prototype.getContext` to provide a mock WebGL/Canvas 2D context, allowing three.js to initialize in jsdom.
- Test files live next to source layers (e.g. `tests/draco.test.js`, `tests/world.test.js`, `tests/dataset-space.test.ts`). The deleted JS analytical tests (`parsers`, `dataset-operations`, `csv-parser`, `arrow-ipc`, `topology-inference`, `tda-mapper`, `wasm-operations`) are covered by Rust `#[test]`s under `wasm/` + `tests/wasm-runtime.test.ts` (RuntimeBridge parity; skips in plain jsdom by design — the pkg is HTTP-served).
- Tests use `vitest run` (one-shot). Pass a path to run a single file: `npx vitest run tests/world.test.js`.
- Gate (see `AGENTS.md` §"Required command order" and §"Token-efficient workflow"): `tsc --noEmit` → `eslint` (0 errors) → `npm run test:all` (cargo + Vitest). Porting rule: every JS test removed must be replaced by a Rust `#[test]`, a `wasm-bindgen-test`, or a JS integration test through `RuntimeBridge.ts`.

## User-facing documentation

- `README.md` — Quick start, build/test commands, deployment notes.
- `docs/GETTING_STARTED.md` — Detailed Quest setup, first interactions, gestures, session saving, telemetry, collaboration, and CSV import format.
- `docs/ARCHITECTURE.md` — Layer-by-layer architecture and data-flow descriptions.
- `docs/DESIGN_SYSTEM.md` — Color palette, typography, artefact specifications, animation timing, and spacing tokens.
- `docs/ROADMAP.md` — Phase-by-phase roadmap. Its **Current Status** block (top of file) is the live project state — read it first.

When making changes, keep these documents aligned if they mention the feature, file, or command you touch.
