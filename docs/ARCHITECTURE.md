# 🏛️ Nemosyne Technical Architecture & API Reference

This document provides a comprehensive technical reference for the **Nemosyne Spatial Data Analysis Suite**, detailing system architecture, component boundaries, class structures, public API contracts, data pipelines, and WebXR spatial ergonomics.

---

## 1. 🌐 System Overview & Architecture Pipeline

Nemosyne maps high-dimensional datasets into interactive 3D spatial "memory palaces" using a Draco-style symbolic constraint engine, WebGL/WebXR three.js rendering, and WebAssembly compute kernels.

```
       Raw Input Data (CSV / JSON / WebSockets / Live Streams)
                                │
                                ▼
         Parsers & Connectors (src/data/ & src/data/connectors/)
                                │
                                ▼
         Dataset Model & Encodings (Dataset.ts & Encodings.ts)
                                │
                                ▼
         Draco Constraint Engine (src/draco/ConstraintEngine.ts)
          └── Evaluates Hard/Soft Constraints & Ranks Layout Specs
                                │
                                ▼
         VRTopologyTranslator (src/draco/VRTopologyTranslator.ts)
          └── Maps Specs to 3D Geometry, Colors, Sizes, and Animations
                                │
                                ▼
       ObjectPool & Time-Slicing (src/vr/scalability/ObjectPool.ts)
          └── Geometry/Material Reuse & Micro-task Frame Slicing
                                │
                                ▼
        three.js WebXR Scene Graph & Analyst Torso Anchor
          ├── DracoTopologyNode (Data Palace)
          ├── Dual Vertical Wheel Menus (HandWheelMenu.ts)
          ├── MovablePanel Cluster & Curved Spatial Dashboard
          └── HolographicInspector & Spatial Landmarks
                                │
                                ▼
       Normalized Input Routing (src/vr/InputRouter.ts & SelectionDispatcher.ts)
          ├── WebXR Hand Tracking & Controller Laser Rays
          ├── Dwell Selection Timer & Multi-modal Audio-Haptics
          └── On-device UX Frustration Analyzer & Telemetry Engine
```

---

## 2. 🧩 Subsystem Class & Component Reference

### 2.1 📊 Data & Serialization Layer (`src/data/`)

The data layer models tabular, graph, geospatial, and time-series data structures, supporting pure functional operations, IndexedDB persistence, and live WebSocket streaming.

#### `Dataset.ts`
- **Class**: `Dataset`
- **Purpose**: Represents an immutable in-memory dataset with typed columns and metadata.
- **Key Methods**:
  - `getColumn(name: string): ColumnSchema | undefined`
  - `rangeOf(columnName: string): { min: number; max: number }`
  - `updateRows(newRows: Record<string, unknown>[], mode?: 'append' | 'replace', limit?: number | null): void`
  - `toJSON(): DatasetJSON`

#### `Parsers.ts`
- **Functions**: `parseCSV()`, `parseJSON()`, `inferColumnTypes()`
- **Purpose**: Parses raw CSV text or JSON array buffers and infers numeric, categorical, or temporal schema types.

#### `DatasetOperations.ts`
- **Functions**: `filter()`, `sort()`, `aggregate()`, `cluster()`, `timeSlice()`, `anomaly()`
- **Purpose**: Pure transform functions that calculate derived datasets without mutating source rows.

#### `SessionStore.ts`
- **Class**: `SessionStore`
- **Purpose**: Asynchronous IndexedDB storage engine for auto-saving analysis history, active encodings, panel positions, and session snapshots.

---

### 2.2 ⚡ WebAssembly Core & Host Bridge (`src/wasm/` & `wasm/`)

The WebAssembly subsystem executes high-performance data transformations and spatial indexing in Rust compiled via `wasm-pack`.

#### `RuntimeBridge.ts`
- **Module**: `RuntimeBridge`
- **Purpose**: Typed JavaScript bridge managing WASM memory allocation (`allocBytes`, `readBytes`) and execution fallbacks.
- **Key Functions**:
  - `executeOperation(dataset: DatasetJSON, spec: OperationSpec): DatasetJSON`
  - `loadSampleDataset(name: string): DatasetJSON`
- **Fault-Tolerance**: Wrapped in JS `try...catch` blocks to auto-fallback to JavaScript calculations on WebAssembly panics.

---

### 2.3 📐 Draco Constraint Recommender (`src/draco/`)

The Draco layer implements symbolic constraint satisfaction for automated 3D spatial visualization.

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

The project includes an extensive Vitest unit and integration test suite (116+ test files, 940+ tests):

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
- [`CLAUDE.md`](file:///C:/Users/stromae/Documents/Code/nemosyne.world/CLAUDE.md) — Runtime guidelines and development commands.
- [`docs/GITHUB_ISSUES.md`](file:///C:/Users/stromae/Documents/Code/nemosyne.world/docs/GITHUB_ISSUES.md) — Issue tracking and proposed solutions.
- [`.agents/team.json`](file:///C:/Users/stromae/Documents/Code/nemosyne.world/.agents/team.json) — AI Developer Team configuration.
- [`.agents/skills/vr-accessibility/SKILL.md`](file:///C:/Users/stromae/Documents/Code/nemosyne.world/.agents/skills/vr-accessibility/SKILL.md) — VR UX and accessibility standards.
