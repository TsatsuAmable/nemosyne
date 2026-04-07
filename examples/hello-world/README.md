# Hello World — Nemosyne's First Artefact

> The simplest possible data visualization in VR.

## What It Does

This example creates a single crystalline node representing one data point:
- **Value:** 42
- **Label:** "Hello World"
- **Interaction:** Hover to see it glow, click to reveal details

## Files

- `index.html` — The VR scene
- `artefact.json` — Artefact specification
- `data.json` — The data being visualized

## Running

```bash
# From this directory
python3 -m http.server 8000
```

Open http://localhost:8000

## The Code

### Data (`data.json`)
```json
{
  "dataset": "hello-world",
  "records": [
    {
      "id": "hw-001",
      "value": 42,
      "label": "Hello World",
      "category": "demo",
      "confidence": 0.95
    }
  ]
}
```

### Artefact Specification (`artefact.json`)
```json
{
  "id": "hello-crystal",
  "topology": "scalar",
  "primitive": "crystal",
  "geometry": {
    "type": "octahedron",
    "radius": 1
  },
  "material": {
    "color": "#00d4aa",
    "emissive": "#00d4aa",
    "emissiveIntensity": 0.5
  },
  "transform": {
    "scale": { "$data": "value", "$range": [0.5, 2] }
  },
  "behaviours": [
    {
      "trigger": "hover",
      "action": "glow",
      "params": { "intensity": 2 }
    },
    {
      "trigger": "click",
      "action": "show-label",
      "params": {
        "content": { "$data": "label" },
        "position": "above"
      }
    }
  ]
}
```

### Scene (`index.html` minimal version)
```html
<!DOCTYPE html>
<html>
<head>
  <title>Nemosyne — Hello World</title>
  <script src="https://aframe.io/releases/1.4.0/aframe.min.js"></script>
  <script src="../../framework/dist/nemosyne.js"></script>
</head>
<body>
  <a-scene>
    <!-- Camera -->
    <a-entity position="0 1.6 4">
      <a-camera>
        <a-cursor color="#00d4aa"></a-cursor>
      </a-camera>
    </a-entity>
    
    <!-- Lighting -->
    <a-light type="ambient" color="#222"></a-light>
    <a-light type="point" position="2 4 4" color="#fff"></a-light>
    
    <!-- Nemosyne Visualization -->
    <nemosyne-artefact 
      src="artefact.json"
      data="data.json"
      position="0 1.5 0">
    </nemosyne-artefact>
    
    <!-- Ground -->
    <a-plane rotation="-90 0 0" width="10" height="10" color="#0a0a0f"></a-plane>
  </a-scene>
</body>
</html>
```

## What You'll See

1. A glowing teal octahedron floating in front of you
2. It slowly rotates
3. Hovering over it makes it glow brighter
4. Clicking it shows "Hello World" above the crystal

## Extending It

Try these modifications:

1. **Multiple values:** Add more records to `data.json`
2. **Color mapping:** Map category to color
3. **Animation:** Make it pulse instead of rotate
4. **Sound:** Add audio feedback on click

## Next Steps

Once you understand Hello World, try:
- [Network Galaxy](../network-galaxy/) — Multiple connected nodes
- [Timeline River](../timeline-river/) — Time-series data

---

*The gateway to Nemosyne.*
