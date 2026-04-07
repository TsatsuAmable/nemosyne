# Getting Started with Nemosyne

This guide will walk you through creating your first VR data visualization.

## Prerequisites

- Basic knowledge of HTML
- Modern web browser (Chrome, Firefox, Edge)
- Optional: VR headset (Quest, Vive, Index, etc.)

## Installation

### Option 1: CDN (Quickest)

Add these to your HTML:

```html
<script src="https://aframe.io/releases/1.4.0/aframe.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/nemosyne@0.1.0/dist/nemosyne.min.js"></script>
```

### Option 2: npm

```bash
npm install nemosyne
```

```javascript
import 'aframe';
import 'nemosyne';
```

## Your First Visualization

### 1. Create an HTML file

```html
<!DOCTYPE html>
<html>
<head>
  <title>My First Nemosyne Vis</title>
  <script src="https://aframe.io/releases/1.4.0/aframe.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/nemosyne@0.1.0/dist/nemosyne.min.js"></script>
</head>
<body>
  <a-scene>
    <!-- Camera with cursor -->
    <a-entity position="0 1.6 4">
      <a-camera look-controls wasd-controls>
        <a-cursor color="#00d4aa"></a-cursor>
      </a-camera>
    </a-entity>
    
    <!-- Your visualization -->
    <nemosyne-artefact 
      spec-inline='<;{"id": "crystal", "geometry": {"type": "octahedron"}, "material": {"color": "#00d4aa"}}'
      data-inline='<;{"records": [{"value": 42}]}'>
    </nemosyne-artefact>
  </a-scene>
</body>
</html>
```

### 2. Open in browser

Just open the file (or serve via local server for the best experience):

```bash
npx serve
```

### 3. Navigate!

- **WASD** — Move around
- **Mouse** — Look around
- **Click** — Interact with the crystal

## Next Steps

- [Learn about Artefacts](../artefacts/)
- [Explore Examples](../examples/)
- [Read the API docs](../api/)

## Troubleshooting

### My visualization doesn't appear

- Check browser console for errors
- Ensure A-Frame loads before Nemosyne
- Try a local server (file:// URLs have security restrictions)

### Controls don't work

- Click on the scene first to focus
- WASD controls may require keyboard focus

---

*Tutorial version 0.1*
