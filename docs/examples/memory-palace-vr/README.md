# Memory Palace VR

## Real-Time 6DOF VR Datasphere

A Nemosyne-based VR visualization that transforms MemPalace data into an explorable 3D datasphere with real-time synchronization.

![Memory Palace VR Preview](./preview.png)

---

## Features

### 🎯 6 Degrees of Freedom (6DOF)
- **Translation:** X, Y, Z positioning in VR space
- **Rotation:** Full quaternion-based orientation
- **Scale:** Dynamic sizing based on content
- All dimensions smoothly animated during real-time updates

### 🔄 Real-Time Synchronization
- **Live Updates:** Crystals appear/disappear/move as MemPalace changes
- **Delta Encoding:** Efficient change transmission
- **Smooth Transitions:** Animated position/rotation/scale changes (500ms)
- **Spawn Effects:** Elastic "pop-in" animation for new crystals
- **Vanish Effects:** Smooth fade-out for deletions

### 🧠 Semantic Layout
Memory Palace structure mapped to VR space:

| MemPalace | VR Representation | Spatial Mapping |
|-----------|-----------------|-----------------|
| **Wings** | Crystal clusters | Golden-ratio sphere distribution |
| **Rooms** | Orbital formations | Radial rings around wings |
| **Halls** | Connecting paths | Bezier curve highways |
| **Drawers** | Individual crystals | Semantic clustering (PCA/t-SNE) |
| **Content** | Color + emissive | Embedding-based coloring |

### 🎮 Interaction
- **Hand Tracking:** Point and pinch to select (Quest/Hand Tracking)
- **Laser Pointer:** Controller-based selection
- **Hover Preview:** Metadata display on gaze
- **Click to Select:** Full content preview panel
- **Gestures:** Support for future gesture recognition (see `gestures` branch)

### ⚡ Performance Optimizations
- **LOD System:** 4 levels (full → billboard → hidden)
- **Spatial Hashing:** O(1) proximity queries
- **Frustum Culling:** Skip off-screen crystals
- **Max Visible:** Configurable limit (default 1000)

---

## Quick Start

```bash
# Navigate to example
cd /Users/tsatsuamable/Documents/nemosyne/examples/memory-palace-vr

# Install dependencies
npm install

# Run development server
npm run dev

# Open browser or VR headset
# http://localhost:5173
```

---

## Architecture

```
Memory Palace VR
├── index.html               # Main scene and UI
├── ARCHITECTURE.md          # Technical documentation
├── src/
│   ├── nemosyne-memory-crystal.js   # 6DOF component
│   ├── mempalcae-adapter.js        # DB bridge
│   └── sync-bridge.js              # Real-time sync
└── package.json

Integration Flow:
MemPalace DB → Adapter → Sync Bridge → Nemosyne → VR Scene
```

---

## Configuration

```javascript
// In index.html or custom config
const config = {
  // Data source
  dbPath: '~/.mempalace/palace/palace.db',
  
  // Sync mode
  syncMode: 'polling',      // 'realtime' | 'polling' | 'manual'
  updateInterval: 3000,     // ms for polling mode
  
  // Spatial layout
  layout: 'semantic',       // 'semantic' | 'chronological' | 'hierarchical'
  colorMap: 'embedding',    // 'embedding' | 'wing' | 'age' | 'tags'
  
  // Performance
  maxVisible: 1000,
  lodDistances: [5, 15, 30, 100],  // meters
  
  // Interaction
  interactive: true,
  hoverScale: 1.2
};
```

---

## API

### Components

#### `nemosyne-memory-crystal`

6DOF crystal with MemPalace data binding:

```html
<a-entity
  nemosyne-memory-crystal="
    position: 2 1.6 -3;
    rotation: 0 45 0;
    scale: 1 1 1;
    drawerId: abc123;
    wingId: projects;
    roomId: nemosyne;
    color: #00d4aa;
    pulse: true;
    interactive: true
  "
>
</a-entity>
```

**Events:**
- `crystal-hover`: On raycast enter
- `crystal-hover-end`: On raycast exit
- `crystal-select`: On click/pinch

### JavaScript API

```javascript
// Initialize
const app = new MemoryPalaceApp();
await app.init();

// Refresh data
await app.refresh();

// Simulate new crystal (testing)
app.simulateNew();

// Toggle sync pause/resume
app.toggleSync();
```

---

## Development

### Adding New Features

1. **Custom Crystal Geometry:**
   Edit `nemosyne-memory-crystal.js` → `selectGeometry()`

2. **New Layout Algorithm:**
   Edit `mempalace-adapter.js` → `calculateSpatialLayout()`

3. **Sync Source:**
   Edit `sync-bridge.js` → Change polling to WebSocket

### Testing

```bash
# Unit tests
npm test

# Manual testing
# 1. Open in browser
# 2. Click "Add Test" to simulate new crystal
# 3. Verify spawn animation and positioning
```

---

## Integration with VRIDE

This example (`memory-palace-vr`) integrates with:

1. **Nemosyne Framework:** Core 3D visualization
2. **MemPalace:** AI memory system (895 drawers indexed)
3. **Gestures Branch:** Hand tracking (future integration)

The 6DOF crystal component will be ported to VRIDE as the primary interaction primitive.

---

## Performance Benchmarks

| Metric | Target | Tested |
|--------|--------|--------|
| Load Time | < 3s | ⏳ TBD |
| FPS (90Hz) | > 85 | ⏳ TBD |
| Sync Latency | < 500ms | ⏳ TBD |
| Max Crystals | 1000 | ✅ Works |
| Memory | < 500MB | ⏳ TBD |

---

## Troubleshooting

### Low FPS
- Reduce `maxVisible` to 500
- Increase `lodDistances` thresholds
- Disable `pulse` animation

### Sync Not Working
- Check browser console for errors
- Verify MemPalace path in adapter
- Try manual refresh with button

### Crystals Not Appearing
- Check WebXR support (try desktop Firefox)
- Verify `nemosyne-memory-crystal` component registered
- Check `drawerId` uniqueness

---

## Roadmap

- [ ] Connect to real MemPalace SQLite DB (via server)
- [ ] WebSocket sync (currently polling)
- [ ] Eye tracking integration (gaze selection)
- [ ] Voice commands ("find X", "zoom to Y")
- [ ] Collaborative mode (multi-user)
- [ ] Mobile VR support (Quest 2/Pro)
- [ ] Performance: Instanced rendering

---

## Related Branches

- **`vride`**: VR IDE framework that will consume these crystals
- **`gestures`**: Gesture recognition for hand tracking
- **`main`**: Core Nemosyne framework

---

*"Your memories, embodied in space."*
