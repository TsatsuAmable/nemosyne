# Artefact Specification v0.1

## Overview

This document defines how artefacts are specified in Nemosyne. An artefact is a VR-native data representation with:
- **Geometry** — 3D form (primitive or custom)
- **Properties** — configurable attributes (color, size, etc.)
- **Behaviours** — interactivity and animation
- **Transforms** — data-to-visual mappings

---

## Artefact Schema

```javascript
{
  // Metadata
  "id": "crystal-node",           // Unique identifier
  "name": "Crystal Node",        // Human-readable name
  "version": "0.1.0",
  "description": "A faceted crystalline node for representing scalar values",
  
  // Category
  "topology": "node",             // graph | hierarchy | temporal | geospatial | field | flow
  "primitive": "crystal",         // The base 3D form
  
  // Geometry definition
  "geometry": {
    "type": "octahedron",         // sphere | box | cylinder | octahedron | custom
    "segments": 8,
    "detail": 2                   // For procedural geometry
  },
  
  // Material/appearance
  "material": {
    "shader": "standard",
    "properties": {
      "color": { "$data": "value", "$map": "viridis" },
      "emissive": "#00d4aa",
      "emissiveIntensity": { "$data": "confidence", "$range": [0, 1] },
      "opacity": 0.9,
      "wireframe": false,
      "metalness": 0.8,
      "roughness": 0.2
    }
  },
  
  // Position and scale
  "transform": {
    "position": { "$layout": "force-directed" },
    "scale": { "$data": "magnitude", "$range": [0.5, 3] },
    "rotation": { "x": 0, "y": { "$animate": "spin" }, "z": 0 }
  },
  
  // Behaviours
  "behaviours": [
    {
      "trigger": "hover",
      "action": "glow",
      "params": { "intensity": 2.0, "duration": 0.3 }
    },
    {
      "trigger": "click",
      "action": "expand",
      "params": { "scale": 1.5, "showDetails": true }
    },
    {
      "trigger": "idle",
      "action": "rotate",
      "params": { "speed": 0.5, "axis": "y" }
    }
  ],
  
  // Labels
  "labels": {
    "primary": { "$data": "name" },
    "secondary": { "$data": "value", "$format": "{v.toFixed(2)}" },
    "position": "above"
  },
  
  // Metadata (non-visual data)
  "metadata": {
    "category": { "$data": "type" },
    "tags": { "$data": "tags" }
  }
}
```

---

## Artefact Types Reference

### Node Artefacts (for Graphs)

| Property | Description | Default |
|----------|-------------|---------|
| `radius` | Base size | 1.0 |
| `color` | Primary color | auto-mapped |
| `glow` | Emissive intensity | 0.5 |
| `shape` | Geometry variant | "octahedron" |

**Shapes:** `octahedron`, `icosahedron`, `dodecahedron`, `sphere`, `box`, `cylinder`, `prism`

### Column Artefacts (for Bar Charts)

| Property | Description | Default |
|----------|-------------|---------|
| `height` | Vertical extent | data-mapped |
| `radius` | Cross-section | 0.5 |
| `segments` | Cylinder smoothness | 16 |
| `caps` | Top/bottom style | "flat" |

### Connector Artefacts (for Edges)

| Property | Description | Default |
|----------|-------------|---------|
| `thickness` | Line diameter | 0.1 |
| `start` | Source position | required |
| `end` | Target position | required |
| `curve` | Curvature amount | 0 (straight) |
| `animated` | Flow effect | false |

### Container Artefacts

| Type | Use Case |
|------|----------|
| `ring` | Orbital levels, categories |
| `zone` | Spatial regions |
| `platform` | Base for hierarchies |

---

## Transform Syntax

Data fields are mapped to visual properties using transform expressions:

### Data Binding
```javascript
// Direct binding
"color": { "$data": "category", "$map": "categoryColors" }

// Range mapping (linear scale)
"scale": { "$data": "value", "$range": [0.5, 3], "$domain": [0, 100] }

// Threshold mapping
"opacity": { "$data": "active", "$if": { true: 1.0, false: 0.3 } }
```

### Layout Functions
```javascript
// Force-directed (for networks)
"position": { "$layout": "force-directed", "strength": 0.05 }

// Grid layout
"position": { "$layout": "grid", "columns": 5 }

// Radial layout (for hierarchies)
"position": { "$layout": "radial", "radius": 10 }

// Time-axis (for temporal)
"position": { "$layout": "timeline", "axis": "x", "unit": "day" }
```

