# Nemosyne 🌌

**Immersive Data Visualization for WebXR**

[![NPM](https://img.shields.io/npm/v/nemosyne.svg)](https://www.npmjs.com/package/nemosyne)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![WebXR](https://img.shields.io/badge/WebXR-Ready-orange.svg)](https://immersiveweb.dev/)

> **Focus**: Nemosyne is now a streamlined framework for validating whether 3D spatial visualization improves data comprehension. See the [Orbital Awareness demo](examples/orbital-awareness.html).

---

## 🚀 Quick Start

```bash
npm install nemosyne aframe
```

**Live Demo:** [Orbital Awareness](examples/orbital-awareness.html) — Walk through 10,000 Near-Earth Object close approaches. Time is the Z-axis. Walk forward to see what's coming.

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://aframe.io/releases/1.7.0/aframe.min.js"></script>
  <script src="dist/nemosyne.iife.js"></script>
</head>
<body>
  <a-scene>
    <!-- Earth at center -->
    <a-sphere position="0 0 0" radius="0.1" color="#4488ff"></a-sphere>
    <!-- Camera -->
    <a-entity position="0 2 10">
      <a-camera look-controls wasd-controls="acceleration: 50"></a-camera>
    </a-entity>
    
    <!-- Lighting -->
    <a-light type="ambient" color="#222"></a-light>
    <a-light type="point" position="0 5 -5" intensity="0.5"></a-light>
  </a-scene>
  
  <script>
    // Load NEO data and create visualizations
    async function init() {
      const response = await fetch('data/neo-processed.json');
      const { data } = await response.json();
      
      const container = document.querySelector('a-scene');
      
      data.forEach(neo => {
        const sphere = document.createElement('a-sphere');
        sphere.setAttribute('position', `${neo.x} ${neo.y} ${neo.z}`);
        sphere.setAttribute('radius', Math.max(0.02, neo.estimatedDiameter / 10000));
        
        // Color by hazard
        let color = '#44ff44';
        if (neo.hazardClass === 'close') color = '#ffaa00';
        if (neo.hazardClass === 'hazardous') color = '#ff4444';
        
        sphere.setAttribute('color', color);
        container.appendChild(sphere);
      });
    }
    
    init();
  </script>
</body>
</html>
```

---

## 📊 The Orbital Awareness Demo

**Dataset:** 10,000 Near-Earth Object close approaches (2020–2021) from NASA CNEOS

**Spatial Encodings:**
- **X/Y:** Orbital plane position
- **Z:** Time (walk forward to see future approaches)
- **Color:** Green (safe >0.1 AU), Yellow (close 0.05-0.1 AU), Red (hazardous <0.05 AU)
- **Size:** Estimated diameter

**The Question:** Does walking through time help us understand what's coming near Earth?

---

## 🏗️ Architecture (v2.0 Orbital)

Nemosyne has been stripped to essentials:

```
src/
├── core/
│   ├── DataNativeEngine.js    # Dataset loading and management
│   ├── LayoutEngine.js        # Spatial positioning algorithms
│   ├── PropertyMapper.js      # Data → visual property mapping
│   ├── TransformDSL.js        # Declarative transformations
│   └── DataLoader.js          # CSV/JSON loading utilities
├── artefacts/
│   ├── nemosyne-scatter-semantic.js    # 3D scatter plots
│   └── nemosyne-graph-force.js         # Force-directed graphs
└── index.js                   # Main exports
```

**Bundle size:** 4KB (UMD), 40KB (ESM minified)

---

## 🧪 Running the Demo

```bash
# Clone and install
git clone https://github.com/TsatsuAmable/nemosyne.git
cd nemosyne
npm install

# Build
npm run build

# Serve and view
npx serve .
# Open http://localhost:3000/examples/orbital-awareness.html
```

**Controls:**
- **WASD:** Move around
- **Mouse:** Look around
- **Walk along Z-axis:** Travel through time

---

## 📦 API (Minimal)

```javascript
import { DataNativeEngine, LayoutEngine, PropertyMapper } from 'nemosyne';

// Load dataset
const engine = new DataNativeEngine();
engine.loadDataset('neo', neoData);

// Calculate layout
const layout = new LayoutEngine();
const positions = layout.calculate('scatter', data, { spacing: 2 });

// Map properties
const mapper = new PropertyMapper();
const visuals = mapper.execute(mapping, data);
```

---

## 🔄 Legacy

The pre-optimization codebase (21 artefacts, research components, comprehensive docs) is preserved on the `legacy/pre-optimisation` branch.

---

## 📄 License

MIT © Tsatsu Amable

---

*This is a validation experiment. The core hypothesis: 3D spatial visualization improves comprehension for inherently spatial data (like orbital mechanics). The demo tests this hypothesis.*
