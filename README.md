# Nemosyne

[![GitHub Pages](https://img.shields.io/badge/Live-nemosyne.world-brightgreen?logo=github)](https://nemosyne.world)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![npm version](https://img.shields.io/npm/v/nemosyne.svg)](https://www.npmjs.com/package/nemosyne)

**VR Artefacts for Real-World Data**

A JavaScript framework for creating interactive 3D data visualizations in VR.

**🚀 [Examples](#examples-gallery)** |
**📖 [Documentation](#documentation)** |
**[GitHub](https://github.com/TsatsuAmable/nemosyne)**

---

## Quick Start

### CDN (Recommended)

```html
<script src="https://aframe.io/releases/1.4.0/aframe.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/nemosyne@0.2.0/dist/nemosyne.min.iife.js"></script>

<a-scene>
  <nemosyne-artefact-v2
    layout="grid"
    spec='{"geometry":{"type":"crystal"}}'
    dataset='{"records":[{"value":42}]}'>
  </nemosyne-artefact-v2>
</a-scene>
```

### npm

```bash
npm install nemosyne
```

```javascript
import Nemosyne from 'nemosyne';

Nemosyne.quickStart(document.querySelector('a-scene'), {
  type: 'crystal',
  data: [42, 56, 23, 89],
  layout: 'bar'
});
```

---

## Examples Gallery

<!-- Web gallery: https://nemosyne.world/examples/ (deploying soon) -->

### Core Examples
- [🔷 Hello World](./examples/hello-world/) — Single crystal, basic interactions ([View on GitHub](https://github.com/TsatsuAmable/nemosyne/tree/main/examples/hello-world))
- [🌌 Network Galaxy](./examples/network-galaxy/) — 8-node microservices network ([View on GitHub](https://github.com/TsatsuAmable/nemosyne/tree/main/examples/network-galaxy))
- [📊 Bar Chart](./examples/bar-chart/) — Monthly revenue visualization ([View on GitHub](https://github.com/TsatsuAmable/nemosyne/tree/main/examples/bar-chart))
- [🌀 Timeline Spiral](./examples/timeline-spiral/) — 24-hour activity pattern ([View on GitHub](https://github.com/TsatsuAmable/nemosyne/tree/main/examples/timeline-spiral))
- [🌳 Data Tree](./examples/data-tree/) — Hierarchical file system ([View on GitHub](https://github.com/TsatsuAmable/nemosyne/tree/main/examples/data-tree))

### Domain-Specific Examples
- [🏭 Industrial IoT](./examples/industrial-iot/) — Factory floor monitoring ([View on GitHub](https://github.com/TsatsuAmable/nemosyne/tree/main/examples/industrial-iot))
- [📈 Financial Markets](./examples/financial-markets/) — FIX protocol trading ([View on GitHub](https://github.com/TsatsuAmable/nemosyne/tree/main/examples/financial-markets))
- [🧬 Scientific Research](./examples/scientific-research/) — Molecular visualization ([View on GitHub](https://github.com/TsatsuAmable/nemosyne/tree/main/examples/scientific-research))
- [🏥 Medical Imaging](./examples/medical-imaging/) — DICOM CT viewer ([View on GitHub](https://github.com/TsatsuAmable/nemosyne/tree/main/examples/medical-imaging))
- [🏙️ Smart Cities](./examples/smart-cities/) — Urban data visualization ([View on GitHub](https://github.com/TsatsuAmable/nemosyne/tree/main/examples/smart-cities))
- [🎓 Education](./examples/education-solar/) — Solar system explorer ([View on GitHub](https://github.com/TsatsuAmable/nemosyne/tree/main/examples/education-solar))
- [🎮 Virtual Worlds](./examples/virtual-worlds/) — Game dev level editor ([View on GitHub](https://github.com/TsatsuAmable/nemosyne/tree/main/examples/virtual-worlds))

---

## Features

- ✅ **7 Layout Algorithms** — grid, radial, timeline, spiral, tree, force, scatter
- ✅ **A-Frame Integration** — Native VR component system
- ✅ **Real-time Data** — WebSocket streaming with buffering
- ✅ **Interactive Behaviours** — hover, click, idle animations
- ✅ **Domain Extensions** — FIX, DICOM, PDB, NavMesh, and more
- ✅ **Production Ready** — ES/UMD/IIFE builds, minified

---

## Documentation

- [📘 API Reference v0.2](./docs/api/v0.2.md)
- [🎨 Design System](./docs/DESIGN_SYSTEM.md)  
- [🔧 Build System](./framework/BUILD.md)
- [👥 Contributing](CONTRIBUTING.md)

---

## Architecture

```
Nemosyne Framework
├── Core Components
│   ├── nemosyne-artefact-v2  (main visualization)
│   ├── nemosyne-connector    (edge/relationship rendering)
│   └── nemosyne-scene        (environment setup)
├── Layout Engine
│   └── 7 algorithms (grid, radial, timeline, spiral, tree, force, scatter)
├── Extensions
│   ├── websocket-stream      (real-time data)
│   ├── fix-protocol          (financial trading)
│   ├── molecular             (PDB structures)
│   ├── dicom-volumetric      (medical imaging)
│   ├── education-solar       (astronomy)
│   └── game-worlds           (navmesh, ECS)
└── Examples
    └── 12 domain examples
```

---

## Quick Start for Developers

```bash
# Clone the repository
git clone https://github.com/TsatsuAmable/nemosyne.git
cd nemosyne/framework

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

---

## License

MIT © TsatsuAmable

---

**[⭐ Star on GitHub](https://github.com/TsatsuAmable/nemosyne)** | 
**[🐛 Report Issues](https://github.com/TsatsuAmable/nemosyne/issues)** |
**[💬 Discussions](https://github.com/TsatsuAmable/nemosyne/discussions)**