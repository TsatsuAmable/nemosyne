# Nemosyne

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![GitHub Pages](https://img.shields.io/badge/Site-nemosyne.world-brightgreen?logo=github)](https://nemosyne.world)

> **Experimental alpha research software, not a validated scientific instrument, maintained product or npm package.** Expect incomplete workflows and breaking changes.

Nemosyne investigates whether representation intelligence can help people develop meaningful, reproducible understanding of datasets without encouraging false discovery. Rust/WASM owns analytical facts; Moneta proposes bounded representation hypotheses or abstains; desktop and WebXR embody the same investigation, evidence and provenance model.

The project is trying to make the path from **data → structure → investigation → defensible understanding** inspectable and replayable, rather than turning every dataset into a cloud of points and calling the fog insight.

---

## What exists now

- Rust/WASM-owned typed-column ingest, dataset identity, statistics, structural evidence, clustering, topology, reduction and analytical layouts.
- Structure-first semantic representations for Aggregate, Distribution, Density, source-partition Cluster and source-authoritative Relationship Graph, with bounded drill-down to observations and exact provenance.
- Bounded Moneta representation decisions with hard constraints, provenance, sensitivity evidence, explicit scientific abstention and model/artifact pinning.
- One desktop/WebXR investigation runtime with shared semantic task vocabulary across desktop, controller and hand-input paths.
- Investigator-visible observations, findings, hypotheses, evidence, annotations, archive/recovery state and bounded Memory Palace projections.
- Portable `.nemosyne` investigations with representation/model identity and replay verification.
- Governed product-data, model-registry and gesture-learning infrastructure through the bounded PT0-PT8 software/governance exits.
- A row-free 10M Rust→JS evidence path plus governed Quest telemetry/validation tooling. These are engineering evidence, not proof of comfortable or sustained 10M-row operation on a headset.

---

## Status and direction

The [Definitive Vision and Roadmap](./docs/Nemosyne_Definitive_Vision_and_Roadmap.md) defines what Nemosyne is trying to become. The [live Roadmap](./docs/ROADMAP.md) is the canonical implementation-status and execution authority. The [GitHub Wiki](https://github.com/TsatsuAmable/nemosyne/wiki) is generated from those version-controlled authorities and is a convenient navigation surface, not a second source of truth.

At the **16 September 2026** roadmap snapshot:

```text
Stream A progressive disclosure                         VERIFIED COMPLETE / STOP
Stream B Relationship Graph V1                         VERIFIED COMPLETE / STOP
Stream C bounded visible-product C1-C4                 LANDED
P1-PT PT0-PT8                                          LANDED at bounded exits
P1-UXR UXR0-UXR1                                       bounded software landed
P1-UXR UXR2 resource lifecycle + UXR3 working set      current engineering frontier
Physical human/Quest qualification                     open where claims require it
PT9 Moneta learning-evidence pipeline                  downstream
PT10 private-preview product/discovery learning        downstream of PT9
Full compositional Moneta                              post-PT9
```

In particular, UXR1 has migrated the canonical panel/navigation path to UIKit and landed purpose/comprehension guidance, but software and simulator evidence do **not** substitute for fresh physical human-comprehension, comfort or sustained-device evidence. UXR2/UXR3 therefore advance independently while those physical gates are collected when claim-relevant.

The [P1 Product Transition, Platform & Learning Plan](./docs/roadmap/P1_PRODUCT_TRANSITION_PLATFORM_AND_LEARNING_PLAN.md) specifies the active strategic tranche structure. The [Evolutionary Improvement Cadence](./docs/roadmap/P1_E_EVOLUTIONARY_IMPROVEMENT_CADENCE.md) is the rolling execution cadence beneath the live roadmap, not a competing status authority.

The current architectural backbone is:

```text
typed data
  → Rust/WASM analytical facts, identity and bounded semantic payloads
  → DatasetEvidence
  → Moneta RepresentationDecision / scientific abstention
  → semantic representation + desktop/WebXR embodiment
  → NIL / Investigation actions
  → evidence, reasoning, archive and replay
```

`src/draco/` remains only as a governed compatibility facade. New production representation reasoning belongs to Moneta.

---

## Quick start

Nemosyne currently targets **Node 24** and **npm 11**. See [Getting Started](./docs/GETTING_STARTED.md) for platform prerequisites, Rust/WASM tooling and troubleshooting.

```bash
git clone https://github.com/TsatsuAmable/nemosyne.git
cd nemosyne
npm ci

# Generate local HTTPS certificates for WebXR.
mkdir -p certs
openssl req -x509 -newkey rsa:2048 -keyout certs/key.pem -out certs/cert.pem -subj "/CN=localhost" -nodes

# Loopback-only development.
npm run dev

# Or rebuild WASM first.
npm run dev:wasm
```

For a physical Quest that must connect over the LAN, opt in explicitly:

```bash
npm run dev:lan
# Or with a fresh WASM development build:
npm run dev:wasm:lan
```

LAN mode exposes development-only middleware and is not an authenticated production service. Use it only on a trusted controlled network and stop it after the headset session. ADB port forwarding can retain loopback-only development while the Quest reaches `https://localhost:5173`.

### Build and verification

The executable scripts in [`package.json`](./package.json) are authoritative. Useful entry points include:

```bash
npm run typecheck
npm run lint
npm run docs:check
npm test
npm run test:all
npm run test:coverage
npm run build
npm run test:smoke
```

Quest-specific governed launchers and evidence checks are also exposed through `package.json` (`dev:quest:*`, `quest:evidence-status`, and `analyze:quest-telemetry`). Test counts are intentionally not copied into this README because they drift; CI and the executable test configuration own that truth.

---

## Repository map

```text
nemosyne/
├── src/
│   ├── app/             # Application use-cases and dataset-facing orchestration
│   ├── atlas/           # Analytical/investigation orchestration and evidence access
│   ├── data/            # Dataset contracts, encodings, connectors and browser data surfaces
│   ├── draco/           # Compatibility facade only; not a representation authority
│   ├── events/          # Governed event contracts and product-data plumbing
│   ├── fitness/         # Fitness-model registry and representation-learning contracts
│   ├── governance*/     # Policy/governance contracts and bounded service surfaces
│   ├── interaction/     # Modality-independent semantic interaction/NIL surfaces
│   ├── investigation/   # Investigation, reasoning and discovery-domain state
│   ├── judgement/       # Human judgement and representation feedback contracts
│   ├── learning/        # Governed model-learning/update infrastructure
│   ├── memory/          # Memory/investigation projection support
│   ├── moneta/          # Representation reasoning, evidence gates and embodiment adapters
│   ├── network/         # Collaboration/signalling protocol and browser-safe network surface
│   ├── observability/   # Runtime/product observability contracts
│   ├── performance/     # Resource/performance infrastructure
│   ├── persistence/     # Production/browser persistence ports and implementations
│   ├── security/        # Security boundary helpers and policy-enforcing infrastructure
│   ├── session/         # `.nemosyne` package, logical session and replay substrate
│   ├── study/           # Controlled-experiment research harness
│   ├── ui/              # Desktop UI surfaces
│   ├── validation/      # Governed validation/evidence plumbing
│   ├── vr/              # three.js/WebXR spatial runtime, input, UIKit and presentation
│   └── wasm/            # Typed TypeScript wrappers over the Rust/WASM kernel
├── wasm/                # Rust analytical kernel, authoritative reductions/layouts and WASM ABI
├── modules/
│   └── gesture-intelligence/  # Pluggable heuristic/ONNX gesture classifier
├── dev/                 # XR lab, experimental engine and developer tooling
├── tests/               # Unit, integration, real-WASM, browser and evidence suites
├── governance/          # Machine-readable readiness/promotion state
├── docs/                # Governing docs, research contracts, plans, reviews and study material
└── .github/workflows/   # CI, evidence and publication workflows
```

For symbol-level navigation, use the generated [Wiki codebase index](https://github.com/TsatsuAmable/nemosyne/wiki/Codebase-Index).

---

## Documentation

Start with the small authority set rather than archaeology through every historical plan:

- [Project documentation index](./docs/PROJECT_DOCS_INDEX.md) — lifecycle and authority map for project documentation.
- [Definitive Vision and Roadmap](./docs/Nemosyne_Definitive_Vision_and_Roadmap.md) — governing product, research and architecture direction.
- [Live Roadmap](./docs/ROADMAP.md) — canonical current implementation status and next-work sequencing.
- [User Experience Design Doctrine](./docs/NEMOSYNE_USER_EXPERIENCE_DESIGN_DOCTRINE.md) — semantic fidelity, progressive detail, bounded resources and interaction doctrine.
- [Technical Architecture](./docs/ARCHITECTURE.md) — current subsystem boundaries and authority model.
- [P1 Product Transition Plan](./docs/roadmap/P1_PRODUCT_TRANSITION_PLATFORM_AND_LEARNING_PLAN.md) — strategic product/platform/learning tranche specification.
- [Developer Guide](./docs/DEVELOPER_EXPLAINER.md) and [Getting Started](./docs/GETTING_STARTED.md) — codebase mental model and local setup.
- [Production Readiness](./docs/PRODUCTION_READINESS.md) — generated projection of machine-readable service/readiness state.
- [Statistical Method Register](./docs/STATISTICAL_METHOD_REGISTER.md) — governed statistical-method inventory.
- [Study Index](./docs/study/README.md) — operational research protocol material.
- [GitHub Wiki](https://github.com/TsatsuAmable/nemosyne/wiki) — generated navigation/reference projection of active authorities.

Historical audits and completed sprint documents remain useful provenance, but they do not override the live roadmap.

---

## Deployment surfaces

- **Public site:** `.github/workflows/pages.yml` publishes `docs/` to GitHub Pages at [nemosyne.world](https://nemosyne.world).
- **Application bundle:** `netlify.toml` defines a Node 24 `npm run build` → `dist/` Netlify deployment surface.
- **Readiness claims:** deployment configuration proves a deployment path exists, not that the private-preview or production-readiness gates are complete. See the live roadmap and production-readiness projection for those claims.

---

## Background

The earlier A-Frame/D3 component framework has been retired. The three.js/WebXR runtime is canonical. Useful declarative artefact concepts, design tokens and research ideas from the earlier implementation were carried forward where they still fit the current authority model.

---

## License

MIT © Tsatsu Amable
