# Hyperion-Cantos Themed Artefacts

A collection of VR data visualization artefacts inspired by Dan Simmons' Hyperion Cantos tetralogy.

**Version:** 0.2.0  
**Theme Pack:** hyperion-cantos  
**Author:** Nemosyne Framework

---

## Artefacts

### 1. `nemosyne-shrike.js` - "The Lord of Pain"

**Inspiration:** The Shrike - a mysterious entity of metal and thorns that exists outside of time

**Purpose:** Temporal data entity representing events or processes that transcend normal time

**Features:**
- Multi-blade geometric structure with 6-12 rotating blades
- Rotating gear mechanisms (timekeeping metaphor)
- Temporal glitch/teleport effects
- Emissive thorns that pulse warning signals
- Scale based on temporal proximity

**Key Attributes:**
| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `bladeCount` | number | 6 | Number of blade projections |
| `bladeLength` | number | 2.0 | Length of blades |
| `enableGlitch` | boolean | true | Temporal displacement effect |
| `glitchInterval` | number | 5000 | ms between glitches |
| `intensity` | number | 0.5 | Entity power level |

**Usage:**
```html
<a-entity nemosyne-shrike="
  data: { timestamp: 123456789, intensity: 0.8 };
  bladeCount: 6;
  enableGlitch: true
"></a-entity>
```

**Size:** ~10KB | **Lines:** ~350

---

### 2. `nemosyne-time-tomb.js` - "Time Tombs of the Future"

**Inspiration:** The Time Tombs - mysterious structures built in humanity's future that exist in temporal stasis

**Purpose:** Sealed data containers with countdown to reveal

**Features:**
- Hexagonal chamber structure
- Countdown timer display
- Encrypted data visualization (noise/distortion)
- Temporal lock effects
- Revelation animation on unlock
- Warning indicators for approaching unlock

**Key Attributes:**
| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `targetTime` | number | Date.now() + 1hr | Unix timestamp to unlock |
| `showCountdown` | boolean | true | Display countdown timer |
| `warningThreshold` | number | 60000 | Warning when < 1 min |
| `revealOnUnlock` | boolean | true | Animate on unlock |

**Usage:**
```html
<a-entity nemosyne-time-tomb="
  targetTime: 1735689600000;
  encryptedData: { value: 42, secret: 'hidden' };
  showCountdown: true
"></a-entity>
```

**Size:** ~12KB | **Lines:** ~400

---

### 3. `nemosyne-farcaster.js` - "Through the Singularity"

**Inspiration:** Farcasters - devices enabling instantaneous transport across vast distances

**Purpose:** Data portal representing transfer or connection

**Features:**
- Circular portal with energy field
- Particle stream effects (data in transit)
- Portal opening/closing animations
- Energy pulse effects
- Destination visualization

**Key Attributes:**
| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `destination` | vec3 | {0,0,0} | Portal exit coordinates |
| `active` | boolean | false | Portal open state |
| `streamCount` | number | 30 | Number of data streams |
| `streamSpeed` | number | 2.0 | Travel time (seconds) |

**Usage:**
```html
<a-entity nemosyne-farcaster="
  destination: { x: 10, y: 0, z: 10 };
  active: true;
  streamCount: 50
"></a-entity>
```

**Size:** ~12KB | **Lines:** ~400

---

### 4. `nemosyne-templar-tree.js` - "The Tree of Pain"

**Inspiration:** The Tree of Pain - massive iron tree where the Shrike impales victims

**Purpose:** Hierarchical data tree with organic branching

**Features:**
- Branching hierarchical structure
- Synchronized pulsing effects
- Seasonal color changes
- Pain/pressure indicators
- Organic metal texture

**Key Attributes:**
| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `levels` | number | 4 | Tree depth |
| `branchesPerLevel` | number | 3 | Branches per node |
| `levelHeight` | number | 1.5 | Vertical spacing |
| `spreadAngle` | number | 45 | Branch spread |

