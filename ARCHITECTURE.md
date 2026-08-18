# Nemosyne Technical Architecture & API Reference

This document provides a comprehensive technical reference for the **Nemosyne Spatial Data Analysis Suite**, detailing system architecture, component boundaries, class structures, public API contracts, data pipelines, and WebXR spatial ergonomics.

> **100% Pure TypeScript.** All application source under `src/` and test suites under `tests/` are `.ts` (`tsc --noEmit` and `eslint` are required CI gates). Only root configs (`vite.config.js`, `vitest.config.js`, `eslint.config.js`, `vite-wasm-pack-plugin.js`) remain `.js`.

> **Rust/WASM Analytical Kernel Authority.** The Rust analytical kernel (`wasm/`) is the authoritative source for all data parsing, topology inference, clustering, and dataset transformations. There is no JavaScript analytical fallback in production.

---

## 1. 🌐 System Overview & Architecture Pipeline

Nemosyne organizes the spatial data exploration workflow into three distinct architectural layers:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. Analysis Runtime (Sole Analytical Authority — Zero Three.js/DOM deps)    │
│    ├── AtlasCore & DatasetSpace (Deterministic provenance & state ledger)   │
│    ├── Rust/WASM Analytical Kernel (Parsing, TDA, Clustering, Filtering)    │
│    └── EvidenceStore & EvidenceWeightedScorer (Empirical Recommender)       │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Analytical Actions / VRCommand Specs
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. Spatial Runtime (3D Spatial Presentation & Input Layer)                  │
│    ├── Engine (Three.js WebXR render loop, WebGL2, performance budgets)     │
│    ├── DracoTopologyNode & Layout Generators (Spatial Data Palaces)         │
│    ├── Unified Input Routing (Pointers, Hand-tracking, Gesture Recognition)  │
│    └── Moveable Panel Cluster, Curved Spatial Dashboard & Telemetry         │
└──────────────────────────────────────▲──────────────────────────────────────┘
                                       │
┌──────────────────────────────────────┴──────────────────────────────────────┐
│ 3. Application Composition Root (Lifecycle Coordination & Command Routing)  │
│    ├── World (Runtime lifecycle bootstrap, scene composition, facade-free)  │
│    ├── WorldUIManager (Panels, HUDs, HandWheelMenu, Modals management)      │
│    ├── NemosyneSession (Deterministic session serialization / hydration)    │
│    └── WorldSessionController & LiveStreamCoordinator (Collab & Streams)    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.1 📐 Strict Dependency Direction
Architectural dependencies flow strictly downward:
`data → analysis (Atlas / Draco / WASM) → representation → rendering (Engine / three.js) → input / UI`
- **Zero Graphics Leakage:** The Data (`src/data/`) and Analytical (`src/atlas/`, `wasm/`) layers must **never** import `three`, WebGL, or DOM types.
- **Renderer Isolation:** `Draco` and `AtlasCore` must **never** import `World`, `Engine`, or scene graph controllers.
- **State Encapsulation:** Presentation and UI components must **never** modify `Dataset` or `DatasetSpace` directly; all analytical mutations route through typed `VRCommand` specs or `WorldCommandExecutor`.

### 1.2 🔄 Dataset Immutability & Live Streaming Buffer Model
- **Immutable Analytical Pipeline:** Analytical operations (`filter`, `sort`, `slice`, `aggregate`, `cluster`, `anomaly`) produce new, immutable derived datasets with deterministic FNV-1a content fingerprints and immutable history chains.
- **Mutable Live Ingestion Buffer:** Live streaming sources (`LiveStreamCoordinator`, `DataConnector`) feed `Dataset.updateRows()` to buffer real-time telemetry into the active row store; discrete spatial palace re-solves capture immutable generational checkpoints in `DatasetSpace`.

### 1.3 📡 Event-Bus vs Direct Call Discipline
- **`WorldEventBus` (Events):** Used exclusively for decoupled observation, telemetry capture, UI HUD notifications, and cross-cutting telemetry.
- **Direct Method Calls:** Used for commands, ownership boundaries, rendering lifecycle, resource teardown/disposal, and synchronous state transitions to maintain a visible and deterministic call graph.

---

## 2. 🧩 Subsystem Class & Component Reference

### 2.1 📊 Analytical Core & State Layer (`src/atlas/` & `src/data/`)

The analysis layer models datasets, manages topological structures, executes analytical operations via the Rust WASM kernel, and maintains an immutable provenance ledger.

