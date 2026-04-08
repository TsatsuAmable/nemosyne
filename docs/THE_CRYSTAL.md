# The Crystal: Nemosyne's Atomic Unit

## Overview

The **Crystal** is the foundational, atomic building block of Nemosyne. It represents the successful marriage of:

- **A-Frame** → 3D geometry, materials, VR rendering
- **D3.js** → Data scales, colour maps, value transformations
- **Custom Behaviours** → Interactions, animations, state management

```
┌─────────────────────────────────────────────────────────┐
│                    NEMOSYNE CRYSTAL                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────┐        ┌─────────────┐               │
│  │   A-FRAME   │◄──────►│   D3.JS     │               │
│  │  Geometry   │        │   Scales    │               │
│  │  Materials  │        │   Colours   │               │
│  │  Scene      │        │   Domains   │               │
│  └──────┬──────┘        └──────┬──────┘               │
│         │                       │                       │
│         └───────────┬───────────┘                       │
│                     │                                   │
│              ┌──────────────┐                          │
│              │   BEHAVIOUR  │                          │
│              │    ENGINE    │                          │
│              └──────────────┘                          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## The Concept

A Crystal is a **first-class VR data citizen** — a self-contained entity that:

1. **Observes data** via D3.js scales
2. **Renders itself** via A-Frame
3. **Behaves interactively** via custom behaviours
4. **Reacts to change** automatically

It's the DNA of every Nemosyne visualization.

---

## Architecture

### 1. Data Layer (D3.js)

```javascript
// D3 scales transform data → visuals
this.scales = {
  // Value → Size (e.g., 42 → 1.2x scale)
  value: d3.scaleLinear()
    .domain([0, 100])      // Input: data range
    .range([0.5, 2.5]),    // Output: visual size
  
  // Category → Color (e.g., "A" → #1f77b4)
  category: d3.scaleOrdinal(d3.schemeCategory10),
  
  // Sequential → Color (e.g., 75 → teal-green)
  viridis: d3.scaleSequential(d3.interpolateViridis)
    .domain([0, 100])
};
```

### 2. Visual Layer (A-Frame)

```javascript
// A-Frame entity with geometry + material
this.geometryEl = document.createElement('a-octahedron');
this.geometryEl.setAttribute('radius', this.data.radius);
this.geometryEl.setAttribute('material', {
  color: '#00d4aa',
  emissive: '#00d4aa',
  emissiveIntensity: 0.5,
  metalness: 0.8,
  roughness: 0.2
});
```

### 3. Behaviour Layer (Custom)

```javascript
// Behaviours are pluggable
this.behaviours = {
  'hover': HoverBehaviour,      // Glow on hover
  'click': ClickBehaviour,      // Scale on click
  'idle': IdleBehaviour,        // Rotate/float
  'data-change': DataChangeBehaviour  // Animate value changes
};
```

---

## Key Features

### Reactive Data Binding

When data changes:

```javascript
// Developer calls:
crystal.setValue(85);

// Crystal automatically:
// 1. D3: valueScale(85) → 2.1
// 2. D3: viridis(85) → "#00ff88"
// 3. A-Frame: animate scale to 2.1x
// 4. A-Frame: fade color to teal-green
// 5. Emit: "data-change" event
```

### Extensible Behaviours

Built-in behaviours:

| Behaviour | Trigger | Effect |
|-----------|---------|--------|
| `hover` | mouseenter | emissive glow 0.5 → 2.0 |
| `click` | click | scale 1.0 → 1.3, show label |
| `idle` | [always] | rotation, float bob |
| `data-change` | setValue() | animate size/color |

Developers can add custom behaviours:

```javascript
NemosyneCrystal.registerBehaviour('pulse', class {
  init() {
    this.crystal.addAnimation({
      property: 'emissiveIntensity',
      from: 0.3,
      to: 2.0,
      loop: true,
      dir: 'alternate'
    });
  }
});
```

---

## API Reference

### Properties

#### Visual

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `geometry` | string | `"octahedron"` | Shape: sphere, box, octahedron, dodecahedron, icosahedron |
| `radius` | number | 1.0 | Base size |
| `color` | string | `"#00d4aa"` | Primary colour (or D3 scale ref) |
| `emissive` | string | `"#00d4aa"` | Glow colour |
| `emissiveIntensity` | number | 0.5 | Glow 0-2 |
| `metalness` | number | 0.8 | Metallic look 0-1 |
| `roughness` | number | 0.2 | Surface roughness 0-1 |
| `opacity` | number | 1.0 | Transparency 0-1 |

#### Data

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `value` | any | 42 | Primary data value |
| `valueAccessor` | string | `"value"` | Which field to read |
| `scaleDomain` | array | `[0, 100]` | D3 input range |
| `scaleRange` | array | `[0.5, 2]` | D3 output range (visual) |
| `colourScale` | string | `"viridis"` | D3: viridis, category10, diverging-rdgy |

#### Animation

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `autoRotate` | boolean | true | Spin while idle |
| `rotateSpeed` | number | 10 | Degrees per second |
| `float` | boolean | true | Bob up/down |
| `floatSpeed` | number | 1 | Cycles per second |
| `floatAmplitude` | number | 0.2 | Bob height in meters |

#### Behaviours

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `behaviours` | string | `"hover,click,idle"` | Comma-separated list |

---

## Usage Examples

### Basic Crystal

```html
<nemosyne-crystal
  value="42"
  color="#00d4aa"
  behaviour="hover, click, idle"
