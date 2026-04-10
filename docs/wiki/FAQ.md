# Frequently Asked Questions

## General Questions

### What is Nemosyne?

Nemosyne is a **data-native VR visualization framework** that transforms data into immersive 3D experiences. Unlike traditional tools that force data into charts, Nemosyne lets data shape the scene, enabling you to walk through your data in VR.

### What does "data-native" mean?

Traditional visualization tools require you to reshape data to fit charts (pivot tables, aggregations, etc.). Nemosyne reads your data's intrinsic structure and automatically creates the optimal visualization. You provide data, Nemosyne handles the rest.

### Do I need a VR headset?

No. Nemosyne works in any modern web browser with mouse/keyboard controls. However, a VR headset (Quest, Vive, etc.) provides the full immersive experience.

### What browsers are supported?

- Chrome/Edge 90+
- Firefox 88+
- Safari 15+ (WebGL 2.0)

WebXR (VR mode) requires Chrome/Edge or Firefox with compatible hardware.

## Getting Started

### How do I install Nemosyne?

**CDN (easiest):**

```html
<script src="https://cdn.jsdelivr.net/npm/nemosyne@latest/dist/nemosyne.min.js"></script>
```

**NPM:**

```bash
npm install nemosyne
```

### What's the simplest visualization I can create?

```html
<a-entity nemosyne-artefact-v2="
  spec: { id: 'demo', geometry: { type: 'sphere', radius: 0.5 } };
  dataset: { records: [{ value: 1 }, { value: 2 }] };
  layout: grid
"></a-entity>
```

This creates two spheres in a basic grid layout.

### Where can I see examples?

Check the `/examples/` directory in the repository. Key demos:
- `hello-world.html` - Basic setup
- `nemorooms-demo.html` - Multi-room navigation
- `memory-palace-vr.html` - Full VR experience
- `physics-explosion-demo.html` - Physics simulation

## Data & Formats

### What data formats are supported?

- **JSON** - Primary format
- **CSV** - Via loader
- **WebSocket** - Real-time streaming
- **Direct arrays** - JavaScript objects

### How much data can Nemosyne handle?

| Metric | Performance |
|--------|-------------|
| **Nodes** | 10,000+ @ 60fps |
| **Memory** | ~300MB for 10k nodes |
| **Load Time** | ~2s for 5k nodes |
| **Physics** | 1,000+ dynamic bodies |

### Can I update data in real-time?

Yes. Use `scene.updateData(id, newData)` or WebSocket streaming:

```javascript
const stream = new NemosyneDataStream('ws://localhost:8766');
stream.on('data', (packet) => {
  scene.updateData('live-viz', packet.data);
});
```

## Layouts & Visualizations

### Which layout should I use?

| Data Type | Recommended Layout |
|-----------|-------------------|
| Categories | `grid` or `radial` |
| Time series | `timeline` or `spiral` |
| Networks | `force` or `graph-force` |
| Hierarchies | `tree` |
| Geographic | `geo-globe` |
| Scatter | `scatter` |

See [Layout Algorithms](Layout-Algorithms) for details.

### Can I create custom layouts?

Yes:

```javascript
Nemosyne.registerLayout('my-layout', {
  calculate: (records, options) => {
    return records.map((r, i) => ({
      x: i * options.spacing,
      y: r.value * options.scale,
      z: 0
    }));
  }
});
```

### How do I map data to colors?

```javascript
{
  transforms: [{
    property: 'color',
    $data: 'category',
    $map: 'category10'  // D3 color scale
  }]
}
```

Or for continuous values:

```javascript
{
  transforms: [{
    property: 'color',
    $data: 'value',
    $range: ['#00d4aa', '#ff6b6b']  // Gradient
  }]
}
```

## Performance

### Why is my visualization slow?

**Common causes:**
1. Too many data points (>10,000)
2. Complex geometries (use spheres instead of detailed meshes)
3. No sleep/wake optimization (physics)
4. Memory leaks (not disposing objects)

**Solutions:**

