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
[Definitive Vision and Roadmap](./docs/Nemosyne_Definitive_Vision_and_Roadmap.md) defines the
target and the [Roadmap](./docs/ROADMAP.md) tracks progress.

### What has been done

- **Phases 1–26 (archived):** Complete foundational runtime, Rust/WASM analytical kernel (v0.2.0), mandatory WASM cutover, AtlasCore single analytical authority, pure fact-consumer Draco solver, standalone gesture intelligence, Phase 24 Analyst Cockpit (4-mode interaction FSM, forgiving HandWheel, contextual surfaces), Quest 3S hardware envelope validation, and empirical study recommender tuning. See [`docs/archive/ROADMAP_PHASES_21-26_COMPLETED.md`](./docs/archive/ROADMAP_PHASES_21-26_COMPLETED.md) and [`docs/archive/ROADMAP_PHASES_1-20_COMPLETED.md`](./docs/archive/ROADMAP_PHASES_1-20_COMPLETED.md).
- **Definitive Gate Model (Gates 0–7):** The active roadmap is organized around the 8 architectural gates defined in the governing specification: Gate 0 (Foundations) → Gate 1 (Understand) → Gate 2 (Represent) → Gate 3 (Experience) → Gate 4 (Investigate) → Gate 5 (Reproduce) → Gate 6 (Study) → Gate 7 (Adaptive Research).
- **Limited Public Testing Release Sprints:** Current active work focuses on modular subsystem boundaries, open-source library adoption (`zod`, `fflate`, `three-mesh-bvh`), crash resilience, and frame-budget reliability.

### What the Definitive Vision proposes

Nemosyne explores whether analytical understanding can be constructed as a **persistent spatial artefact**. The primary product entity is the **Investigation** (not the dataset, session, or scene), which preserves the entire analytical reasoning chain, observations, findings, decisions, and representations with cryptographic provenance.

The target architecture:

```text
DATASET → Rust Analytical Kernel (Computational Authority)
        → Investigation (Semantic Spine & Meaning)
        → Atlas (Application Orchestration & Constraints)
        → Draco (Explainable SpatialStrategy Selection)
        → Spatial Runtime & Memory Palace (WebXR 3D Projection)
        ↑ Perception / Gestures (Observational Only)
        ↑ Research Harness (2D vs VR Treatment Boundary)
```

Governing principles: Rust as sole analytical authority; Investigation owns meaning; Draco consumes facts; rendering primitives are not authorities; 2D as a legitimate partner; explainable automation; progressive disclosure; and reproducible investigations.

See [`docs/Nemosyne_Definitive_Vision_and_Roadmap.md`](./docs/Nemosyne_Definitive_Vision_and_Roadmap.md) for the governing specification, [`docs/DEVELOPER_EXPLAINER.md`](./docs/DEVELOPER_EXPLAINER.md) for the developer onboarding guide, and [`docs/ROADMAP.md`](./docs/ROADMAP.md) for active implementation gates.

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

- [Definitive Vision and Roadmap](./docs/Nemosyne_Definitive_Vision_and_Roadmap.md) — the governing spec (target architecture, principles, Gate 0–7 model, Stable Alpha definition).
- [Developer Guide & Explainer](./docs/DEVELOPER_EXPLAINER.md) — codebase mental model, data lifecycle, Rust/WASM ABI, and cookbooks.
- [Roadmap](./docs/ROADMAP.md) — implementation status & Gate 0–7 deliverables (Phases 1–26 archived).
- [Technical Architecture](./docs/ARCHITECTURE.md) — modular subsystems specification & boundaries.
- [Open Source Standardization Review](./docs/STANDARDIZATION_REVIEW.md) — comprehensive open-source library evaluation and maintenance footprint reduction.
- [Open Source Migration Proposal](./docs/OSS_MIGRATION_PROPOSAL.md) — open-source adoption to reduce maintenance footprint.
- [Getting Started](./docs/GETTING_STARTED.md)
- [Codebase Wiki](./docs/WIKI.md)
- [Error Register](./docs/ERROR_REGISTER.md)
- [Features](./FEATURES.md)
- [Artefacts](./docs/ARTEFACTS.md)
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