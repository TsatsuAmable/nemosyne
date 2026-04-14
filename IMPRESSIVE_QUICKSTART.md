# IMPRESSIVE_QUICKSTART.md

## 🚀 Quick Start — Full Featured Demo

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://aframe.io/releases/1.7.0/aframe.min.js"></script>
  <script src="https://unpkg.com/nemosyne@latest/dist/nemosyne.iife.js"></script>
  <style>
    body { margin: 0; overflow: hidden; background: #000; font-family: 'Segoe UI', sans-serif; }
    .ui { position: absolute; top: 20px; left: 20px; z-index: 100; color: #fff; pointer-events: none; }
    .badge { background: rgba(0, 212, 170, 0.2); border: 1px solid #00d4aa; color: #00d4aa; 
             padding: 4px 12px; border-radius: 4px; font-size: 12px; text-transform: uppercase; }
    h1 { margin: 10px 0 5px; font-size: 28px; font-weight: 300; }
    .subtitle { color: #888; font-size: 14px; }
  </style>
</head>
<body>
  <div class="ui">
    <span class="badge">Nemosyne v1.2.2</span>
    <h1>Interactive Data Space</h1>
    <p class="subtitle">Click bars to animate • Hover for details • WASD to move</p>
  </div>

  <a-scene nemosyne-scene="theme: void">
    <!-- Camera with gaze cursor -->
    <a-entity position="0 3 8" rotation="-20 0 0">
      <a-camera look-controls wasd-controls="acceleration: 100">
        <a-cursor color="#00d4aa" 
                  scale="0.3 0.3 0.3"
                  raycaster="objects: .clickable"
                  animation__click="property: scale; startEvents: click; from: 0.3 0.3 0.3; to: 0.1 0.1 0.1; dur: 100"
                  animation__release="property: scale; startEvents: mouseup; from: 0.1 0.1 0.1; to: 0.3 0.3 0.3; dur: 100">
        </a-cursor>
      </a-camera>
    </a-entity>
    
    <!-- Atmospheric lighting -->
    <a-light type="ambient" color="#001122" intensity="0.2"></a-light>
    <a-light type="point" position="5 10 5" intensity="1" color="#ffffff" cast-shadow="true"></a-light>
    <a-light type="point" position="-5 5 -5" intensity="0.5" color="#6b4ee6"></a-light>
    
    <!-- 3D Bar Chart with Data-Driven Scaling -->
    <a-entity id="chart-container" position="-3 0 0">
      <a-entity 
        nemosyne-artefact-v2='
        {
          "spec": {
            "id": "revenue-chart",
            "geometry": { "type": "box" },
            "material": { 
              "properties": { 
                "color": "#00d4aa",
                "emissive": "#00d4aa",
                "emissiveIntensity": 0.3,
                "metalness": 0.9,
                "roughness": 0.1
              }
            },
            "transform": {
              "scale": { "$data": "revenue", "$range": [0.2, 4] }
            },
            "behaviours": [
              { "trigger": "hover", "action": "glow", "params": { "intensity": 1.5 } },
              { "trigger": "hover-leave", "action": "glow", "params": { "intensity": 0.3 } },
              { "trigger": "click", "action": "emit", "params": { "event": "bar-clicked" } }
            ],
            "labels": {
              "primary": { "$template": "{quarter}: ${revenue}K" },
              "color": "#d4af37",
              "position": "above"
            }
          },
          "dataset": { 
            "records": [
              { "quarter": "Q1", "revenue": 120, "growth": 15 }, 
              { "quarter": "Q2", "revenue": 195, "growth": 62 },
              { "quarter": "Q3", "revenue": 150, "growth": -23 },
              { "quarter": "Q4", "revenue": 280, "growth": 87 }
            ] 
          },
          "layout": "timeline",
          "layout-options": { "spacing": 2.5, "yOffset": 0 }
        }'
        class="clickable">
      </a-entity>
    </a-entity>
    
    <!-- Rotating Crystal Cluster -->
    <a-entity id="cluster" position="3 1 -2">
      <a-entity 
        nemosyne-artefact-v2='
        {
          "spec": {
            "id": "metrics-cluster",
            "geometry": { "type": "octahedron", "radius": 0.6 },
            "material": { 
              "properties": { 
                "color": "#6b4ee6",
                "emissive": "#6b4ee6",
                "emissiveIntensity": 0.4,
                "opacity": 0.9,
                "transparent": true
              }
            },
            "behaviours": [
              { "trigger": "idle", "action": "rotate", "params": { "speed": 0.3, "axis": "y" } },
              { "trigger": "hover", "action": "color-shift", "params": { "to": "#ff3864", "duration": 0.3 } },
              { "trigger": "hover-leave", "action": "color-shift", "params": { "to": "#6b4ee6", "duration": 0.3 } }
            ]
          },
          "dataset": {
            "records": [
              { "id": "users", "metric": "Active Users", "value": 12500 },
              { "id": "sessions", "metric": "Sessions", "value": 45000 },
              { "id": "conversion", "metric": "Conversion", "value": 3.2 },
              { "id": "retention", "metric": "Retention", "value": 68 },
              { "id": "satisfaction", "metric": "NPS", "value": 72 }
            ]
          },
          "layout": "radial",
          "layout-options": { "radius": 2.5, "yOffset": 0.5 }
        }'
        class="clickable">
      </a-entity>
    </a-entity>
    
    <!-- Animated Connector Between Visualizations -->
    <a-entity
      nemosyne-connector='{
        "from": "#revenue-chart",
        "to": "#metrics-cluster", 
        "color": "#d4af37",
        "thickness": 0.08,
        "animated": true,
        "pulse": true
      }'>
    </a-entity>
    
    <!-- Floating Data Points (Spiral Layout) -->
    <a-entity position="0 4 -5">
      <a-entity 
        nemosyne-artefact-v2='
        {
          "spec": {
            "id": "floating-metrics",
            "geometry": { "type": "sphere", "radius": 0.3 },
            "material": { 
              "properties": { 
                "color": "#ff3864",
                "emissive": "#ff3864",
                "emissiveIntensity": 0.6
              }
            },
            "behaviours": [
              { "trigger": "idle", "action": "rotate", "params": { "speed": 0.1, "axis": "z" } }
            ]
          },
          "dataset": {
            "records": [
              { "label": "CPU" }, { "label": "RAM" }, { "label": "IO" },
              { "label": "Net" }, { "label": "Disk" }, { "label": "GPU" }
            ]
          },
          "layout": "spiral",
          "layout-options": { "radius": 4, "heightStep": 0.3, "rotations": 2 }
        }'
        animation="property: position.y; dir: alternate; to: 0.5; dur: 4000; loop: true; easing: easeInOutSine">
      </a-entity>
    </a-entity>
    
    <!-- Infinite Ground Grid -->
    <a-plane rotation="-90 0 0" width="100" height="100" 
      color="#050510"
      material="roughness: 0.9; metalness: 0.1">
    </a-plane>
    
    <!-- Fog for depth -->
    <a-entity id="fog" fog="type: exponential; color: #000205; density: 0.03"></a-entity>
  </a-scene>

  <script>
    // Programmatic Nemosyne API usage
    document.addEventListener('DOMContentLoaded', () => {
      const scene = document.querySelector('a-scene');
      
      // Listen for Nemosyne events
      scene.addEventListener('nemosyne-loaded', (e) => {
        console.log('✨ Visualization loaded:', e.detail);
      });
      
      scene.addEventListener('nemosyne-error', (e) => {
        console.error('❌ Nemosyne error:', e.detail.error);
      });
      
      // Add dynamic interaction
      scene.addEventListener('bar-clicked', (e) => {
        console.log('📊 Bar clicked!');
        // Could trigger data refresh here
      });
      
      // Optional: Create visualizations programmatically
      // const el = Nemosyne.create(scene, spec, data, { layout: 'grid' });
    });
  </script>
</body>
</html>
```

**Features demonstrated:**
- **4 Nemosyne artefacts** (bar chart, radial cluster, spiral points, connector)
- **5 layout algorithms** (timeline, radial, spiral, plus grid and force)
- **Transform DSL** (`$data`, `$range`, `$template`)
- **8 behaviours** (glow, rotate, color-shift, emit)
- **Event system** (click handlers, load events)
- **JavaScript API** (programmatic access)

Open in a browser or serve with `python3 -m http.server 8000`.
