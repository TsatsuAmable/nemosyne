# NEO Dataset Use Cases

## Dataset: NASA Near Earth Objects
**Source:** CNEOS (Center for Near Earth Object Studies), JPL, NASA  
**API:** [SSD/CNEOS API Server](https://ssd-api.jpl.nasa.gov/)  
**Current Download:** `data/neo-close-approaches-full.json`  
**Size:** 10,000 close approach records (expandable to 900,000+)  

**Schema (CAD API):**
| Field | Meaning |
|-------|---------|
| `des` | Object designation (e.g., "2024 AV2") |
| `jd` | Julian Date (time) |
| `cd` | Calendar date/time of approach |
| `dist` | Nominal distance (AU) |
| `dist_min` | Minimum possible distance (AU) |
| `dist_max` | Maximum possible distance (AU) |
| `v_rel` | Relative velocity (km/s) |
| `v_inf` | V-infinity (km/s) |
| `h` | Absolute magnitude (size proxy) |

**Note:** 1 AU = ~150 million km. Earth-Moon distance = 0.0026 AU.

---

## Use Case 1: Orbital Awareness (Primary) ⭐
**The Core 3D Value Proposition**

**Concept:** Walk through the solar system's "near-Earth" region. See which asteroids are approaching and how close they'll get.

**Spatial Encodings:**
- **Z (time):** Calendar date of approach — walk forward/backward in time
- **X/Y:** Orbital plane position (derived from approach geometry)
- **Color:** Miss distance (green=safe >0.1 AU, yellow=close 0.05-0.1 AU, red=hazardous <0.05 AU)
- **Size:** Estimated diameter (derived from absolute magnitude H)
- **Glow intensity:** Relative velocity (faster = brighter)

**3D Questions Answered:**
- When is the next close approach?
- How close do objects get relative to each other?
- What's the "density" of approaches in different time periods?
- Which large objects come uncomfortably close?

**Why 3D Matters:** Time becomes a spatial dimension you walk through. You can literally see the "storm" of approaches in 2029 (Apophis) or other busy periods.

---

## Use Case 2: Hazard Assessment Dashboard
**Planetary Defense Perspective**

**Concept:** Filter for Potentially Hazardous Asteroids (PHAs). Visualize cumulative risk.

**Spatial Encodings:**
- **X/Y/Z:** Position in orbital space
- **Color:** Torino Scale / Palermo Scale impact risk
- **Size:** Kinetic energy potential (size × velocity²)
- **Label:** Time until next approach

**3D Questions Answered:**
- Which objects are being actively monitored?
- Where are the knowledge gaps (uncertainty)?
- What's the spatial distribution of risk?

**Why 3D Matters:** Risk is spatial and temporal. Flat risk lists miss the "where" that matters for observation planning.

---

## Use Case 3: Discovery Timeline Walk
**Temporal Pattern Recognition**

**Concept:** Asteroids positioned by discovery year, not approach date. See how our detection capabilities have improved.

**Spatial Encodings:**
- **Z:** Discovery year (walk from 1990s to present)
- **X/Y:** Distance at discovery
- **Color:** Discovery survey (Catalina, Pan-STARRS, etc.)
- **Size:** Actual size

**3D Questions Answered:**
- How many small objects remain undiscovered?
- What's the completeness by size?
- Which surveys found the most hazardous objects?

**Why 3D Matters:** Discovery bias is spatial (ground-based surveys have blind spots at certain inclinations).

---

## Use Case 4: Mission Planning / Accessibility
**Asteroid Mining & Exploration**

**Concept:** Filter for accessible targets. Delta-v vs. value tradeoff.

**Spatial Encodings:**
- **X/Y/Z:** Orbital parameters
- **Color:** Delta-v requirement (energy to reach)
- **Size:** Physical size
- **Shape:** Orbit class (Aten, Apollo, Amor)

**3D Questions Answered:**
- Which asteroids are easiest to reach?
- Where are the "low-hanging fruit"?
- What's the tradeoff between size and accessibility?

**Why 3D Matters:** Orbital mechanics are inherently 3D. Delta-v tables miss the intuitive spatial relationships.

---

## Use Case 5: Size Distribution at Scale
**Comprehending the Range**

**Concept:** Log-scale visualization showing true size range — from pebbles to small moons.

**Spatial Encodings:**
- **Radial distance from center:** Size (log scale)
- **Angle:** Approach frequency
- **Color:** Size category
- **Reference spheres:** Earth, Moon, landmarks

**3D Questions Answered:**
- How many "city killers" (10-100m) vs "continent killers" (1-10km)?
- What's the size distribution?
- Where are the detection gaps?

**Why 3D Matters:** Log scale in 3D preserves spatial intuition better than flat charts.

---

## Recommended: Use Case 1 (Orbital Awareness)

**Why this one:**
1. ✅ **Data available** — Have 10,000 close approaches already
2. ✅ **Immediate 3D value** — Time as walkable space
3. ✅ **Clear narrative** — "Here's what's coming near Earth"
4. ✅ **Emotional resonance** — Existential risk is engaging
5. ✅ **Technical feasibility** — No complex orbital calculations needed
6. ✅ **Differentiation** — 2D tables exist, walkable timelines don't

**The Core Experience:**
> Stand at Earth. Look "up" (forward in time). See the asteroids coming. Walk toward 2029. See Apophis — a 300m object passing closer than geostationary satellites. Understand: This is real.

**Next Steps:**
1. ✅ Download NEO close approach data (10K records)
2. Convert JSON to optimized format
3. Gut codebase to 3 core artefacts: spatial scatter, timeline path, proximity alert
4. Build single scene: Earth center, time as Z-axis, walkable timeline
5. Validate: Does 3D actually help understand "what's coming"?

---

## Data Expansion Options

**Full dataset:** 900,000+ close approaches available via API  
**Orbital elements:** Can query SBDB for full orbital parameters  
**Real-time updates:** API provides new discoveries within hours

**API Endpoints:**
- Close approaches: `https://ssd-api.jpl.nasa.gov/cad.api`
- Object details: `https://ssd-api.jpl.nasa.gov/sbdb.api`
- Scout (new objects): `https://ssd-api.jpl.nasa.gov/scout.api`