></nemosyne-crystal>
```

### Data-Driven Scaling

```html
<nemosyne-crystal
  value="78"
  scale-domain="[0, 100]"
  scale-range="[0.5, 3]"
  colour-scale="viridis"
></nemosyne-crystal>
```

### Categorical Data

```html
<nemosyne-crystal
  value="{'category': 'finance', 'amount': 50000}"
  value-accessor="amount"
  category-field="category"
  colour-scale="category10"
></nemosyne-crystal>
```

### JavaScript API

```javascript
// Get crystal
const crystal = document.querySelector('#my-crystal');

// Change value (triggers D3 → A-Frame animation)
crystal.components['nemosyne-crystal'].setValue(95);

// Change visual property
crystal.setAttribute('nemosyne-crystal', 'emissiveIntensity', 1.5);

// Listen to events
crystal.addEventListener('hover', (e) => {
  console.log('Hovered:', e.detail);
});

crystal.addEventListener('data-change', (e) => {
  console.log(`${e.detail.oldValue} → ${e.detail.newValue}`);
});
```

---

## D3 + A-Frame Integration

### Value → Size

```javascript
// D3 scale
const valueScale = d3.scaleLinear()
  .domain([0, 100])
  .range([0.5, 2.5]);

// When value changes
const newSize = valueScale(newValue);  // e.g., 70 → 2.0

// A-Frame animation
el.setAttribute('animation', {
  property: 'scale',
  to: '2.0 2.0 2.0',
  dur: 300,
  easing: 'easeOutElastic'
});
```

### Value → Colour

```javascript
// D3 viridis scale (black → purple → teal → yellow)
const colorScale = d3.scaleSequential(d3.interpolateViridis)
  .domain([0, 100]);

// When value changes
const newColor = colorScale(newValue);  // e.g., 70 → "#3b528b"

// A-Frame material update
el.setAttribute('material', 'color', newColor);
```

---

## Creating Custom Crystals

### Extend the Base

```javascript
class CustomCrystal extends NemosyneCrystal {
  init() {
    super.init();
    // Custom initialization
  }
  
  customMethod(value) {
    // Custom behaviour
    this.setVisual('color', '#ff3864');
    this.emit('custom-event', { value });
  }
}
```

### Register Custom Behaviour

```javascript
// Define behaviour
class HeartbeatBehaviour extends CrystalBehaviour {
  tick(time, delta) {
    const pulse = (Math.sin(time * 0.003) + 1) / 2; // 0-1
    const intensity = 0.3 + pulse * 1.5; // 0.3 - 1.8
    this.crystal.setVisual('emissiveIntensity', intensity);
  }
}

// Register
NemosyneCrystal.registerBehaviour('heartbeat', HeartbeatBehaviour);

// Use
// <nemosyne-crystal behaviours="hover, heartbeat"></nemosyne-crystal>
```

---

## Best Practices

1. **Keep values numeric** for D3 scales to work best
2. **Use consistent domains** across related crystals
3. **Let behaviours handle interactions** instead of manual event listeners
4. **Use data-change behaviour** for reactive updates
5. **Group crystals** for complex visualizations

---

## Next Steps

- **[Crystal Gallery](./CRYSTAL-GALLERY.md)** — See all crystal types
- **[Behaviour Guide](./BEHAVIOUR-GUIDE.md)** — Create custom behaviours
- **[Crystal Compositions](./CRYSTAL-COMPOSITIONS.md)** — Group crystals into visualizations

---

**The Crystal is the atom. Everything else is molecules.** 🐾