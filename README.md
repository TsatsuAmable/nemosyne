# Nemosyne

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![GitHub Pages](https://img.shields.io/badge/Site-nemosyne.world-brightgreen?logo=github)](https://nemosyne.world)

> **A personal, experimental WebXR project — not a maintained product or npm package.**
> Nemosyne is a solo exploration of spatial data analysis in VR. Expect rough edges,
> unfinished features, and breaking changes. Nothing here is published to npm or
> supported for external use.

A WebXR / three.js runtime that maps multi-dimensional datasets into interactive 3D
"memory palaces" using a Draco-style constraint recommender and an artefact taxonomy
(Crystal, Column, Orb, Plinth, Beam, Trail, Ring, Field, Zone).

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

# Start the dev server
npm run dev
```

Then open `https://YOUR-IP:5173` in Meta Quest Browser, or use ADB port forwarding and open `https://localhost:5173`.

### Build and test

```bash
npm run build        # Production bundle -> dist/
npm test             # Vitest suite (1191 pass / 9 skip; see TEST_READY.md)
npm run test:coverage
```

See [TEST_READY.md](./TEST_READY.md) for the current test-count breakdown.

---

## Repository layout

```
nemosyne/
├── index.html              # App entry point
├── package.json
├── vite.config.js          # Vite + HTTPS dev server + signalling plugin
├── vitest.config.js        # Test config
├── src/
│   ├── main.js             # Bootstraps World
│   ├── ai/                 # (planned) on-device model integration
│   ├── analytics/          # TDA mapper
│   ├── data/               # Dataset, operations, connectors, session store
│   ├── draco/              # Constraint engine, topology translator, layout generators
│   ├── network/            # WebRTC/WebSocket collaboration
│   ├── ui/                 # 2D DOM file loader
│   ├── utils/              # Telemetry, performance budget, accessibility, download helpers
│   ├── vr/                 # Engine, World, UI panels, interactions, locomotion, input
│   │   ├── artifacts/      # Scene landmarks and data artefacts
│   │   ├── audio/          # Selection feedback tones
│   │   ├── interactions/   # Data operations and metaphor actions
│   │   └── scalability/     # Instanced point cloud, spatial index, LOD, object pool
│   └── wasm/               # Rust/WASM runtime bridge (gradual migration)
├── wasm/                   # Rust crate (data, draco, ECS — compiled via wasm-pack)
├── tests/                  # Vitest + E2E suite
├── docs/                   # Project docs + GitHub Pages website
└── artefacts/              # Declarative artefact specification
```

---

## Documentation

- [Getting Started](./docs/GETTING_STARTED.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [Features](./FEATURES.md)
- [Artefacts](./docs/ARTEFACTS.md)
- [Roadmap](./docs/ROADMAP.md)
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