**Usage:**
```html
<a-entity nemosyne-templar-tree="
  data: { hierarchy: [...] };
  levels: 5;
  spreadAngle: 60
"></a-entity>
```

**Size:** ~9KB | **Lines:** ~300

---

### 5. `nemosyne-memory-crystal.js` - "Mnemosyne Preserves"

**Inspiration:** Mnemosyne - Titaness of memory, mother of the Muses

**Purpose:** Crystalline data storage with internal playback

**Features:**
- Crystal lattice geometry with internal refraction
- Memory playback visualization
- Refractive material effects
- Data density through crystal clarity
- Retrieval shimmer effects

**Key Attributes:**
| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `crystalType` | string | 'octahedron' | 'octahedron' \| 'diamond' \| 'quartz' |
| `quality` | number | 1.0 | Data integrity (0-1) |
| `enablePlayback` | boolean | true | Animate through memories |
| `playbackSpeed` | number | 2000 | ms per memory state |

**Usage:**
```html
<a-entity nemosyne-memory-crystal="
  data: { memories: [...], quality: 0.85 };
  crystalType: 'diamond';
  enablePlayback: true
"></a-entity>
```

**Size:** ~12KB | **Lines:** ~400

---

## Installation

Include the artefacts in your scene:

```html
<!-- Load after Nemosyne core -->
<script src="src/artefacts/hyperion/nemosyne-shrike.js"></script>
<script src="src/artefacts/hyperion/nemosyne-time-tomb.js"></script>
<script src="src/artefacts/hyperion/nemosyne-farcaster.js"></script>
<script src="src/artefacts/hyperion/nemosyne-templar-tree.js"></script>
<script src="src/artefacts/hyperion/nemosyne-memory-crystal.js"></script>
```

Or use the bundle:

```html
<script src="dist/nemosyne-hyperion.js"></script>
```

---

## Integration Example

```html
<a-scene>
  <!-- Shrike entity watching over data -->
  <a-entity nemosyne-shrike="
    data: { timestamp: Date.now(), intensity: 0.8 };
    position: 5 2 5
  "></a-entity>
  
  <!-- Time tomb holding future data -->
  <a-entity nemosyne-time-tomb="
    targetTime: 1704067200000;
    showCountdown: true;
    position: 0 1.5 0
  "></a-entity>
  
  <!-- Active Farcaster portal -->
  <a-entity nemosyne-farcaster="
    active: true;
    destination: { x: 10, y: 0, z: -10 }
  "></a-entity>
  
  <!-- Memory crystal storing critical data -->
  <a-entity nemosyne-memory-crystal="
    data: { memories: [...], quality: 0.95 };
    enablePlayback: true
  "></a-entity>
  
  <!-- Templar Tree showing hierarchy -->
  <a-entity nemosyne-templar-tree="
    data: { hierarchy: orgData };
    levels: 4
  "></a-entity>
</a-scene>
```

---

## Thematic Consistency

These artefacts maintain thematic consistency with Hyperion Cantos:

| Theme | Artefacts | Manifestation |
|-------|-----------|-------------|
| **Time Manipulation** | Shrike, Time Tomb | Temporal displacement, countdown |
| **Instantaneous Travel** | Farcaster | Portal mechanics, teleportation |
| **Pain & Sacrifice** | Templar Tree | Dark aesthetic, pressure indicators |
| **Memory & Identity** | Memory Crystal | Data preservation, playback |
| **The TechnoCore** | All | Metal/crystal aesthetics, AI-like presence |

---

## Total Package

| Metric | Value |
|--------|-------|
| Files | 5 |
| Total Lines | ~1,850 |
| Total Size | ~55KB |
| Dependencies | A-Frame, Three.js (via Nemosyne) |

---

**Quote:** *"In the end, all things must pass. All things... except the data."* - adapted from Hyperion