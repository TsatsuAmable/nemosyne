# Nemosyne Architecture

**Version:** 1.1.0-research  
**Last Updated:** 2026-04-12  
**Status:** Experimental — Subject to Change Based on Research Findings

> ⚠️ **RESEARCH PREVIEW**: This document describes the current system design. All architectural decisions are hypotheses awaiting empirical validation. The architecture may change significantly based on research results.

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

### Research Context

Nemosyne's architecture exists to test a hypothesis: **Does 3D spatial computing improve data comprehension compared to 2D?**

The current design assumes:
- Automatic topology detection is possible (unvalidated)
- Layout algorithms have predictable efficacy (untested)
- Transform engines produce meaningful encodings (unproven)
- Behaviours enhance understanding (unknown)

These assumptions drive the architecture but may be wrong.

### High-Level Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Raw Data   │────▶│   Nemosyne  │────▶│ A-Frame     │────▶│  Display    │
│  (JSON/CSV) │     │   Core      │     │   Scene     │     │  (VR/2D)    │
└─────────────┘     └──────┬──────┘     └─────────────┘     └─────────────┘
                           │
                    ┌──────▼──────┐
                    │  Datumplane   │  ← Research Question: Is 3D better?
                    │  (3D Space)   │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
         ┌─────────┐ ┌──────────┐ ┌──────────┐
         │ Layout  │ │ Transform│ │ Behaviour│
         │ Engine  │ │ Engine   │ │ Engine   │
         │ (untested)│ (unproven) │ (unknown)│
         └────┬────┘ └────┬─────┘ └────┬─────┘
              └────────────┼────────────┘
                           ▼
                    ┌──────────────┐
                    │  Three.js/   │
                    │  WebGL       │
                    └──────────────┘
```

### Design Principles (Hypotheses)

1. **Declarative over Imperative**: Define what, not how (may be wrong if users need more control)
2. **Component-Based**: Reusable, composable building blocks (efficacy untested)
3. **Data-Driven**: Visualizations reflect underlying data (topology detection accuracy unknown)
4. **VR-First**: Spatial computing as default context (core research question)
5. **Real-Time**: Live data streams (latency impact on comprehension unstudied)

---

## Core Components

### 2.1 SceneManager

The central orchestrator. **Note**: The component lifecycle is implemented but its optimality for VR dataviz is unproven.

```typescript
interface SceneManager {
  scene: AFRAME.Scene;
  artefacts: Map<string, Artefact>;
  layouts: LayoutEngine;      // Implemented, efficacy unknown
  transforms: TransformEngine; // Implemented, meaningfulness unknown
  behaviours: BehaviourEngine; // Implemented, impact unknown
  
  registerArtefact(spec: ArtefactSpec, data: DataPoint[]): Promise<Artefact>;
  updateData(artefactId: string, newData: DataPoint[]): void;
  destroy(): void;
}

class SceneManagerImpl implements SceneManager {
  constructor(container: HTMLElement, options?: SceneOptions) {
    this.scene = document.createElement('a-scene');
    this.artefacts = new Map();
    this.layouts = new LayoutEngine();
    this.transforms = new TransformEngine();
    this.behaviours = new BehaviourEngine();
    
    if (container) {
      container.appendChild(this.scene);
    }
    
    this.setupDefaults();
  }
  
  async registerArtefact(spec: ArtefactSpec, data: DataPoint[]): Promise<Artefact> {
    // Validation
    validateSpec(spec);
    validateData(data);
    
    // Calculate layout positions
    const positions = this.layouts.calculate(spec.layout || 'grid', data, spec.layoutOptions);
    
    // Create artefact
    const artefact = new Artefact(spec, data, positions);
    
    // Mount to scene
    this.scene.appendChild(artefact.mesh);
    this.artefacts.set(artefact.id, artefact);
    
    return artefact;
  }
  
  updateData(artefactId: string, newData: DataPoint[]): void {
    const artefact = this.artefacts.get(artefactId);
    if (artefact) {
      // Calculate diff
      const diff = this.calculateDiff(artefact.data, newData);
      
      // Apply updates
      if (diff.hasAdditions) {
        diff.additions.forEach(item => artefact.spawnEntity(item));
      }
      if (diff.hasRemovals) {
        diff.removals.forEach(item => artefact.despawnEntity(item.id));
      }
      if (diff.hasUpdates) {
        diff.updates.forEach(update => artefact.updateEntity(update));
      }
    }
  }
  
