# Getting Started with Nemosyne

Welcome! This guide will take you from zero to your first VR visualization in 5 minutes.

## Prerequisites

- A modern web browser (Chrome, Firefox, Edge)
- Basic HTML/JavaScript knowledge
- (Optional) A VR headset for full immersion

## Step 1: Installation

### Option A: CDN (Quickest)

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

```html
<a-scene>
  <!-- Camera -->
  <a-entity position="0 1.6 -5">
    <a-camera></a-camera>
  </a-entity>

  <!-- Bar Chart -->
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
3. You should see 4 green cylinders arranged in a row
4. Click and drag to look around (or use WASD keys)
5. Enter VR mode (click the VR button in bottom right)

## Step 4: Add Interactivity

Let's make the chart interactive:

```html
<a-entity nemosyne-artefact-v2="
  spec: { id: 'interactive-chart', /* ... */ };
  dataset: { records: [/* ... */] };
  transforms: [{
    property: 'height',
    $data: 'sales',
    $range: [0.5, 3]
  }];
  behaviours: [{
    trigger: 'hover',
    action: 'scale',
    params: { factor: 1.2 }
  }, {
    trigger: 'click',
    action: 'drill',
    params: { target: 'detail-view' }
  }]
"></a-entity>
```

## Next Steps

- **[Basic Concepts](Basic-Concepts)** - Learn about layouts and transforms
- **[Component Gallery](Crystal)** - Explore available visualizations
- **[Examples](Examples)** - See what others have built

## Troubleshooting

### "Nothing appears"
- Check browser console for errors
- Ensure A-Frame loaded correctly
- Verify your data format

### "Performance is slow"
- Reduce number of data points (start with < 100)
- Use simpler geometries (sphere vs complex mesh)
- Enable VR mode for better rendering

### "VR button doesn't work"
- Use HTTPS in production (WebXR requires it)
- Ensure browser supports WebXR
- Try on a different device

---

**Need help?** Join our [Discord](https://discord.gg/nemosyne) or open an issue on GitHub.