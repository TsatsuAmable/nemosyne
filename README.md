# Nemosyne 🌌

**Immersive Data Visualization for WebXR**

[![NPM](https://img.shields.io/npm/v/nemosyne.svg)](https://www.npmjs.com/package/nemosyne)
[![Tests](https://img.shields.io/badge/tests-373%20passing-brightgreen.svg)](.)
[![Coverage](https://img.shields.io/badge/coverage-83%25-yellow.svg)](.)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![WebXR](https://img.shields.io/badge/WebXR-Ready-orange.svg)](https://immersiveweb.dev/)
[![Release](https://img.shields.io/badge/release-v1.2.0-blue.svg)](https://github.com/TsatsuAmable/nemosyne/releases)

> **Experimental**: Nemosyne is a research framework exploring whether 3D VR visualizations improve data comprehension. [Learn about our research agenda](docs/RESEARCH_AGENDA.md).

**[Documentation](docs/API_REFERENCE_COMPLETE.md)** | **[Examples](examples/)** | **[Changelog](CHANGELOG.md)** | **[Contributing](CONTRIBUTING.md)**

---

## 🚀 Quick Start

```bash
npm install nemosyne aframe
```

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://aframe.io/releases/1.7.0/aframe.min.js"></script>
  <script src="dist/nemosyne.min.js"></script>
</head>
<body>
  <a-scene>
    <a-entity nemosyne-artefact-v2="
      spec: { id: 'demo', geometry: { type: 'cylinder', radius: 0.3, height: 2 }, material: { color: '#00d4aa' } };
      dataset: { records: [{ month: 'Jan', sales: 100 }, { month: 'Feb', sales: 150 }] };
      layout: grid;
      layout-options: { columns: 2, spacing: 2 }
    "></a-entity>
  </a-scene>
</body>
</html>
```

See [SETUP_GUIDE.md](SETUP_GUIDE.md) for detailed setup instructions.

---

## ✨ Features

- **7 Layout Algorithms**: Force-directed, tree, timeline (linear/spiral), scatter, globe, categorical grid, matrix
- **8 Visual Primitives**: Spheres, boxes, cylinders, cones, and procedural geometries mapped from data structure
- **Topology Detection**: Automatically suggests best layout for your data structure
- **Real-time Streaming**: WebSocket support for live data
- **Transform DSL**: Declarative data-to-visual mappings
- **WebXR Ready**: Works in VR headsets and browser

---

## 📊 Component Status

| Component | Status | Notes |
|-----------|--------|-------|
| Core Rendering | ✅ Stable | 373 tests passing, ~83% coverage |
| Layout Algorithms | ✅ Ready | 7 implementations with tests |
| Topology Detection | ✅ Working | Auto-detects data structure |
| WebSocket Streaming | ✅ Working | Real-time data updates |
| Physics Integration | 🚧 In Progress | Ammo.js support coming |
| MemPalace Connector | 🚧 Experimental | Memory palace integration |

See [CHANGELOG.md](CHANGELOG.md) for detailed version history.

---

## 🎯 Use Cases

Nemosyne is designed for:

- **Topology exploration**: Finding clusters, bridges, hierarchies in network data
- **Temporal patterns**: Time series that benefit from spatial context
- **Large datasets**: When 2D becomes overcrowded

Not ideal for:
- Precise value comparison (tables/charts work better)
- Mobile-first experiences (requires VR or large screen)
- Production dashboards (experimental status)

---

## 📖 Documentation

- **[API Reference](docs/API_REFERENCE_COMPLETE.md)** - Complete method documentation
- **[Layout Guide](docs/LAYOUT_GUIDE.md)** - Choosing and configuring layouts
- **[Component Gallery](docs/COMPONENT_GALLERY.md)** - Visual showcase of artefacts
- **[Architecture](ARCHITECTURE.md)** - Technical design decisions
- **[Research Agenda](docs/RESEARCH_AGENDA.md)** - Hypotheses and validation plan

---

## 🧪 Research Context

Nemosyne is built to test a specific hypothesis:

> **3D spatial encoding improves comprehension of topology (clusters, hierarchies, networks) but not precision tasks (value comparison, label reading).**

This is **untested**. We're building the infrastructure to find out. If you're interested in collaborating on user studies, see [RESEARCH_AGENDA.md](docs/RESEARCH_AGENDA.md).

---

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

```bash
# Clone and setup
git clone https://github.com/TsatsuAmable/nemosyne.git
cd nemosyne
npm install

# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

---

## 📦 Installation Options

### npm (Recommended)
```bash
npm install nemosyne aframe
```

### CDN (Quick Try)
```html
<script src="https://unpkg.com/nemosyne@latest/dist/nemosyne.min.js"></script>
```

---

## 🗺️ Roadmap

### v1.2.0 (Current) ✅
**Released April 2025**
- [x] Integration tests with Playwright (26 tests)
- [x] CI type checking enabled
- [x] 373 tests, 83.5% coverage
- [x] Full module exports (AnimationEngine, GestureController, TelemetryEngine)
- [x] Documentation accuracy improvements

### v1.1.0 ✅
**Released April 2025**
- [x] Comprehensive test suite (312 tests, ~80% coverage)
- [x] CLI tool for project scaffolding
- [x] TypeScript definitions
- [x] GitHub templates and code of conduct
- [x] README redesign
- [x] All core modules stable

### v1.3.0 (Next) 🚧
- GitHub Wiki
- Video tutorials
- Mobile VR optimizations
- Physics integration (AMMO.js full support)
- Enhanced documentation

### v2.0.0 (Long-term)
- AR mode (WebXR hit-test)
- AI-assisted artefact generation
- Collaborative editing
- Commercial support tiers

*Note: v1.0.0/v1.1.0 marks API stabilization, not feature completeness. Major features continue in v1.x releases.*

See [CHANGELOG.md](CHANGELOG.md) for completed features.

---

## 📝 License

MIT © [Tsatsu Amable](https://github.com/TsatsuAmable)

Named after Mnemosyne, Titaness of memory in Greek mythology. Because every dataset tells a story worth remembering.
