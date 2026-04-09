# Nemosyne Architecture

**Version:** 0.2.0  
**Last Updated:** 2026-04-09

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Core Components](#core-components)
3. [Data Flow](#data-flow)
4. [Component Architecture](#component-architecture)
5. [Layout System](#layout-system)
6. [Transform Engine](#transform-engine)
7. [Behaviour System](#behaviour-system)
8. [WebSocket Integration](#websocket-integration)
9. [Performance Considerations](#performance-considerations)
10. [Extension Points](#extension-points)

---

## System Overview

### High-Level Architecture

```
[Data Source] → [Nemosyne Core] → [A-Frame Scene] → [WebGL Renderer] → [Display]
                    ↓
              [Datumplane VR]
                    ↓
          [User Interaction] ← [Input Devices]
```

### Design Principles

1. **Declarative over Imperative**: Define what, not how
2. **Component-Based**: Reusable, composable building blocks
3. **Data-Driven**: Visualizations reflect underlying data
4. **VR-First**: Spatial computing as default context
5. **Real-Time**: Live data streams, not static exports

---

## Core Components

### 2.1 SceneManager

The central orchestrator responsible for:
- Initializing the VR scene
- Managing artefacts lifecycle
- Coordinating layout calculations
- Handling data updates

```javascript
class SceneManager {
  constructor(container, options) {
    this.scene = new AFRAME.Scene();
    this.artefacts = new Map();
    this.layouts = new LayoutEngine();
    this.transforms = new TransformEngine();
    this.behaviours = new BehaviourEngine();
  }
  
  registerArtefact(spec, data) {
    // Validation, instantiation, mounting
  }
  
  updateData(artefactId, newData) {
    // Diff calculation, visual updates
  }
  
  destroy() {
    // Cleanup, memory management
  }
}
```

### 2.2 Artefact

The fundamental unit of visualization:

```javascript
class Artefact {
  constructor(spec, data) {
    this.id = spec.id || uuid();
    this.spec = this.validate(spec);
    this.data = this.transform(data);
    
    // Three.js representation
    this.mesh = this.createMesh();
    this.material = this.createMaterial();
  }
  
  update(data) {
    // Update transforms based on new data
    this.updateTransforms(data);
  }
  
  destroy() {
    // Proper disposal for garbage collection
  }
}
```

### 2.3 Datumplane

The conceptual 3D dataspace:

| Dimension | Default | Purpose |
|-----------|---------|---------|
| **X** | `-5` to `5` | Relational data, networks |
| **Y** | `0` to `3` | Hierarchy, importance |
| **Z** | `-5` to `5` | Time, sequence |

---

## Data Flow

### 3.1 Ingestion Pipeline

```
[Raw Data] 
    ↓
[Validator] - Schema enforcement, type checking
    ↓
[Transformer] - Normalization, scaling
    ↓
[Layout Calculator] - Position assignment
    ↓
[Render Engine] - Three.js mesh generation
    ↓
[GPU] - WebGL rendering
```

### 3.2 Update Cycle

```javascript
// Data → Visual synchronization
DataSource.on('update', newData => {
  const diff = calculateDiff(currentData, newData);
  
  if (diff.hasAdditions) {
    scene.spawn(diff.additions);
  }
  
  if (diff.hasRemovals) {
    scene.despawn(diff.removals);
  }
  
  if (diff.hasUpdates) {
    diff.updates.forEach(update => {
      const artefact = scene.get(update.id);
      artefact.update(update.changes);
      
      // Triggers animation
      animator.transition(artefact, update.changes, {
        duration: 500,
        easing: 'easeOutQuart'
      });
    });
  }
});
```

### 3.3 Batching Strategy

For performance, updates are batched:

```javascript
class UpdateBatch {
  constructor() {
    this.queue = [];
    this.rafId = null;
  }
  
  push(update) {
    this.queue.push(update);
    
    if (!this.rafId) {
      this.rafId = requestAnimationFrame(() => this.flush());
    }
  }
  
  flush() {
    // Process all queued updates
    // Group by type for efficient rendering
    // Clear queue
  }
}
```

---

## Component Architecture

### 4.1 Component Hierarchy

```
Artefact (abstract base)
├── PrimitiveArtefact
│   ├── Crystal (octahedron)
│   ├── Orb (sphere)
│   ├── Pillar (cylinder)
│   └── Ring (torus)
├── CompositeArtefact
│   ├── Node (primitive + label)
│   ├── Edge (line + arrow)
│   └── Cluster (grouping)
└── SpecialArtefact (thematic)
    ├── Shrike (time entity)
    ├── Farcaster (portal)
    └── TemplarTree (hierarchy)
```

### 4.2 Component Lifecycle

```
[Specification] 
    ↓
[Validation] → [Error] (if invalid)
    ↓
[Data Binding]
    ↓
[Layout Calculation]
    ↓
[Mesh Generation]
    ↓
[Scene Mounting]
    ↓
[Render]
    ↓
[Interaction Handling]
    ↓
[Data Update] → [Re-render] (loop)
    ↓
[Unmounting]
    ↓
[Destruction] → [GC]
```

### 4.3 Component Interface

```typescript
interface Artefact {
  // Identification
  id: string;
  type: string;
  name: string;
  
  // Specification
  spec: ArtefactSpec;
  
  // Data
  data: DataPoint | DataPoint[];
  
  // Visual representation
  mesh: THREE.Mesh;
  material: THREE.Material;
  
  // Spatial properties
  position: Vector3;
  rotation: Euler;
  scale: Vector3;
  
  // Methods
  update(newData: DataPoint): void;
  highlight(state: boolean): void;
  select(state: boolean): void;
  destroy(): void;
}

interface ArtefactSpec {
  id: string;
  geometry: GeometrySpec;
  material: MaterialSpec;
  transforms?: TransformSpec[];
  behaviours?: BehaviourSpec[];
}
```

---

## Layout System

### 5.1 Layout Interface

```javascript
class LayoutEngine {
  constructor() {
    this.algorithms = new Map();
    this.registerDefaults();
  }
  
  register(name, algorithm) {
    this.algorithms.set(name, algorithm);
  }
  
  calculate(records, layoutType, options) {
    const algorithm = this.algorithms.get(layoutType);
    return algorithm.calculate(records, options);
  }
}
```

### 5.2 Grid Layout

**Algorithm:**
```javascript
function gridLayout(records, { columns, spacing, offset }) {
  const numCols = columns || Math.ceil(Math.sqrt(records.length));
  
  return records.map((record, i) => {
    const col = i % numCols;
    const row = Math.floor(i / numCols);
    
    return {
      x: (col - (numCols - 1) / 2) * spacing.x + offset.x,
      y: row * spacing.y + offset.y,
      z: offset.z
    };
  });
}
```

**Complexity:** O(n)  
**Use Cases:** Tables, calendars, basic positioning

### 5.3 Force-Directed Layout

**Algorithm (D3-force simulation):**
```javascript
function forceLayout(records, options) {
  const simulation = d3.forceSimulation(records)
    .force('charge', d3.forceManyBody().strength(options.charge || -30))
    .force('center', d3.forceCenter(0, 0, 0))
    .force('collision', d3.forceCollide().radius(options.radius || 0.5))
    .force('link', options.links ? d3.forceLink(options.links) : null);
  
  // Run simulation to convergence
  simulation.tick(300);
  
  return records.map(r => ({ x: r.x, y: r.y, z: r.z || 0 }));
}
```

**Complexity:** O(n²) worst case  
**Use Cases:** Networks, graphs, organic structures

### 5.4 Timeline Layout

**Algorithm:**
```javascript
function timelineLayout(records, { 
  field = 'date', 
  spacing = { x: 1, y: 0, z: 0 },
  offset = { x: 0, y: 0, z: 0 },
  direction = 'horizontal', // 'horizontal' | 'spiral'
  spiral = false 
}) {
  // Sort by temporal field
  const sorted = [...records].sort((a, b) => 
    new Date(a[field]) - new Date(b[field])
  );
  
  if (spiral) {
    // Spiral variant
    const spiralFactor = 0.1;
    return sorted.map((r, i) => ({
      x: offset.x + spacing.x * i,
      y: offset.y + Math.sin(i * spiralFactor) * 2,
      z: offset.z + Math.cos(i * spiralFactor) * 2
    }));
  }
  
  // Linear layout
  const centerOffset = sorted.length * spacing.x / 2;
  
  return sorted.map((r, i) => ({
    x: (direction === 'horizontal' ? i : 0) * spacing.x - centerOffset + offset.x,
    y: offset.y,
    z: (direction === 'vertical' ? i : 0) * spacing.z + offset.z
  }));
}
```

**Complexity:** O(n log n) due to sort  
**Use Cases:** Time series, event logs, historical data

### 5.5 Tree Layout

**Algorithm (Reingold-Tilford):**
```javascript
function treeLayout(records, options) {
  // Build hierarchy
  const hierarchy = d3.stratify()
    .id(d => d.id)
    .parentId(d => d.parentId)(records);
  
  // Calculate layout
  const tree = d3.tree()
    .size([options.width || 10, options.height || 10]);
  
  const root = tree(hierarchy);
  
  // Map to positions
  return root.descendants().map(node => ({
    id: node.data.id,
    x: node.x,
    y: node.depth * options.levelSpacing,
    z: node.y
  }));
}
```

**Complexity:** O(n)  
**Use Cases:** Org charts, file systems, taxonomies

---

## Transform Engine

### 6.1 Transform DSL

Nemosyne uses a declarative transform specification:

```javascript
const transforms = {
  // Scale based on data
  scale: {
    $data: 'value',
    $range: [0, 100],
    $domain: [0.5, 2.0]
  },
  
  // Color based on category
  color: {
    $data: 'status',
    $map: 'viridis' // D3 color scale
  },
  
  // Position based on layout
  position: {
    $layout: 'grid',
    $spacing: { x: 2, y: 0, z: 2 }
  },
  
  // Rotation based on direction
  rotation: {
    $data: 'trend',
    $calculate: (trend) => trend > 0 ? 0 : 180
  }
};
```

### 6.2 Transform Resolution

```javascript
class TransformEngine {
  resolve(transformSpec, data, context) {
    // Handle different transform types
    if (transformSpec.$data) {
      return this.resolveDataTransform(transformSpec, data);
    }
    
    if (transformSpec.$layout) {
      return this.resolveLayoutTransform(transformSpec, context);
    }
    
    if (transformSpec.$calculate) {
      return transformSpec.$calculate(this.getNestedValue(data, transformSpec.$data));
    }
    
    // Static value
    return transformSpec;
  }
  
  resolveDataTransform(spec, data) {
    const value = this.getNestedValue(data, spec.$data);
    
    if (spec.$map) {
      return this.applyColorMap(value, spec.$map);
    }
    
    if (spec.$range && spec.$domain) {
      return this.scale(value, spec.$domain, spec.$range);
    }
    
    return value;
  }
}
```

### 6.3 Common Transforms

| Transform | Input | Output | Use Case |
|-----------|-------|--------|----------|
| **Linear Scale** | Numeric | Numeric | Mapping values to sizes |
| **Log Scale** | Numeric | Numeric | Exponential data |
| **Ordinal Scale** | String | Color/Shape | Categorical data |
| **Threshold Scale** | Numeric | Discrete | Status levels |
| **Time Scale** | Date | Position | Timelines |
| **Quantize** | Numeric | Binned | Histograms |

---

## Behaviour System

### 7.1 Behaviour Interface

```javascript
class BehaviourEngine {
  constructor() {
    this.handlers = new Map();
    this.registerDefaults();
  }
  
  register(trigger, handler) {
    this.handlers.set(trigger, handler);
  }
  
  setup(entity, behaviours, data) {
    return behaviours.map(behaviour => {
      const handler = this.handlers.get(behaviour.trigger);
      return handler.attach(entity, behaviour, data);
    });
  }
}
```

### 7.2 Built-in Behaviours

| Trigger | Action | Description |
|---------|--------|-------------|
| `hover` | `glow` | Emissive intensity increase |
| `hover-leave` | `reset` | Return to default |
| `click` | `scale` | Toggle size |
| `click` | `drill` | Load detail view |
| `idle` | `pulse` | Subtle breathing animation |
| `data-update` | `flash` | Brief highlight on change |
| `proximity` | `orbit` | Rotate around cursor |
| `collision` | `bounce` | Physics reaction |

### 7.3 Custom Behaviour Example

```javascript
// Define custom behaviour
class QuantumEntanglement {
  attach(entity, config, data) {
    const partner = scene.get(config.pairedWith);
    
    return {
      update: (newData) => {
        // Mirror partner's highlight state
        if (partner.isHighlighted) {
          entity.highlight(true);
        }
      },
      
      cleanup: () => {
        // Proper event listener removal
      }
    };
  }
}

// Register
behaviours.register('entangled', new QuantumEntanglement());

// Use
const spec = {
  behaviours: [{
    trigger: 'entangled',
    pairedWith: 'artefact-42'
  }]
};
```

---

## WebSocket Integration

### 8.1 Connection Management

```javascript
class NemosyneDataStream {
  constructor(url, options = {}) {
    this.url = url;
    this.options = {
      reconnect: true,
      reconnectInterval: 5000,
      maxReconnects: 10,
      heartbeatInterval: 30000,
      ...options
    };
    
    this.ws = null;
    this.reconnectCount = 0;
    this.listeners = new Map();
    
    this.connect();
  }
  
  connect() {
    this.ws = new WebSocket(this.url);
    
    this.ws.onopen = () => {
      this.reconnectCount = 0;
      this.emit('connected');
      this.startHeartbeat();
    };
    
    this.ws.onmessage = (event) => {
      const data = this.parse(event.data);
      this.emit('data', data);
    };
    
    this.ws.onclose = () => {
      this.stopHeartbeat();
      this.emit('disconnected');
      
      if (this.options.reconnect && this.reconnectCount < this.options.maxReconnects) {
        setTimeout(() => this.connect(), this.options.reconnectInterval);
        this.reconnectCount++;
      }
    };
    
    this.ws.onerror = (error) => {
      this.emit('error', error);
    };
  }
  
  parse(message) {
    // Support multiple formats
    try {
      return JSON.parse(message);
    } catch {
      // Try CSV
      if (message.includes(',')) {
        return this.parseCSV(message);
      }
      // Return raw
      return { raw: message };
    }
  }
  
  emit(event, data) {
    this.listeners.get(event)?.forEach(cb => cb(data));
  }
  
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  }
}
```

### 8.2 Protocol Support

| Protocol | Status | Implementation |
|----------|--------|----------------|
| WebSocket | ✅ | Native `WebSocket` API |
| Socket.IO | ⚠️ | Via adapter |
| MQTT | ⚠️ | Via Paho client |
| SSE | ✅ | `EventSource` |
| FIX | ⚠️ | Financial protocol |

---

## Performance Considerations

### 9.1 Rendering Optimizations

**Instanced Mesh Rendering:**
```javascript
// For repeated geometry (stars, particles)
const geometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
const material = new THREE.MeshBasicMaterial({ color: 0xffffff });

const mesh = new THREE.InstancedMesh(geometry, material, 1000);

// Set positions for each instance
const dummy = new THREE.Object3D();
for (let i = 0; i < 1000; i++) {
  dummy.position.set(
    Math.random() * 10 - 5,
    Math.random() * 10 - 5,
    Math.random() * 10 - 5
  );
  dummy.updateMatrix();
  mesh.setMatrixAt(i, dummy.matrix);
}

scene.add(mesh);
```

**Level of Detail (LOD):**
```javascript
// Simplify geometry for distant objects
const lod = new THREE.LOD();

lod.addLevel(highPolyMesh, 0);      // < 50 units
lod.addLevel(mediumPolyMesh, 50);   // 50-100 units
lod.addLevel(lowPolyMesh, 100);    // > 100 units

scene.add(lod);
```

**Occlusion Culling:**
```javascript
// Skip rendering objects behind others
class OcclusionCulling {
  update(camera, objects) {
    return objects.filter(obj => {
      // Frustum culling
      if (!obj.inFrustum(camera)) return false;
      
      // Occlusion query
      return !this.occludedBy(obj, camera);
    });
  }
}
```

### 9.2 Memory Management

**Object Pooling:**
```javascript
class ArtefactPool {
  constructor(createFn, resetFn, size = 100) {
    this.createFn = createFn;
    this.resetFn = resetFn;
    this.available = Array(size).fill().map(createFn);
    this.inUse = new Set();
  }
  
  acquire() {
    if (this.available.length === 0) {
      throw new Error('Pool exhausted');
    }
    const obj = this.available.pop();
    this.inUse.add(obj);
    return obj;
  }
  
  release(obj) {
    this.inUse.delete(obj);
    this.resetFn(obj);
    this.available.push(obj);
  }
}
```

**Texture Disposal:**
```javascript
artefact.destroy() {
  // Properly dispose all GPU resources
  this.mesh.geometry.dispose();
  this.mesh.material.map.dispose();
  this.mesh.material.dispose();
  
  // Remove from scene
  this.mesh.parent.remove(this.mesh);
  
  // Nullify references for GC
  this.mesh = null;
}
```

### 9.3 Benchmarks

| Metric | Target | Hardware |
|--------|--------|----------|
| 60fps | < 16ms frame time | Desktop |
| Draw calls | < 100 | All |
| Geometries | < 1000 | All |
| Textures | < 50MB VRAM | Mobile |
| Memory | < 500MB total | All |

---

## Extension Points

### 10.1 Custom Artefacts

```javascript
class MyArtefact extends Nemosyne.Artefact {
  constructor(spec, data) {
    super(spec, data);
    
    // Custom initialization
    this.customProperty = spec.customProperty;
  }
  
  createMesh() {
    // Custom Three.js geometry
    const geometry = new THREE.CustomGeometry(...);
    const material = new THREE.ShaderMaterial({
      vertexShader: myVertexShader,
      fragmentShader: myFragmentShader
    });
    
    return new THREE.Mesh(geometry, material);
  }
  
  update(data) {
    // Custom update logic
    this.mesh.material.uniforms.time.value = Date.now();
    super.update(data);
  }
}

// Register
Nemosyne.registerArtefact('my-custom', MyArtefact);
```

### 10.2 Custom Layouts

```javascript
class SpiralGalaxyLayout {
  calculate(records, options) {
    const positions = [];
    const spiralFactor = options.tightness || 0.3;
    const spread = options.spread || 2;
    
    records.forEach((record, i) => {
      const angle = i * spiralFactor;
      const radius = Math.sqrt(i) * spread;
      
      positions.push({
        x: Math.cos(angle) * radius,
        y: (i / records.length) * options.height || 5,
        z: Math.sin(angle) * radius
      });
    });
    
    return positions;
  }
}

Nemosyne.registerLayout('galaxy', new SpiralGalaxyLayout());
```

### 10.3 Custom Transforms

```javascript
Nemosyne.registerTransform('quantum', {
  apply: (value, options) => {
    // Quantum superposition visualization
    const probability = Math.abs(value);
    return {
      visible: Math.random() < probability,
      opacity: probability,
      scale: options.minScale + probability * (options.maxScale - options.minScale)
    };
  }
});
```

### 10.4 Plugin System

```javascript
const myPlugin = {
  name: 'quantum-plugin',
  version: '1.0.0',
  
  install(Nemosyne, options) {
    // Add global methods
    Nemosyne.entangle = (artefact1, artefact2) => {
      // Quantum entanglement logic
    };
    
    // Add component
    Nemosyne.registerArtefact('quantum-particle', QuantumParticle);
  },
  
  uninstall() {
    // Cleanup
  }
};

Nemosyne.use(myPlugin);
```

---

## Further Reading

- [Component Development Guide](docs/Custom-Components.md)
- [Performance Optimization](docs/Performance.md)
- [WebSocket Integration](docs/WebSocket-Guide.md)
- [Hyperion Cantos Thematic](docs/Thematic/Hyperion-Cantos.md)

---

**Version:** 0.2.0  
**Last Updated:** 2026-04-09  
**Maintainer:** TsatsuAmable