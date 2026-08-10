# Project: Nemosyne

## Architecture
Nemosyne is a high-performance WebXR spatial analytics platform for high-dimensional topological data.
The architecture enforces a strict unidirectional data flow:
`Data Ingestion (src/data/) → Draco Topology Engine (src/draco/) → VR Spatial Runtime (src/vr/)`

```
┌─────────────────────────────────────────────────────────┐
│                       Data Layer                        │
│ (Parsers, Connectors, Ingestion, Dataset, Topology)     │
└────────────────────────────┬────────────────────────────┘
                             │ (Data Models & Topology)
                             ▼
┌─────────────────────────────────────────────────────────┐
│                  Draco Engine Layer                     │
│ (ConstraintEngine, TopologyTranslator, VR Layouts)      │
└────────────────────────────┬────────────────────────────┘
                             │ (Spatial Nodes & Renderables)
                             ▼
┌─────────────────────────────────────────────────────────┐
│                   VR Spatial Runtime                    │
│ (World, Engine, SceneComposer, InstancedPointCloud, UI) │
└─────────────────────────────────────────────────────────┘
```

## Feature Inventory
| # | Feature / Bug Fix | Description | Milestone | Source |
|---|-------------------|-------------|-----------|--------|
| 1 | Data → Draco Reverse Import | Fix `src/data/TopologyInference.ts` importing `TopologyTypes` from `src/draco/ConstraintEngine.ts` | M1 | survey_1 |
| 2 | Draco → VR Upstream Imports | Decouple `DracoDiagnosticHUD`, `DracoTopologyNode`, and `VRTopologyTranslator` from `src/vr/` UI & Scalability | M1 | survey_1 |
| 3 | God Object Refactoring | Decouple `src/vr/World.ts` central hub and clean legacy `.js` stubs | M1 | survey_1 |
| 4 | Shared Geometry Disposals | Prevent `Dispose.ts` / `World.loadDataset()` from disposing `MeshPool` static shared geometries | M2 | survey_2 |
| 5 | Governor Event Loop | Wire `eventBus` into `AdaptiveFrameGovernor` in `Engine.ts` to emit `PERFORMANCE_THROTTLE` events | M2 | survey_2 |
| 6 | Instanced Buffer Attribute Leaks | Properly dispose and reuse `instanceColor` & `instanceMatrix` in `InstancedPointCloud.ts` | M2 | survey_2 |
| 7 | Edge Draw Call Explosion | Convert individual `THREE.Line` edge meshes in `VRTopologyTranslator` into unified `THREE.LineSegments` | M2 | survey_2 |
| 8 | 90 FPS Frame Target | Align budget checks in `Engine.ts` and governor to 11.11ms WebXR target | M2 | survey_2 |
| 9 | Torso Anchor Rotation Jitter | Add smooth damping to `analystAnchor` yaw rotation in `WorldSceneComposer` | M2 | survey_2 |
| 10 | 3D UI Panel Z-sorting | Correct `depthTest` and `depthWrite` settings in `MovablePanel.ts` | M2 | survey_2 |
| 11 | Prototype Pollution Hardening | Filter `__proto__`, `constructor`, `prototype` keys across `parseCSV`, `CSVDataParser`, `Dataset.fromJSON`, `MessagePackSerializer`, `NetworkManager` | M3 | survey_3 |
| 12 | Binary Protocol Bounds Safety | Add strict buffer byte length checks in `FlatBuffersSerializer` and `ArrowBinaryParser` | M3 | survey_3 |
| 13 | 0 Unhandled Rejections & Leaks | Guard async dynamic imports and serialization streams against unhandled rejections | M3 | survey_3 |
| 14 | Unit & WASM Test Suite | Enhance unit and WASM test coverage to ensure 100% `npm test` pass rate | M4 | survey_3 |
| 15 | Requirement-Driven E2E Suite | Construct opaque-box E2E test suite (Tiers 1-4) and publish `TEST_READY.md` | E2E | user_req |

## Feature Inventory Cross-Check
- Total Features: 15
- All features 1..15 assigned:
  - M1: 1, 2, 3
  - M2: 4, 5, 6, 7, 8, 9, 10
  - M3: 11, 12, 13
  - M4: 14
  - E2E: 15
- Verification: 100% assigned. Zero unassigned features.

## Milestones

> Live status is tracked in the **Current Status** block at the top of
> `docs/ROADMAP.md`. The table below is a historical record of the M1-M4
> orchestration and is not kept current — read ROADMAP for today's state.

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Architectural Decoupling | Unidirectional data flow (Data -> Draco -> VR), fix reverse/upstream imports, legacy `.js` stubs | None | ✅ DONE |
| M2 | WebXR Graphics & Spatial Engine | Sub-11.1ms frame budget, Three.js geometry/material cleanup, line segments, torso damping, UI z-index | M1 | ✅ DONE |
| M3 | Security & Robustness | Prototype pollution rejection (`__proto__`, `constructor`), binary buffer bounds safety, 0 unhandled rejections | M1 | ✅ DONE |
| M4 | Test Coverage & Quality | 100% test pass rate across `src/` and WASM, final coverage hardening | M2, M3 | ✅ DONE |
| E2E | E2E Testing Suite Track | Independent requirement-driven opaque-box E2E test suite (Tiers 1-4 + Tier 5) | None (parallel) | ✅ DONE |

## Interface Contracts

### Data ↔ Draco Interface Contract
- `src/types/topology.ts`: Shared topology data types (`TopologyTypes`, node/edge data structures) owned by Data layer or shared type registry.
- `src/data/` MUST NOT import anything from `src/draco/` or `src/vr/`.
- `src/draco/` MUST ONLY import from `src/data/` or `src/types/`.

### Draco ↔ VR Spatial Runtime Interface Contract
- `DracoTopologyTranslator`: Translates topological objects into spatial scene specifications.
- `src/draco/` MUST NOT import UI components (`MovablePanel`), render scalability classes (`MeshPool`, `InstancedPointCloud`), or artifacts (`ChartPlane`) directly from `src/vr/`.
- Interaction hooks and UI registration are passed down from `src/vr/` via callbacks, events (`EventBus`), or factory interfaces defined in `src/draco/types/`.

## Code Layout
- `src/data/`: Data ingestion, CSV/JSON/Arrow parsers, Dataset model, topology inference.
- `src/draco/`: Draco topology engine, constraint solvers, topology translation.
- `src/vr/`: VR spatial runtime, Three.js engine, world composer, WebXR controllers, scalability pools, UI panels.
- `src/network/`: WebRTC signalling, peer synchronization, pose serialization.
- `src/utils/`: Event bus, disposal helpers, math utilities.
- `wasm/`: Rust WebAssembly topology acceleration crate (`wasm-pack`).
- `tests/`: Vitest test suite and mocks.
