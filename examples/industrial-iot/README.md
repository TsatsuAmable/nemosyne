# Industrial IoT Dashboard

Real-time factory floor monitoring with sensor visualizations.

## Overview

Visualizes industrial sensors (temperature, pressure, vibration, humidity) in a 3D factory environment. Each sensor displays real-time readings with color-coded status alerts.

## Data Sources

**Simulation Mode (default):**
- Generates realistic sensor data every 2 seconds
- Simulates time-of-day patterns (higher temps during production hours)
- Creates alert conditions for testing

**Production Mode:**
```javascript
// Replace with your IIoT platform
const ws = new WebSocket('wss://your-thingsboard-instance.com/ws');
```

## Sensor Types

| Sensor | Normal Range | Unit | Alert Threshold |
|--------|-------------|------|-----------------|
| Temperature | 60-90 | °C | > 100 |
| Pressure | 40-70 | PSI | > 80 |
| Vibration | 0.1-2.0 | mm/s | > 5 |
| Humidity | 30-60 | % | > 70 |

## Visual Encoding

**Status Colors:**
- **Cyan (#00d4aa)**: Normal operation
- **Gold (#d4af37)**: Warning (90% of threshold)
- **Red (#ff3864)**: Critical (> threshold), rapid pulse animation

**Scale Changes:**
- Sensor pillar height varies with reading intensity
- Critical status triggers 1.3x scale pulse

## Component API

```javascript
// Create sensor
const sensor = document.createElement('a-entity');
sensor.setAttribute('industrial-sensor', {
  sensorId: 'temp-01',
  type: 'temperature',
  value: 75,
  threshold: 100,
  status: 'normal'
});
```

## Configuration

**Conveyor Speed:**
```javascript
// Adjust in startDataStream()
setInterval(updateData, 5000); // Slower updates
```

**Alert Sensitivity:**
```javascript
// Change warning/critical thresholds
if (newValue > threshold * 0.9) newStatus = 'warning';
if (newValue > threshold) newStatus = 'critical';
```

## Integration

**ThingsBoard:**
1. Configure WebSocket endpoint
2. Map device attributes to sensor types
3. Set threshold values in device profile

**InfluxDB/Grafana:**
```javascript
// Query latest readings
fetch('http://grafana:3000/api/datasources/proxy/1/query?...')
  .then(r => r.json())
  .then(updateVisualization);
```

## Performance

- **Entities:** 12-15 per scene
- **Update Rate:** 2 seconds
- **WebSocket:** Recommended for >10 sensors

## Browser Support

- Chrome 90+ (WebGL 2.0)
- Firefox 88+
- Safari 14+ (no WebXR)

## License

MIT License - TsatsuAmable 2026