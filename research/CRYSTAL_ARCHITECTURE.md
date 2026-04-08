# Nemosyne Crystal Architecture

## The Atomic Unit

The Crystal is the fundamental VR data artefact — a self-contained object that merges A-Frame's 3D rendering with D3.js's data transformation capabilities.

---

## Core Philosophy

```
Crystal = A-Frame Entity + D3 Data Binding + Behaviour Engine
```

Every Crystal is:
- **Observable** — Reacts to data changes
- **Configurable** — Properties via HTML attributes or JS
- **Extensible** — Custom behaviours can be added
- **Self-contained** — No external dependencies once instantiated

---

## Class Structure

```javascript
class NemosyneCrystal extends AFRAME.Component {
  // Core properties managed by the crystal
  properties = {
    value: null,        // The data this crystal represents
    scale: 1,           // Visual size
    color: '#00d4aa',   // Primary color
    emissive: '#00d4aa', // Glow color
    emissiveIntensity: 0.5,
    
    // D3.js bindings
    scaleDomain: [0, 100],    // Input range
    scaleRange: [0.5, 2],     // Output range (visual)
    colourScale: 'viridis',   // D3 colour scale name
    
    // State
    isHovered: false,
    isSelected: false,
    isAnimating: false
  };
  
  // Built-in behaviours
  behaviours = {
    hover: HoverBehaviour,
    click: ClickBehaviour,
    idle: IdleBehaviour,
    dataChange: DataChangeBehaviour
  };
  
  // Extensible user behaviours
  customBehaviours = new Map();
}
```

---

## The D3-A-Frame Bridge

### Data → Visual Mapping

```javascript
// D3.js scale for value → size
this.valueScale = d3.scaleLinear()
  .domain(this.data.scaleDomain)
  .range(this.data.scaleRange);

// D3.js scale for category → colour
this.colourScale = d3.scaleOrdinal(d3.schemeCategory10);

// D3.js scale for sequential data
this.viridisScale = d3.scaleSequential(d3.interpolateViridis)
  .domain([0, 100]);
```

### Reactive Binding

When data changes:
```javascript
onDataChange(newValue) {
  // D3: Calculate new visual properties
  const newScale = this.valueScale(newValue);
  const newColor = this.viridisScale(newValue);
  
  // A-Frame: Apply with animation
  this.el.setAttribute('animation', {
    property: 'scale',
    to: `${newScale} ${newScale} ${newScale}`,
    dur: 300,
    easing: 'easeOutElastic'
  });
  
  this.el.setAttribute('material', {
    color: newColor
  });
}
```

---

## Built-in Properties

### Visual Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `geometry` | string | `"octahedron"` | Shape: sphere, box, crystal, orb |
| `radius` | number | 1.0 | Base size |
| `color` | string/color-fn | `"#00d4aa"` | Primary colour or D3 scale |
| `emissive` | string | `"#00d4aa""` | Glow colour |
| `emissiveIntensity` | number | 0.5 | Glow strength |
| `metalness` | number | 0.8 | Material property |
| `roughness` | number | 0.2 | Material property |
| `opacity` | number | 1.0 | Transparency |

### Data Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `value` | any | 42 | Primary data value |
| `valueAccessor` | string | `"value"` | Which field to visualize |
| `scaleDomain` | array | [0, 100] | Input range |
| `scaleRange` | array | [0.5, 2] | Output range |
| `colourScale` | string | `"viridis"` | D3 colour scale name |
| `categoryField` | string | `"category"` | For categorical colours |

### Transform Properties

| Property | Type | Description |
|----------|------|-------------|
| `position` | vec3 | Static position |
| `rotation` | vec3 | Static rotation |
| `autoRotate` | boolean | Continuous rotation |
| `rotateSpeed` | number | Rotation speed (deg/sec) |
| `float` | boolean | Bobbing animation |
| `floatSpeed` | number | Bob speed (cycles/sec) |
| `floatAmplitude` | number | Bob height |

---

## Behaviour System

### Built-in Behaviours

#### 1. HoverBehaviour
```javascript
class HoverBehaviour {
  onEnter() {
    this.crystal.set('emissiveIntensity', 2.0);
    this.crystal.emit('hover');
  }
  
  onLeave() {
    this.crystal.set('emissiveIntensity', 0.5);
    this.crystal.emit('hover-end');
  }
}
```

