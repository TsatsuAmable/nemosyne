# Nemosyne Design System

## Visual Language

Nemosyne aims for a consistent aesthetic across all visualizations — elegant, futuristic, and data-focused.

---

## Design Principles

### 1. Data First
The data must be the hero. Visual elements serve the data, not compete with it.

### 2. Depth + Space
Use the Z-axis meaningfully. Closer = more important/present. Distance = context/background.

### 3. Light as Information
Emissive properties show data values. Glow indicates significance or selection.

### 4. Motion as Feedback
Animation communicates state changes. Smooth transitions guide attention.

### 5. Minimal Chrome
Reduce UI elements that aren't data. Use spatial relationships instead of borders.

---

## Color System

### Primary Palette

| Role | Color | Hex | Usage |
|------|-------|-----|-------|
| **Accent** | Teal | `#00d4aa` | Primary highlights, interactive elements, positive values |
| **Secondary** | Gold | `#d4af37` | Labels, important data points, headers |
| **Alert** | Rose | `#ff3864` | Warnings, negative values, alerts |
| **Purple** | Violet | `#6b4ee6` | Secondary categories, neutral data |

### Semantic Colors

- **Success:** `#00d4aa` (teal)
- **Warning:** `#ffaa00` (amber)
- **Error:** `#ff3864` (rose)
- **Info:** `#6b4ee6` (violet)
- **Neutral:** `#888888` (gray)

### Background Colors

| Theme | Background | Fog | Ambient |
|-------|------------|-----|---------|
| **Void (default)** | `#000205` | `#000510` | `#001122` |
| **Light** | `#f5f5f7` | `#ffffff` | `#e0e0e0` |
| **Color** | `#0a0a1a` | `#0a0a1a` | `#1a1a2e` |

### Data Color Scales

**Sequential:**
- Viridis: Dark blue → cyan → yellow (accessible, perceptually uniform)
- Blues: Light to dark blue
- Warm: Red → orange → yellow

**Diverging:**
- RdGy (Red-Grey): Red (negative) → grey (neutral) → teal (positive)
- BrBG (Brown-Blue-Green): Natural tones

**Categorical:**
- Category10: Distinct colors for up to 10 categories
- Pastel variants for softer distinctions

---

## Typography

### Font Families

- **Primary:** System sans-serif (Segoe UI, -apple-system, etc.)
- **Labels:** `kelsonsans` (A-Frame default) or `exo2bold` for futuristic feel
- **Mono:** `JetBrains Mono` or `Fira Code` for data values

### Hierarchy

| Level | Size | Weight | Usage |
|-------|------|--------|-------|
| **Title** | 24px | Light (300) | Scene labels, major headings |
| **Heading** | 18px | Regular (400) | Section labels, data categories |
| **Label** | 14px | Regular | Data point labels, tooltips |
| **Data** | 12px | Mono | Raw values, timestamps |

### Text in VR

- Always face the camera ( billboard component)
- Use `draw: front` to ensure readability
- Minimum width: 4 units for visibility
- Align: center for floating labels, left for data lists

---

## Artefact Specifications

### Crystal (Node Artefact)

```
Geometry: Octahedron (8 faces)
Radius: 0.5 - 2.0 (data-driven)
Material:
  - Color: Data-mapped or category
  - Metalness: 0.8 (reflective)
  - Roughness: 0.2 (smooth)
  - Emissive: Matching color at 0.3-0.5 intensity

Visual Features:
  - Wireframe variant for connections/structure
  - Glow sphere halo at 1.3x scale, 15% opacity
  - Idle: Slow Y rotation (8-10s per cycle)

Behaviours:
  - Hover: Emissive intensity → 2.0 (glow)
  - Click: Scale 1.0 → 1.3 (elastic), show label
```

### Column (Bar Chart)

```
Geometry: Cylinder (hex or smooth)
Height: Data-mapped (0.5 - 5.0 typical)
Radius: 0.3 - 0.6
Material:
  - Gradient possible (bottom → top)
  - Emissive top for emphasis

Visual Features:
  - Cap geometry (rounded or flat)
  - Ground shadow for depth cue
  - Adjacent columns have 0.2 spacing

Behaviours:
  - Hover: Height scale 1.0 → 1.1
  - Click: Rotate to face camera, show data label
```

### Sphere (Point/Value)

```
Geometry: UV Sphere
Radius: Data-mapped (0.3 - 1.5)
Segments: 32 (smooth)
Material:
  - Transparent possible for overlaps
  - Inner glow effect

Visual Features:
  - Orb-style lighting gradient
  - Size indicates magnitude clearly

Behaviours:
  - Hover: Scale 1.0 → 1.2 + glow
  - Drag: Reposition in space (if enabled)
```

### Trail/Connection (Edge)

```
Geometry: Cylinder or curved tube
Thickness: Relationship strength (0.1 - 0.5)
Material:
  - Transparent (30-50% opacity)
  - Emissive for active paths
  - Dashed variant for weak links

Visual Features:
  - Animated data flow (particles along curve)
  - Curvature: Slight arc instead of straight lines
  - Glow pulse on data transmission

Behaviours:
  - Hover: Highlight both connected nodes
  - Trace: Animate path traversal
```

