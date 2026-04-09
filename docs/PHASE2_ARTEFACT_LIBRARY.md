# Phase 2: Artefact Library Implementation

## Data-Native Visualization Components

**Status:** In Progress (3/9 components complete)  
**Branch:** Multiple feature/artefact-* branches

---

## Completed Components ✅

### 1. nemosyne-graph-force
**Branch:** `feature/artefact-graph-force`  
**Lines:** ~500  
**Time:** 45 minutes

**Features:**
- Physics simulation (repulsion, spring, gravity, friction)
- Real-time force-directed layout
- Interactive node dragging
- Dynamic edge rendering with weight-based opacity
- Size by node degree/centrality
- Hover highlighting of neighbors
- Entrance animations

**API:**
```javascript
entity.setAttribute('nemosyne-graph-force', {
  nodes: [{ id, value, color }, ...],
  edges: [{ source, target, weight }, ...],
  chargeStrength: -300,
  linkDistance: 2,
  draggable: true
});
```

---

### 2. nemosyne-timeline-spiral
**Branch:** `feature/artefact-timeline-spiral`  
**Lines:** ~550  
**Time:** 60 minutes

**Features:**
- Archimedean spiral with golden angle (137.507°)
- Time progression along spiral
- Vertical height encodes absolute time
- Density-based clustering detection
- Connector lines between sequential points
- Time labels at intervals
- Playback mode with camera following
- Temporal navigation (swipe gestures)
- Color by value/density/category

**API:**
```javascript
entity.setAttribute('nemosyne-timeline-spiral', {
  dataPoints: [{ timestamp, value }, ...],
  colorBy: 'value', // 'value', 'density', 'category'
  showConnectors: true,
  playAnimation: false,
  playSpeed: 1000
});
```

---

### 3. nemosyne-scatter-semantic
**Branch:** `feature/artefact-scatter-semantic`  
**Lines:** ~480  
**Time:** 50 minutes

**Features:**
- Auto-detection of embedding dimensions
- K-means clustering (auto cluster count)
- Density calculation per point
- Color by cluster/density/value
- 3D axes and coordinate grid
- Size scales with local density
- Region/lasso selection API
- Hover tooltips with metadata
- LOD support (max visible points)

**API:**
```javascript
entity.setAttribute('nemosyne-scatter-semantic', {
  dataPoints: [{ id, embeddings: [x,y,z], value }, ...],
  projection: 'auto', // 'auto', 'direct', 'umap'
  colorBy: 'cluster', // 'cluster', 'value', 'density'
  autoCluster: true,
  clusterCount: 5,
  maxVisiblePoints: 5000
});
```

---

## Components Remaining ⏳

### 4. nemosyne-tree-hierarchical
**Priority:** High  
**Estimated Time:** 40 minutes

**Features:**
- Tree layout (root at top, children below)
- Collapsible/expandable branches
- Depth-based sizing/coloring
- Orthogonal or radial layout option
- Path highlighting on selection
- Fold/unfold animations

**Use Case:** Org charts, file systems, classification hierarchies

---

### 5. nemosyne-geo-globe
**Priority:** High  
**Estimated Time:** 50 minutes

**Features:**
- Spherical Earth projection
- Lat/long to 3D conversion
- Marker clustering by zoom level
- Country/region coloring
- Great circle arc connections
- Zoom and rotation controls

**Use Case:** Geographic data, travel routes, global distributions

---

### 6. nemosyne-grid-categorical
**Priority:** Medium  
**Estimated Time:** 35 minutes

**Features:**
- Grid/trellis layout by category
- Grid cells sized by count
- Category headers
- Sortable by value/count
- Expand category to detail view

**Use Case:** File browsers, image galleries, categorized collections

---

### 7. nemosyne-heatmap-matrix
**Priority:** Medium  
**Estimated Time:** 40 minutes

**Features:**
- 2D matrix with cells
- Color intensity by value
- Heat map gradient
- X/Y axis labels
- Cell selection highlighting
- Value tooltips

**Use Case:** Correlation matrices, confusion matrices, sensor grids

---

### 8. nemosyne-crystal-field
**Priority:** Medium  
**Estimated Time:** 45 minutes

**Features:**
- Scalar field visualization
- Voxel or point cloud rendering
- Isosurface extraction (marching cubes)
- Volume rendering with opacity
- Slice planes
- Field line tracing

**Use Case:** Physics simulations, medical imaging, flow fields

---

### 9. nemosyne-tree-radial
**Priority:** Low  
**Estimated Time:** 35 minutes

**Features:**
- Radial tree layout (root at center)
- Angular distribution of children
- Sector coloring by branch
- Collapsible wedges
- Rotation controls

**Use Case:** Small hierarchies, phylogenetic trees, sunburst charts

---

## Implementation Template

Each component follows this structure:

