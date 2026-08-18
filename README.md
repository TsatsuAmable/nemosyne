# Nemosyne

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![GitHub Pages](https://img.shields.io/badge/Site-nemosyne.world-brightgreen?logo=github)](https://nemosyne.world)

> **A personal, experimental WebXR project — not a maintained product or npm package.**
> Nemosyne is a solo exploration of spatial data analysis in VR. Expect rough edges,
> unfinished features, and breaking changes. Nothing here is published to npm or
> supported for external use.

A WebXR / three.js runtime that maps multi-dimensional datasets into interactive 3D
"memory palaces" using a Draco-style constraint recommender and an artefact taxonomy
(Crystal, Column, Orb, Plinth, Beam, Trail, Ring, Field, Zone). Analytical computation
runs in a Rust/WASM kernel; three.js is the WebGL/WebXR renderer.

---

## What it does

- Loads tabular, hierarchical, graph, time-series, vector-field, and geospatial datasets.
- Uses a symbolic constraint recommender (Draco-style) to choose layout, geometry, behavior, and interaction based on data topology.
- Renders the result as a memory-palace-style 3D VR world anchored to the analyst torso (`analystAnchor`).
- Supports Meta Quest hand tracking and controllers, plus a desktop fallback with mouse/keyboard.
- Provides free-floating persisted HUD panels, Dual Vertical Wheel Menus, and a curved analyst dashboard.
- Includes an on-device UX frustration analyzer, gaze/laser dwell-time tracking, and low-token telemetry digests.
- Uses geometry & material object pooling and micro-task time slicing to reduce dataset-load frame spikes.
- Tracks every data operation on an undo/redo history stack with gesture and keyboard shortcuts.
- Connects to live streaming datasets/APIs via WebSocket or REST polling adapters.
- Saves/restores sessions via IndexedDB and exports screenshots + analysis stories as JSON.
- Ships a standalone, pluggable gesture-intelligence module (`modules/gesture-intelligence/`) — a frozen 56-dim feature vector with a heuristic + ONNX neural classifier, on-device personalization, and a capture→train→deploy pipeline.

---

## Status & direction

Nemosyne is a research instrument under construction, not a finished product. The
[Concept Paper](./docs/Nemosyne_Concept_Paper_v1.0.md) defines the target and the
[Roadmap](./docs/ROADMAP.md) tracks progress.

### What has been done

- **Phases 1–20 (archived):** the foundational runtime is complete — three.js/WebXR engine, Draco constraint recommender, artefact taxonomy, multi-modal input, live connectors, statistical aids, atmosphere layer, CSV/Arrow ingestion, session persistence, WebRTC collaboration, voice/NL query, architectural hardening, and a 90 FPS adaptive frame governor. See [`docs/archive/ROADMAP_PHASES_1-20_COMPLETED.md`](./docs/archive/ROADMAP_PHASES_1-20_COMPLETED.md) for the per-sprint record.
- **Rust/WASM analytical kernel (Phase 21, in progress):** the TypeScript analytical layer is removed; the Rust kernel is the sole analytical engine. Data parsing, operations, statistics, topology/encoding inference, TDA, the Draco constraint solver, NL intent compilation, and 3D layout simulation run in Rust; every result carries a provenance envelope. JS keeps WebXR pose polling, rendering, and input.
- **UX V2.0 (Phase 22, in progress):** low-strain spatial interface, accessibility, input-correctness, security/WASM robustness, GPU lifecycle hygiene, and a UX telemetry inventory that ties qualitative experience to measurable phenomena (UX-001..UX-012).
- **Standalone gesture intelligence:** `modules/gesture-intelligence/` ships a frozen 56-dim feature vector, heuristic + ONNX classifier with honest provenance, on-device personalization, and a capture→train→deploy pipeline. Architecturally separate — not yet wired into the host.

### What the Concept Paper proposes

Nemosyne explores whether analytical understanding can be constructed as a **persistent spatial artefact**. The Stable Alpha target is the smallest reliable research instrument capable of running a defined **2D-versus-VR `Find the Fraud`** study — not a claim that VR is superior (the paper explicitly does not assume that).

The target architecture:

```
DATASET → Rust Analytical Kernel → Atlas (state/guidance/provenance)
       → Draco v1 (whole-dataset spatial embodiment) → Memory Palace (replayable)
       ↑ Perception / ML (optional; on-device, never mutates authoritative state)
```

Governing principles: evidence before architecture; whole-dataset embodiment; separate computation, reasoning, embodiment, and perception; explainable automation; semantic honesty; 2D as a legitimate partner; human agency and reversibility; research observability by design; privacy by minimization; stable means testable, not proven.

See [`docs/Nemosyne_Concept_Paper_v1.0.md`](./docs/Nemosyne_Concept_Paper_v1.0.md) for the full paper and [`docs/ROADMAP.md`](./docs/ROADMAP.md) for active and proposed work (Phase 23: gesture-intelligence host integration + global model improvement; Phase 24: UX architecture — analyst cockpit & interaction hierarchy).

---

## Quick start

```bash
# Clone the repository
git clone https://github.com/TsatsuAmable/nemosyne.git
cd nemosyne

# Install dependencies
npm install

# Generate HTTPS certificates (required for WebXR on a local network)
mkdir certs
openssl req -x509 -newkey rsa:2048 -keyout certs/key.pem -out certs/cert.pem -subj "/CN=localhost" -nodes

# Start the dev server (WASM is lazy-loaded at runtime)
npm run dev
# Or: full WASM dev build + dev server
npm run dev:wasm
```

Then open `https://YOUR-IP:5173` in Meta Quest Browser, or use ADB port forwarding and open `https://localhost:5173`.

### Build and test

```bash
npm run build        # Production bundle -> dist/
npm test             # Vitest suite (see TEST_READY.md for the current count)
npm run test:all     # cargo test for wasm/ + all Vitest tests
npm run test:coverage
```

See [TEST_READY.md](./TEST_READY.md) for the current test-count breakdown.

---

## Repository layout

```
nemosyne/
├── index.html              # App entry point
├── package.json
├── vite.config.js          # Vite + HTTPS dev server + signalling + UX-trace plugin
├── vitest.config.js        # Test config
├── src/                    # TypeScript application source (TS-first)
│   ├── main.ts             # Bootstraps World
│   ├── ai/                 # On-device model integration (NeuralConstraintPredictor, GestureClassifierModel, VoiceCommandListener, DracoWorldModel, …)
│   ├── atlas/              # Authoritative analytical-authority layer (AtlasCore + DatasetSpace)
│   ├── data/               # Dataset (typed projection over kernel DatasetJSON), encodings, connectors, session store
│   ├── draco/              # Constraint engine, topology translator, layout generators
│   ├── network/            # WebRTC/WebSocket collaboration
│   ├── session/            # NemosyneSession — authoritative logical-session substrate
│   ├── study/              # Controlled-experiment harness
│   ├── types/              # Shared TypeScript types
│   ├── ui/                 # 2D DOM file loader
│   ├── utils/              # Telemetry, performance budget, accessibility, UX frustration analyzer, object pool
│   ├── vr/                 # Engine, World, UI panels, interactions, locomotion, input
│   │   ├── artifacts/      # Scene landmarks and data artefacts
│   │   ├── audio/          # Selection feedback tones
│   │   ├── interactions/   # Data operations and metaphor actions
│   │   └── scalability/    # Instanced point cloud, spatial index, LOD
│   └── wasm/               # Typed JS wrappers over the Rust/WASM kernel (RuntimeBridge)
├── wasm/                   # Rust crate (data, draco, layouts, intent — compiled via wasm-pack)
├── modules/gesture-intelligence/  # Standalone, pluggable gesture classifier (heuristic + ONNX, architecturally separate)
├── tests/                  # Vitest + E2E suite
└── docs/                   # Project docs + GitHub Pages website + Concept Paper + Roadmap
```

---

## Documentation

- [Concept Paper](./docs/Nemosyne_Concept_Paper_v1.0.md) — the defining paper (target architecture, principles, Stable Alpha definition).
- [Roadmap](./docs/ROADMAP.md) — current status + Phases 21–24 + Atlas V5 (Phases 1–20 archived).
- [Getting Started](./docs/GETTING_STARTED.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [Features](./FEATURES.md)
- [Artefacts](./docs/ARTEFACTS.md)
- [Design System](./docs/DESIGN_SYSTEM.md)
- [Test Readiness](./TEST_READY.md)

---

## Deployment

- **Website:** GitHub Pages serves `docs/index.html` at https://nemosyne.world.
- **Live app:** Netlify builds and serves the three.js/WebXR app from `dist/` (private demo deployment).

---

## Background

The earlier A-Frame/D3 component framework has been retired. The current three.js/WebXR runtime is the canonical implementation; the declarative artefact specification, design tokens, and research concepts from the A-Frame era were carried forward and aligned where applicable.

---

## License

MIT © Tsatsu Amable