#### `AtlasCore.ts`
- **Class**: `AtlasCore`
- **Purpose**: Authoritative domain coordinator and provenance engine. Zero Three.js or DOM dependencies.
- **Key Methods**:
  - `loadDataset(dataset: Dataset): void`
  - `applyAnalysis(spec: AnalysisSpec): AnalysisResult`
  - `recordEmbodimentCommand(command: VRCommand): void`
  - `toState(): AtlasStateJSON` & `restoreState(state: AtlasStateJSON): void`

#### `DatasetSpace.ts`
- **Class**: `DatasetSpace`
- **Purpose**: Tracks dataset versioning, dimensionality, statistical facts, and cryptographic FNV-1a state fingerprints.

#### `EvidenceStore.ts` & `EvidenceWeightedScorer.ts` (`src/draco/evidence/`)
- **Classes**: `EvidenceStore`, `EvidenceWeightedScorer`
- **Purpose**: Ingests trial interaction telemetry and calculates empirical utility to Bayesian-re-rank Draco candidate visual layouts.

#### `Dataset.ts`
- **Class**: `Dataset`
- **Purpose**: In-memory representation of typed columns, schemas, and row collections.

---

### 2.2 ⚡ WebAssembly Core & Host Bridge (`src/wasm/` & `wasm/`)

The WebAssembly subsystem executes high-performance data transformations, topology inference, and spatial graph algorithms in Rust compiled via `wasm-pack`.

#### `RuntimeBridge.ts`
- **Module**: `RuntimeBridge`
- **Purpose**: Typed JavaScript bridge to the `nemosyne_wasm` module utilizing handle-based memory management and command buffers.
- **Key Functions**:
  - `runOperation(handle: number, spec: OperationSpec): number`
  - `getDatasetJson(handle: number): DatasetJSON | null`
  - `inferTopology(handle: number): TopologyType`
  - `inferEncodings(handle: number, topology?: TopologyType): EncodingMapping`

---

### 2.3 📐 Draco Constraint Recommender (`src/draco/`)

The Draco v1 Embodiment Engine implements symbolic constraint satisfaction for automated VR spatial visualization.

#### `ConstraintEngine.ts`
- **Class**: `ConstraintEngine`
- **Purpose**: Extracts facts from dataset properties, filters invalid specs via hard constraints, and ranks recommendations using weighted soft constraints.
- **Key Methods**:
  - `solve(input: DracoDataInput): SolverResult`
  - `adjustWeight(ruleName: string, delta: number): void`

#### `VRTopologyTranslator.ts`
- **Class**: `VRTopologyTranslator`
- **Purpose**: Translates Draco solver specifications into Three.js object groups.
- **Layout Generators**:
  - `GridLayout3D`: 3D matrix layouts for tabular datasets.
  - `ForceDirected3D`: Physics-based spring layout for graph networks.
  - `RadialTreeLayout`: Conical orbital rings for hierarchical trees.
  - `GeoSurfaceLayout`: Latitude/longitude spatial projections.
  - `TimeSeriesRibbonLayout`: 3D temporal ribbon curves.
  - `StreamlineLayout`: Vector field streamlines.

#### `DracoTopologyNode.ts`
- **Class**: `DracoTopologyNode`
- **Purpose**: Controls data palace lifecycle (solve ➔ synthesize ➔ place ➔ update ➔ dispose).
- **Object Pool Integration**: Uses `MeshPool.instance.releaseGroup()` to recycle 3D node meshes instantly on dataset updates.

---

### 2.4 🥽 WebXR Runtime & Spatial Coordinators (`src/vr/`)

The VR runtime layer manages WebGL rendering, WebXR session binding, camera anchoring, and coordinator modules.

#### `World.ts` composition root

`World` currently composes the runtime and delegates work to coordinators. The Stable Alpha
architecture refactor narrows that role further: it constructs dependencies, translates input into
typed commands, coordinates renderer lifecycle, and observes transitions. It must not own Atlas
state, analytical facts, research records, persistence authority, or remote state application.

The target boundary is:

```text
logical session + Atlas Core + research ledger
                    |
              typed commands
                    |
          World composition root
             /              \
       2D precision       WebXR renderer
```

Acceptance evidence is a renderer teardown/rebuild from serialized logical state, uniform
coordinator disposal, and identical analytical command semantics for 2D and VR.

#### `Engine.ts`
- **Class**: `Engine`
- **Purpose**: Owns Three.js `Scene`, `PerspectiveCamera`, `WebGLRenderer`, WebXR render loop, and the `updatables` ticking array.