---

## Interaction Patterns

### Cursor States

| State | Visual | Feedback |
|-------|--------|----------|
| **Default** | Dot | Tiny, non-intrusive |
| **Hover** | Ring | Expands slightly, color matches target |
| **Click** | Compress | Brief scale 0.3 → 0.5 |
| **Grabbing** | Closed | Held state for drag |

### Raycasting

- Default: 50 units distance
- Highlight: Closest intersect object
- Filtering: Only on `.clickable` class by default
- Intersection point: Used for placement feedback

### Navigation (First-Person)

```
Movement:
  - WASD: Walk/fly (configurable: walk vs fly mode)
  - Shift: Sprint (2x speed)
  - Space/C: Ascend/descend (fly mode)
  
Rotation:
  - Mouse: Look around
  - Q/E: Snap rotate 45°
  
Interactions:
  - Left click: Primary action
  - Right click: Secondary/context menu
  - Middle click + drag: Pan camera
```

### Gestures (VR Controllers)

```
Trigger (Index):
  - Point to select
  - Squeeze to grab
  - Pull to activate

Grip (Hand):
  - Grab and move artefacts
  - Scale with two hands
  - Twist to rotate

Thumbstick/Touchpad:
  - Move (forward/back/left/right)
  - Rotate (snap smooth)
  - Menu navigation

Buttons:
  - Menu: Toggle UI overlays
  - System: Quick actions (reset, home)
```

---

## Animation Standards

### Timing Functions

| Type | Easing | Use Case |
|------|--------|----------|
| **Quick** | `easeOutQuad` | Hover states, micro-interactions (200-300ms) |
| **Smooth** | `easeInOutQuad` | Transitions, position changes (300-500ms) |
| **Elastic** | `easeOutElastic` | Appearances, exciting moments (500-800ms) |
| **Linear** | `linear` | Continuous motion (rotation, orbits) |

### Standard Durations

- **Instant:** 0ms (state toggle)
- **Micro:** 150ms (color changes)
- **Quick:** 300ms (hover, small movements)
- **Normal:** 500ms (scales, reveals)
- **Slow:** 1000ms (major transitions)
- **Ambient:** ∞ (idle rotations, pulses)

---

## Layout Principles

### Viewport Zones

```
Center (Primary Focus):
  - Main data artefact
  - Current selection
  - Interactive elements

Near Field (Secondary):
  - Related data
  - Controls
  - Breadcrumbs

Mid Field (Context):
  - Adjacent nodes
  - Cluster boundaries

Far Field (Background):
  - Ambient elements
  - Environment cues
  - Fogged/muted data
```

### Spacing

- **Intimate:** 0.5 units (touching/overlapping)
- **Close:** 1-2 units (clustered data)
- **Medium:** 3-5 units (standard separation)
- **Far:** 8-15 units (scene sections)
- **Extreme:** 20+ units (different datasets)

### Scale Guidelines

- **Micro:** 0.1-0.3 units (detail elements, labels)
- **Small:** 0.5-1.0 units (data points, nodes)
- **Medium:** 1.5-3.0 units (primary artefacts)
- **Large:** 5-10 units (containers, zones)
- **Massive:** 20+ units (environmental)

---

## Responsive Considerations

### Screen Size

| Mode | Camera | UI |
|------|--------|-----|
| **Desktop (2D)** | WASD + mouse | Overlay panels |
| **Mobile** | Gyro + touch | Bottom sheet |
| **VR (Headset)** | Full spatial | Floating UI |
| **AR (Passthrough)** | World-locked | Anchored panels |

### Density Adaptations

- Low density: More spacing, larger artefacts
- High density: Smaller, clustered, aggregation
- Mobile VR: Simplified geometry, clearer UI

---

## Accessibility

### Color Blindness

- Always pair color with shape/size
- Use patterns/wireframes, not just hue
- Test with simulated protanopia/deuteranopia

### Motion Sensitivity

- Provide "reduce motion" option
- Disable idle animations
- Static fallbacks for critical info
- Smooth locomotion (no instant teleports)

### Contrast

- Minimum 4.5:1 for text
- Labels have backgrounds when needed
- Glow effects enhance visibility

---

## Design Tokens (CSS/JS)

```javascript
const NemosyneDesign = {
  colors: {
    accent: '#00d4aa',
    secondary: '#d4af37',
    alert: '#ff3864',
    purple: '#6b4ee6',
    background: '#000205',
    fog: '#000510'
  },
  
  easing: {
    quick: 'easeOutQuad',
    smooth: 'easeInOutQuad',
    elastic: 'easeOutElastic',
    linear: 'linear'
  },
  
  duration: {
    micro: 150,
    quick: 300,
    normal: 500,
    slow: 1000
  },
  
  spacing: {
    intimate: 0.5,
    close: 2,
    medium: 5,
    far: 15
  },
  
  scale: {
    micro: 0.3,
    small: 1,
    medium: 2,
    large: 5
  }
};
```

---

*Version 0.1 — Foundation*
