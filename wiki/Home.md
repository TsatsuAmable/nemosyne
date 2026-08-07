# Nemosyne Wiki

Welcome to the Nemosyne documentation hub.

## Quick Links

- [Getting Started](./tutorials/Getting-Started.md)
- [Design System](../DESIGN_SYSTEM.md)
- [Roadmap](../ROADMAP.md)
- [Architecture](../ARCHITECTURE.md)
- [Examples](../examples/)
- [Artefact Catalog](../ARTEFACTS.md)

## What's Nemosyne?

Nemosyne is a **WebXR spatial data analysis suite** built on three.js. It transforms multi-dimensional datasets into interactive 3D memory palaces that can be explored in VR or on desktop.

## Live app

The fastest way to try Nemosyne is the Netlify deployment:

**https://nemosyne-analysis-suite.netlify.app/**

## Core Concepts

1. **Datasets** — Typed in-memory tabular, graph, hierarchical, time-series, vector, and geospatial data.
2. **Draco Recommender** — Symbolic constraint engine that picks layout, geometry, behavior, and interaction based on topology and statistics.
3. **Artefacts** — Three.js objects (Crystal, Column, Orb, Plinth, Beam, Trail, Ring, Field, Zone) that represent data.
4. **Interactions** — Gesture-driven data operations (filter, aggregate, sort, time-slice, cluster, anomaly lens).
5. **Panels** — Free-floating, persisted HUD and dashboard surfaces for analysis tools.
6. **Memory Palaces** — Persistent spatial worlds where datasets become navigable landscapes.

## Hello World

```javascript
import { World, Dataset } from 'nemosyne';

const world = new World();
await world.start();

const dataset = Dataset.fromJSON({
  columns: [
    { name: 'item', type: 'string' },
    { name: 'value', type: 'number' }
  ],
  rows: [['A', 12], ['B', 34], ['C', 56]]
});

world.loadDataset(dataset);
```

## Status

🚀 **Active Development** — The three.js/WebXR runtime is the canonical implementation. The earlier A-Frame component framework has been retired. See the [migration note](../README.md) for details.

---

## Contributing

See the main repository for contribution guidelines.