#### `WorldSceneComposer.ts`
- **Class**: `WorldSceneComposer`
- **Purpose**: Manages spatial ergonomics and anchors the analyst workspace (`analystAnchor`) to the user's torso (`camera.y - 0.25m`).
- **Key Method**: `update(): void` — keeps floating panels facing the user at eye/chest level (`~1.35m`).

#### `DataOperationController.ts`
- **Class**: `DataOperationController`
- **Purpose**: Coordinates data operation execution, previewing, and history undo/redo stacks.

#### `WorldInputCoordinator.ts`
- **Class**: `WorldInputCoordinator`
- **Purpose**: Routes physical gestures, controller buttons, and desktop shortcuts to world actions.

---

### 2.5 🖐️ Spatial Input, Ergonomics & Telemetry (`src/vr/input/` & `src/utils/`)

#### `InputRouter.ts`
- **Class**: `InputRouter`
- **Purpose**: Unified interaction dispatcher across WebXR controllers, hand tracking joints, and desktop mouse/keyboard fallback.

#### `SelectionDispatcher.ts`
- **Class**: `SelectionDispatcher`
- **Purpose**: Manages pointer hover states, selection triggers, audio-haptic feedback (`SelectionFeedback.ts`), and **Gaze/Laser Dwell Selection** (`1200ms` timer).
- **Telemetry Call**: `recordDwell(targetId, durationMs, wasClicked)`

#### `HandGestureRecognizer.ts`
- **Class**: `HandGestureRecognizer`
- **Purpose**: Dual-hand gesture detector supporting `pinchTogether`, `pinchApart`, `scoopUp`, `pushForward`, `okSign`, and `bothPinched`.

#### `UXFrustrationAnalyzer.ts`
- **Class**: `UXFrustrationAnalyzer`
- **Purpose**: Real-time sliding-window UX friction analyzer detecting repeated rapid clicking, window thrashing, air-click misses, WASM errors, gesture misfires, and long dwell hesitations.
- **Key Method**: `formatCompactReport(): string` — produces an 8-line token-compressed digest.

---

### 2.6 🖥️ World-Space Panels & UI (`src/vr/ui/`)

#### `MovablePanel.ts`
- **Class**: `MovablePanel`
- **Purpose**: Base class for draggable 3D canvas panels featuring scrollbars, title bars, and minimize buttons.

#### `HandWheelMenu.ts`
- **Class**: `HandWheelMenu`
- **Purpose**: **Dual Vertical Multicoloured Wheel Menus** positioned on the left (`X = -0.36m`) and right (`X = +0.36m`) sides of the analyst torso.
- **Visual Design**: High-contrast rectangular pills (`0.24m x 0.075m`), 30px+ fonts, and horizontal action fan-outs.

#### `GuidedTour.ts`
- **Class**: `GuidedTour`
- **Purpose**: Step-by-step spatial onboarding card anchored at chest height (`1.35m`). Features interactive `[ NEXT > ]` and `[ < PREV ]` button pills, single-step auto-advance guards, and sequential step counting (`1/9` to `9/9`).

---

### 2.7 🚀 Scalability & Object Pooling (`src/vr/scalability/`)

#### `ObjectPool.ts`
- **Classes**: `MeshPool`, `executeInTimeSlices()`
- **Purpose**: Reuses Three.js `SphereGeometry`, `BoxGeometry`, `CylinderGeometry`, and independent `MeshStandardMaterial` instances. Eliminates dataset swap frame spikes (>200ms) by batching mesh creation in micro-task time slices.

#### `InstancedPointCloud.ts`
- **Class**: `InstancedPointCloud`
- **Purpose**: High-capacity GPU point cloud wrapper using `THREE.InstancedMesh` for rendering up to 65,536 nodes efficiently.

#### `SpatialIndex.ts`
- **Class**: `SpatialIndex`
- **Purpose**: Uniform-grid 3D spatial partitioning index for fast radius searches and laser raycast intersection queries.

---

## 3. 🧪 Testing & Build Verification

The current test and build evidence is maintained in the `Current Status` block of
[ROADMAP.md](ROADMAP.md), not duplicated here.

```bash
# Run all unit and integration tests
npm test

# Run a single test file
npx vitest run tests/object-pool.test.ts

# Production build
npm run build
```

---

## 📚 Related Documentation Files
- [`CLAUDE.md`](../CLAUDE.md) — Runtime guidelines and development commands.
- [`PROJECT_DOCS_INDEX.md`](PROJECT_DOCS_INDEX.md) — Documentation authorities and archive index.
- [`team.json`](../.agents/team.json) — AI Developer Team configuration.
- [`SKILL.md`](../.agents/skills/vr-accessibility/SKILL.md) — VR UX and accessibility standards.
