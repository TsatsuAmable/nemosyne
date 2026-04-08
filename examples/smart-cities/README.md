# Smart Cities Visualization

Real-time urban IoT data visualization across traffic, energy, population, and air quality.

## Overview

Creates a 9-zone city grid where each zone displays live metrics for urban planning and smart city management. Includes animated traffic, energy consumption, and air quality indicators.

## Data Sources

**Simulation Mode (default):**
- Generates city-wide metrics every 3 seconds
- Simulates rush hour traffic patterns
- Correlates traffic with air quality (inverse)

**Production Integration:**

**OpenAQ (Air Quality):**
```javascript
fetch('https://api.openaq.org/v2/latest?city=London')
  .then(r => r.json())
  .then(data => updateAirQuality(data.results[0]));
```

**TomTom Traffic:**
```javascript
const ws = new WebSocket('wss://traffic.tomtom.com/stream');
ws.send(JSON.stringify({ bbox: [-0.5, 51.3, 0.3, 51.6] }));
```

**Smart Meter IoT:**
```javascript
const mqtt = new Paho.MQTT.Client('mqtt.smartgrid.io', 8080);
mqtt.connect({ onSuccess: () => {
  mqtt.subscribe('city/energy/consumption');
}});
```

## Urban Metrics

| Metric | Unit | Green | Yellow | Red |
|--------|------|-------|--------|-----|
| Traffic | Congestion % | < 40% | 40-70% | > 70% |
| Energy | MW | Balanced | Peak | Overload |
| Population | People/km² | Normal | Crowded | Overflow |
| Air Quality | AQI | < 50 | 50-100 | > 100 |

## Visual Encoding

**Zone Components:**
| Element | Represents | Color | Animation |
|---------|------------|-------|-----------|
| Gold Pillar | Traffic volume | #d4af37 | Height scaling |
| Cyan Pillar | Energy consumption | #00d4aa | Height scaling |
| Blue Sphere | Population density | #3050F8 | Pulse animation |
| Ground Indicator | Air quality | Variable | Static color |

**Traffic Patterns:**
- **Rush Hour (7-9am, 5-7pm):** Vehicles speed up, density increases
- **Daytime:** Moderate flow
- **Night:** Minimal vehicles

**Time-of-Day Adjustments:**
```javascript
const hour = new Date().getHours();
const rushHour = hour >= 7 && hour <= 9 || hour >= 17 && hour <= 19;
const trafficMultiplier = rushHour ? 1.7 : 1.0;
```

## Component API

```javascript
// Create city zone
const zone = document.createElement('a-entity');
zone.setAttribute('city-zone', {
  zoneId: 'Zone-1',
  traffic: 65,
  energy: 58,
  population: 80,
  airQuality: 72
});
```

## Real-World Integrations

**Smart City Platforms:**
| Platform | Protocol | Endpoint |
|----------|----------|----------|
| Cisco Kinetic | MQTT | mqtt://smartcity.cisco.io |
| Microsoft Azure IoT | AMQP | amqps://Azure-IoT-Hub |
| AWS IoT Core | MQTT | mqtt://AWS-IoT-Endpoint |
| Google Cloud IoT | MQTT | mqtt://cloudiot.googleapis.com |

**Open Data Sources:**
- OpenAQ (Air quality): https://openaq.org/
- World Traffic Index: https://tomtom.com/traffic-index/
- Energy Data: https://openenergy.org/

## Performance

**Entity Count:**
- 9 zones × 4 metrics = 36 entities
- ~300 animated vehicles
- 500,000+ stars in background

**Update Strategy:**
- Metrics: Every 3 seconds
- Vehicles: Continuous animation
- Background: Static

**Optimization:**
```javascript
// Use object pooling for vehicles
const vehiclePool = [];
for (let i = 0; i < 300; i++) {
  vehiclePool.push(createVehicle());
}
```

## Sustainability Metrics

**Carbon Footprint Calculation:**
```javascript
const carbonEmitted = traffic * 0.12; // kg CO2 per hour
const energyRenewable = (solar + wind) / totalEnergy;
```

## License

MIT License - TsatsuAmable 2026