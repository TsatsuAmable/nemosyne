# Getting Started with Nemosyne (Experimental)

> ⚠️ **RESEARCH PREVIEW**: Nemosyne is an experimental framework. Features work but may not produce useful visualizations. We're validating whether 3D improves data comprehension.

This guide will help you set up Nemosyne and create your first 3D visualization. Expect rough edges—this is research code, not production software.

## Prerequisites

- A modern web browser (Chrome 90+, Firefox 88+, Edge 90+)
- Basic HTML/JavaScript knowledge
- (Optional) A VR headset for full immersion

## Step 1: Installation

### Option A: CDN (Simplest)

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://aframe.io/releases/1.7.0/aframe.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/nemosyne@latest/dist/nemosyne.min.js"></script>
</head>
<body>
  <a-scene>
    <!-- Your visualization here -->
  </a-scene>
</body>
</html>
```

### Option B: NPM

```bash
npm install nemosyne aframe
```

```javascript
import 'aframe';
import 'nemosyne';
```

## Step 2: Create Your First Visualization

Here's a basic 3D bar chart. **Note**: Whether this is better than a 2D chart is exactly what we're researching.

```html
<a-scene>
  <!-- Camera -->
  <a-entity position="0 1.6 -5">
    <a-camera></a-camera>
  </a-entity>

  <!-- 3D Bar Chart (Experimental) -->
  <a-entity position="0 0 -3">
    <a-entity nemosyne-artefact-v2="
      spec: {
        id: 'sales-chart',
        geometry: { type: 'cylinder', radius: 0.3, height: 2 },
        material: { properties: { color: '#00d4aa' } }
      };
      dataset: {
        records: [
          { month: 'Jan', sales: 100 },
          { month: 'Feb', sales: 150 },
          { month: 'Mar', sales: 120 },
          { month: 'Apr', sales: 200 }
        ]
      };
      layout: grid;
      layout-options: { columns: 4, spacing: 2 }
    "></a-entity>
  </a-entity>
</a-scene>
```

## Step 3: View Your Visualization

1. Save the file as `index.html`
2. Open it in your browser
3. You should see 4 cylinders arranged in a row
4. Click and drag to look around (or use WASD keys)
5. (Optional) Enter VR mode (click the VR button in bottom right)

## Step 4: Add Interactivity (Advanced)

⚠️ Behaviours are implemented but their effectiveness is untested.

```html
<a-entity nemosyne-artefact-v2="
  spec: { id: 'interactive-chart', geometry: { type: 'cylinder', radius: 0.3 } };
  dataset: { records: [{ sales: 100 }, { sales: 150 }] };
  transforms: [{
    property: 'height',
    $data: 'sales',
    $range: [0.5, 3]
  }];
  behaviours: [{
    trigger: 'hover',
    action: 'scale',
    params: { factor: 1.2 }
  }]
"></a-entity>
```

## Current Limitations

| Feature | Status | Notes |
|---------|--------|-------|
| Basic rendering | ✅ Works | 3D scene displays |
| Layouts | ✅ Work | But efficacy untested |
| Large datasets (>1000 nodes) | 🚧 Unknown | No performance benchmarks |
| Topology auto-detection | ⚠️ Heuristic | Accuracy unknown |
| Real-time data | ✅ Works | But no latency studies |

## Next Steps

### For Research Contributors
- **[Research Agenda](../RESEARCH_AGENDA.md)** - See what we're investigating
- **[GitHub Discussions](https://github.com/TsatsuAmable/nemosyne/discussions)** - Join the research forum

### For Developers
- **[Examples](../../examples/)** - Visual prototypes (simulated data)
- **[Architecture](../ARCHITECTURE.md)** - System design (may change)

## Troubleshooting

### "Nothing appears"
- Check browser console for errors
- Ensure A-Frame loaded correctly (check Network tab)
- Verify your data format is valid JSON

### "Performance is slow"
- Reduce data points (start with < 50 for testing)
- Use simpler geometries (`sphere` vs custom meshes)
- Check browser's GPU acceleration is enabled

### "VR button doesn't work"
- Use HTTPS in production (WebXR requires secure context)
- Ensure browser supports WebXR (Chrome/Edge/Firefox)
- Verify VR headset is properly connected

### "Behaviours don't respond"
- Currently implemented: `hover`, `click`
- Ensure entities have proper colliders
- Check browser console for A-Frame component errors

## Research Context

Nemosyne is not trying to replace 2D charts. We're asking: **for which tasks, if any, does 3D VR improve comprehension?**

Current hypothesis: 3D advantages may emerge for:
- Topology-reading (finding bridges between clusters)
- Hierarchy understanding (seeing levels at once)
- Memory encoding (spatial context aids recall)

NOT for:
- Precise value comparisons (hard to read in 3D)
- Large-scale trends (occlusion problems)

**Help us find out:** If you test Nemosyne, share your findings on [GitHub Discussions](https://github.com/TsatsuAmable/nemosyne/discussions).

---

**Last Updated:** 2026-04-12  
**Version:** 0.2.0-research
