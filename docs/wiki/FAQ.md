# Frequently Asked Questions

> ⚠️ **RESEARCH PREVIEW**: Nemosyne is an experimental framework. Answers describe current implementation, not validated best practices.

---

## General Questions

### What is Nemosyne?

Nemosyne is an **experimental research framework** for investigating immersive data visualization in VR. We're testing whether 3D, navigable data spaces improve comprehension compared to traditional 2D charts.

**It is not**: A production-ready visualization tool, a replacement for Tableau/D3, or a validated approach.

**It is**: A platform for empirical research into spatial data encoding.

### What does "data-native" mean?

In Nemosyne's design philosophy, "data-native" means attempting to derive visual encoding from data structure rather than imposing chart types. **Note**: Whether this approach produces better visualizations is an open research question.

### Do I need a VR headset?

No. Nemosyne works in any modern web browser with mouse/keyboard. VR headsets provide immersion but we're also studying whether desktop 3D (without headset) offers any advantages.

### What browsers are supported?

- Chrome/Edge 90+ (full support)
- Firefox 88+ (full support)
- Safari 15+ (WebGL only, no VR)

WebXR (headset support) requires Chrome/Edge/Firefox with compatible hardware.

---

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

### What's the simplest visualization?

```html
<a-entity nemosyne-artefact-v2="
  spec: { id: 'demo', geometry: { type: 'sphere', radius: 0.5 } };
  dataset: { records: [{ value: 1 }, { value: 2 }] };
  layout: grid
"></a-entity>
```

This creates two spheres. Whether this is useful depends on your research question.

### Where can I see examples?

See `/examples/` directory. **Important**: These use **simulated data** to demonstrate capabilities. They show what's possible, not production implementations.

- `hello-world.html` - Basic setup (works)
- `industrial-iot/` - Simulated sensor data (not real factory)
- `financial-markets/` - Mock prices (not live trading)
- `medical-imaging/` - Sample images (not DICOM integration)

---

## Data & Formats

### What data formats are supported?

- **JSON** - Primary format
- **CSV** - Via loader
- **Arrays** - JavaScript objects
- **WebSocket** - Real-time streaming (implemented but latency impact unstudied)

### How much data can Nemosyne handle?

**Unknown**. We have not conducted systematic performance testing.

| Scale | Estimated | Confidence |
|-------|-----------|------------|
| < 100 nodes | Likely smooth | Medium |
| 100-1000 nodes | Uncertain | Low |
| > 1000 nodes | Unknown | None |

If you benchmark, please share results on GitHub Discussions.

### Can I update data in real-time?

Yes, the WebSocket implementation works:

```javascript
const stream = new NemosyneDataStream('ws://localhost:8766');
stream.on('data', (packet) => {
  scene.updateData('live-viz', packet.data);
});
```

**However**: The effect of latency on VR comprehension is unstudied. We don't know if real-time updates help or hurt understanding.

---

## Layouts & Visualizations

### Which layout should I use?

We don't know yet. Current options with **untested hypotheses**:

| Layout | Hypothesis | Status |
|--------|------------|--------|
| `grid` | Good for categories | Implemented |
| `radial` | Good for menus/cycles | Implemented |
| `timeline` | Good for chronology | Implemented |
| `spiral` | May show accumulation | Implemented |
| `tree` | May reveal hierarchies | Implemented |
| `force` | May reveal clusters | Implemented |

**Research needed**: User studies comparing 3D layouts to 2D equivalents.

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

If you develop a layout that shows promise in user testing, please share your findings.

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

**Research question**: Do color mappings need adaptation for 3D contexts (lighting, depth perception)?

---

## Performance

### Why is my visualization slow?

Common causes (unprioritized):
1. Too many data points (try < 100 for testing)
2. Complex geometries (use simple shapes)
3. No optimization (no LOD, instancing, culling implemented)

**Solutions**:
- Reduce geometry: `{ geometry: { type: 'sphere', segments: 16 } }`
- Use fewer data points for initial testing

### What's the recommended target for Quest 2?

Unknown. We have not benchmarked on Quest 2 specifically.

**Conservative guess**: < 500 nodes for smooth performance

If you test, please report:
- Node count
- FPS achieved
- Device specs

---

## Physics

### Do I need physics?

Physics is optional. It's implemented via Ammo.js but:
- Adds complexity
- Performance impact unmeasured
- Educational value for dataviz unproven

Use if your research question involves physical dynamics (e.g., "do bouncing data points aid engagement?").

### Can I use physics without Ammo.js?

The simplified `layout: 'force'` works without physics. It's pure JavaScript but may not scale to large networks.

---

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

If you create an artefact and test it with users, please publish your results.

### How do I contribute?

We welcome research contributions:

1. **User Studies**: Test Nemosyne with participants, publish findings
2. **Research Design**: Propose study methodologies
3. **Bug Fixes**: Improve the experimental platform
4. **Documentation**: Clarify experimental status

See [Contributing Guidelines](../CONTRIBUTING.md).

---

## Research Context

### Is Nemosyne better than 2D charts?

**We don't know.** That's the research question.

Current hypothesis: 3D may be better for:
- Understanding network topology
- Comprehending hierarchies
- Memory encoding (spatial context)

Likely worse for:
- Precise value comparison
- Reading labels at a distance
- Quick pattern recognition (occlusion)

### How can I help validate (or refute) Nemosyne?

1. **Design a study**: Compare 3D vs 2D for a specific task
2. **Run a pilot**: Test with colleagues/friends
3. **Share results**: Post on GitHub Discussions
4. **Collaborate**: Join ongoing research efforts

### What's the goal?

To determine **when, if ever**, 3D VR data visualization provides measurable advantages over 2D alternatives—and when it doesn't.

We're not trying to prove 3D is better. We're trying to find out if it ever is, and for what.

---

## Troubleshooting

### "Ammo is not defined"

Cause: Ammo.js not loaded before Nemosyne.

Fix:
```html
<script src="ammo.js"></script>
<script>
  Ammo().then(() => {
    // Now load Nemosyne
  });
</script>
```

### "Nothing appears in VR"

Causes:
1. HTTPS required for WebXR
2. Camera positioned incorrectly
3. Scene background not set

Fix:
```html
<a-scene background="color: #000" renderer="antialias: true">
  <a-camera position="0 1.6 0"></a-camera>
</a-scene>
```

---

## Support

### Where can I get help?

1. **[GitHub Discussions](https://github.com/TsatsuAmable/nemosyne/discussions)** - Research Q&A
2. **[GitHub Issues](https://github.com/TsatsuAmable/nemosyne/issues)** - Bug reports
3. **No Discord yet** - May create if research community grows

### Is there commercial support?

No. This is a research project, not a product.

### How do I report a bug?

Include:
1. Nemosyne version
2. Browser & version
3. VR hardware (if applicable)
4. Minimal reproduction case
5. Error messages from console

---

**Have a question not answered here?** Add it to [GitHub Discussions](https://github.com/TsatsuAmable/nemosyne/discussions) and we'll update this FAQ.

---

**Last Updated:** 2026-04-12  
**Version:** 0.2.0-research
