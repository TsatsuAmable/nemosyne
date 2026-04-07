# Nemosyne Examples Gallery

A comprehensive collection of domain-specific examples demonstrating Nemosyne's capabilities across industries.

## Quick Start

```bash
cd examples/
python3 -m http.server 8000
```

Then open http://localhost:8000/hello-world/

---

## Core Examples

### 🔷 Hello World
**Single crystal, basic interactions**

- 1 data point (value: 42)
- Hover glow, click to show label
- Entry animation (elastic scale)
- **Perfect for:** Understanding the basics

[→ Open](./hello-world/) | `Single artefact` | `Basic behaviours`

---

### 🌌 Network Galaxy
**8-node microservices network**

- Nodes representing services (DB, API, cache, etc.)
- Color mapped to category
- Size mapped to connections
- Radial 3D layout
- Procedural connection lines

[→ Open](./network-galaxy/) | `Graph topology` | `Force-directed layout`

---

### 📊 Bar Chart
**Monthly revenue visualization**

- Column bars (Jan-Aug)
- Height = value
- Viridis color scale
- Platform base with grid lines

[→ Open](./bar-chart/) | `Tabular data` | `Grid layout`

---

### 🌀 Timeline Spiral
**24-hour activity pattern**

- Rising spiral (time flows upward)
- Diverging colors (red = low, teal = high)
- Connecting path between hours
- Central rotating core

[→ Open](./timeline-spiral/) | `Time-series` | `Spiral layout`

---

### 🌳 Data Tree
**Hierarchical file system**

- 12 nodes in tree structure
- Level 0: Root (Documents)
- Level 1: Work, Personal, Projects
- Level 2-4: Subfolders & files
- Color = file type
- Connecting pillars

[→ Open](./data-tree/) | `Hierarchy` | `Tree layout`

---

## Domain-Specific Examples

### 🏭 Industrial IoT
**Real-time factory floor monitoring**

- Temperature sensors (diverging colors: blue → red)
- Vibration sensors (pulsing when critical)
- Power distribution (animated flow lines)
- Alert system with thresholds
- Auto-reconnect WebSocket simulation

**Extensions:** `websocket-stream`, `alert-system`

[→ Open](./industrial-iot/) | `Live data` | `Alerts` | `Monitoring`

---

### 📈 Financial Markets
**FIX protocol trading visualization**

- Order book depth (bid = teal, ask = rose)
- FIX 4.4 message parsing (Tag 35, 39, 150)
- Trade flow visualization
- Real-time price ticker
- Market data aggregator

**Extensions:** `fix-protocol`

[→ Open](./financial-markets/) | `Trading` | `FIX` | `Real-time`

---

### 🧬 Scientific Research
**Molecular dynamics (PDB format)**

- Protein structure visualization
- CPK coloring (C=gray, N=blue, O=red, S=yellow)
- Bond rendering (explicit + inferred)
- Auto-rotating molecule
- PDB file parser

**Extensions:** `molecular`

[→ Open](./scientific-research/) | `Molecular` | `PDB` | `Chemistry`

---

### 🏥 Medical Imaging
**DICOM CT scan viewer**

- Axial/sagittal/coronal slice planes
- Hounsfield Unit (HU) windowing
- Transfer function editor (air/bone/soft tissue)
- ROI markers for anomalies
- Synthetic CT data generation

**Extensions:** `dicom-volumetric`

[→ Open](./medical-imaging/) | `DICOM` | `Volume` | `CT/MRI`

---

### 🏙️ Smart Cities
**Urban planning data viz**

- Building extrusion by height
- Air quality plumes (AQI color-coded)
- Traffic flow arteries (thickness = volume)
- Energy consumption monitoring
- Auto-updating sensors

[→ Open](./smart-cities/) | `Urban` | `Environment` | `Planning`

---

### 🎓 Education
**Interactive solar system**

- 8 planets with orbital mechanics
- Keplerian orbits (eccentricity, period)
- Logarithmic scale for outer planets
- Size comparison mode
- Quiz system with scoring

**Extensions:** `education-solar`

[→ Open](./education-solar/) | `Astronomy` | `Orbits` | `Quiz`

---

### 🎮 Virtual Worlds
**Game dev level editor**

- NavMesh visualization (walkable areas)
- Spawn points (enemy, player, loot)
- Patrol path editing
- Performance profiler overlay
- Entity Component System (ECS) viewer

**Extensions:** `game-worlds`

[→ Open](./virtual-worlds/) | `Game Dev` | `NavMesh` | `Profiler`

---

## Feature Comparison by Domain

| Example | Topology | Layout | Real-time | Extensions |
|---------|----------|--------|-----------|------------|
| Hello World | Scalar | Single | — | — |
| Network Galaxy | Graph | Radial | — | — |
| Bar Chart | Tabular | Grid | — | — |
| Timeline Spiral | Temporal | Spiral | — | — |
| Data Tree | Hierarchy | Custom | — | — |
| **Industrial IoT** | Multi | Grid | ✅ | WebSocket, Alerts |
| **Financial Markets** | Tabular | Linear | ✅ | FIX Parser |
| **Scientific Research** | Spatial | Custom | — | PDB Parser |
| **Medical Imaging** | Volumetric | Slice | — | DICOM Parser |
| **Smart Cities** | Geospatial | Grid | ✅ | — |
| **Education** | Orbital | Custom | ✅ | Astronomy |
| **Virtual Worlds** | Spatial | Custom | ✅ | Game Tools |

---

## Extension Summary

| Extension | File | Size | Purpose |
|-----------|------|------|---------|
| `websocket-stream` | `websocket-stream/index.js` | ~600 LOC | Real-time data, buffering, alerts |
| `fix-protocol` | `fix-protocol/fix-parser.js` | ~500 LOC | FIX 4.4 trading protocol |
| `molecular` | `molecular/pdb-parser.js` | ~600 LOC | Protein structures, CPK colors |
| `dicom-volumetric` | `dicom-volumetric/dicom-parser.js` | ~700 LOC | Medical imaging, CT/MRI |
| `education-solar` | `education-solar/astronomy.js` | ~600 LOC | Orbital mechanics, quizzes |
| `game-worlds` | `game-worlds/index.js` | ~700 LOC | NavMesh, ECS, profiler |

---

## Creating Your Own Example

Template structure:

```
projects/nemosyne/examples/your-example/
├── index.html       # Main visualization
├── README.md        # Documentation
├── data/            # Sample data files
└── assets/          # Images, textures
```

Minimal HTML:

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://aframe.io/releases/1.4.0/aframe.min.js"></script>
  <script src="../../framework/dist/nemosyne.v2.js"></script>
  <!-- Any extensions -->
  <script src="../../extensions/your-extension/index.js"></script>
</head>
<body>
  <a-scene>
    <nemosyne-artefact-v2
      spec='{"geometry":{"type":"octahedron"}}'
      dataset='{"records":[{"value":42}]}'
      layout="grid"
    ></nemosyne-artefact-v2>
  </a-scene>
</body>
</html>
```

---

*Examples are tested in Chrome, Firefox, and Edge. VR headset support requires WebXR-compatible browser.*
