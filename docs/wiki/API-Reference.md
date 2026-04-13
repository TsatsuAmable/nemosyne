# API Reference

Complete API documentation for Nemosyne v0.2.0.

## Core API

### Nemosyne

Global namespace providing framework utilities.

#### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `quickStart(scene, options)` | `Artefact` | Rapid visualization creation |
| `registerArtefact(name, Constructor)` | `void` | Register custom artefact |
| `registerLayout(name, algorithm)` | `void` | Register custom layout |
| `registerTransform(name, transform)` | `void` | Register custom transform |
| `version` | `string` | Framework version |

#### Configuration

```javascript
Nemosyne.config({
  debug: false,
  defaultColor: '#00d4aa',
  animationEnabled: true,
  performanceMode: 'auto' // 'auto' | 'high' | 'low'
});
```

### SceneManager

```typescript
interface SceneManager {
  init(container: HTMLElement, options?: SceneOptions): Promise<void>;
  destroy(): void;
  registerArtefact(spec: ArtefactSpec, data: DataPoint[]): Promise<Artefact>;
  getArtefact(id: string): Artefact | undefined;
  updateData(artefactId: string, newData: DataPoint[]): void;
  removeArtefact(id: string): void;
  setLayout(artefactId: string, layout: string, options?: LayoutOptions): void;
  clear(): void;
  exportScene(): SceneExport;
  importScene(export: SceneExport): void;
}
```

## Component Attributes

### nemosyne-artefact

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `src` | string | `''` | URL to artefact spec JSON |
| `spec` | JSON | required | Inline specification |
| `dataset` | JSON | required | Inline dataset |
| `layout` | string | `'grid'` | Layout algorithm |
| `layout-options` | JSON | `{}` | Layout-specific options |
| `animate` | boolean | `true` | Enable entry animations |
| `interactive` | boolean | `true` | Enable hover/click |

### nemosyne-connector

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `from` | selector | required | Source element |
| `to` | selector | required | Target element |
| `type` | string | `'line'` | Style: line, curve, tube, beam |
| `color` | string | `'#00d4aa'` | Line color |
| `thickness` | number | `0.03` | Line thickness |
| `animated` | boolean | `false` | Flow animation |

## Layout Algorithms

### `grid`

Rows and columns with configurable spacing.

**Complexity:** O(n)

```javascript
{
  layout: 'grid',
  'layout-options': JSON.stringify({
    columns: 4,
    spacing: 3,
    offset: { x: 0, y: 0, z: 0 }
  })
}
```

### `radial`

Circular arrangement around center point.

**Complexity:** O(n)

```javascript
{
  layout: 'radial',
  'layout-options': JSON.stringify({
    radius: 5,
    angleOffset: 0,
    yOffset: 0
  })
}
```

### `timeline`

Linear arrangement along X axis.

**Complexity:** O(n log n)

```javascript
{
  layout: 'timeline',
  'layout-options': JSON.stringify({
    spacing: 3,
    yOffset: 0,
    zOffset: 0
  })
}
```

### `spiral`

Rising spiral pattern.

**Complexity:** O(n)

```javascript
{
  layout: 'spiral',
  'layout-options': JSON.stringify({
    radius: 5,
    heightStep: 0.5,
    rotations: 2
  })
}
```

### `tree`

Hierarchical arrangement for parent-child relationships.

**Complexity:** O(n)

```javascript
{
  layout: 'tree',
  'layout-options': JSON.stringify({
    levelHeight: 3,
    siblingSpacing: 4
  })
}
```

### `force`

Force-directed layout (simplified).

**Complexity:** O(n²)

```javascript
{
  layout: 'force',
  'layout-options': JSON.stringify({
    bounds: 10,
    charge: -30,
    linkDistance: 1
  })
}
```

## Spec Schema

```typescript
interface ArtefactSpec {
  id: string;
  type?: string;
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
}

interface MaterialSpec {
  properties: {
    color?: string;
    emissive?: string;
    emissiveIntensity?: number;
    metalness?: number;
    roughness?: number;
    opacity?: number;
    transparent?: boolean;
  };
}

interface TransformSpec {
  property: 'position' | 'rotation' | 'scale' | 'color';
  $data?: string;
  $range?: [number, number];
  $domain?: [number, number];
  $map?: string;
  $calculate?: (value: any) => any;
}

interface BehaviourSpec {
  trigger: 'hover' | 'click' | 'idle' | 'data-update' | string;
  action: 'glow' | 'scale' | 'drill' | 'pulse' | string;
  params?: Record<string, any>;
}
```

## Events

### Component Events

| Event | Detail | Description |
|-------|--------|-------------|
| `nemosyne-loaded` | `{ count, layout }` | Artefacts rendered |
| `nemosyne-error` | `{ error }` | Loading failed |
| `point-selected` | `{ point }` | Node clicked |
| `time-navigated` | `{ currentTime, direction }` | Temporal navigation |

### Physics Events (Ammo.js)

| Event | Detail | Description |
|-------|--------|-------------|
| `collision` | `{ otherBody, contactPoints, impulse }` | Physics collision |
| `body-sleep` | `{ nodeId }` | Body went to sleep |
| `body-wake` | `{ nodeId }` | Body woke up |

## Transforms

### Linear Scale

```javascript
{
  property: 'scale',
  $data: 'value',
  $range: [0.5, 2.0],
  $domain: [0, 100]
}
```

### Log Scale

```javascript
{
  property: 'scale',
  $data: 'value',
  $map: 'log',
  $base: 10
}
```

### Ordinal Scale

```javascript
{
  property: 'color',
  $data: 'category',
  $map: 'category10'
}
```

### Time Scale

```javascript
{
  property: 'position.x',
  $data: 'timestamp',
  $map: 'time',
  $range: [0, 10]
}
```

## Behaviours

### Built-in Behaviours

| Trigger | Action | Parameters |
|---------|--------|------------|
| `hover` | `glow` | `{ intensity }` |
| `hover` | `scale` | `{ factor }` |
| `hover-leave` | `reset` | `{}` |
| `click` | `drill` | `{ target }` |
| `click` | `scale` | `{ factor, duration }` |
| `idle` | `pulse` | `{ speed, min, max }` |
| `idle` | `rotate` | `{ speed, axis }` |
| `data-update` | `flash` | `{ color, duration }` |

### Custom Behaviours

```javascript
Nemosyne.registerBehaviour('entangled', {
  attach: (entity, config, data) => {
    // Attach logic
    return () => {
      // Cleanup function
    };
  }
});
```

## Further Reading

- [Component Gallery](Component-Gallery)
- [Physics API](Physics-API)
- [WebSocket Streaming](WebSocket-Streaming)
- [Migration Guide](Migration-Guide)