# Nemosyne E2E Testing Infrastructure Specification

## 1. E2E Testing Philosophy & Opaque-Box Guarantees

Nemosyne's End-to-End (E2E) testing suite validates the full spatial analytics runtime stack (`Data Ingestion → Draco Engine → VR Spatial Runtime`) from an **opaque-box** perspective. 

### Core Principles:
- **Opaque-Box Testing**: Tests interact exclusively with public module APIs, exported classes, and system-level `EventBus` events. Tests do not inspect or mutate internal private properties or white-box state.
- **Progressive Testability & Zero Flakiness**: Mocks (WebGL, WebXR, Workers) provide deterministic execution without external GPU or hardware dependencies.
- **Four-Tier Architecture**:
  - **Tier 1 (Feature Coverage)**: Validates functional happy-paths for all 15 core features (minimum 5 test cases per feature, >=75 total).
  - **Tier 2 (Boundary & Corner Cases)**: Validates edge conditions, null handling, malicious payloads, and stress scenarios (minimum 5 test cases per feature, >=75 total).
  - **Tier 3 (Cross-Feature Interactions)**: Multi-layer integration testing between decoupled subsystems (e.g. Memory Disposal × Throttled Instanced Rendering).
  - **Tier 4 (Real-World Workflows)**: Full E2E analytics workflows simulating long-running WebXR sessions, live binary streaming, and dataset swapping.

---

## 2. Directory Architecture & Test File Organization

```
tests/e2e/
├── setup.ts                           # Global E2E environment configuration & mock installers
├── harness/                           # Shared testing harness utilities
│   ├── webgl_mock.ts                  # WebGL 1.0/2.0 context stub & buffer allocation recorder
│   ├── webxr_session_mock.ts          # WebXR device, session, frame, and input controller mocks
│   ├── dataset_fixtures.ts           # Synthetic CSV, JSON, Arrow, and binary payload generators
│   └── memory_profiler.ts             # WebGL geometry, material, and heap memory tracking hooks
└── tier1_feature_coverage/            # Tier 1 Specs (F1..F15)
    ├── f01_reverse_import.spec.ts
    ├── f02_draco_vr_decoupling.spec.ts
    ├── f03_god_object_refactoring.spec.ts
    ├── f04_shared_geometry_disposal.spec.ts
    ├── f05_governor_event_loop.spec.ts
    ├── f06_instanced_buffer_leaks.spec.ts
    ├── f07_edge_line_segments.spec.ts
    ├── f08_fps_frame_target.spec.ts
    ├── f09_torso_anchor_damping.spec.ts
    ├── f10_panel_z_sorting.spec.ts
    ├── f11_prototype_pollution.spec.ts
    ├── f12_binary_bounds_safety.spec.ts
    ├── f13_zero_unhandled_rejections.spec.ts
    ├── f14_unit_wasm_pass_rate.spec.ts
    └── f15_e2e_readiness.spec.ts
```

---

## 3. Test Environment & Mock Harness Setup

### WebGL Mock (`tests/e2e/harness/webgl_mock.ts`)
Provides headless mock implementations for WebGL 1.0/2.0 contexts (`HTMLCanvasElement.getContext('webgl2')`), allowing Three.js `WebGLRenderer` to operate without native hardware bindings. Features include:
- Extended parameters for `MAX_TEXTURE_SIZE`, `MAX_VERTEX_ATTRIBS`, `UNMASKED_RENDERER_WEBGL`.
- Buffer creation and disposal tracking for detecting memory leaks.
- Extension stubs (`ANGLE_instanced_arrays`, `OES_texture_float`, `EXT_color_buffer_float`).

### WebXR Session Mock (`tests/e2e/harness/webxr_session_mock.ts`)
Simulates WebXR hardware APIs (`navigator.xr`):
- `MockXRSession`: Emulates `inline` and `immersive-vr` sessions, supporting `requestAnimationFrame`, `end`, and reference space queries.
- `MockXRFrame`: Supplies virtual head/hand pose data (`XRViewerPose`, `XRTransform`).
- `MockXRInputSource`: Simulates WebXR controllers, triggers, squeezes, and spatial ray pointers.

### Dataset Fixtures (`tests/e2e/harness/dataset_fixtures.ts`)
Generates synthetic datasets across formats and scales:
- Standard Tabular, Graph, Hierarchy, and Geo datasets.
- Malicious payloads containing `__proto__`, `constructor`, `prototype` keys for security testing.
- Corrupted binary payloads (truncated Arrow streams, invalid FlatBuffers headers).
- Large-scale high-dimensional data (100k+ rows) for performance benchmark tests.

