# Education Example

Immersive learning environments and data exploration.

## Use Case
Interactive lessons: solar system, historical timelines, molecular chemistry.

## Data Schema
```jsonn{
  "lesson": "solar-system",
  "entities": [
    {      "name": "Mercury",      "type": "planet",
      "diameter": 4879,      "distance": 57900000,
      "orbitalPeriod": 88,      "texture": "mercury.jpg"
    },
    {      "name": "Saturn",      "type": "planet",
      "diameter": 116460,      "distance": 1433500000,
      "hasRings": true    }
  ],  "relationships": [
    { "from": "Sun", "to": "Earth", "type": "gravity" }
  ],  "annotations": [
    { "target": "Earth", "text": "Our home planet" }
  ]}
```

## Artefacts
- **Planetary Spheres:** Scaled sizes, orbital animations
- **Orbit Rings:** Circular trails showing paths
- **Timeline Path:** Historical events on curved path
- **Molecule Kits:** Bondable atoms for student assembly

## Interactive Learning
- Grab and reposition planets
- Scale mode: compare relative sizes
- Timeline scrubbing through epochs
- Quiz mode: label planets/capitals

## Extensions Required
- Physics simulation for orbits
- Annotation system
- Quiz/assessment hooks
- Multiplayer collaboration
