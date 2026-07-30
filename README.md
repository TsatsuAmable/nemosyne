# Nemosyne

[![GitHub Pages](https://img.shields.io/badge/Live-nemosyne.world-brightgreen?logo=github)](https://nemosyne.world)
[![Netlify](https://img.shields.io/badge/App-Netlify-00C7B7?logo=netlify)](https://nemosyne-analysis-suite.netlify.app/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**VR Spatial Data Analysis Suite**

A WebXR/three.js runtime that transforms multi-dimensional datasets into interactive 3D memory palaces. Built on the ideas of [nemosyne.world](https://nemosyne.world): the Method of Loci, spatial epistemology, and a taxonomy of data artefacts (Crystal, Column, Orb, Plinth, Beam, Trail, Ring, Field, Zone).

**[Launch Nemosyne](https://nemosyne-analysis-suite.netlify.app/)** |
**[Documentation](./docs/)** |
**[GitHub](https://github.com/nemosyne.world/nemosyne)**

---

## What it does

- Loads tabular, hierarchical, graph, time-series, vector-field, and geospatial datasets.
- Uses a symbolic constraint recommender (Draco-style) to choose layout, geometry, behavior, and interaction based on data topology.
- Renders the result as a memory-palace-style 3D VR world using the Nemosyne artefact taxonomy.
- Supports Meta Quest hand tracking and controllers, plus a desktop fallback with mouse/keyboard.
- Provides free-floating, persisted HUD panels, a body-locked radial wheel menu, and a curved analyst dashboard.
- Tracks every data operation on an undo/redo history stack with gesture and keyboard shortcuts.
- Connects to live streaming datasets/APIs via WebSocket or REST polling adapters.
- Saves/restores sessions via IndexedDB and exports screenshots + analysis stories as JSON.
- Includes opt-in telemetry, a performance budget, accessibility options, and a gesture coach.
- Supports WebRTC/WebSocket networking for shared collaboration (foundation in place).

**Project status:** this repo is the merged canonical runtime. The original nemosyne-analysis-suite has been adopted as the three.js/WebXR implementation, replacing the earlier A-Frame component framework.

---

## Quick start

### Live app

The fastest way to try Nemosyne is the Netlify deployment:

**https://nemosyne-analysis-suite.netlify.app/**

Open it in a WebXR-capable browser such as Meta Quest Browser. A VR headset is recommended; a desktop fallback is also available.

### Run locally

```bash
# Clone the repository
git clone https://github.com/nemosyne.world/nemosyne.git
cd nemosyne

# Install dependencies
npm install

# Generate HTTPS certificates (required for WebXR on a local network)
mkdir certs
openssl req -x509 -newkey rsa:2048 -keyout certs/key.pem -out certs/cert.pem -subj /CN=localhost -nodes

# Start the dev server
npm run dev
```

Then open `https://YOUR-IP:5173` in Meta Quest Browser, or use ADB port forwarding and open `https://localhost:5173`.

### Build and test

```bash
npm run build      # Production bundle -> dist/
npm test           # 675 Vitest tests
npm run test:coverage
```

---

## Repository layout

```
nemosyne/
├── index.html              # App entry point
├── package.json            # nemosyne@1.0.0-alpha.1
├── vite.config.js          # Vite 8 + HTTPS dev server
├── vitest.config.js        # Test config
├── src/
│   ├── main.js             # Bootstraps World
│   ├── vr/                 # Engine, World, UI, interactions, locomotion, input
│   ├── draco/              # Constraint engine, topology translator, layout generators
│   ├── data/               # Dataset, operations, connectors, session store
│   ├── network/            # WebRTC/WebSocket collaboration
│   └── utils/              # Telemetry, performance budget, accessibility, download helpers
├── tests/                  # 675+ Vitest tests
├── docs/                   # Project docs + GitHub Pages website
│   ├── index.html          # Marketing landing page (GitHub Pages)
│   ├── css/                # Site styles
│   ├── wiki/               # Wiki pages
│   ├── ROADMAP.md          # Current phase roadmap
│   ├── GETTING_STARTED.md  # Developer getting started
│   └── DESIGN_SYSTEM.md    # Visual language tokens
├── artefacts/              # Declarative artefact specification
└── research/               # Concept notes (Crystal architecture, data topologies)
```

---

## Documentation

- [Design System](./docs/DESIGN_SYSTEM.md)
- [Getting Started](./docs/GETTING_STARTED.md)
- [Roadmap](./docs/ROADMAP.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [Contributing](./docs/CONTRIBUTING.md)

---

## Deployment

- **Website:** GitHub Pages serves `docs/index.html` at https://nemosyne.world.
- **Live app:** Netlify builds and serves the three.js/WebXR app from the `dist/` directory.
- **npm:** the package is published as `nemosyne`.

Configure the Netlify site with:
- Build command: `npm run build`
- Publish directory: `dist`

---

## Migration note

The earlier A-Frame/D3 component framework (`framework/`, `<nemosyne-artefact-v2>`, CDN builds) has been retired. The three.js/WebXR runtime from the original nemosyne-analysis-suite is now the canonical implementation. The declarative artefact specification, design tokens, and research concepts from the A-Frame era have been preserved and aligned with the new runtime where applicable.

---

## License

MIT © Nemosyne Project

---

**[Star on GitHub](https://github.com/nemosyne.world/nemosyne)** |
**[Report Issues](https://github.com/nemosyne.world/nemosyne/issues)** |
**[Discussions](https://github.com/nemosyne.world/nemosyne/discussions)**
