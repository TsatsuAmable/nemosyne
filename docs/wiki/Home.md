# Welcome to the Nemosyne Wiki

**Nemosyne** (`nemosyne.world`) is an open-source, production-grade WebXR Spatial Data Analysis Suite.

---

## 🏛️ System Architecture

Nemosyne uses a **direct three.js + WebGL/WebXR core** paired with a **Rust / WebAssembly high-performance runtime** and **ONNX AI Gesture Classifier**:

```
Raw Data (CSV / JSON / Live Stream)
       ↓
Rust / WASM Data Core (Parsers, Clustering, TDA Mapper, CommandBuffer)
       ↓
Draco Evolutionary Genetic Algorithm (GA) + Edge SLM World Model
       ↓
VR Topology Synthesis (Crystals, TechnoCore, IceVault, ChartPlanes)
       ↓
three.js WebXR Render Engine (90 FPS on Meta Quest 3/3S)
       ↓
Multi-Sensory Interaction (AI Gestures, JIT Hints, HRTF Spatial Audio)
       ↓
WebRTC P2P DataChannel Collaboration (3D User Cloud Avatars)
```

---

## 📖 Wiki Navigation

- [Getting Started Guide](Getting-Started.md) — Setup, local development, and Meta Quest WebXR deployment.
- [API Reference](API-Reference.md) — Comprehensive API reference for `World`, `Dataset`, `GestureClassifierModel`, `SpatialAudioSynthesizer`, `NetworkManager`, `UserCloudAvatar`, and WASM modules.
- [Features & Capabilities Matrix](../../FEATURES.md) — Master breakdown of all shipped capabilities.

---

## 🛠️ Key Developer Commands

```bash
# Install dependencies
npm install

# Run Vitest unit test suite (875+ tests)
npm test

# Run TypeScript type check
npm run typecheck

# Build production bundle
npm run build

# Start local dev server
npm run dev
```
