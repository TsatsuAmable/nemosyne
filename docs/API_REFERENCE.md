# Nemosyne API Reference

Complete API documentation for all Nemosyne components.

## Table of Contents

- [Core Components](#core-components)
- [Visualization Components](#visualization-components)
- [Animation System](#animation-system)
- [MemPalace Integration](#mempalace-integration)

---

## Core Components

### DataNativeEngine

Main orchestrator for data-native visualization.

```javascript
const engine = new DataNativeEngine(options);
```

**Options:**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `autoDetect` | boolean | true | Auto-select visualization type |
| `enableGestures` | boolean | true | Enable hand tracking |
| `performanceMode` | string | 'balanced' | 'quality', 'balanced', 'performance' |

**Methods:**

| Method | Returns | Description |
|--------|---------|-------------|
| `loadData(data)` | Promise | Load data and detect topology |
| `setVisualization(type)` | void | Force specific visualization |
| `render(selector)` | void | Render to DOM element |
| `update()` | void | Refresh with current data |

**Events:**

- `topology-detected` - { type, confidence }
- `render-complete` - { component, nodeCount }
- `gesture` - { type, data }

---

### TopologyDetector

Automatically detects the best visualization type for data.

```javascript
const detector = new TopologyDetector();
const result = detector.analyze(dataPacket);
```

**Returns:**

```javascript
{
  type: 'graph' | 'temporal' | 'hierarchical' | 'spatial' | ...,
  confidence: 0.0-1.0,
  scores: { /* per-type scores */ },
  recommendation: string
}
```

**Detection Types:**

| Type | Trigger |
|------|---------|
| `graph` | Has source/target links |
| `temporal` | Has date/timestamp fields |
| `hierarchical` | Has parent/children |
| `spatial` | Has lat/lon coordinates |
| `categorical` | Many categories |
| `matrix` | 2D grid structure |
| `field` | Continuous values |
| `embedding` | High-dimensional |
| `network` | Nodes + connections |

---

### PropertyMapper

Maps data properties to visual properties.

```javascript
const mapper = new PropertyMapper();
mapper.map(data, {
  color: 'category',
  size: 'value',
  opacity: 'confidence'
});
```

**Color Schemes:**

- `heatmap` - Sequential colors
- `categorical` - Distinct colors
- `diverging` - Two-color scale
- `custom` - User-defined

---

## Visualization Components

### nemosyne-graph-force

Force-directed graph with physics.

**Attributes:**

```html
<a-entity nemosyne-graph-force="
  data: [...];
  linkDistance: 2;
  chargeStrength: -50;
  centerGravity: 0.1;
  enablePhysics: true
"></a-entity>
```

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `data` | string | '[]' | JSON array of nodes/links |
| `linkDistance` | number | 2 | Ideal link length |
| `chargeStrength` | number | -30 | Node repulsion |
| `centerGravity` | number | 0.1 | Pull to center |
| `enablePhysics` | boolean | true | Use Ammo.js physics |
| `collisionRadius` | number | 0.5 | Node collision size |

---

### nemosyne-timeline-spiral

Spiral timeline for temporal data.

**Attributes:**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `timeField` | string | 'date' | Field containing timestamp |
| `valueField` | string | 'value' | Numeric value field |
| `categoryField` | string | 'category' | Categorical field |
| `radiusGrowth` | number | 0.15 | Radius increment per point |
| `playAnimation` | boolean | false | Auto-play timeline |

---

### nemosyne-geo-globe

Geographic data on 3D globe.

**Attributes:**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `markers` | string | '[]' | Array of {lat, lon, value} |
| `radius` | number | 3 | Globe radius |
| `autoRotate` | boolean | true | Rotate globe |
| `clusterDistance` | number | 0.5 | Marker clustering radius |

---

### [Additional Components...]

See component files for full documentation:
- `nemosyne-tree-hierarchical`
- `nemosyne-grid-categorical`
- `nemosyne-heatmap-matrix`
- `nemosyne-crystal-field`
- `nemosyne-tree-radial`
- `nemosyne-stream-graph` ⭐ NEW
- `nemosyne-circle-pack` ⭐ NEW
- `nemosyne-network-globe` ⭐ NEW
- `nemosyne-parallel-coords` ⭐ NEW

---

## Animation System

### TemporalScrubber

Time-travel through data epochs.

```javascript
const scrubber = new TemporalScrubber({
  playbackSpeed: 7,  // days per second
  loop: true
});

// Load data
await scrubber.loadFromMemPalace(connector);

// Control playback
scrubber.play();
scrubber.pause();
scrubber.scrubTo(timestamp);

// Events
scrubber.addEventListener('time-update', (e) => {
  console.log(e.detail.currentTime, e.detail.state);
});
```

---

### UncertaintyVisualizer

Visualize confidence and probability.

```javascript
const viz = new UncertaintyVisualizer(scene);

viz.visualizeUncertainty(entity, {
  confidence: 0.7,    // 0-1 certainty
  type: 'pulse',      // 'pulse' | 'flicker' | 'ghost' | 'blur' | 'cloud'
  intensity: 0.5      // Effect strength
});
```

---

## MemPalace Integration

### MemPalaceVRConnector

Connect to MemPalace API.

```javascript
const connector = new MemPalaceVRConnector({
  baseUrl: 'http://localhost:8765',
  wsUrl: 'ws://localhost:8766'
});

await connector.connect();

// Queries
const nearby = connector.findMemoriesNearPosition(
  { x: 0, y: 1.6, z: -2 },
  2  // radius in meters
);

const byTime = connector.findMemoriesByTimeRange(
  Date.now() - 86400000,  // 24 hours ago
  Date.now()
);

// Save position back
await connector.updatePosition(drawerId, newPosition);
```

**Methods:**

| Method | Description |
|--------|-------------|
| `fetchStats()` | Get database statistics |
| `fetchStructure()` | Get wing/room hierarchy |
| `fetchDrawers(options)` | Get memory drawers |
| `searchMemories(query)` | Search by content |
| `findMemoriesNearPosition(pos, radius)` | Spatial query |
| `findMemoriesInVolume(volume)` | Bounding box query |
| `findMemoriesByTimeRange(start, end)` | Temporal query |
| `navigateByTime(timestamp)` | Jump to nearest memory |
| `getMemoryTrail(start, end)` | Get chronological path |
| `findPathBetweenMemories(from, to)` | Get path between two memories |

---

## Events Reference

### Global Events

| Event | Payload | Description |
|-------|---------|-------------|
| `nemosyne-ready` | - | All components loaded |
| `data-loaded` | { count } | Data successfully loaded |
| `topology-detected` | { type, confidence } | Best vis type found |
| `gesture-detected` | { type, position } | Hand gesture recognized |

### Component Events

| Event | Payload | Description |
|-------|---------|-------------|
| `node-select` | { node, position } | Node clicked |
| `node-hover` | { node } | Node hovered |
| `time-update` | { currentTime, state } | Temporal scrubber moved |
| `region-select` | { bounds, nodes } | Area selected |

---

## Performance Tips

1. **Use `performanceMode: 'performance'`** for large datasets
2. **Enable `enablePhysics: false`** if not needed
3. **Set `maxVisiblePoints`** for scatter plots
4. **Use LOD** (Level of Detail) for distant objects
5. **Batch updates** - don't update every frame

---

## Version History

| Version | Date | Notes |
|---------|------|-------|
| 1.0.0 | 2026-04-09 | Initial release with 12 components |
