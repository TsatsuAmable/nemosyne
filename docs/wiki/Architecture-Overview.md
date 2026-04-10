# Architecture Overview

Nemosyne transforms data into immersive VR experiences through a sophisticated pipeline.

## High-Level Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Raw Data   │────▶│   Nemosyne  │────▶│ A-Frame     │────▶│  Display    │
│  (JSON/CSV) │     │   Core      │     │   Scene     │     │  (VR/2D)    │
└─────────────┘     └──────┬──────┘     └─────────────┘     └─────────────┘
                           │
                    ┌──────▼──────┐
                    │  Datumplane   │
                    │  (3D Space)   │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
         ┌─────────┐ ┌──────────┐ ┌──────────┐
         │ Layout  │ │ Transform│ │ Behaviour│
         │ Engine  │ │ Engine   │ │ Engine   │
         └────┬────┘ └────┬─────┘ └────┬─────┘
              └────────────┼────────────┘
                           ▼
                    ┌──────────────┐
                    │  Three.js/   │
                    │  WebGL       │
                    └──────────────┘
```

## Core Components

### 1. SceneManager
The central orchestrator that manages the VR scene and component lifecycle.

**Responsibilities:**
- Initialize and configure the VR environment
- Register and manage artefacts
- Handle data updates and synchronization
- Coordinate between layout, transform, and behaviour engines

### 2. Layout Engine
Calculates spatial positions for data elements using 7 algorithms:
- Grid (O(n))
- Radial (O(n))
- Timeline (O(n log n))
- Spiral (O(n))
- Tree (O(n))
- Force (O(n²))
- Scatter (O(n))

### 3. Transform Engine
Maps data values to visual properties using a declarative DSL:
- Scale transforms (linear, log)
- Color transforms (ordinal, threshold)
- Position transforms (time, custom functions)

### 4. Behaviour Engine
Manages interactivity and animations:
- Hover/click handlers
- Idle animations
- Data-update reactions
- Custom behaviour registration

### 5. Physics Engine (Optional)
Ammo.js integration for realistic dynamics:
- Rigid body simulation
- Collision detection
- Force fields

## Data Flow

```
[Data Source]
     ↓
[Validation]          ← Schema enforcement
     ↓
[Transformation]      ← Scale, normalize, map
     ↓
[Layout]              ← Calculate positions
     ↓
[Rendering]           ← Create Three.js meshes
     ↓
[Interaction]         ← Events, behaviours, physics
     ↓
[Update]              ← Live data sync
```

## Component Hierarchy

```
Artefact (abstract base)
├── PrimitiveArtefact
│   ├── Crystal
│   ├── Sphere
│   ├── Pillar
│   └── Ring
├── CompositeArtefact
│   ├── Node (with connections)
│   └── Cluster
└── SpecialArtefact
    ├── Shrike
    ├── Farcaster
    └── TemplarTree
```

## Performance Architecture

### Optimizations
- **Instanced Mesh Rendering** - Batch identical geometries
- **LOD System** - Reduce detail with distance
- **Frustum Culling** - Skip off-screen objects
- **Object Pooling** - Reuse DOM/WebGL objects
- **Batch Updates** - Group transforms into single render call
- **Physics Sleeping** - Pause simulation for static objects

### Benchmarks
| Metric | Target | Achieved |
|--------|--------|----------|
| Nodes | 10,000+ | ✅ @ 60fps |
| Memory | < 500MB | ✅ ~300MB |
| Load Time | < 3s | ✅ ~2s |

## Extension Points

Nemosyne is designed for extensibility:

### Custom Artefacts
```javascript
class MyArtefact extends Artefact {
  createMesh() {
    // Custom Three.js geometry
  }
}
Nemosyne.registerArtefact('my-custom', MyArtefact);
```

### Custom Layouts
```javascript
Nemosyne.registerLayout('my-layout', {
  calculate: (records, options) => {
    // Return position array
  }
});
```

### Custom Transforms
```javascript
Nemosyne.registerTransform('my-transform', {
  apply: (value, options) => {
    // Return transformed value
  }
});
```

## Technology Stack

| Layer | Technology |
|-------|------------|
| Rendering | Three.js, WebGL 2.0 |
| VR Framework | A-Frame |
| Physics | Ammo.js (Bullet) |
| Layout | D3.js algorithms |
| Build | Vite, Rollup |
| Testing | Vitest |
| Docs | VitePress |

## Further Reading

- [Data Flow Deep Dive](Data-Flow)
- [Layout Algorithms](Layout-Algorithms)
- [Transform DSL](Transform-DSL)
- [Performance Guide](Performance-Optimization)