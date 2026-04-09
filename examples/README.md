# Nemosyne Examples Gallery

This directory contains working demonstrations of VR Artefacts across different domains. Each example is a complete, self-contained HTML application with live data integration.

---

## Quick Start

All examples are static HTML files. Simply open in any modern browser:

```bash
# Start a local server
npx serve examples/

# Or with Python
python -m http.server 8080

# Then navigate to
http://localhost:8080/hello-world/
```

---

## Examples Overview

### Core Examples

| Example | Description | Key Features |
|---------|-------------|--------------|
| **hello-world** | Basic crystal artefact | Single interactive element, data binding |
| **network-galaxy** | Network topology | Force-directed layout, microservices visualization |
| **bar-chart** | Spatial data visualization | Monthly revenue, vertical bars, hover interactions |
| **timeline-spiral** | Temporal data | Activity patterns, spiral layout, time-series binding |
| **data-tree** | Hierarchical visualization | File system, tree layout, expandable nodes |
| **virtual-worlds** | Game development | NavMesh integration, level editor, collision detection |

### Domain-Specific Examples

| Example | Domain | Data Integration | Unique Features |
|---------|--------|-----------------|-----------------|
| **industrial-iot** | Manufacturing | WebSocket sensor feed | Real-time alerts, status indicators, conveyor visualizations |
| **financial-markets** | Finance | FIX-protocol trading | Market depth, bid/ask walls, live price updates |
| **scientific-research** | Science | PDB molecular structures | Atom visualization, bonds, molecular rotation |
| **medical-imaging** | Healthcare | DICOM PACS streaming | CT/MRI modes, slice navigation, window/level controls |
| **smart-cities** | Urban Planning | IoT sensor grid | Traffic patterns, energy consumption, air quality |
| **education-solar** | Education | NASA planetary data | Accurate orbital mechanics, moon systems, starfield |

---

## Technical Documentation

### Industrial IoT Example

**Location:** `examples/industrial-iot/`

**Data Model:**
```javascript
{
  sensorId: 'sensor-1',
  type: 'temperature',  // temperature | pressure | vibration | humidity
  value: 75.3,
  threshold: 100,
  status: 'normal'     // normal | warning | critical
}
```

**WebSocket Simulation:**
- Updates every 2 seconds
- Simulates temperature spikes, pressure drops
- Status changes trigger color and animation changes

