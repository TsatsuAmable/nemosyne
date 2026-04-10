# Distance Field Component

## Visualize Relationships in 3D Space

**Component:** `nemosyne-distance-field`  
**Status:** Production Ready  
**Branch:** `feature/distance-field`

---

## Overview

The Distance Field component renders animated lines from a source point to its neighbors, visualizing relationships with:

- **Line Thickness** = Relationship strength (similarity)
- **Color** = Similarity type (cyan = strong, red = weak)
- **Opacity** = Distance (closer = more opaque)
- **Pulsing Animation** = Live connection indicator

---

## Installation

```html
<script src="src/components/nemosyne-distance-field.js"></script>
```

---

## Basic Usage

```html
<!-- Standalone distance field -->
<a-entity nemosyne-distance-field="
  sourcePoint: 0 1.6 -3;
  neighbors: [
    {id: 'a', position: {x: 2, y: 1.6, z: -4}, similarity: 0.8},
    {id: 'b', position: {x: -1, y: 2, z: -2}, similarity: 0.4}
  ];
  threshold: 5;
  animate: true
"></a-entity>
```

---

## Schema Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `sourcePoint` | vec3 | `0 0 0` | Center point of distance field |
| `neighbors` | array | `[]` | Array of neighbor objects |
| `threshold` | number | `5.0` | Max distance to show lines (meters) |
| `maxConnections` | number | `20` | Limit number of lines rendered |
| `animate` | boolean | `true` | Enable pulsing animation |
| `pulseSpeed` | number | `1.0` | Animation speed multiplier |
| `baseColor` | color | `#00d4aa` | Default line color |
| `highSimilarityColor` | color | `#00ffff` | Color for similarity > 0.7 |
| `lowSimilarityColor` | color | `#ff4444` | Color for similarity < 0.4 |
| `baseOpacity` | number | `0.6` | Base line opacity |
| `lineThickness` | number | `2` | Line width (pixels) |
| `metric` | string | `'cosine'` | Distance metric type |

### Neighbor Object Format

```javascript
{
  id: 'unique-id',                // Identifier
  position: {x, y, z},            // 3D position
  similarity: 0.0-1.0,              // Relationship strength (optional)
  distance: meters                // Euclidean distance (optional)
}
```

---

## Crystal Connections Usage

Automatic connection discovery for Nemosyne crystals:

```html
<a-entity nemosyne-crystal-connections="
  sourceCrystal: #crystal-123;
  maxConnections: 10;
  threshold: 5;
  animate: true
"></a-entity>
```

This automatically:
- Finds all other crystals in scene
- Calculates cosine similarity from embeddings
- Renders distance field lines
- Updates on crystal movement

---

## JavaScript API

### Update Neighbors Dynamically

```javascript
const field = document.querySelector('[nemosyne-distance-field]');

// Update with new data
field.components['nemosyne-distance-field'].updateNeighbors([
  {id: 'new1', position: {x: 1, y: 2, z: 3}, similarity: 0.9}
]);
```

### Show/Hide Field

```javascript
const field = document.querySelector('[nemosyne-distance-field]');
field.components['nemosyne-distance-field'].setVisible(false);
```

### Highlight Specific Connection

```javascript
// Highlight connection to specific neighbor
field.components['nemosyne-distance-field'].highlightConnection('neighbor-id');

// Reset highlighting
field.components['nemosyne-distance-field'].resetHighlight();
```

---

## Visual Encoding

### Similarity to Color

| Similarity | Color | Meaning |
|------------|-------|---------|
| > 0.7 | Bright Cyan | Strongly related |
| 0.4 - 0.7 | Teal → Cyan | Moderately related |
| < 0.4 | Red → Teal | Weakly related |

### Similarity to Thickness

- `thickness = baseThickness * similarity`
- Max similarity (1.0) = full thickness
- Min similarity (0.0) = 1 pixel

### Distance to Opacity

- `opacity = baseOpacity * (1 - distance/threshold * 0.5)`
- Closer points = more visible
- Distant points fade out

---

## Performance

- Uses `THREE.Line` (efficient for many segments)
- Limits to `maxConnections` to prevent overload
- Animation uses efficient shader properties
- Lines culled when `distance > threshold`

**Recommended:**
- Max 50 connections per field
- Max 10 distance fields per scene
- Combine with LOD system for distant fields

---

## Demo

Open `examples/distance-field-demo.html` to see:
- 25 randomly placed neighbor points
- Animated distance field from center
- Interactive threshold controls
- Hover effects on neighbors

---

## Integration with Memory Palace

```javascript
// Load memories, calculate distances
const memories = await adapter.loadAllDrawers();
const neighbors = memories.map(m => ({
  id: m.data.drawerId,
  position: m.position,
  similarity: cosineSimilarity(queryEmbedding, m.data.embedding)
}));

// Render distance field
field.updateNeighbors(neighbors);
```

---

## Next Steps

- [ ] GPU picking for line selection
- [ ] Haptic feedback (controller vibration)
- [ ] Distance metric selector UI
- [ ] Cluster-based grouping
- [ ] Temporal comparison (before/after)

---

*"See the invisible structure of your data."*