```javascript
// Reduce geometry complexity
{ geometry: { type: 'sphere', segments: 16 } } // Instead of 64

// Enable physics sleep
body.setSleepingThresholds(0.1, 0.1);

// Dispose properly
artefact.destroy();
```

### How do I optimize for mobile VR?

- Use instanced meshes for repeated geometries
- Reduce texture sizes
- Simplify collision shapes
- Disable shadows
- Use LOD (Level of Detail)

### What's the recommended target for Quest 2?

- **Nodes:** < 5,000 for smooth performance
- **Draw calls:** < 50
- **Textures:** < 10MB total
- **Physics:** < 500 bodies

## Physics

### Do I need physics?

Only if you want:
- Collision detection
- Realistic dynamics
- Force-directed layouts at scale (10k+ nodes)
- Interactive dragging with momentum

### How do I enable physics?

```html
<script src="https://cdn.jsdelivr.net/npm/ammo.js@0.0.10/ammo.js"></script>
<script src="src/physics/AmmoPhysicsEngine.js"></script>
```

Then use the physics-enabled component:

```html
<a-entity nemosyne-graph-force="
  nodes: [...];
  edges: [...];
  chargeStrength: -50;
"></a-entity>
```

### Can I use physics without Ammo.js?

Nemosyne includes a simplified force-directed layout without physics:

```javascript
{ layout: 'force' }  // Pure JavaScript, no WASM
```

But for collisions and realistic dynamics, Ammo.js is required.

## Custom Development

### How do I create a custom artefact?

```javascript
class MyArtefact extends Nemosyne.Artefact {
  createMesh() {
    const geometry = new THREE.IcosahedronGeometry(1, 2);
    const material = new THREE.MeshStandardMaterial({ color: 0x00d4aa });
    return new THREE.Mesh(geometry, material);
  }
}

Nemosyne.registerArtefact('my-custom', MyArtefact);
```

### How do I contribute?

See [Contributing Guidelines](Contributing-Guidelines). Quick steps:

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Submit a pull request

### What's the code style?

- **Linting:** ESLint with custom config
- **Formatting:** Prettier
- **Testing:** All features need tests
- **Documentation:** Update docs with API changes

## Troubleshooting

### "Ammo is not defined"

**Cause:** Ammo.js not loaded before Nemosyne.

**Fix:**

```html
<!-- Load Ammo FIRST -->
<script src="ammo.js"></script>
<script>
  // Wait for WASM
  Ammo().then(() => {
    // Now load Nemosyne
  });
</script>
```

### Bodies not moving

**Cause:** Body is asleep or kinematic.

**Fix:**

```javascript
body.activate();  // Wake up
// Or check if kinematic:
const isKinematic = body.getCollisionFlags() & Ammo.btCollisionObject.CF_KINEMATIC_OBJECT;
```

### "Nothing appears in VR"

**Causes:**
1. HTTPS required for WebXR
2. Camera positioned incorrectly
3. Scene background/sky not set

**Fix:**

```html
<a-scene background="color: #000" renderer="antialias: true">
  <a-camera position="0 1.6 0"></a-camera>
</a-scene>
```

### Memory leaks

**Proper cleanup:**

```javascript
// Remove artefact
scene.removeArtefact(id);

// Destroy physics
physics.destroy();

// Clear containers
container.innerHTML = '';
```

## Support

### Where can I get help?

1. **[Discord](https://discord.gg/nemosyne)** - Community chat
2. **[GitHub Issues](https://github.com/TsatsuAmable/nemosyne/issues)** - Bug reports
3. **[GitHub Discussions](https://github.com/TsatsuAmable/nemosyne/discussions)** - Q&A
4. **Stack Overflow** - Tag with `nemosyne`

### Is there commercial support?

Coming in v1.0. For now:
- Enterprise consulting via Discord
- Sponsored development available
- Training workshops (request via email)

### How do I report a bug?

Include:
1. Nemosyne version
2. Browser & version
3. VR hardware (if applicable)
4. Minimal reproduction case
5. Error messages from console

---

**Have a question not answered here?** Add it to the [GitHub Discussions](https://github.com/TsatsuAmable/nemosyne/discussions) and we'll update this FAQ.