  private calculateDiff(oldData: DataPoint[], newData: DataPoint[]): DataDiff {
    // Implementation in utils/diff-engine.js
    return diffEngine.calculate(oldData, newData);
  }
}
```

**Complexity:**
- `registerArtefact()`: O(n) where n = number of data points
- `updateData()`: O(m) where m = size of diff
- Memory: O(total artefacts × data points)

### 2.2 Artefact

The fundamental unit of visualization.

```typescript
interface ArtefactSpec {
  id: string;
  type?: string;                    // 'crystal', 'sphere', 'node', etc.
  geometry: GeometrySpec;
  material: MaterialSpec;
  transforms?: TransformSpec[];
  behaviours?: BehaviourSpec[];
  labels?: LabelSpec;
  connections?: 'auto' | ConnectionSpec[];
  layout?: string;                  // 'grid', 'radial', 'timeline', etc.
  layoutOptions?: LayoutOptions;
}

interface Artefact {
  id: string;
  spec: ArtefactSpec;
  data: DataPoint[];
  mesh: THREE.Mesh | THREE.Group;
  material: THREE.Material;
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: THREE.Vector3;
  
  update(data: DataPoint[]): void;
  highlight(state: boolean): void;
  select(state: boolean): void;
  destroy(): void;
}

class ArtefactImpl implements Artefact {
  id: string;
  mesh: THREE.Mesh;
  
  constructor(spec: ArtefactSpec, data: DataPoint[], positions: Position[]) {
    this.id = spec.id || uuid();
    this.spec = this.validateSpec(spec);
    this.data = this.transformData(data);
    
    // Create mesh group
    this.mesh = this.createMesh();
    
    // Apply transforms
    this.applyTransforms(data);
    
    // Setup behaviours
    this.setupBehaviours(spec.behaviours);
  }
  
  createMesh(): THREE.Mesh {
    const { geometry: geoSpec, material: matSpec } = this.spec;
    
    const geometry = this.createGeometry(geoSpec);
    const material = this.createMaterial(matSpec);
    
    return new THREE.Mesh(geometry, material);
  }
  
  update(data: DataPoint[]): void {
    // Calculate transforms based on new data
    this.applyTransforms(data);
    
    // Trigger visual updates
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.material.needsUpdate = true;
  }
  
  destroy(): void {
    // Proper disposal for garbage collection
    this.mesh.geometry.dispose();
    if (this.mesh.material.map) this.mesh.material.map.dispose();
    this.mesh.material.dispose();
    
    // Remove from parent
    if (this.mesh.parent) {
      this.mesh.parent.remove(this.mesh);
    }
    
    // Nullify references
    this.mesh = null;
  }
}
```

**Source:** `src/core/artefact.js` | `framework/src/components/nemosyne-artefact-v2.js`

### 2.3 Datumplane

The conceptual 3D dataspace where all visualizations exist.

| Dimension | Default | Purpose | Mapping |
|-----------|---------|---------|---------|
| **X** | `-5` to `5` | Relational data | Networks, categories |
| **Y** | `0` to `3` | Hierarchy, importance | Values, levels |
| **Z** | `-5` to `5` | Time, sequence | Temporal data |

The Datumplane is not a physical boundary but a coordinate reference. Data can extend beyond these bounds.

---

## Data Flow

### 3.1 Ingestion Pipeline

```
[Raw Data] 
    ↓
[Validator] ← Schema enforcement, type checking (O(n))
    ↓
[Transformer] ← Normalization, scaling (O(n))
    ↓
[Layout Calculator] ← Position assignment (varies by algorithm)
    ↓
[Render Engine] ← Three.js mesh generation (O(n))
    ↓
