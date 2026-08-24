# Nemosyne

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![GitHub Pages](https://img.shields.io/badge/Site-nemosyne.world-brightgreen?logo=github)](https://nemosyne.world)

> **Experimental alpha research software — not a validated scientific instrument,
> maintained product or npm package.** Expect incomplete workflows and breaking changes.

Nemosyne investigates whether representation intelligence can help people find meaningful,
reproducible structure in data without encouraging false discovery. Rust/WASM owns analytical facts;
Moneta selects or abstains from bounded representation hypotheses; desktop and WebXR embody the same
investigation and provenance model.

---

## What exists now

- Typed-column ingest, identity, statistics, structural evidence, clustering, topology, reduction and data-derived layouts in the Rust/WASM kernel.
- Bounded Moneta representation decisions with hard constraints, provenance, sensitivity evidence, learned-model pinning and typed NIL/abstention outcomes.
- Desktop, controller and hand-input foundations over one three.js/WebXR investigation runtime.
- Inspectable observations, findings, annotations and discovery episodes.
- Portable `.nemosyne` sessions with representation/model identity and clean-room replay verification.
- Authenticated signalling, peer-presence and study/telemetry foundations that still require private-preview qualification.
- A row-free 10M Rust/JS evidence path and Quest telemetry collection; physical Quest 3S execution remains pending.

---

## Status & direction

Nemosyne is a research instrument under construction, not a finished product. The
[Definitive Vision and Roadmap](./docs/Nemosyne_Definitive_Vision_and_Roadmap.md) defines the
target and the [Roadmap](./docs/ROADMAP.md) tracks progress.

The governing architecture is:

```text
typed data → Rust/WASM analytical facts and identity
           → compact DatasetEvidence
           → Moneta RepresentationDecision or NIL
           → desktop/WebXR embodiment
           → Investigation provenance and portable replay
```

The Draco name remains only as a governed compatibility facade. Production code imports Moneta
directly. The [Definitive Vision](./docs/Nemosyne_Definitive_Vision_and_Roadmap.md) governs direction,
the [Roadmap](./docs/ROADMAP.md) records live status, and the
[Pre-P1 Audit](./docs/PRE_P1_SYSTEMATIC_AUDIT.md) records current blockers and implementation work.

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
├── vite.config.ts          # Vite + HTTPS dev server + signalling + UX-trace plugin
├── vitest.config.ts        # Vitest configuration (100% TypeScript)
├── src/                    # TypeScript application source (TS-first)
│   ├── main.ts             # Bootstraps World
│   ├── atlas/              # Analytical application orchestrator (AtlasCore, investigation graph, evidence ledger)
│   ├── data/               # Dataset (typed projection over kernel DatasetJSON), encodings, connectors, session store
│   ├── draco/              # Governed compatibility facade only
│   ├── moneta/             # Representation hypotheses, bounded selection, provenance and embodiment adapters
│   ├── network/            # Authenticated transport & WebRTC/WebSocket collaboration
│   ├── session/            # NemosyneSession — authoritative logical-session & .nemosyne package substrate
│   ├── study/              # Controlled-experiment research harness (treatment configs, counterbalancing, trials)
│   ├── types/              # Shared TypeScript types
│   ├── ui/                 # 2D DOM file loader & desktop interface
│   ├── utils/              # Generic utilities (typed event bus, object pools, disposers, seeded RNG)
│   ├── vr/                 # Desktop/WebXR embodiment (Engine, World, UI, locomotion, input, resilience)
│   │   ├── animation/      # Spatial tweening & motion transitions
│   │   ├── artifacts/      # Scene landmarks and data artefacts
│   │   ├── audio/          # Selection feedback tones & spatial sound
│   │   ├── coordinators/   # World subsystem coordinators (UI, session, tour, workspace)
│   │   ├── input/          # Controller/hand pointer event machine & interaction router
│   │   ├── interactions/   # Data operations and metaphor actions
│   │   ├── perception/     # Multimodal perception & geometric gesture recognition
│   │   ├── resilience/     # WebGL context recovery, diegetic error boundaries, GPU resource disposal
│   │   ├── scalability/    # Instanced point cloud, BVH spatial index, zero-alloc math, load testing
│   │   └── ui/             # Spatial HUD panels, dashboard, VR console, hand wheel menu
│   └── wasm/               # Typed JS wrappers over the Rust/WASM kernel (RuntimeBridge, CommandApplier)
├── wasm/                   # Rust analytical kernel and authoritative layouts, compiled via wasm-pack
├── modules/gesture-intelligence/  # Standalone, pluggable gesture classifier (heuristic + ONNX, architecturally separate)
├── dev/                    # Spatial dev tools (ergonomics linter, 6DoF pose rig, scene inspector)
├── tests/                  # Vitest unit + four-tier E2E test suite
└── docs/                   # Project docs + Concept Paper + Roadmap + Study protocol
```

---

## Documentation

- [Definitive Vision and Roadmap](./docs/Nemosyne_Definitive_Vision_and_Roadmap.md) — governing product, research and architecture specification.
- [Developer Guide & Explainer](./docs/DEVELOPER_EXPLAINER.md) — codebase mental model, data lifecycle, Rust/WASM ABI, and cookbooks.
- [Roadmap](./docs/ROADMAP.md) — current implementation status, blockers and planned work.
- [Technical Architecture](./docs/ARCHITECTURE.md) — modular subsystems specification & boundaries.
- [Pre-P1 Systematic Audit](./docs/PRE_P1_SYSTEMATIC_AUDIT.md) — current adversarial review, implementation fixes and governed risk backlog.
- [Getting Started](./docs/GETTING_STARTED.md)
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