```javascript
AFRAME.registerComponent('nemosyne-[name]', {
  schema: {
    // Data
    dataPoints: { type: 'array', default: [] },
    
    // Visual params
    size: { type: 'number', default: 0.1 },
    colorBy: { type: 'string', default: 'value' },
    
    // Interaction
    interactive: { type: 'boolean', default: true }
  },
  
  init: function() {
    // 1. Create container
    // 2. Process/transform data
    // 3. Calculate layout positions
    // 4. Build visual elements
    // 5. Setup interactions
    // 6. Animate entrance
  },
  
  // Required methods:
  createNode/createCell/createPoint() {},
  calculateLayout() {},
  setupInteractions() {},
  updateVisuals() {},
  remove() {}
});
```

---

## Gesture Integration

All components support:

| Gesture | Action | Component Variation |
|---------|--------|---------------------|
| **Point + Pinch** | Select element | Universal |
| **Grab + Move** | Spatial manipulate | Graph (drag node), Timeline (scrub), Scatter (brush) |
| **Two-hand Expand** | Aggregate/Zoom | Graph (cluster), Scatter (zoom), Timeline (expand window) |
| **Swipe Left/Right** | Navigate | Timeline (time shift), Grid (page), Heatmap (scroll) |
| **Circle Draw** | Select region | Scatter (lasso), Geo (radius), Grid (rectangle) |
| **Thumbs Up** | Confirm | Universal (commit selection) |
| **Thumbs Down** | Cancel/Reject | Universal (clear selection) |

---

## Component Selection Logic

```javascript
// From TopologyDetector
if (data.hasGraphLinks || avgLinksPerNode > 2) {
  return 'nemosyne-graph-force';
} else if (data.hasHierarchy) {
  return data.packetCount < 20 ? 'nemosyne-tree-radial' : 'nemosyne-tree-hierarchical';
} else if (data.types.temporal > 0.5) {
  return 'nemosyne-timeline-spiral';
} else if (data.hasEmbeddings || data.dimensions > 3) {
  return 'nemosyne-scatter-semantic';
} else if (data.hasGeoData) {
  return 'nemosyne-geo-globe';
} else if (data.types.categorical > 0.7) {
  return 'nemosyne-grid-categorical';
} else if (data.structures.matrix > 0.5) {
  return 'nemosyne-heatmap-matrix';
} else if (data.structures.field > 0.5) {
  return 'nemosyne-crystal-field';
}
```

---

## Usage with Data-Native Engine

```html
<!-- Automatic selection based on data -->
<a-entity nemosyne-data-native="source: #myData"></a-entity>

<!-- Or explicit component selection -->
<a-entity id="visualization"
  nemosyne-graph-force="nodes: [...]; edges: [...]"></a-entity>
```

---

## Progress Summary

| Component | Status | Branch | Lines | Time |
|-----------|--------|--------|-------|------|
| graph-force | ✅ Complete | feature/artefact-graph-force | 500 | 45min |
| timeline-spiral | ✅ Complete | feature/artefact-timeline-spiral | 550 | 60min |
| scatter-semantic | ✅ Complete | feature/artefact-scatter-semantic | 480 | 50min |
| tree-hierarchical | ⏳ Todo | - | - | 40min |
| geo-globe | ⏳ Todo | - | - | 50min |
| grid-categorical | ⏳ Todo | - | - | 35min |
| heatmap-matrix | ⏳ Todo | - | - | 40min |
| crystal-field | ⏳ Todo | - | - | 45min |
| tree-radial | ⏳ Todo | - | - | 35min |

**Completed:** 3/9 (33%)  
**Lines Written:** 1,530  
**Time Spent:** 2 hours 55 minutes  
**Estimated Remaining:** 4 hours 5 minutes  

---

## Next Steps

1. **Complete tree-hierarchical** - Org charts, file systems
2. **Complete geo-globe** - Geographic data  
3. **Complete grid-categorical** - File browsers, galleries
4. **Complete heatmap-matrix** - Correlation/accuracy matrices
5. **Complete crystal-field** - Volume rendering
6. **Complete tree-radial** - Sunburst charts

**Total Phase 2 ETA:** ~7 hours total

---

## Integration Test

```javascript
// Load graph data - auto-selects graph-force
const graphData = {
  nodes: [
    { id: 'A', value: 10 },
    { id: 'B', value: 20 },
    { id: 'C', value: 15 }
  ],
  edges: [
    { source: 'A', target: 'B', weight: 0.8 },
    { source: 'B', target: 'C', weight: 0.6 }
  ]
};

const engine = new DataNativeEngine();
engine.ingest(graphData);
// → Uses nemosyne-graph-force automatically
// → Physics layout, draggable nodes, highlight neighbors
```

---

*"Each component embodies one topology, one way of seeing data."*
