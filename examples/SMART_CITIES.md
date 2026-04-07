# Smart Cities Example

Urban data visualization for city planning.

## Use Case
Monitor traffic, air quality, and energy across urban environment.

## Data Schema
```json
{
  "cityBlocks": [    {
      "id": "block-001",
      "bounds": [[0, 0], [100, 0], [100, 100], [0, 100]],
      "buildings": [        {
          "height": 45,
          "type": "residential",          "occupancy": 0.85,
          "energyUsage": 1250
        }
      ],
      "trafficFlow": 450,      "airQuality": { "pm25": 15, "no2": 30, "o3": 45 }
    }
  ],
  "trafficSignals": [    {
      "id": "sig-001", "location": [50, 50],      "state": "green",
      "cycleTime": 90    }
  ]
}
```

## Artefacts
- **Building Blocks:** Extruded polygons showing skyline
- **Traffic Arteries:** Animated flow lines (speed = thickness)
- **AQI Plumes:** Rising transparent columns (color = quality)
- **Transit Network:** Underground tube visualization

## Behaviours
- Fly through at street level
- Time-of-day slider (see rush hour patterns)
- Toggle data layers (traffic, pollution, energy)
- Click building for details panel

## Extensions Required
- GeoJSON parser
- OSM building extrusion
- Time-of-day simulation
- Particle systems for traffic