#### 2. ClickBehaviour
```javascript
class ClickBehaviour {
  onClick() {
    this.crystal.animate('scale', 1.3, { dur: 200 });
    this.crystal.showLabel();
    this.crystal.emit('click');
  }
}
```

#### 3. IdleBehaviour
```javascript
class IdleBehaviour {
  tick(time, delta) {
    if (this.crystal.data.autoRotate) {
      this.crystal.rotate.y += this.crystal.data.rotateSpeed * delta;
    }
    
    if (this.crystal.data.float) {
      const bob = Math.sin(time * this.crystal.data.floatSpeed) * 
                  this.crystal.data.floatAmplitude;
      this.crystal.position.y = this.crystal.baseY + bob;
    }
  }
}
```

#### 4. DataChangeBehaviour
```javascript
class DataChangeBehaviour {
  onValueChange(oldValue, newValue) {
    // D3 scale lookup
    const newColor = this.crystal.colourScale(newValue);
    const newSize = this.crystal.valueScale(newValue);
    
    // Animate to new state
    this.crystal.tween('color', newColor);
    this.crystal.tween('scale', newSize);
    
    this.crystal.emit('data-change', { oldValue, newValue });
  }
}
```

### Custom Behaviour Registration

Developers can add behaviours:

```javascript
// Register custom behaviour
NemosyneCrystal.registerBehaviour('pulse', class PulseBehaviour {
  init() {
    this.crystal.addAnimation({
      property: 'emissiveIntensity',
      from: 0.3,
      to: 2.0,
      dur: 1000,
      loop: true,
      dir: 'alternate'
    });
  }
});

// Use in HTML
<nemosyne-crystal behaviour="hover, click, pulse"></nemosyne-crystal>

// Or via JS
crystal.addBehaviour('pulse');
```

---

## Full API Example

### Basic Usage

```html
<!-- Static crystal -->
<nemosyne-crystal
  value="42"
  color="#00d4aa"
  behaviour="hover, click, idle"
></nemosyne-crystal>
```

### Data-Driven

```html
<!-- Data-driven with D3 scales -->
<nemosyne-crystal
  value="78"
  value-accessor="temperature"
  scale-domain="[0, 100]"
  scale-range="[0.5, 2]"
  colour-scale="viridis"
  behaviour="hover, click, idle, data-change"
></nemosyne-crystal>
```

### Dynamic Updates

```javascript
// Get crystal instance
const crystal = document.querySelector('#my-crystal');

// Update value (triggers animation)
crystal.setValue(65);

// Update visual properties
crystal.setProperties({
  emissiveIntensity: 1.0,
  rotateSpeed: 1.5
});

// Add custom behaviour
crystal.addBehaviour('shake', {
  onActivate() {
    this.el.setAttribute('animation', {
      property: 'position',
      to: '0.2 0 0',
      dir: 'alternate',
      dur: 50,
      loop: 10
    });
  }
});

// Listen to events
crystal.addEventListener('hover', () => console.log('Hovered!'));
crystal.addEventListener('data-change', (e) => {
  console.log(`Value changed: ${e.detail.oldValue} → ${e.detail.newValue}`);
});
```

---

## Implementation Flow

```
1. DATA INPUT
   ↓
2. D3.js TRANSFORM
   - Scale value to size
   - Map to colour
   - Calculate position
   ↓
3. A-FRAME RENDER
   - Create/update geometry
   - Apply materials
   - Set transforms
   ↓
4. BEHAVIOUR ENGINE
   - Attach event listeners
   - Start idle animations
   - Wire up interactions
   ↓
5. READY
   - React to data changes
   - Respond to user input
   - Emit events
```

---

## As First-Class Citizen

The Crystal is:

- **Composable**: Can be grouped, connected, nested
- **Queryable**: `document.querySelector('nemosyne-crystal[value=">50"]')`
- **Serializable**: `crystal.toJSON()` exports full state
- **Clonable**: `crystal.clone()` creates identical copy
- **Observable**: `crystal.watch('value', callback)`

---

## Extension Points

Developers can extend:

1. **Geometry**: Add custom shapes
2. **Materials**: Custom shaders
3. **Behaviours**: New interaction patterns
4. **Scales**: Custom D3 scales
5. **Data transforms**: Custom value → visual mappings

This Crystal is the DNA of Nemosyne — everything else is built from or extends this pattern.