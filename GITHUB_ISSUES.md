# 📋 GitHub Issues & Investigation Plan

This document tracks identified friction points, runtime panics, and performance bottlenecks gathered from telemetry and VR remote console logs, complete with root-cause analysis, reproduction steps, proposed solutions, and implementation plans.

---

## 🐛 Issue #1: WebAssembly Runtime Panic (`RuntimeError: unreachable`) on Operations

- **Labels**: `bug`, `wasm`, `high-priority`
- **Component**: `src/wasm/RuntimeBridge.ts`, `src/vr/coordinators/DataOperationController.ts`
- **Impact**: When WASM operations (such as `timeSlice` or unmapped dataset keys) execute, Rust WebAssembly triggers `RuntimeError: unreachable`.

### 📌 Root Cause Analysis
Certain operation parameter specifications (or datasets with missing columns) pass through `buildWasmOperationSpec()` into Rust WASM without full schema validation on the Rust side, causing a Rust panic.

### 🛠️ Proposed Solution & Investigation Plan
1. **Immediate Mitigation (Implemented)**:
   - Wrapped WASM calls in `try...catch` blocks to gracefully fail over to JS calculation without crashing the WebXR render loop.
2. **Rust Engine Validation (Permanent Fix)**:
   - Update `nemosyne_wasm` Rust crate to return explicit result status codes (`Result<DatasetHandle, WasmError>`) instead of invoking `panic!()` or `unreachable!()`.
   - Add Rust-side column schema checks in `execute_operation()`.

---

## ⚡ Issue #2: Frame Render Time Spikes (>200ms) During Dataset Loading

- **Labels**: `performance`, `webxr`, `rendering`
- **Component**: `src/vr/World.ts`, `src/vr/artifacts/DracoPalaceNode.ts`
- **Impact**: Switching datasets triggers a `200ms–243ms` main-thread frame spike (`[PerformanceBudget] critical`), causing temporary visual stutter in VR.

### 📌 Root Cause Analysis
Synchronous instantiation of hundreds of Three.js `Mesh`, `BufferGeometry`, and `Material` objects on the main looper thread during dataset teardown and rebuild.

### 🛠️ Proposed Solution & Investigation Plan
1. **Time-Sliced Mesh Instantiation**:
   - Break mesh creation into chunks across 3–4 animation frames using `requestIdleCallback` or asynchronous generator steps.
2. **Geometry & Material Reuse (Object Pooling)**:
   - Implement geometry/material object pools for Draco node spheres and connection lines to avoid garbage collection sweeps and allocation spikes during dataset swaps.

---

## 🖐️ Issue #3: Hand Tracking Boundary Disconnects & Laser Target Loss

- **Labels**: `ux`, `webxr`, `input`
- **Component**: `src/vr/input/HandPointer.ts`, `src/vr/InputRouter.ts`
- **Impact**: When hand tracking camera FOV drops or hands exit boundary space, hand pointers trigger repeated disconnect/reconnect events (`HandPointer 0 disconnected`), causing laser raycast target loss.

### 📌 Root Cause Analysis
`HandPointer` invalidates pointer raycasts immediately upon joint loss without maintaining a short hysteresis smoothing window.

### 🛠️ Proposed Solution & Investigation Plan
1. **Pointer Hysteresis & Fallback Smoothing**:
   - Maintain a 300ms raycast position extrapolation window when joint tracking temporarily drops out.
2. **Seamless Controller Swap**:
   - Auto-enable controller laser fallback immediately when hand tracking joints report `jointsValid = false`.

---

## 📈 Issue #4: Low-Token Telemetry & Friction Compression

- **Labels**: `feature`, `telemetry`, `ux`
- **Component**: `src/utils/UXFrustrationAnalyzer.ts`, `src/utils/Telemetry.ts`
- **Impact**: Tailing raw 500-line console logs consumed AI model context quota rapidly.

### 📌 Solution (Implemented)
- Added `UXFrustrationAnalyzer.ts` to compress interaction sequences into an 8-line token-efficient UX Frustration Digest.

---

# 🚀 Additional Metrics & Logs to Track

To further improve user experience and diagnose friction before it causes dissatisfaction, we recommend adding the following metrics to our telemetry pipeline:

| Metric | Target Component | Purpose & Insight |
| :--- | :--- | :--- |
| **Gaze & Laser Dwell Time** | `SelectionDispatcher.ts` | Tracks how long an analyst hovers over a button/node before clicking or turning away. Identifies confusing UI labels. |
| **Gesture Confidence & Misfire Rate** | `HandGestureRecognizer.ts` | Measures false-positive vs. true-positive rates for pinch, scoop, and OK-sign gestures to tune gesture sensitivity. |
| **IndexedDB Quota & Write Latency** | `SessionStore.ts` | Monitors auto-save write times and storage consumption to prevent storage quota exhaustion in long sessions. |
| **WebRTC Peer Packet Loss & RTT** | `NetworkAdapter.ts` | Tracks network ping, round-trip time (RTT), and packet loss during multi-user VR collaboration. |
| **Parsing vs. Layout Benchmark Timings** | `RuntimeBridge.ts` | Separates CSV parsing time from 3D layout math to isolate performance bottlenecks. |
