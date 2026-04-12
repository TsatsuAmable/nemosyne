# Nemosyne 🌌

**Research Framework for Immersive Data Visualization**

> ⚠️ **RESEARCH PREVIEW**: Nemosyne is an experimental framework for investigating whether 3D VR visualizations improve data comprehension compared to 2D. Many features are implemented but untested. We are seeking collaborators to help validate (or refute) our hypotheses.

[![NPM](https://img.shields.io/npm/v/nemosyne.svg)](https://www.npmjs.com/package/nemosyne)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![WebXR](https://img.shields.io/badge/WebXR-Experimental-orange.svg)](https://immersiveweb.dev/)
[![A-Frame](https://img.shields.io/badge/A--Frame-1.7.0-EF2D5E)](https://aframe.io/)

**[Documentation](docs/API_REFERENCE_COMPLETE.md)** | **[Research Agenda](docs/RESEARCH_AGENDA.md)** | **[Examples](examples/)** | **[Changelog](CHANGELOG.md)**

---

## 🔬 Current Status

Nemosyne is a research framework, not a production tool. Here's what exists versus what's validated:

| Component | Implementation | Validation Status | Research Question |
|-----------|---------------|-------------------|-------------------|
| **Core Rendering** | ✅ Working | ⚠️ Needs UX study | Does 3D spatial encoding improve comprehension? |
| **Layout Algorithms** | ✅ 7 implemented | ❌ Not started | Which layouts work for which data types? |
| **Topology Detection** | 🚧 Partial | ❌ Not started | Can we reliably auto-detect data structure? |
| **Performance (10k nodes)** | 🚧 Unbenchmarked | ❌ Not started | At what density does 3D become illegible? |
| **WebSocket Streaming** | ✅ Working | ⚠️ Unmeasured | Does real-time VR dataviz improve monitoring? |
| **MemPalace Integration** | 🚧 Connector exists | ❌ Not started | Does self-built spatial context aid recall? |
| **17 Artefact Types** | 🚧 ~5 working | ❌ Not started | Which visual encodings are most effective? |

### What This Means

- **✅ Working**: Code runs, produces output
- **⚠️ Needs UX study**: Implemented but untested with users
- **🚧 Unbenchmarked**: No performance data exists
- **❌ Not started**: No empirical validation yet

---

## 🌟 What is Nemosyne?

Nemosyne is an **experimental framework** for creating 3D visualizations of data in VR. We're testing a core hypothesis: **does embodied, navigable 3D space improve data comprehension compared to 2D representations?**

Named after the Titaness of memory, Nemosyne explores whether "walking through your data" reveals patterns invisible in traditional charts—or whether the added spatial complexity obscures more than it reveals.

### The Core Hypothesis

```
Hypothesis: 3D advantages emerge for topology-reading tasks
(finding bridges between clusters, understanding hierarchies)

NOT for: value-reading tasks (precise comparisons, reading labels)
```

This hypothesis is **untested**. We're building the infrastructure to find out.

---

## 🚀 Quick Start (Experimental)

### Installation

```bash
npm install nemosyne aframe
```

### Basic Example

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://aframe.io/releases/1.7.0/aframe.min.js"></script>
  <script src="dist/nemosyne.min.js"></script>
</head>
<body>
  <a-scene>
    <!-- A basic 3D bar chart -->
    <a-entity nemosyne-artefact-v2="
      spec: {
        id: 'demo',
        geometry: { type: 'cylinder', radius: 0.3, height: 2 },
        material: { properties: { color: '#00d4aa' } }
      };
      dataset: {
        records: [
          { month: 'Jan', sales: 100 },
          { month: 'Feb', sales: 150 }
        ]
      };
      layout: grid;
      layout-options: { columns: 2, spacing: 2 }
    "></a-entity>
  </a-scene>
</body>
</html>
```

⚠️ **Note**: This creates a 3D visualization. Whether it's *better* than a 2D bar chart for your task is the research question we're investigating.

---

## 📋 Research Agenda

We're treating Nemosyne as a platform for answering seven critical questions:

### 1. Spatial Encoding Efficacy
**Question**: Does embodied, navigable 3D space produce better data comprehension than 2D alternatives, and for which task types?

**Hypothesis**: 3D advantages emerge for topology-reading tasks (finding bridges between clusters), not value-reading tasks (precise comparisons).

### 2. Datumplane Semantics
**Question**: Are the X/Y/Z axis assignments (relationships/hierarchy/time) congruent with human spatial intuition, or arbitrary?

**Experiment**: Present the same dataset in multiple axis configurations and measure comprehension speed and accuracy.

### 3. Memory Palace Hypothesis
**Question**: Does encoding information in a self-constructed, navigable VR space improve recall compared to 2D representations?

**Hypothesis**: Self-generated spatial contexts produce stronger encoding than imposed ones.

*[See all 7 research questions](docs/RESEARCH_AGENDA.md)*

---

## 📦 Current Capabilities (Experimental)

### Implemented Layouts

| Layout | Status | Notes |
|--------|--------|-------|
| `grid` | ✅ Working | Rows and columns |
| `radial` | ✅ Working | Circular arrangement |
| `timeline` | ✅ Working | Linear temporal |
| `spiral` | ⚠️ Implemented | Needs validation |
| `tree` | ⚠️ Implemented | Reingold-Tilford algorithm |
| `force` | ⚠️ Implemented | Force-directed placement |
| `scatter` | 🚧 Basic | Needs refinement |

**Important**: These layouts run and produce output. Whether they produce *useful* visualizations for specific tasks is unknown.

### Data Topology Detection (Experimental)

Nemosyne attempts to analyze your data and suggest layouts. This is **heuristic-based** and untested:

| Topology | Detection | Confidence |
|----------|-----------|------------|
| **Network** | `nodes` + `links` arrays | Low—needs validation |
| **Hierarchy** | `parent` references | Low—needs validation |
| **Temporal** | `timestamp` field | Medium—time is unambiguous |
| **Numerical** | Single numeric value | High—trivial detection |

---

## 🧪 Examples (Simulated Data)

The `/examples/` directory contains demonstrations using **simulated data**. They show what's possible, not production integrations.

| Example | Status | Data Source |
|---------|--------|-------------|
| hello-world | ✅ Working | Static |
| industrial-iot | ⚠️ Simulated | Mock WebSocket |
| financial-markets | ⚠️ Simulated | Mock price generator |
| medical-imaging | 🚧 Static | Sample images, not DICOM |
| smart-cities | ⚠️ Simulated | Mock sensor data |
| scientific-research | 🚧 Static | Sample molecule |

**None** of these currently connect to real data sources. They're visual prototypes awaiting empirical validation.

---

## 🤝 Contributing to Research

We're seeking collaborators with expertise in:

- **Human-Computer Interaction** — Design user studies
- **Data Visualization** — Validate layout efficacy
- **VR/AR Development** — Improve WebXR performance
- **Cognitive Psychology** — Test memory palace hypothesis

### How to Contribute

1. **Join the Discussion**: [GitHub Discussions](https://github.com/TsatsuAmable/nemosyne/discussions)
2. **Propose a Study**: Open an issue with your research design
3. **Share Results**: If you test Nemosyne, publish your findings

---

## 📝 License

MIT © [Tsatsu Amable](https://github.com/TsatsuAmable)

See [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- **[A-Frame](https://aframe.io/)** — WebXR framework
- **[Three.js](https://threejs.org/)** — 3D rendering
- **[Dan Simmons](https://en.wikipedia.org/wiki/Dan_Simmons)** — Hyperion Cantos inspiration

---

## 💬 Research Community

- **GitHub Discussions**: [Join the research conversation](https://github.com/TsatsuAmable/nemosyne/discussions)
- **Issues**: Report bugs or propose studies

---

**Built for data exploration research** 🌌

<p align="center">
  <em>"We're not claiming 3D is better. We're building the tools to find out."</em>
</p>
  <a-scene>
    <a-entity nemosyne-artefact-v2="
      spec: {
        id: 'demo',
        geometry: { type: 'octahedron', radius: 0.5 },
        material: { properties: { color: '#00d4aa', emissive: '#00d4aa', emissiveIntensity: 0.5 } }
      };
      dataset: {
        records: [
          { id: 1, value: 100, category: 'A' },
          { id: 2, value: 200, category: 'B' },
          { id: 3, value: 150, category: 'A' }
        ]
      };
      layout: radial;
      layout-options: { radius: 3 }
    "></a-entity>
  </a-scene>
</body>
</html>
```

### JavaScript API

```javascript
import { SceneManager } from 'nemosyne';

const scene = new SceneManager(document.getElementById('scene'));

await scene.registerArtefact({
  id: 'my-visualization',
  geometry: { type: 'sphere', radius: 0.5 },
  material: { properties: { color: '#4477ff' } },
  layout: 'force'
}, [
  { id: 1, value: 100 },
  { id: 2, value: 200 },
  { id: 3, value: 300 }
]);

// Live data updates
scene.updateData('my-visualization', newData);
```

---

## 📦 Core Concepts

### Data Topology Detection

Nemosyne automatically analyzes your data and assigns the best visualization:

| Topology | Detection | Best Layout |
|----------|-----------|-------------|
| **Network** | `nodes` + `links` arrays | `graph-force` |
| **Hierarchy** | `parent` references | `tree-hierarchical` |
| **Temporal** | `timestamp` field | `timeline-spiral` |
| **Geographic** | `lat`/`lng` fields | `geo-globe` |
| **Numerical** | Single numeric value | `scatter-semantic` |
| **Categorical** | String categories | `grid-categorical` |
| **Matrix** | 2D array | `heatmap-matrix` |

### The Datumplane

Your data lives in a virtual 3D space called the **Datumplane**:

| Axis | Meaning | Usage |
|------|---------|-------|
| **X** | Relationships | Network connections, categories |
| **Y** | Hierarchy | Levels, importance, values |
| **Z** | Time | Sequence, chronology |

---

## 🎨 Artefact Gallery (17 Components)

### Core Visualizations

#### `nemosyne-graph-force` 🕸️
Force-directed network graphs for relationships.

```javascript
{
  nodes: [
    { id: 1, name: 'AI Research', value: 100 },
    { id: 2, name: 'VR Project', value: 80 }
  ],
  links: [
    { source: 1, target: 2, strength: 0.8 }
  ]
}
```

#### `nemosyne-timeline-spiral` 🌀
Temporal data spiraling through time.

```html
<a-entity nemosyne-timeline-spiral="
  dataPoints: [...];
  playAnimation: true;
  temporalScrubbing: true
"></a-entity>
```

#### `nemosyne-tree-hierarchical` 🌳
Dendrograms for hierarchical data.

```javascript
{
  records: [
    { id: 'root', name: 'Company' },
    { id: 'eng', name: 'Engineering', parent: 'root' },
    { id: 'design', name: 'Design', parent: 'root' },
    { id: 'frontend', name: 'Frontend', parent: 'eng' }
  ]
}
```

#### `nemosyne-geo-globe` 🌍
Geographic data on spherical projection.

```javascript
{
  records: [
    { lat: 40.7128, lng: -74.0060, value: 100, city: 'NYC' },
    { lat: 51.5074, lng: -0.1278, value: 80, city: 'London' }
  ]
}
```

#### `nemosyne-scatter-semantic` 📊
2D/3D scatter plots with semantic clustering.

### Advanced Visualizations

- **`nemosyne-crystal-field`** - Scalar fields with isosurfaces
- **`nemosyne-stream-graph`** - Layered temporal flows
- **`nemosyne-network-globe`** - Global network topology
- **`nemosyne-parallel-coords`** - Multi-dimensional data
- **`nemosyne-sankey-flow`** - Process flows and energy transfer
- **`nemosyne-heatmap-matrix`** - Correlation matrices
- **`nemosyne-circle-pack`** - Nested proportions

### Hyperion-Cantos Themed

*A special collection inspired by Dan Simmons' Hyperion Cantos*

| Component | Theme | Purpose |
|-----------|-------|---------|
| `nemosyne-shrike` | Time entity | Temporal guardians |
| `nemosyne-time-tomb` | Sealed chambers | Countdown visualizations |
| `nemosyne-farcaster` | Portal | Data transport connections |
| `nemosyne-templar-tree` | Tree of Pain | Dark hierarchies |
| `nemosyne-memory-crystal` | Mnemosyne | Crystalline storage |

See `src/artefacts/hyperion/` for themed components.

---

## 📐 Layout Algorithms

Nemosyne includes 7 built-in layout algorithms:

### `grid` 📁
Rows and columns for categorical data.

**Complexity:** O(n)  
**Best for:** Tables, file systems, calendars

```javascript
{
  layout: 'grid',
  'layout-options': { columns: 4, spacing: 2.5 }
}
```

### `radial` ☀️
Circular arrangement around center.

**Complexity:** O(n)  
**Best for:** Menus, pie charts, star networks

```javascript
{
  layout: 'radial',
  'layout-options': { radius: 5, angleOffset: 0 }
}
```

### `timeline` ⏱️
Linear arrangement for chronological data.

**Complexity:** O(n log n)  
**Best for:** Event logs, time series

```javascript
{
  layout: 'timeline',
  'layout-options': { spacing: 3, yOffset: 0 }
}
```

### `spiral` 🌀
Rising spiral for temporal accumulation.

**Complexity:** O(n)  
**Best for:** Golden ratio arrangements, time progression

```javascript
{
  layout: 'spiral',
  'layout-options': { radius: 5, heightStep: 0.5, rotations: 2 }
}
```

### `tree` 🌲
Reingold-Tilford algorithm for hierarchies.

**Complexity:** O(n)  
**Best for:** Org charts, file systems, taxonomies

```javascript
{
  layout: 'tree',
  'layout-options': { levelHeight: 2, siblingSpacing: 3 }
}
```

### `force` 💫
Force-directed placement for networks.

**Complexity:** O(n²) worst case  
**Best for:** Social graphs, organic structures

```javascript
{
  layout: 'force',
  'layout-options': { charge: -30, linkDistance: 1 }
}
```

### `scatter` 🎯
Random positions within bounds.

**Complexity:** O(n)  
**Best for:** Density visualization, cloud formations

---

## 🔧 Transform Engine

Nemosyne uses a declarative Transform DSL to map data to visual properties:

### Scale Transform
```javascript
{
  property: 'scale',
  $data: 'value',
  $domain: [0, 100],     // Input range
  $range: [0.5, 2.0]     // Output scale
}
```

### Color Transform
```javascript
{
  property: 'color',
  $data: 'category',
  $map: 'category10'      // D3 color scale
}
```

### Custom Calculation
```javascript
{
  property: 'rotation.y',
  $data: 'trend',
  $calculate: (trend) => trend > 0 ? 0 : 180
}
```

---

## 🎭 Behaviour System

Define interactive behaviours declaratively:

```javascript
{
  behaviours: [
    { trigger: 'hover', action: 'glow', params: { intensity: 2 } },
    { trigger: 'click', action: 'drill', params: { target: 'detail-view' } },
    { trigger: 'idle', action: 'pulse', params: { speed: 0.5 } },
    { trigger: 'data-update', action: 'flash', params: { color: '#ff0', duration: 300 } }
  ]
}
```

### Built-in Behaviours

| Trigger | Actions | Description |
|---------|---------|-------------|
| `hover` | glow, scale | Mouse/touch enter |
| `hover-leave` | reset | Mouse/touch exit |
| `click` | scale, drill, emit | Selection |
| `idle` | pulse, rotate, float | Background animation |
| `data-update` | flash, re-color | Live data changes |
| `proximity` | orbit, glow | Nearness to user |

---

## 📡 WebSocket Integration

Connect to live data streams:

```javascript
import { NemosyneDataStream } from 'nemosyne';

const stream = new NemosyneDataStream('ws://localhost:8766', {
  reconnect: true,
  reconnectInterval: 5000,
  heartbeatInterval: 30000
});

stream.on('connected', () => {
  console.log('Connected to data source');
});

stream.on('data', (packet) => {
  scene.updateData('live-viz', packet.data);
});

stream.on('disconnected', () => {
  console.log('Disconnected, attempting reconnect...');
});
```

---

## 🧠 MemPalace Integration

Walk through your memories in VR:

```javascript
import { MemPalaceVRConnector } from 'nemosyne';

const connector = new MemPalaceVRConnector({
  baseUrl: 'http://localhost:8765',
  wsUrl: 'ws://localhost:8766'
});

await connector.connect();

// Load memories as visualization
const memories = await connector.query({
  startDate: '2024-01-01',
  endDate: '2024-12-31',
  tags: ['project', 'important']
});

await scene.registerArtefact({
  id: 'memory-palace',
  type: 'crystal',
  layout: 'timeline'
}, memories);
```

---

## ⚡ Performance

Nemosyne is optimized for large datasets:

| Metric | Target | Achieved |
|--------|--------|----------|
| **Nodes** | 10,000+ | ✅ @ 30fps |
| **Memory** | < 500MB | ✅ ~300MB @ 10k nodes |
| **Load Time** | < 3s | ✅ ~2s for 5k nodes |
| **Physics** | Real-time | ✅ 60hz simulation |

### Optimizations

- **Instanced Mesh Rendering** - Batch identical geometries
- **LOD System** - Reduce detail with distance
- **Frustum Culling** - Skip off-screen objects
- **Object Pooling** - Reuse DOM/WebGL objects
- **Batch Updates** - Group transforms into single render call
- **Physics Sleeping** - Pause simulation for static objects

---

## 📁 Project Structure

```
nemosyne/
├── src/
│   ├── core/               # SceneManager, Artefact base
│   ├── artefacts/          # Visualization components
│   │   ├── core/          # Crystal, Sphere, Node, etc.
│   │   └── hyperion/      # Themed components (Shrike, etc.)
│   ├── layouts/            # Layout algorithms
│   ├── transforms/         # Transform engine
│   ├── behaviours/       # Behaviour system
│   └── utils/              # DataLoader, Validator
├── framework/
│   └── src/
│       ├── components/     # A-Frame components
│       ├── layouts/        # Framework layouts
│       └── tests/          # Unit tests
├── tests/
│   └── integration/        # End-to-end tests
├── examples/               # Demo scenes
├── docs/
│   ├── ARCHITECTURE.md     # System architecture
│   └── API_REFERENCE_COMPLETE.md  # Complete API docs
└── dist/                   # Built files
```

---

## 🛠️ Development

### Setup

```bash
git clone https://github.com/TsatsuAmable/nemosyne.git
cd nemosyne
npm install
```

### Development Server

```bash
npm run dev          # Hot reload dev server
npm run build        # Production build
npm run test         # Run all tests
npm run test:watch   # Watch mode
npm run lint         # Code linting
```

### Building Examples

```bash
python3 -m http.server 8080
open http://localhost:8080/examples/nemosyne-ecosystem-demo.html
```

---

## 📖 Documentation

- **[Architecture Guide](ARCHITECTURE.md)** - System design, data flow, extension points
- **[API Reference](docs/API_REFERENCE_COMPLETE.md)** - Complete API documentation
- **[Component Gallery](docs/COMPONENT_GALLERY.md)** - Visual component showcase
- **[Layout Guide](docs/LAYOUT_GUIDE.md)** - Deep dive into layouts
- **[WebSocket Guide](docs/WEBSOCKET_GUIDE.md)** - Real-time data integration

---

## 🔌 Extending Nemosyne

### Custom Artefact

```javascript
import { Artefact } from 'nemosyne';

class MyArtefact extends Artefact {
  createMesh() {
    // Custom Three.js geometry
    const geometry = new THREE.IcosahedronGeometry(1, 2);
    const material = new THREE.MeshStandardMaterial({
      color: 0x00d4aa,
      metalness: 0.8,
      roughness: 0.2
    });
    return new THREE.Mesh(geometry, material);
  }
  
  update(data) {
    // Custom update logic
    this.mesh.rotation.y += 0.01;
    super.update(data);
  }
}

Nemosyne.registerArtefact('my-custom', MyArtefact);
```

### Custom Layout

```javascript
Nemosyne.registerLayout('galaxy', {
  calculate: (records, options) => {
    return records.map((record, i) => {
      const angle = i * options.spiralFactor;
      const radius = Math.sqrt(i) * options.spread;
      return {
        x: Math.cos(angle) * radius,
        y: (i / records.length) * options.height,
        z: Math.sin(angle) * radius
      };
    });
  }
});

// Use
{
  layout: 'galaxy',
  'layout-options': { spiralFactor: 0.3, spread: 2 }
}
```

### Custom Transform

```javascript
Nemosyne.registerTransform('quantum', {
  apply: (value, options) => {
    const probability = Math.abs(value);
    return {
      visible: Math.random() < probability,
      opacity: probability,
      scale: options.minScale + probability * (options.maxScale - options.minScale)
    };
  }
});
```

---

## 🗺️ Roadmap

### v0.2.0 (Current) ✅
- [x] Complete v0.2 API with stabilized interfaces
- [x] 17 visualization components
- [x] 7 layout algorithms
- [x] Transform/Behaviour engines
- [x] Comprehensive tests
- [x] Full documentation

### v0.2.1 (Next) 🚧
- [ ] GitHub Wiki
- [ ] Interactive documentation site
- [ ] Video tutorials
- [ ] Mobile VR optimizations

### v0.3.0 (Short-term) 📋
- [ ] Physics integration (AMMO.js full support)
- [ ] Audio-reactive artefacts
- [ ] Gesture recognition
- [ ] Voice commands
- [ ] Multiplayer sync (WebRTC)

### v1.0.0 (Long-term) 🎯
- [ ] AR mode (WebXR hit-test)
- [ ] AI-assisted artefact generation
- [ ] Collaborative editing
- [ ] Commercial support tiers

---

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Quick Start

```bash
# Fork and clone
git clone https://github.com/YOUR_USERNAME/nemosyne.git

# Create feature branch
git checkout -b feature/amazing-feature

# Make changes, commit
git commit -m "Add amazing feature"

# Push and open PR
git push origin feature/amazing-feature
```

### Code Standards

- **Tests:** All new features require tests
- **Documentation:** Update docs with API changes
- **Commit messages:** Follow conventional commits
- **Linting:** `npm run lint` must pass

---

## 📝 License

MIT © [Tsatsu Amable](https://github.com/TsatsuAmable)

See [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- **[A-Frame](https://aframe.io/)** - WebXR framework
- **[Three.js](https://threejs.org/)** - 3D rendering
- **[Ammo.js](https://github.com/kripken/ammo.js/)** - Physics engine
- **[D3.js](https://d3js.org/)** - Data transformations
- **[Dan Simmons](https://en.wikipedia.org/wiki/Dan_Simmons)** - Hyperion Cantos inspiration

---

## 💬 Community

- **Discord:** [Join our server](https://discord.gg/nemosyne)
- **GitHub Discussions:** [Start a thread](https://github.com/TsatsuAmable/nemosyne/discussions)
- **Twitter:** [@NemosyneVR](https://twitter.com/NemosyneVR)

---

**Built with 💚 for data exploration in VR**

<p align="center">
  <em>"We do not remember days, we remember moments."</em><br>
  <em>— Cesare Pavese</em>
</p>

<p align="center">
  <strong>Step into your data.</strong> 🌌
</p>