### Memory Profiler (`tests/e2e/harness/memory_profiler.ts`)
Tracks GPU buffer and JS heap allocations during test execution:
- `WebGLMemoryTracker`: Monitors count of active shaders, programs, buffers, textures, and framebuffers.
- `HeapSnapshot`: Captures memory footprints before and after operations to verify disposal compliance.

---

## 4. Execution Pipeline & Command Reference

| Suite | Command | Objective |
|-------|---------|-----------|
| **Tier 1 (Feature Coverage)** | `npx vitest run tests/e2e/tier1_feature_coverage/` | Verify 75 happy-path test cases across Features 1..15 |
| **Tier 2 (Boundary & Corner)** | `npx vitest run tests/e2e/tier2_boundary_corner/` | Verify 75 boundary/edge/stress test cases |
| **Tier 3 (Cross-Feature)** | `npx vitest run tests/e2e/tier3_cross_feature/` | Verify inter-module integration specs |
| **Tier 4 (Real-World)** | `npx vitest run tests/e2e/tier4_real_world/` | Verify end-to-end user analytics workflows |
| **Complete E2E Suite** | `npx vitest run tests/e2e/` | Run full E2E test suite |

---

## 5. Four-Tier Coverage Matrix

| Feature ID | Feature Name | Tier 1 Spec File | Tier 2 Spec File | Tier 3 Interaction | Tier 4 Scenario |
|------------|--------------|------------------|------------------|-------------------|-----------------|
| **F1** | Data → Draco Decoupling | `f01_reverse_import.spec.ts` | `f01_boundary.spec.ts` | Suite 3.1 | Scenario 1 |
| **F2** | Draco → VR Decoupling | `f02_draco_vr_decoupling.spec.ts` | `f02_boundary.spec.ts` | Suite 3.1 | Scenario 2 |
| **F3** | God Object Refactoring | `f03_god_object_refactoring.spec.ts` | `f03_boundary.spec.ts` | Suite 3.1 | Scenario 3 |
| **F4** | Shared Geometry Disposal | `f04_shared_geometry_disposal.spec.ts` | `f04_boundary.spec.ts` | Suite 3.1 | Scenario 3 |
| **F5** | Governor Event Loop | `f05_governor_event_loop.spec.ts` | `f05_boundary.spec.ts` | Suite 3.2 | Scenario 1, 4 |
| **F6** | Instanced Buffer Leaks | `f06_instanced_buffer_leaks.spec.ts` | `f06_boundary.spec.ts` | Suite 3.2 | Scenario 1, 3 |
| **F7** | Edge LineSegments | `f07_edge_line_segments.spec.ts` | `f07_boundary.spec.ts` | Suite 3.2 | Scenario 1 |
| **F8** | 90 FPS Frame Target | `f08_fps_frame_target.spec.ts` | `f08_boundary.spec.ts` | Suite 3.2 | Scenario 1, 3 |
| **F9** | Torso Anchor Damping | `f09_torso_anchor_damping.spec.ts` | `f09_boundary.spec.ts` | Suite 3.3 | Scenario 2 |
| **F10** | 3D UI Panel Z-Sorting | `f10_panel_z_sorting.spec.ts` | `f10_boundary.spec.ts` | Suite 3.3 | Scenario 1 |
| **F11** | Prototype Pollution | `f11_prototype_pollution.spec.ts` | `f11_boundary.spec.ts` | Suite 3.4 | Scenario 1, 4 |
| **F12** | Binary Bounds Safety | `f12_binary_bounds_safety.spec.ts` | `f12_boundary.spec.ts` | Suite 3.4 | Scenario 2, 4 |
| **F13** | 0 Unhandled Rejections | `f13_zero_unhandled_rejections.spec.ts` | `f13_boundary.spec.ts` | Suite 3.4 | Scenario 2, 4 |
| **F14** | Unit & WASM Quality | `f14_unit_wasm_pass_rate.spec.ts` | `f14_boundary.spec.ts` | Suite 3.5 | N/A |
| **F15** | E2E Suite Readiness | `f15_e2e_readiness.spec.ts` | `f15_boundary.spec.ts` | Suite 3.5 | N/A |

---

## 6. Flakiness Prevention, Memory Leak Assertions & Quality Standards

1. **Virtual Time & Deterministic Framing**: Frame calculations in tests use controlled delta time steps (e.g. 11.11ms for 90 FPS), avoiding system clock non-determinism.
2. **WebGL Buffer Counter Assertions**: Memory profiler tracks buffer creation vs disposal counters before and after dataset swaps to enforce zero WebGL buffer leaks (`activeBuffers == 0` or baseline).
3. **Unhandled Promise Rejection Traps**: E2E test setup installs a global process `unhandledRejection` listener that fails the active test immediately if an unhandled promise rejection is emitted.
4. **Isolated Test State**: Each test case instantiates its own `EventBus`, scene elements, and datasets, resetting global state in `afterEach()` hooks.