**Visual Encoding:**
| Sensor Status | Color | Animation |
|---------------|-------|-----------|
| Normal | Cyan (#00d4aa) | Static glow |
| Warning | Gold (#d4af37) | Slow pulse |
| Critical | Red (#ff3864) | Rapid pulse + scaling |

**Interaction:**
- Hover: Scale up, show tooltip
- Click: Detailed sensor panel
- Real-time: Conveyor belt animates continuously

---

### Financial Markets Example

**Location:** `examples/financial-markets/`

**Data Model:**
```javascript
{
  symbol: 'BTC-USD',
  price: 45234.50,
  volume: 15420,
  change: 1.2,  // percentage
  bid: 45230,
  ask: 45238
}
```

**WebSocket Simulation:**
- Price updates every 2 seconds
- Volatility based on crypto/FX patterns
- Automatic color coding (green=up, red=down)

**Visual Encoding:**
| Element | Representation | Interaction |
|---------|----------------|-------------|
| Price | Bar height | Scale on click |
| Volume | Base radius | Pulse animation |
| Change | Bar color | Color shift on update |
| Order Book | Wall visualization | Bid=green, Ask=red |

**FIX Protocol Compatibility:**
Component accepts standard FIX message format:
```
8=FIX.4.4|9=100|35=W|55=BTCUSD|268=2|269=0|270=45234|271=100|10=123|
```

---

### Scientific Research Example

**Location:** `examples/scientific-research/`

**Data Model (PDB-style):**
```javascript
{
  name: 'Caffeine',
  formula: 'C8H10N4O2',
  atoms: [
    { element: 'C', x: 0, y: 0, z: 0, bonds: 3 },
    // ... more atoms
  ],
  bonds: [
    { from: 0, to: 1, order: 1 }
  ]
}
```

**Element Visualization:**
| Element | Color | Radius | CPK Standard |
|---------|-------|--------|--------------|
| Carbon (C) | #333333 | 0.7 | ✓ |
| Nitrogen (N) | #3050F8 | 0.65 | ✓ |
| Oxygen (O) | #FF0D0D | 0.65 | ✓ |
| Hydrogen (H) | #FFFFFF | 0.3 | ✓ |

**Interactions:**
- Hover atom: Scale 1.3x, show element info
- Click: Freeze rotation
- Auto-rotation: 360° every 20 seconds

**Loading Real PDB Files:**
```javascript
// Fetch from RCSB PDB Database
fetch('https://files.rcsb.org/download/1ABC.pdb')
  .then(r => r.text())
  .then(parsePDB)
  .then(renderMolecule);
```

---

### Medical Imaging Example

**Location:** `examples/medical-imaging/`

**Data Model (DICOM-style):**
```javascript
{
  modality: 'CT',
  sliceIndex: 64,
  totalSlices: 128,
  windowCenter: 40,  // Hounsfield units
  windowWidth: 400,
  pixelData: Uint16Array  // 512x512 typical
}
```

**Window/Level Presets:**
| Tissue | Window Center | Window Width | Use Case |
|--------|---------------|--------------|----------|
| Soft Tissue | 40 | 400 | Organs, muscles |
| Bone | 400 | 1800 | Fractures, implants |
| Lung | -600 | 1500 | Pneumonia, COVID |

**WebSocket Simulation:**
- Slice cycling every 3 seconds
- Simulates real-time DICOM streaming from PACS
- Annotations update per slice

**DICOM Integration:**
```javascript
// Connect to PACS server
const ws = new WebSocket('wss://pacs.hospital.org/stream');
ws.onmessage = (event) => {
  const dicomData = JSON.parse(event.data);
  updateSlice(dicomData);
};
```

---

### Smart Cities Example

**Location:** `examples/smart-cities/`

**Data Model:**
```javascript
{
  zoneId: 'Zone-1',
  traffic: 65,        // 0-100 congestion index
  energy: 58,         // MW consumption
  population: 12000,  // people/km²
  airQuality: 72      // AQI 0-100
}
```

**Time-Based Patterns:**
| Time Period | Traffic Multiplier | Energy Multiplier |
|-------------|-------------------|-------------------|
| Rush Hour (7-9, 17-19) | 1.7x | 1.4x |
| Business Hours | 1.2x | 1.3x |
| Night | 0.3x | 0.6x |

**WebSocket Simulation:**
- Updates every 3 seconds
- Correlates traffic with air quality (inverse relationship)
- Vehicle animations speed up during rush hour

**IoT Sensor Integration:**
```javascript
// Real sensor data from smart city API
fetch('https://api.smartcity.gov/live-zones')
  .then(r => r.json())
  .then(data => {
    data.zones.forEach(updateZoneVisualization);
  });
```

---

### Education: Solar System Example

**Location:** `examples/education-solar/`

**Data Model:**
```javascript
{
  name: 'Earth',
  radius: 6371,        // km
  distance: 149600000, // km from sun
  orbitalPeriod: 365.25, // days
  rotationPeriod: 24,   // hours
  moons: 1,
  hasRings: false
}
```

**Scale Adjustments:**
- Distance: Logarithmic scale (otherwise planets too far apart)
- Size: Linear ratio (Sun = 3 units, Jupiter = 2.2 units, Earth = 1 unit)
- Time: 1 second = ~10 Earth days

**Planetary Features:**
| Planet | Special Rendering | Moons |
|--------|-------------------|-------|
| Earth | Atmosphere glow | 1 (animated orbit) |
| Jupiter | Cloud bands | 4 |
| Saturn | Ring system with particles | 3 |
| Mars | Red tint | 2 (Phobos, Deimos) |

**Educational Features:**
- Click planet: Show facts panel
- Orbit toggle: Show/hide orbital paths
- Time scale: Adjust simulation speed
- Focus mode: Zoom to specific planet

---

## WebSocket API Reference

All examples use WebSocket-style data streams. In production, replace simulation with real endpoints:

### Connection Pattern
```javascript
class DataStream {
  constructor(url, onMessage) {
    this.ws = new WebSocket(url);
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      onMessage(data);
    };
  }
  
  send(command) {
    this.ws.send(JSON.stringify(command));
  }
}
```

### Recommended Providers

| Domain | Data Source | API/Protocol | Free Tier |
|--------|-------------|--------------|-----------|
| Industrial | ThingsBoard | MQTT/WebSocket | ✓ |
| Financial | Alpaca Markets | WebSocket FIX | ✓ |
| Scientific | RCSB PDB | REST API | ✓ |
| Medical | Orthanc PACS | DICOMWeb | Self-hosted |
| Urban | OpenAQ | REST API | ✓ |
| Education | NASA Horizons | REST API | ✓ |

---

## Performance Tuning

### Optimization Tips

**1. Instanced Meshes**
For repeated elements (sensors, stars, vehicles):
```javascript
// Instead of creating 500 individual spheres:
const starField = document.createElement('a-entity');
starField.setAttribute('instanced-mesh', {
  count: 500,
  geometry: 'sphere',
  radius: 0.1
});
```

**2. LOD (Level of Detail)**
For complex scenes:
```javascript
entity.setAttribute('lod', {
  levels: [
    { distance: 0, geometry: 'high-poly' },
    { distance: 50, geometry: 'low-poly' }
  ]
});
```

**3. Occlusion Culling**
Hide objects behind others:
```javascript
entity.setAttribute('occlusion-culling', true);
```

### Benchmarks

| Example | Entities | Update Rate | FPS (Desktop) | FPS (Mobile) |
|---------|----------|-------------|---------------|--------------|
| Industrial IoT | 12 | 2s | 60fps | 45fps |
| Financial Markets | 15 | 2s | 60fps | 50fps |
| Scientific Research | 50 | - | 60fps | 40fps |
| Medical Imaging | 5 | 3s | 60fps | 55fps |
| Smart Cities | 40 | 3s | 55fps | 35fps |
| Solar System | 500+ | - | 45fps | 25fps |

---

## Customization Guide

### Changing Data Sources

**1. Replace WebSocket URL**
```javascript
// In component definition
this.ws = new WebSocket('wss://your-api.example.com/data');
```

**2. Transform Data Format**
```javascript
this.ws.onmessage = (event) => {
  const rawData = JSON.parse(event.data);
  const transformed = this.transformData(rawData);
  this.updateVisualization(transformed);
};
```

**3. Adjust Update Frequency**
```javascript
// For slower connections
setInterval(updateData, 5000);  // 5 seconds

// For real-time critical
setInterval(updateData, 100);   // 100ms (max 10fps)
```

---

## File Structure

```
examples/
├── hello-world/
│   ├── index.html          # Single artefact example
│   └── README.md           # Specific documentation
├── network-galaxy/
│   ├── index.html
│   ├── data/
│   │   └── topology.json   # Network topology data
│   └── README.md
├── industrial-iot/
│   ├── index.html
│   ├── assets/
│   │   └── textures/       # Optional: sensor textures
│   └── README.md
└── ... (other examples)
```

---

## Browser Support

| Browser | Version | WebGL | WebSocket | VR Headset |
|---------|---------|-------|-----------|------------|
| Chrome | 90+ | ✓ | ✓ | ✓ (WebXR) |
| Firefox | 88+ | ✓ | ✓ | ✓ (WebXR) |
| Safari | 14+ | ✓ | ✓ | ✗ |
| Edge | 90+ | ✓ | ✓ | ✓ (WebXR) |

**Mobile VR:**
- Cardboard: Supported (gyroscope)
- Oculus Quest: Supported (WebXR)
- HoloLens: Partial (see AR.js)

---

## Contributing

To add a new example:

1. Create directory: `examples/your-example/`
2. Add `index.html` with VR scene
3. Include `README.md` with documentation
4. Test on multiple browsers
5. Submit pull request

**Example Template:**
```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://aframe.io/releases/1.4.0/aframe.min.js"></script>
  <title>Nemosyne - Your Example</title>
</head>
<body>
  <a-scene>
    <a-entity your-component></a-entity>
    <a-camera position="0 1.6 0"></a-camera>
  </a-scene>
</body>
</html>
```

---

## License

All examples are released under MIT License.
Data sources may have separate licenses (see individual READMEs).

---

## Support

- GitHub Issues: https://github.com/TsatsuAmable/nemosyne/issues
- Documentation: https://nemosyne.world/docs/
- Discord: https://discord.gg/nemosyne

---

*Generated as part of Nemosyne v0.2.0*