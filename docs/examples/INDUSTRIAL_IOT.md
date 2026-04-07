# Industrial IoT Example

Real-time sensor monitoring for manufacturing facility.

## Use Case
Monitor temperature, vibration, and energy consumption across factory floor.

## Data Schema
```json
{
  "sensors": [
    {
      "id": "temp-001",
      "type": "temperature",
      "value": 78.5,
      "unit": "celsius",
      "status": "normal",
      "location": { "x": 10, "y": 0, "z": 5 },
      "lastUpdate": "2026-04-07T13:30:00Z"
    }
  ]
}
```

## Artefacts
- **Temperature Nodes:** Color-coded (blue→red), size = heat intensity
- **Vibration Spheres:** Pulsing animation for active alarms
- **Energy Flow:** Animated tubes showing power distribution
- **Status Panels:** Floating displays for aggregate metrics

## Behaviours
- Click sensor to see 24h history sparkline
- Alert mode: Alarms glow red and pulse
- Drag to reposition sensors (calibration mode)

## Extensions Required
- Real-time WebSocket data streaming
- Threshold-based alerts with visual/audio feedback
- Time-series data caching for history