[GPU] ← WebGL rendering
```

### 3.2 Update Cycle

```javascript
// Data → Visual synchronization
DataSource.on('update', (newData: DataPoint[]) => {
  const diff = calculateDiff(currentData, newData);  // O(n) with hashing
  
  if (diff.hasAdditions) {
    diff.additions.forEach(item => scene.spawn(item));
    // Complexity: O(additions) → DOM + WebGL buffer updates
  }
  
  if (diff.hasRemovals) {
    diff.removals.forEach(item => scene.despawn(item.id));
    // Complexity: O(removals) → Buffer reallocation
  }
  
  if (diff.hasUpdates) {
    diff.updates.forEach(update => {
      const artefact = scene.get(update.id);
      artefact.update(update.changes);  // O(1) per update
      
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

For performance, updates are batched using `requestAnimationFrame`:

```javascript
class UpdateBatch {
  private queue: Update[] = [];
  private rafId: number | null = null;
  
  push(update: Update): void {
    this.queue.push(update);
    
    if (!this.rafId) {
      this.rafId = requestAnimationFrame(() => this.flush());
    }
  }
  
  flush(): void {
    // Group updates by type for efficient batching
    const byType = this.groupBy(this.queue, u => u.type);
    
    // Process each type batch
    byType.forEach((updates, type) => {
      this.processBatch(type, updates);
    });
    
    // Clear queue
    this.queue = [];
    this.rafId = null;
  }
  
  private processBatch(type: string, updates: Update[]): void {
    switch(type) {
      case 'position':
        // Single buffer update for all positions
        this.updatePositionBuffer(updates);
        break;
      case 'color':
        // Single material update
        this.updateColorBuffer(updates);
        break;
      // ... etc
    }
  }
}
```

**Source:** `src/core/update-batch.js`

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
interface ArtefactBuilder {
  build(spec: ArtefactSpec, record: DataPoint, position: Position, parent: HTMLElement): Artefact;
  validate(spec: ArtefactSpec): boolean;
}

interface Artefact {
  id: string;
  type: string;
  name: string;
  spec: ArtefactSpec;
  data: DataPoint;
  mesh: THREE.Mesh;
  material: THREE.Material;
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: THREE.Vector3;
  
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

**Source:** `framework/src/components/artefact-builder.js`

---

## Layout System

### 5.1 Layout Engine

```javascript
class LayoutEngine {
  private algorithms = new Map<string, LayoutAlgorithm>();
  
  constructor() {
    this.registerDefaults();
  }
  
  register(name: string, algorithm: LayoutAlgorithm): void {
    this.algorithms.set(name, algorithm);
  }
  
  calculate(layoutType: string, records: DataPoint[], options: LayoutOptions): Position[] {
    const algorithm = this.algorithms.get(layoutType);
    if (!algorithm) {
      throw new Error(`Unknown layout: ${layoutType}`);
    }
    return algorithm.calculate(records, options);
  }
  
  private registerDefaults(): void {
    this.register('grid', new GridLayout());
    this.register('radial', new RadialLayout());
    this.register('timeline', new TimelineLayout());
    this.register('spiral', new SpiralLayout());
    this.register('tree', new TreeLayout());
    this.register('force', new ForceLayout());
  }
}
```

### 5.2 Grid Layout

**Algorithm:** O(n)

```javascript
function gridLayout(records: DataPoint[], options: GridOptions): Position[] {
  const columns = options.columns || Math.ceil(Math.sqrt(records.length));
  const spacing = options.spacing || { x: 2, y: 0, z: 2 };
  const offset = options.offset || { x: 0, y: 0, z: 0 };
  
  return records.map((record, i) => {
    const col = i % columns;
    const row = Math.floor(i / columns);
    
    return {
      x: (col - (columns - 1) / 2) * spacing.x + offset.x,
      y: row * spacing.y + offset.y,
      z: offset.z
    };
  });
}
```

**Use Cases:** Tables, calendars, basic positioning  
**Complexity:** O(n) | **Space:** O(n)

### 5.3 Force-Directed Layout

**Algorithm:** O(n²) worst case

```javascript
function forceLayout(records: DataPoint[], options: ForceOptions): Position[] {
  const simulation = d3.forceSimulation(records)
    .force('charge', d3.forceManyBody().strength(options.charge || -30))
    .force('center', d3.forceCenter(0, 0, 0))
    .force('collision', d3.forceCollide().radius(options.radius || 0.5));
  
  if (options.links) {
    simulation.force('link', d3.forceLink(options.links));
  }
  
  // Run simulation to convergence
  simulation.tick(300);
  
  return records.map(r => ({ x: r.x, y: r.y, z: r.z || 0 }));
}
```

**Use Cases:** Networks, graphs, organic structures  
**Complexity:** O(n²) worst case | **Space:** O(n + links)

### 5.4 Timeline Layout

**Algorithm:** O(n log n) (due to sort)

```javascript
function timelineLayout(records: DataPoint[], options: TimelineOptions): Position[] {
  const field = options.field || 'date';
  const spacing = options.spacing || { x: 1, y: 0, z: 0 };
  const direction = options.direction || 'horizontal';
  
  // Sort by temporal field - O(n log n)
  const sorted = [...records].sort((a, b) => 
    new Date(a[field]) - new Date(b[field])
  );
  
  const centerOffset = sorted.length * spacing.x / 2;
  
  return sorted.map((r, i) => ({
    x: direction === 'horizontal' ? (i * spacing.x - centerOffset) : 0,
    y: options.yOffset || 0,
    z: direction === 'vertical' ? (i * spacing.z) : 0
  }));
}
```

**Use Cases:** Time series, event logs, historical data  
**Complexity:** O(n log n) | **Space:** O(n)

### 5.5 Tree Layout

**Algorithm:** Reingold-Tilford O(n)

```javascript
function treeLayout(records: DataPoint[], options: TreeOptions): Position[] {
  // Build hierarchy - O(n)
  const hierarchy = d3.stratify()
    .id(d => d.id)
    .parentId(d => d.parentId)(records);
  
  // Calculate layout - O(n)
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

**Use Cases:** Org charts, file systems, taxonomies  
**Complexity:** O(n) | **Space:** O(n)

**Source:** `framework/src/layouts/layout-engine.js` | `src/layouts/*.js`

---

## Transform Engine

### 6.1 Transform DSL

Nemosyne uses a declarative transform specification:

```javascript
const transforms = {
  // Scale based on data value
  scale: {
    $data: 'value',
    $range: [0, 100],
    $domain: [0.5, 2.0]
  },
  
  // Color based on category
  color: {
    $data: 'status',
    $map: 'viridis'  // D3 color scale
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
  resolve(transformSpec: TransformSpec, data: DataPoint, context: Context): any {
    // Handle different transform types
    if (transformSpec.$data) {
      return this.resolveDataTransform(transformSpec, data);
    }
    
    if (transformSpec.$layout) {
      return this.resolveLayoutTransform(transformSpec, context);
    }
    
    if (transformSpec.$calculate) {
      return transformSpec.$calculate(
        this.getNestedValue(data, transformSpec.$data)
      );
    }
    
    // Static value
    return transformSpec;
  }
  
  private resolveDataTransform(spec: TransformSpec, data: DataPoint): any {
    const value = this.getNestedValue(data, spec.$data);
    
    if (spec.$map) {
      return this.applyColorMap(value, spec.$map);
    }
    
    if (spec.$range && spec.$domain) {
      return this.scale(value, spec.$domain, spec.$range);
    }
    
    return value;
  }
  
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((o, p) => o?.[p], obj);
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

**Source:** `framework/src/transforms/transform-engine.js`

---

## Behaviour System

### 7.1 Behaviour Engine

```javascript
class BehaviourEngine {
  private handlers = new Map<string, BehaviourHandler>();
  
  constructor() {
    this.registerDefaults();
  }
  
  register(trigger: string, handler: BehaviourHandler): void {
    this.handlers.set(trigger, handler);
  }
  
  setup(entity: Entity, behaviours: BehaviourSpec[], data: DataPoint): CleanupFn[] {
    return behaviours.map(behaviour => {
      const handler = this.handlers.get(behaviour.trigger);
      if (!handler) {
        console.warn(`Unknown behaviour trigger: ${behaviour.trigger}`);
        return () => {};  // No-op cleanup
      }
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
  attach(entity: Entity, config: EntanglementConfig, data: DataPoint): CleanupFn {
    const partner = scene.get(config.pairedWith);
    
    const handler = (newData: DataPoint) => {
      // Mirror partner's highlight state
      if (partner.isHighlighted) {
        entity.highlight(true);
      }
    };
    
    // Subscribe to partner updates
    partner.on('update', handler);
    
    // Return cleanup function
    return () => {
      partner.off('update', handler);
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

**Source:** `framework/src/behaviours/behaviour-engine.js`

---

## WebSocket Integration

### 8.1 Connection Management

```javascript
class NemosyneDataStream {
  private ws: WebSocket | null = null;
  private reconnectCount = 0;
  private listeners = new Map<string, Set<Callback>>();
  
  constructor(private url: string, private options: StreamOptions = {}) {
    this.options = {
      reconnect: true,
      reconnectInterval: 5000,
      maxReconnects: 10,
      heartbeatInterval: 30000,
      ...options
    };
    
    this.connect();
  }
  
  private connect(): void {
    this.ws = new WebSocket(this.url);
    
    this.ws.onopen = () => {
      this.reconnectCount = 0;
      this.emit('connected', {});
      this.startHeartbeat();
    };
    
    this.ws.onmessage = (event) => {
      const data = this.parse(event.data);
      this.emit('data', data);
    };
    
    this.ws.onclose = () => {
      this.stopHeartbeat();
      this.emit('disconnected', {});
      
      if (this.options.reconnect && this.reconnectCount < this.options.maxReconnects) {
        setTimeout(() => this.connect(), this.options.reconnectInterval);
        this.reconnectCount++;
      }
    };
    
    this.ws.onerror = (error) => {
      this.emit('error', error);
    };
  }
  
  private parse(message: string): DataMessage {
    // Support multiple formats
    try {
      return JSON.parse(message);
    } catch {
      // Try CSV
      if (message.includes(',')) {
        return { type: 'csv', data: this.parseCSV(message) };
      }
      // Return raw
      return { type: 'raw', data: message };
    }
  }
  
  on(event: string, callback: Callback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }
  
  private emit(event: string, data: any): void {
    this.listeners.get(event)?.forEach(cb => cb(data));
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

**Source:** `src/core/websocket-stream.js`

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
const lod = new THREE.LOD();

lod.addLevel(highPolyMesh, 0);      // < 50 units
lod.addLevel(mediumPolyMesh, 50);   // 50-100 units
lod.addLevel(lowPolyMesh, 100);     // > 100 units

scene.add(lod);
```

**Occlusion Culling:**

```javascript
class OcclusionCulling {
  update(camera: THREE.Camera, objects: THREE.Object3D[]): THREE.Object3D[] {
    return objects.filter(obj => {
      // Frustum culling
      if (!obj.inFrustum(camera)) return false;
      
      // Occlusion query (simplified)
      return !this.occludedBy(obj, camera);
    });
  }
}
```

### 9.2 Memory Management

**Object Pooling:**

```javascript
class ArtefactPool {
  private available: Artefact[] = [];
  private inUse = new Set<Artefact>();
  
  constructor(
    private createFn: () => Artefact,
    private resetFn: (obj: Artefact) => void,
    private size = 100
  ) {
    this.available = Array(size).fill(null).map(createFn);
  }
  
  acquire(): Artefact {
    if (this.available.length === 0) {
      throw new Error('Pool exhausted');
    }
    const obj = this.available.pop()!;
    this.inUse.add(obj);
    return obj;
  }
  
  release(obj: Artefact): void {
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
  if (this.mesh.material.map) {
    this.mesh.material.map.dispose();
  }
  this.mesh.material.dispose();
  
  // Remove from scene
  if (this.mesh.parent) {
    this.mesh.parent.remove(this.mesh);
  }
  
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
  constructor(spec: ArtefactSpec, data: DataPoint[]) {
    super(spec, data);
    this.customProperty = spec.customProperty;
  }
  
  createMesh(): THREE.Mesh {
    // Custom Three.js geometry
    const geometry = new THREE.CustomGeometry(...);
    const material = new THREE.ShaderMaterial({
      vertexShader: myVertexShader,
      fragmentShader: myFragmentShader
    });
    
    return new THREE.Mesh(geometry, material);
  }
  
  update(data: DataPoint[]): void {
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
  calculate(records: DataPoint[], options: GalaxyOptions): Position[] {
    const positions: Position[] = [];
    const spiralFactor = options.tightness || 0.3;
    const spread = options.spread || 2;
    
    records.forEach((record, i) => {
      const angle = i * spiralFactor;
      const radius = Math.sqrt(i) * spread;
      
      positions.push({
        x: Math.cos(angle) * radius,
        y: (i / records.length) * (options.height || 5),
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
  apply: (value: number, options: QuantumOptions) => {
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
const myPlugin: NemosynePlugin = {
  name: 'quantum-plugin',
  version: '1.0.0',
  
  install(Nemosyne: NemosyneAPI, options: PluginOptions): void {
    // Add global methods
    Nemosyne.entangle = (artefact1: Artefact, artefact2: Artefact) => {
      // Quantum entanglement logic
    };
    
    // Add component
    Nemosyne.registerArtefact('quantum-particle', QuantumParticle);
  },
  
  uninstall(): void {
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
- [API Reference](docs/API_REFERENCE_COMPLETE.md)
- [Hyperion Cantos Thematic](docs/Thematic/Hyperion-Cantos.md)

---

**Version:** 0.2.0  
**Last Updated:** 2026-04-10  
**Source:** `/src/core/` | `/framework/src/`