### Preset Scales (`$map` values)

**Categorical:**
- `category10`, `category20` — ColorBrewer palettes
- `ordinal` — Custom color list

**Sequential:**
- `viridis`, `plasma`, `magma` — Perceptually uniform
- `blues`, `reds`, `greens` — Single hue ramps

**Diverging:**
- `rdyg`, `brbg`, `piyg` — Red-green, blue-brown, purple-green

---

## Behaviour Reference

### Triggers

| Trigger | Description |
|---------|-------------|
| `hover` | Cursor enters proximity |
| `hover-leave` | Cursor exits |
| `click` | User clicks artefact |
| `select` | User explicitly selects |
| `deselect` | Selection removed |
| `idle` | Always running (no trigger needed) |
| `data-update` | Underlying data changed |
| `proximity` | Another artefact nearby |

### Actions

| Action | Effect | Parameters |
|--------|--------|------------|
| `glow` | Increase emissive | `intensity`, `color`, `duration` |
| `scale` | Resize | `factor`, `duration`, `easing` |
| `rotate` | Spin | `speed`, `axis` |
| `move` | Relocate | `to`, `duration`, `easing` |
| `color-shift` | Change color | `to`, `duration` |
| `pulse` | Rhythmic scale | `frequency`, `amplitude` |
| `show-label` | Display text | `content`, `position` |
| `emit` | Spawn particles | `type`, `count`, `lifetime` |
| `play-sound` | Audio feedback | `src`, `volume` |
| `reveal` | Show children/details | `expand`, `transition` |
| `highlight-path` | Trace connections | `to`, `color`, `duration` |

### Chaining Behaviours
```javascript
"behaviours": [
  {
    "trigger": "click",
    "sequence": [
      { "action": "scale", "params": { "factor": 1.3, "duration": 0.2 } },
      { "action": "glow", "params": { "intensity": 3.0 } },
      { "action": "show-label", "params": { "content": { "$data": "details" } } }
    ]
  }
]
```

---

## Example Artefact Definitions

### Stock Price Crystal
```javascript
{
  "id": "price-crystal",
  "topology": "temporal",
  "geometry": { "type": "octahedron" },
  "material": {
    "color": { "$data": "change", "$map": "diverging-rdgy" },
    "emissiveIntensity": { "$data": "volume", "$range": [0.2, 2] }
  },
  "transform": {
    "position": { "$layout": "timeline" },
    "scale": { "$data": "price", "$range": [0.5, 2] }
  },
  "behaviours": [
    { "trigger": "hover", "action": "glow", "params": { "intensity": 2 } },
    { "trigger": "click", "action": "show-label", "params": { "content": { "$template": "{symbol}: ${price}" } } }
  ]
}
```

### Social Network Node
```javascript
{
  "id": "person-node",
  "topology": "graph",
  "geometry": { "type": "sphere" },
  "material": {
    "color": { "$data": "community", "$map": "category10" },
    "opacity": 0.9
  },
  "transform": {
    "position": { "$layout": "force-directed" },
    "scale": { "$data": "connections", "$range": [0.5, 2] }
  },
  "behaviours": [
    { "trigger": "hover", "action": "highlight-path", "params": { "to": "neighbors" } },
    { "trigger": "click", "action": "reveal", "params": { "expand": "subgraph" } },
    { "trigger": "idle", "action": "rotate", "params": { "speed": 0.1 } }
  ]
}
```

### Temperature Field
```javascript
{
  "id": "temp-landscape",
  "topology": "field",
  "geometry": { "type": "plane", "segments": 64 },
  "material": {
    "shader": "heightmap",
    "color": { "$data": "temperature", "$map": "blues" }
  },
  "transform": {
    "displacement": { "$data": "temperature", "$scale": 2 },
    "wireframe": true
  },
  "behaviours": [
    { "trigger": "hover", "action": "show-label", "params": { "content": { "$template": "{temp}°C" } } }
  ]
}
```

---

## Extension: Custom Artefacts

Users can define new artefact types:

```javascript
Nemosyne.defineArtefact('spiral-node', {
  geometry: (data) => {
    // Procedural geometry based on data
    return generateSpiral(data.turns, data.radius);
  },
  material: {
    // Custom shader support
    shader: 'spiral-shader',
    uniforms: { ... }
  }
});
```

---

*Version 0.1 — Draft specification. Subject to refinement during implementation.*
