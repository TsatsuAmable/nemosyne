# Research: Data Topologies and VR Artefact Mapping

## 1. Data Topology Categories

Data can be organized into several fundamental topological structures. Each type has distinct characteristics that suggest different VR representations.

### 1.1 Graphs / Networks
**Characteristics:**
- Nodes (entities) connected by edges (relationships)
- Can be directed or undirected
- May have weighted edges (strength of connection)
- May have node attributes (size, color, category)

**Examples:** Social networks, dependency graphs, knowledge bases, neural networks

**VR Representation Candidates:**
- Floating nodes (spheres, crystals, geometric shapes) in 3D space
- Glowing edges (beams, tubes, trails) connecting nodes
- Node size/color mapped to attributes
- Force-directed layout in 3D (nodes arrange themselves)
- Clusters visible as spatial groupings

---

### 1.2 Hierarchies / Trees
**Characteristics:**
- Parent-child relationships
- Single root, branching downward
- Depth indicates level
- Leaves are terminal nodes

**Examples:** File systems, org charts, taxonomies, decision trees, DOM structures

**VR Representation Candidates:**
- Vertical or radial tree structures
- Platforms at different heights (root at top/base)
- Connecting pillars or vines between levels
- Collapsible branches (fold/unfold subtrees)
- Circular/organic layouts for radial trees

---

### 1.3 Time-Series / Temporal Data
**Characteristics:**
- Sequential data points
- Time on one axis
- Values vary over time
- May have trends, cycles, anomalies

**Examples:** Stock prices, sensor readings, user activity logs, weather data

**VR Representation Candidates:**
- 3D line graphs (ribbon-like trails through space)
- Cylindrical timeline you can walk around
- Waveforms in a "data ocean"
- Stacked rings showing time progressing outward
- Animated data points appearing sequentially

---

### 1.4 Geospatial / Maps
**Characteristics:**
- Latitude/longitude coordinates
- Regional boundaries
- Point clusters and distributions
- Distance/proximity matters

**Examples:** Population density, store locations, migration patterns, weather systems

**VR Representation Candidates:**
- Globe with extruded height maps
- Flat maps floating in space
- 3D bars/columns rising from surface
- Heatmaps projected onto terrain
- Flying over data landscapes

---

### 1.5 Multidimensional / Tabular
**Characteristics:**
- Rows and columns (many dimensions)
- Each record has multiple attributes
- Relationships between dimensions
- Correlations and clusters

**Examples:** Customer databases, product catalogs, sensor arrays

**VR Representation Candidates:**
- Scatter plots in 3D (3 dimensions mapped to X/Y/Z)
- Additional dimensions as color, size, shape, transparency
- "Constellation" view where similar records cluster
- Individual data cards floating in space

---

### 1.6 Flows / Processes
**Characteristics:**
- Directional movement
- Multiple paths/channels
- Magnitude/volume along paths
- Sources and sinks

**Examples:** Network traffic, supply chains, user journeys, energy grids, water flows

**VR Representation Candidates:**
- Particle systems flowing through channels
- Rivers/streams of light
- Sankey-style wide ribbons
- Traffic visualization with flowing vehicles
- Pulsing conduits with varying thickness

---

### 1.7 Fields / Continuous Data
**Characteristics:**
- Values defined at every point in a region
- Gradients and contours
- Smooth versus discrete
- Vector fields (magnitude + direction)

**Examples:** Temperature maps, electromagnetic fields, pressure systems, wind patterns

**VR Representation Candidates:**
- Height-map landscapes (terrain representing values)
- Contour surfaces (isosurfaces)
- Particle flow visualization (LIC, streamlines)
- Volumetric fog/clouds with varying density
- Arrow/glyph fields showing vectors

---

## 2. Artefact Taxonomy — VR Object Types

Based on the topologies above, we can define core artefact categories:

### 2.1 Primitives (Atomic Building Blocks)

