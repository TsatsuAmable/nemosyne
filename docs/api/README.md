# Nemosyne API Reference

## Components

### `nemosyne-artefact`

Main component for rendering data visualizations.

#### Schema

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `src` | string | `""` | URL to artefact specification JSON |
| `data` | string | `""` | URL to data JSON |
| `spec-inline` | string | `""` | Inline JSON specification |
| `data-inline` | string | `""` | Inline data JSON |
| `layout` | string | `"default"` | Layout algorithm (default, radial, grid, timeline) |

#### Example

```html
<nemosyne-artefact
  spec-inline='<;{"geometry": {"type": "octahedron"}}'
  data-inline='<;{"records": [{"value": 42}]}'>
</nemosyne-artefact>
```

#### Events

| Name | Detail | Description |
|------|--------|-------------|
| `nemosyne-loaded` | `{ count: number }` | Fired when artefacts are rendered |

---

### `nemosyne-scene`

Scene configuration component.

#### Schema

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `theme` | string | `"void"` | Theme preset (void, light, color) |

---

## Artefact Specification Schema

### Geometry

```json
{
  "type": "octahedron",  // sphere, box, cylinder, octahedron, icosahedron, dodecahedron
  "radius": 1            // Base size
}
```

### Material

```json
{
  "properties": {
    "color": "#00d4aa",          // Or data binding: {"$data": "category", "$map": "category10"}
    "emissive": "#00d4aa",       // Glow color
    "emissiveIntensity": 0.5,    // 0-2 typically
    "metalness": 0.8,            // 0-1
    "roughness": 0.2,            // 0-1
    "opacity": 0.9,              // 0-1
    "transparent": false,
    "wireframe": false
  }
}
```

### Transform

```json
{
  "scale": { "$data": "value", "$range": [0.5, 2] },
  "color": { "$data": "category", "$map": "category10" }
}
```

### Behaviours

```json
[
  { 
    "trigger": "hover",           // hover, hover-leave, click, idle
    "action": "glow",             // glow, scale, show-label, rotate
    "params": {                   // Action-specific parameters
      "intensity": 2
    }
  }
]
```

#### Triggers

- `hover` - Cursor enters artefact
- `hover-leave` - Cursor exits
- `click` - User clicks
- `idle` - Always active (for rotations, etc.)

#### Actions

- `glow` - Change emissive intensity (params: `intensity`)
- `scale` - Resize (params: `factor`, `duration`)
- `show-label` - Display text (params: `content`, `position`, `duration`)
- `rotate` - Continuous rotation (params: `speed`, `axis`)

#### Labels

```json
{
  "primary": { "$data": "name" },
  "color": "#d4af37",
  "position": "above",    // above, below, center
  "width": 6
}
```

---

## Globals

### `Nemosyne`

| Property | Type | Description |
|----------|------|-------------|
| `VERSION` | string | Current version |

---

*API version 0.1.0*
