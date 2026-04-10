# Nemosyne API Reference

**Version:** 0.2.0  
**Last Updated:** 2026-04-10

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Core API](#core-api)
3. [Artefact Reference](#artefact-reference)
4. [Component Attributes](#component-attributes)
5. [Layout Algorithms](#layout-algorithms)
6. [Spec Schema](#spec-schema)
7. [Events](#events)
8. [Transforms](#transforms)
9. [Behaviours](#behaviours)
10. [Migration Guide](#migration-guide)

---

## Quick Start

The fastest way to create a visualization:

```javascript
Nemosyne.quickStart(scene, {
  type: 'crystal',   // crystal | sphere | bar | node | orb | shrike
  data: [42, 56, 23, 89],
  layout: 'grid',    // grid | radial | timeline | spiral | tree
  color: '#00d4aa',  // hex color or scale name
  labels: true,
  animate: true
});
```

**Complete HTML Example:**

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://aframe.io/releases/1.4.0/aframe.min.js"></script>
  <script src="dist/nemosyne.min.js"></script>
</head>
<body>
  <a-scene>
    <!-- Basic crystal field -->
    <a-entity nemosyne-artefact-v2="
      spec: {
        id: 'demo',
        geometry: { type: 'octahedron', radius: 1 },
        material: { properties: { color: '#00d4aa' } }
      };
      dataset: { records: [{ value: 10 }, { value: 20 }, { value: 30 }] };
      layout: grid;
      layout-options: { columns: 3, spacing: 2.5 }
    "></a-entity>
  </a-scene>
</body>
</html>
```

---

## Core API

### Nemosyne

The global namespace providing framework utilities.

#### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `quickStart(scene, options)` | `Artefact` | Rapid visualization creation |
| `registerArtefact(name, Constructor)` | `void` | Register custom artefact type |
| `registerLayout(name, algorithm)` | `void` | Register custom layout algorithm |
| `registerTransform(name, transform)` | `void` | Register custom transform |
| `version` | `string` | Framework version |

#### Configuration

```javascript
// Global configuration
Nemosyne.config({
  debug: false,           // Enable validation logging
  defaultColor: '#00d4aa', // Default theme color
  animationEnabled: true,  // Global animation toggle
  performanceMode: 'auto'   // 'auto' | 'high' | 'low'
});
```

### SceneManager

```typescript
interface SceneManager {
  // Lifecycle
  init(container: HTMLElement, options?: SceneOptions): Promise<void>;
  destroy(): void;
  
  // Artefact Management
  registerArtefact(spec: ArtefactSpec, data: DataPoint[]): Promise<Artefact>;
  getArtefact(id: string): Artefact | undefined;
  updateData(artefactId: string, newData: DataPoint[]): void;
  removeArtefact(id: string): void;
  
  // Layout Management
  setLayout(artefactId: string, layout: string, options?: LayoutOptions): void;
  
  // Scene Control
  clear(): void;
  exportScene(): SceneExport;
  importScene(export: SceneExport): void;
}
```

**Scene Options:**

```javascript
const options = {
  width: 1920,           // Scene width
  height: 1080,          // Scene height
  background: '#000000', // Background color
  camera: 'perspective', // 'perspective' | 'orthographic'
  vr: true,              // Enable VR mode
  stats: false            // Show performance stats
};
```

---

## Artefact Reference

### 1. Crystal (`nemosyne-crystal`)

Geometric octahedron for scalar data visualization.

**Purpose:** General purpose data point visualization

**Spec Properties:**

```javascript
{
  id: 'crystal-demo',
  geometry: {
    type: 'octahedron',
    radius: 0.5,           // Base size (0.1 - 10)
    detail: 0              // Subdivision level (0 - 5)
  },
  material: {
    properties: {
      color: '#00d4aa',     // Base color
      metalness: 0.8,       // Metallic appearance (0-1)
      roughness: 0.2,       // Surface roughness (0-1)
      emissive: '#00d4aa',  // Glow color
      emissiveIntensity: 0.5 // Glow strength (0-2)
    }
  },
  transforms: [{
    property: 'scale',
    $data: 'value',
    $range: [0.5, 2.0]
  }],
  behaviours: [{
    trigger: 'hover',
    action: 'glow',
    params: { intensity: 2 }
  }, {
    trigger: 'idle',
    action: 'rotate',
    params: { speed: 0.5, axis: 'y' }
  }]
}
```

**Example:**

```javascript
// Basic usage
Nemosyne.quickStart(scene, {
  type: 'crystal',
  data: [
    { id: 'a', value: 10, category: 'A' },
    { id: 'b', value: 20, category: 'B' },
    { id: 'c', value: 30, category: 'A' }
  ],
  layout: 'grid',
  colorBy: 'category'
});
```

---

### 2. Sphere (`nemosyne-sphere`)

3D ball for point data and volumetric visualization.

**Purpose:** Points in space, particle systems

**Spec Properties:**

```javascript
{
  id: 'sphere-demo',
  geometry: {
    type: 'sphere',
    radius: 0.5,
    widthSegments: 32,    // Horizontal resolution
    heightSegments: 16    // Vertical resolution
  },
  material: {
    properties: {
      color: '#4477ff',
      metalness: 0.3,
      roughness: 0.4,
      transparent: true,
      opacity: 0.8
    }
  }
}
```

---

### 3. Node (`nemosyne-node`)

Network node with connection support.

**Purpose:** Graph/network visualization

**Spec Properties:**

```javascript
{
  id: 'node-demo',
  geometry: {
    type: 'dodecahedron',
    radius: 0.4
  },
  material: {
    properties: {
      color: '#ff7755',
      emissive: '#ff4422',
      emissiveIntensity: 0.3
    }
  },
  connections: 'auto',      // Auto-create edges from parent refs
  // OR explicit connections:
  connections: [
    { from: 'node1', to: 'node2', style: { color: '#fff', thickness: 0.02 } }
  ]
}
```

**Data Format:**

```javascript
[
  { id: 'root', value: 100 },
  { id: 'child1', value: 50, parent: 'root' },
  { id: 'child2', value: 50, parent: 'root' }
]
```

---

### 4. Pillar (`nemosyne-pillar`)

Vertical column for bar charts and vertical comparisons.

**Purpose:** Bar charts, vertical comparisons

**Spec Properties:**

```javascript
{
  id: 'pillar-demo',
  geometry: {
    type: 'cylinder',
    radiusTop: 0.3,       // Can taper
    radiusBottom: 0.3,
    height: 2,
    radialSegments: 16
  },
  transforms: [{
    property: 'height',
    $data: 'value',
    $range: [0.5, 5]
  }]
}
```

---

### 5. Ring (`nemosyne-ring`)

Torus for cyclical data and radial menus.

**Purpose:** Donut charts, cyclical data, progress indicators

**Spec Properties:**

```javascript
{
  id: 'ring-demo',
  geometry: {
    type: 'torus',
    radius: 1,            // Major radius
    tube: 0.3,            // Minor radius (thickness)
    radialSegments: 16,
    tubularSegments: 100
  },
  transforms: [{
    property: 'arc',
    $data: 'completion',
    $range: [0, Math.PI * 2]
  }]
}
```

---

### 6. Crystal Field (`nemosyne-crystal-field`)

Volume/field visualization with isosurfaces and slices.

**Purpose:** Scalar fields, vector fields, volumetric data

**Attributes:**

```javascript
{
  fieldData: [],        // 3D array of scalar values
  dimensions: { x: 32, y: 32, z: 32 },
  bounds: { x: 10, y: 10, z: 10 },
  mode: 'isosurface',   // 'isosurface' | 'volumetric' | 'slices' | 'fieldlines'
  isovalue: 0.5,
  colorScale: 'heatmap',
  minColor: '#000044',
  maxColor: '#00ffaa',
  animateField: true
}
```

---

### 7. Timeline Spiral (`nemosyne-timeline-spiral`)

Time-series data on Archimedean spiral.

**Purpose:** Temporal navigation, time-series data

**Attributes:**

```javascript
{
  dataPoints: [],       // Array of {timestamp, value}
  startRadius: 1,
  radiusGrowth: 0.15,
  verticalScale: 0.001,
  goldenAngle: 137.507,
  playAnimation: true,
  temporalScrubbing: true
}
```

---

### 8. Scatter Semantic (`nemosyne-scatter-semantic`)

2D/3D scatter plot with semantic clustering.

**Purpose:** Correlation analysis, clustering

**Attributes:**

```javascript
{
  dataPoints: [],
  xField: 'x',
  yField: 'y',
  zField: 'z',
  categoryField: 'cluster',
  showClusterHull: true,
  showRegression: false
}
```

---

### 9. Graph Force (`nemosyne-graph-force`)

Force-directed graph with physics simulation.

**Purpose:** Network topology, social graphs

**Attributes:**

```javascript
{
  nodes: [],
  edges: [],
  iterations: 300,
  charge: -30,
  linkDistance: 1,
  collisionRadius: 0.5
}
```

---

### 10. Sankey Flow (`nemosyne-sankey-flow`)

Flow diagram for process visualization.

**Purpose:** Process flows, energy transfers

---

### 11. Tree Hierarchical (`nemosyne-tree-hierarchical`)

Dendrogram for hierarchical data.

**Purpose:** Org charts, file systems, taxonomies

**Attributes:**

```javascript
{
  showLabels: true,
  branchCurve: true,
  nodeSize: 0.3,
  showCollapsing: true
}
```

---

### 12. Geo Globe (`nemosyne-geo-globe`)

Spherical projection for geospatial data.

**Purpose:** Maps, geographic distributions

**Attributes:**

```javascript
{
  projection: 'mercator',  // 'mercator' | 'orthographic'
  showCountries: true,
  colorBy: 'population',
  enableRotation: true
}
```

---

### 13. Stream Graph (`nemosyne-stream-graph`)

Layered area chart for temporal stacks.

**Purpose:** Historical trends, stacked data

---

### 14. Parallel Coordinates (`nemosyne-parallel-coords`)

Multi-dimensional data visualization.

**Purpose:** Feature comparison, ML feature analysis

---

### 15. Network Globe (`nemosyne-network-globe`)

3D network on sphere surface.

**Purpose:** Global network topology

---

### 16. Shrike (Hyperion-Cantos Themed)

Metallic time-travelling entity with blade features.

**Coming in v0.3.0**

### 17. Time Tomb

Sealed chamber with countdown visualization.

**Coming in v0.3.0**

### 18. Farcaster Portal

Instant data transport portal with particle streams.

**Coming in v0.3.0**

---

## Component Attributes

### nemosyne-artefact-v2

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `src` | string | `''` | URL to artefact spec JSON |
| `data` | string | `''` | URL to dataset JSON |
| `spec` | JSON | required | Inline artefact specification |
| `dataset` | JSON | required | Inline dataset |
| `layout` | string | `'grid'` | Layout algorithm |
| `layout-options` | JSON | `{}` | Layout-specific options |
| `animate` | boolean | `true` | Enable entry animations |
| `entry-duration` | number | `800` | Animation duration (ms) |
| `interactive` | boolean | `true` | Enable hover/click |
| `debug` | boolean | `false` | Validation logging |

---

### nemosyne-connector

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `from` | selector | required | Source element |
| `to` | selector | required | Target element |
| `type` | string | `'line'` | Style: line, curve, tube, beam |
| `color` | string | `'#00d4aa'` | Line color |
| `thickness` | number | `0.03` | Line thickness |
| `opacity` | number | `0.4` | Line opacity |
| `animated` | boolean | `false` | Flow animation |
| `pulse` | boolean | `false` | Pulse effect |

---

## Layout Algorithms

### grid

Rows and columns with configurable spacing.

**Complexity:** O(n)

```javascript
{
  layout: 'grid',
  'layout-options': JSON.stringify({
    columns: 4,              // Auto-calculated if omitted
    spacing: 3,              // Distance between items
    offset: { x: 0, y: 0, z: 0 }
  })
}
```

---

### radial

Circular arrangement around center point.

**Complexity:** O(n)

```javascript
{
  layout: 'radial',
  'layout-options': JSON.stringify({
    radius: 5,               // Circle radius
    angleOffset: 0,        // Rotation offset (radians)
    yOffset: 0               // Vertical position
  })
}
```

---

### timeline

Linear arrangement along X axis.

**Complexity:** O(n log n) (sort)

```javascript
{
  layout: 'timeline',
  'layout-options': JSON.stringify({
    spacing: 3,              // Distance between points
    yOffset: 0,
    zOffset: 0
  })
}
```

---

### spiral

Rising spiral pattern.

**Complexity:** O(n)

```javascript
{
  layout: 'spiral',
  'layout-options': JSON.stringify({
    radius: 5,               // Starting radius
    heightStep: 0.5,         // Vertical rise per item
    rotations: 2,            // Full rotations
    radiusShrink: 0.3        // Radius decrease (0-1)
  })
}
```

---

### tree

Hierarchical arrangement for parent-child relationships.

**Complexity:** O(n)

```javascript
{
  layout: 'tree',
  'layout-options': JSON.stringify({
    levelHeight: 3,          // Vertical distance between levels
    siblingSpacing: 4        // Horizontal distance between siblings
  })
}
```

---

### force

Force-directed layout (simplified).

**Complexity:** O(n²) worst case

```javascript
{
  layout: 'force',
  'layout-options': JSON.stringify({
    bounds: 10,              // Position bounds
    charge: -30,             // Repulsion strength
    linkDistance: 1          // Edge preferred length
  })
}
```

---

### scatter

Random positions within bounds.

**Complexity:** O(n)

```javascript
{
  layout: 'scatter',
  'layout-options': JSON.stringify({
    bounds: 10               // Position range [-10, 10]
  })
}
```

---

## Spec Schema

```typescript
interface ArtefactSpec {
  id: string;                           // Unique identifier
  type?: string;                        // Artefact type
  geometry: GeometrySpec;
  material: MaterialSpec;
  transforms?: TransformSpec[];
  behaviours?: BehaviourSpec[];
  labels?: LabelSpec;
  connections?: 'auto' | ConnectionSpec[];
}

interface GeometrySpec {
  type: 'sphere' | 'box' | 'cylinder' | 'octahedron' | 
        'dodecahedron' | 'icosahedron' | 'torus' | string;
  radius?: number;
  width?: number;
  height?: number;
  depth?: number;
  [key: string]: any;                   // Type-specific parameters
}

interface MaterialSpec {
  properties: {
    color?: string;                     // Hex color
    emissive?: string;                  // Glow color
    emissiveIntensity?: number;         // Glow strength (0-2)
    metalness?: number;                 // 0-1
    roughness?: number;                 // 0-1
    opacity?: number;                   // 0-1
    transparent?: boolean;
    wireframe?: boolean;
    [key: string]: any;
  };
}

interface TransformSpec {
  property: 'position' | 'rotation' | 'scale' | 'color';
  $data?: string;                       // Data field to map
  $range?: [number, number];           // Output range
  $domain?: [number, number];          // Input range
  $map?: string;                        // Color scale name
  $calculate?: (value: any) => any;    // Custom function
}

interface BehaviourSpec {
  trigger: 'hover' | 'click' | 'idle' | 'data-update' | string;
  action: 'glow' | 'scale' | 'drill' | 'pulse' | string;
  params?: Record<string, any>;
}

interface LabelSpec {
  primary?: { $data: string } | string;
  secondary?: { $data: string } | string;
  color?: string;
  position?: 'above' | 'below' | 'center';
}
```

---

## Events

### Component Events

| Event | Detail | Description |
|-------|--------|-------------|
| `nemosyne-loaded` | `{ count: number, layout: string }` | Artefacts rendered |
| `nemosyne-error` | `{ error: string }` | Loading/rendering failed |
| `point-selected` | `{ point: DataPoint }` | Node clicked |
| `time-navigated` | `{ currentTime: number, direction: number }` | Temporal navigation |

### Custom Events

```javascript
// Listen for load completion
element.addEventListener('nemosyne-loaded', (e) => {
  console.log(`Loaded ${e.detail.count} artefacts`);
});

// Listen for selection
element.addEventListener('point-selected', (e) => {
  console.log('Selected:', e.detail.point);
});
```

---

## Transforms

### Linear Scale

Maps numeric values linearly.

```javascript
{
  property: 'scale',
  $data: 'value',
  $range: [0.5, 2.0],      // Output: 0.5x to 2x scale
  $domain: [0, 100]         // Input domain
}
```

---

### Log Scale

For exponential data distributions.

```javascript
{
  property: 'scale',
  $data: 'value',
  $map: 'log',
  $base: 10
}
```

---

### Ordinal Scale

Maps categorical data to discrete values.

```javascript
{
  property: 'color',
  $data: 'category',
  $map: 'category10'        // D3 categorical scale
}
```

---

### Time Scale

Maps dates to positions.

```javascript
{
  property: 'position.x',
  $data: 'timestamp',
  $map: 'time',
  $range: [0, 10]          // Timeline width
}
```

---

### Threshold Scale

Creates discrete ranges.

```javascript
{
  property: 'color',
  $data: 'temperature',
  $thresholds: [0, 15, 25, 35],
  $colors: ['blue', 'green', 'yellow', 'red']
}
```

---

### Custom Calculate

Custom transform function.

```javascript
{
  property: 'rotation.y',
  $data: 'trend',
  $calculate: (trend) => trend > 0 ? 0 : 180
}
```

---

## Behaviours

### Built-in Behaviours

| Trigger | Action | Parameters | Effect |
|---------|--------|------------|--------|
| `hover` | `glow` | `{ intensity: number }` | Emissive boost |
| `hover` | `scale` | `{ factor: number }` | Size increase |
| `hover-leave` | `reset` | `{}` | Return to default |
| `click` | `drill` | `{ target: string }` | Navigate to detail |
| `click` | `scale` | `{ factor: number, duration: number }` | Toggle size |
| `idle` | `pulse` | `{ speed: number, min: number, max: number }` | Breathing effect |
| `idle` | `rotate` | `{ speed: number, axis: 'x' | 'y' | 'z' }` | Spin |
| `data-update` | `flash` | `{ color: string, duration: number }` | Highlight change |
| `proximity` | `orbit` | `{ speed: number, radius: number }` | Circle cursor |

---

### Defining Custom Behaviours

```javascript
// Register custom behaviour
Nemosyne.registerBehaviour('entangled', {
  attach: (entity, config, data) => {
    const partner = scene.get(config.pairedWith);
    
    const handler = () => {
      if (partner.isHighlighted) {
        entity.highlight(true);
      }
    };
    
    partner.on('highlight', handler);
    
    // Return cleanup function
    return () => partner.off('highlight', handler);
  }
});

// Use in spec
{
  behaviours: [{
    trigger: 'entangled',
    pairedWith: 'partner-node'
  }]
}
```

---

## Migration Guide

### v0.1 to v0.2 Changes

| v0.1 | v0.2 | Notes |
|------|------|-------|
| `nemosyne-artefact` | `nemosyne-artefact-v2` | New stabilized API |
| `src` | `spec` (inline JSON) | Inline JSON string |
| `data` | `dataset` (inline JSON) | Inline JSON string |
| `spec-inline` | `spec` | Unified naming |
| `data-inline` | `dataset` | Unified naming |
| Manual position scripts | `layout` attribute | Built-in layouts |
| Manual connector scripts | `nemosyne-connector` | Dedicated component |

---

### Quick Migration Example

**v0.1:**
```html
<a-entity nemosyne-artefact="
  src: artefacts/my-spec.json;
  data: data/nodes.json;
"></a-entity>
```

**v0.2:**
```html
<a-entity nemosyne-artefact-v2="
  spec: { id: 'my-spec', geometry: {...} };
  dataset: { records: [...] };
  layout: grid;
  layout-options: { columns: 3 }
"></a-entity>
```

---

## Further Reading

- [Architecture Guide](../ARCHITECTURE.md)
- [Component Development](../Custom-Components.md)
- [Performance Optimization](../Performance.md)
- [WebSocket Integration](../WebSocket-Guide.md)

**Version:** 0.2.0  
**Last Updated:** 2026-04-10