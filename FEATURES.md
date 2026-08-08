# 🌟 Nemosyne Features & Capability Matrix

**Nemosyne** (`nemosyne.world`) is a production-grade WebXR spatial data analysis suite. It transforms multi-dimensional datasets into interactive 3D "memory palaces" using three.js, WebGL/WebXR, a high-performance Rust/WASM engine, ONNX AI gesture models, and real-time WebRTC collaboration.

---

## 🚀 Core Features Matrix

### 1. 🌐 WebXR Spatial Render Engine
- **Direct three.js + WebXR Core**: Sub-11.1ms frame rendering budget ensuring steady **90 FPS** on standalone Meta Quest 3/3S headsets.
- **Cockpit-Style Semicircle Dashboard (`DashboardManager.ts`)**: Curved 2D/3D workspace wall with fixed angular columns, billboard orientation, and snap-to-zone dragging.
- **Body-Locked Radial Wheel Menu (`HandWheelMenu.ts`)**: Muscle-memory radial menu anchored in front of the chest at ~0.55m comfort distance.
- **Diegetic Holographic Inspector (`HolographicInspector.js`)**: Hand-following slate for deep row metadata inspection.
- **Spatial Audio Synthesizer (`SpatialAudioSynthesizer.ts`)**: Web Audio `PannerNode` HRTF 3D spatialization, distance pitch cues (300Hz–1200Hz), and tri-tone cluster chords.

### 2. ⚡ Rust / WASM Performance Core
- **C-ABI Command Buffer (`wasm/src/command_buffer.rs`)**: Zero-allocation binary stream (`OP_CREATE_NODE`, `OP_UPDATE_TRANSFORM`, `OP_SET_COLOR`) consumed by JavaScript `CommandApplier` once per frame.
- **3D Native Spatial Layout Generators**: `Grid3D`, `ForceDirected3D` (Fibonacci sphere + N-body repulsion), and `RadialTreeLayout` calculated natively in WebAssembly memory.
- **WASM Data Operations (`wasm/src/data/operations.rs`)**: Native WASM implementations of **k-means++**, **DBSCAN** ($\epsilon$-neighborhoods + noise filtering), and **Agglomerative Hierarchical Clustering** (dendrogram tree splits).
- **Topological Data Analysis Engine (`wasm/src/data/topology.rs`)**: Native WASM calculation of **TDA Mapper graphs**, **Vietoris-Rips 1D persistence barcodes**, and **Betti-0 curves**.

### 3. 🤖 AI Gesture Recognition & JIT Hints
- **AI Gesture Classifier Model (`GestureClassifierModel.ts`)**: 60Hz 3D joint trajectory sampling buffer, velocity vectors, angular curvature, and dynamic biomechanical auto-calibration (`moveThreshold`, `pinchThreshold`).
- **ONNX Runtime Web Bridge**: Seamless asynchronous ONNX model loading (`/assets/models/gesture_classifier.onnx`) with graceful heuristic fallback.
- **Just-In-Time (JIT) Diegetic Hints (`JITGestureHintManager.ts`)**: Context-sensitive 3D ghost hand wireframe animations and floating diegetic labels.
- **On-Device Weight Retraining (`GestureTrainingWorker.ts` & `GestureModelStore.ts`)**: Background micro-epoch training pass during idle moments with IndexedDB model weight persistence (`nemosyne_gesture_weights_v1`).

### 4. 👥 WebRTC Multi-User Collaboration & User Cloud Avatars
- **WebRTC P2P DataChannel Engine (`NetworkManager.ts`)**: Direct Peer-to-Peer data channels streaming 60Hz pose vectors and user telemetry datasets (`broadcastUserTelemetry`).
- **User Telemetry Interpreter (`TelemetryInterpreter.ts` & `UserMetadataDataset.ts`)**: Converts raw interaction metadata (gaze dwell, selection frequency, sentiment metrics, gesture confidence) into structured user telemetry datasets.
- **Living 3D User Cloud Avatar (`UserCloudAvatar.ts`)**: Dynamic 3D instanced particle cloud representing peer analysts in VR space based on their focus columns and sentiment state, with wireframe fallback.

### 5. 🧬 Evolutionary Draco Constraint Solver & World Model
- **Evolutionary Genetic Algorithm (GA) Solver (`ConstraintEngine.ts`)**: Emergent 3D memory palace representations produced through genetic crossover & mutation across Layout, Geometry, Encoding, Behavior, and Overlay genes.
- **Interactive Candidate Carousel (`RepresentationCarousel.ts`)**: 3D VR candidate representation carousel featuring interactive diegetic weight sliders (*Separability*, *Occlusion*, *Spatial Audio Proximity*).
- **Edge SLM World Model (`DracoWorldModel.ts`)**: Closed-loop feedback model modulating GA parameters live as analysts adjust sliders in 3D VR space.

---

## 📊 Technical Quality & Governance Metrics

- **Type Safety**: 100% TypeScript conversion (`tsc --noEmit` 0 errors).
- **Test Coverage**: 95+ test files / **875+ passing unit tests** via Vitest.
- **Continuous Integration**: Automated GitHub Actions matrix (`.github/workflows/ci.yml`) testing Node 20 & Node 22 on every Pull Request.
- **Production Build**: Production assets optimized and chunk-split in `dist/`.
