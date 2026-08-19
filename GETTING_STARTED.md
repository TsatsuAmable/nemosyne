# Getting Started with Nemosyne

This guide walks you through building, running, and exploring datasets in Nemosyne on desktop and WebXR headsets (Meta Quest 3 / Quest 3S / Apple Vision Pro).

---

## 1. Prerequisites

- **Node.js**: 20+
- **Rust Toolchain**: `rustup` with `wasm32-unknown-unknown` target
- **WebXR Headset**: Meta Quest 3, Quest 3S, or desktop Chrome/Edge emulator
- **Local Network**: Secure HTTPS certificates for WebXR origin

---

## 2. Quickstart Commands

```bash
# 1. Install dependencies
npm install

# 2. Build the Rust/WASM analytical kernel
npm run wasm:dev

# 3. Generate local HTTPS certificates (required for WebXR)
mkdir -p certs
openssl req -x509 -newkey rsa:2048 -keyout certs/key.pem -out certs/cert.pem -subj "/CN=localhost" -nodes

# 4. Start the Vite dev server
npm run dev

# 5. Run full CI verification gate
npm run typecheck && npm run lint && npm run test:coverage && npm run build
```

---

## 3. The Analyst Cockpit & Interaction Grammar (Phase 24)

Nemosyne organizes the spatial analytical experience around a clean, uncluttered cockpit:

### Interaction State Machine
- **`NAVIGATE`**: Explore the environment, teleport with arc preview, pan/zoom the memory palace.
- **`INTERACT`**: Select nodes, open DataCards, filter data, inspect clusters.
- **`TRANSFORM`**: Rotate, scale, slice, and reposition spatial artifacts.
- **`OBSERVE`**: Ambient observation mode with secondary tools minimized.

### 3-Level HandWheel Navigation
Pinch your non-dominant hand to summon the radial HandWheel, organized into 6 intent categories:
1. **`ANALYSE`**: Cluster, anomaly detection, statistical aggregations, TDA Mapper.
2. **`VIEW`**: Switch layout topologies (`GRID`, `FORCE_DIRECTED`, `TIME_RIBBON`, `STREAMLINE`, `GEO_SURFACE`, `CLUSTER_VOLUME`).
3. **`DATA`**: Load CSV/JSON, sample datasets, schema inspection, live data feeds.
4. **`STUDY`**: 2D-vs-VR crossover trials, evidence bookmarks, trial export.
5. **`COLLABORATE`**: WebRTC room connection, peer presence radar, shareable URLs.
6. **`SYSTEM`**: Comfort settings, snap turn, text scaling, theme presets.

### Status Strip ("What Am I Doing?")
A single persistent 1-line strip at the base of your field of view displays your active context:
```text
GRAPH / 18,420 nodes · MODE: ANALYSE · FOCUS: COMMUNITY 7 · ACTION: COMPARE
```

---

## 4. Running a 2D-vs-VR Controlled Study

To launch the built-in experimental crossover study:
1. Open the HandWheel and navigate to **`STUDY`** $\rightarrow$ **`Start Crossover Trial`**.
2. Complete the prompted analytical task (e.g. identify anomaly cluster, compare distributions).
3. Confirm your answer with the confidence rating (1–7) and NASA-TLX workload slider.
4. Export the resulting trial research bundle via **`STUDY`** $\rightarrow$ **`Export Study CSV`**.

---

## 5. Key Documentation Links

- **Developer Guide & Explainer:** [`docs/DEVELOPER_EXPLAINER.md`](file:///Users/tsatsuamable/Documents/nemosyne/docs/DEVELOPER_EXPLAINER.md)
- **Technical Architecture Specification:** [`docs/ARCHITECTURE.md`](file:///Users/tsatsuamable/Documents/nemosyne/docs/ARCHITECTURE.md)
- **Codebase Wiki & Symbol Index:** [`docs/WIKI.md`](file:///Users/tsatsuamable/Documents/nemosyne/docs/WIKI.md)
- **System Error Register:** [`docs/ERROR_REGISTER.md`](file:///Users/tsatsuamable/Documents/nemosyne/docs/ERROR_REGISTER.md)
- **Definitive Product Vision & Roadmap:** [`docs/Nemosyne_Definitive_Vision_and_Roadmap.md`](file:///Users/tsatsuamable/Documents/nemosyne/docs/Nemosyne_Definitive_Vision_and_Roadmap.md)
- **Study Protocol & Crossover Design:** [`docs/study/PROTOCOL.md`](file:///Users/tsatsuamable/Documents/nemosyne/docs/study/PROTOCOL.md)
