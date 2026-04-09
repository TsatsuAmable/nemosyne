# Solar System Explorer

Interactive VR education module with accurate planetary data and orbital mechanics.

## Overview

Complete solar system simulation with all 8 planets, accurate proportions, and orbital mechanics. Designed for educational use in astronomy and physics education.

## Data Sources

**NASA Planetary Fact Sheet:**
- Semi-major axes (orbital distances)
- Planetary radii
- Orbital periods
- Rotation periods
- Moon counts

**Data Model:**
```javascript
{
  name: 'Earth',
  radius_km: 6371,
  distance_km: 149600000,  // From Sun
  orbital_period_days: 365.25,
  rotation_period_hours: 24,
  moons: 1,
  has_rings: false,
  color: '#1a5276'
}
```

## Scale Adjustments

**Distance (Logarithmic):**
Actual distances would make planets invisible due to scale. We use logarithmic scaling:
```javascript
function scaleDistance(actual_km) {
  return Math.log(actual_km / 1000000) * 5; // Compression factor
}
```

**Size (Linear):**
Planet sizes are proportional but exaggerated for visibility:
- Sun: 3.0 units (actual: 695,700 km radius)
- Jupiter: 2.2 units (actual: 69,911 km)
- Earth: 1.0 units (actual: 6,371 km)

**Time Compression:**
- 1 second real-time = ~10 Earth days
- Earth's orbit: 36.5 seconds (365.25 days compressed)
- Neptune's orbit: ~600 seconds (~165 years compressed)

## Planetary Features

### Mercury
- Smallest planet
- 88-day orbit
- No moons
- Extreme temperature variations

### Venus
- Hottest planet (462°C)
- Retrograde rotation
- Thick atmosphere
- No moons

### Earth
- Only known life-bearing planet
- 1 moon (Luna)
- Atmosphere glow effect
- 365.25-day orbit

### Mars
- Red planet
- 2 moons (Phobos, Deimos)
- Thin atmosphere
- 687-day orbit

### Jupiter
- Largest planet
- 95 Earth masses
- Great Red Spot
- 4 Galilean moons
- Cloud bands visualization

### Saturn
- Famous ring system
- Ring particles: 300+ individually rendered
- 3 major moons
- Lowest density (would float in water)

### Uranus
- Tilted 98° ("rolling" orbit)
- 2 moons
- Icy composition
- Cyan color

### Neptune
- Windiest planet (2,100 km/h winds)
- Deep blue color
- 1 moon (Triton)
- Furthest from Sun

## Component API

```javascript
// Create solar system
const system = document.createElement('a-entity');
system.setAttribute('solar-system', true);

// Create individual planet
const earth = document.createElement('a-entity');
earth.setAttribute('planet', {
  name: 'Earth',
  radius: 1,
  distance: 13,
  orbitalPeriod: 365.25,
  color: '#1a5276',
  moons: 1
});
```

## Educational Features

**Interactive Elements:**
- **Hover planet:** Scale up, show tooltip
- **Click planet:** Open facts panel
- **Toggle orbits:** Show/hide orbital paths
- **Focus mode:** Move camera to specific planet

**Time Controls:**
```javascript
// Speed up/slow down
function setTimeScale(scale) {
  // scale: 0.5 = half speed, 2.0 = double speed
  planets.forEach(p => {
    const animation = p.getAttribute('animation__revolution');
    animation.dur = 365.25 * 100 / scale;
  });
}
```

**Learning Objectives:**
1. Scale of the solar system
2. Orbital mechanics (distance vs. period)
3. Comparative planet sizes
4. Moon systems and interactions
5. Planetary characteristics

## Performance

**Entity Count:**
- 8 planets
- 13 moons
- 300 ring particles (Saturn)
- 500 stars

**Optimizations:**
- Instanced stars (single draw call)
- LOD for distant planets
- Background rendering optimization

## Curriculum Alignment

**NGSS Standards:**
- MS-ESS1-3: Earth-Sun-Moon system
- HS-ESS1-4: Kepler's laws
- MS-PS2-4: Gravitational interactions

**UK National Curriculum:**
- KS3: Solar system structure
- GCSE Physics: Orbital mechanics

## Technical Notes

**Known Limitations:**
- Distances compressed logarithmically (not to scale)
- Orbital inclinations simplified to ecliptic plane
- Asteroid belt not rendered
- Oort cloud not included

**Future Enhancements:**
- Dwarf planets (Pluto, Ceres, Eris)
- Asteroid belt
- Comets with elliptical orbits
- Exoplanet comparison mode
- VR multiplayer for classroom use

## References

- NASA Planetary Fact Sheet: https://nssdc.gsfc.nasa.gov/planetary/
- JPL HORIZONS: https://ssd.jpl.nasa.gov/horizons/
- IAU Minor Planet Center: https://minorplanetcenter.net/

## License

MIT License - TsatsuAmable 2026

Educational use encouraged. Attribution appreciated.