| Artefact | Geometry | Best For | Properties |
|----------|----------|----------|------------|
| **Crystal** | Octahedron/Prism | Data nodes, values | Facets, color, glow, rotation |
| **Sphere** | UV Sphere | Points in space, proximity | Radius, color, transparency |
| **Orb** | Sphere + Halo | Important values, alerts | Core + aura effect, pulses |
| **Column** | Cylinder | Bar charts, height values | Height, radius, segments |
| **Node** | Low-poly geometric | Network points, entities | Shape variety, connectivity |
| **Token** | Flat disc | Categorical labels | Face texture, rotation, stackable |
| **Plinth** | Box platform | Bases, pedestals, categories | Size, texture, elevation |

### 2.2 Connectors (Relationship Visualizers)

| Artefact | Geometry | Best For | Properties |
|----------|----------|----------|------------|
| **Beam** | Cylinder (long) | Direct connections | Thickness, color, animation |
| **Trail** | Ribbon/tube | Paths, flows | Width, color gradient, particles |
| **Thread** | Thin line | Weak/subtle connections | Opacity, dashed vs solid |
| **Web** | Planar mesh | Surfaces, membranes | Tension, vibration, transparency |

### 2.3 Containers (Spatial Organization)

| Artefact | Geometry | Best For | Properties |
|----------|----------|----------|------------|
| **Ring** | Torus | Levels, tiers | Radius, thickness, orientation |
| **Orbit** | Circle path | Rotating groups | Speed, phase, radius |
| **Field** | Volumetric | Continuous data | Density, color mapping |
| **Zone** | Boundary mesh | Regions, clusters | Fade edges, pulsate |

### 2.4 Composites (Complex Artefacts)

| Artefact | Composition | Best For |
|----------|-------------|----------|
| **Datatree** | Plinths + Columns + Beams | Hierarchies |
| **Constellation** | Nodes + Threads + Glow | Networks |
| **Timeline** | Ring + Tokens + Trail | Time-series |
| **Landscape** | Heightmap + Field + Particles | Continuous data |
| **Flowsystem** | Channels + Particles + Volumes | Process flows |

---

## 3. Behaviour System Concepts

Artefacts should be interactive and responsive.

### 3.1 Universal Behaviours (applies to all artefacts)
- **Hover** — Highlight/glow on cursor proximity
- **Select** — Enlarge, elevate, show details on click
- **Drag** — Reposition in 3D space
- **Animate** — Idle motion (rotation, bobbing, pulsing)

### 3.2 Topology-Specific Behaviours

**For Networks:**
- **Expand/Collapse** — Show/hide connected nodes
- **Filter** — Dim unrelated nodes
- **Trace Path** — Highlight route between two nodes

**For Hierarchies:**
- **Drill Down** — Enter subtree, zoom in
- **Fold/Unfold** — Collapse children
- **Reorder** — Sort siblings by value

**For Time-Series:**
- **Scrub** — Move through time manually
- **Play/Pause** — Animate temporal evolution
- **Zoom Time** — Focus on specific range

**For Geospatial:**
- **Fly To** — Navigate camera to location
- **Height Scale** — Adjust vertical exaggeration
- **Layers** — Toggle data layers on/off

---

## 4. Transform Pipeline Concept

Raw data → Transform → VR Artefact → Render → Interact

### 4.1 Data Input Formats
- JSON (most flexible)
- CSV/TSV (tabular)
- Graph formats (GraphML, GEXF)
- Live streams (WebSocket, MQTT)

### 4.2 Transform Operations
- **Map** — Value → Visual property (color scale, size scale)
- **Layout** — Calculate positions (force-directed, grid, radial)
- **Aggregate** — Combine into summary artefacts
- **Filter** — Reduce to relevant subset
- **Normalize** — Scale values for visualization

### 4.3 Artefact Construction
- Generate geometry
- Apply materials/colors
- Position in scene
- Wire up behaviours
- Add labels/metadata

---

## 5. Research Questions to Resolve

1. What are the performance limits for number of artefacts in a scene?
2. How do we handle streaming/real-time data updates?
3. What's the optimal scale — room-scale, table-scale, cosmic-scale?
4. How do we prevent visual clutter in dense datasets?
5. What's the accessibility story for VR data viz?
6. How do we export/share static views?

---

*Research ongoing. This document will be refined as theory solidifies.*
