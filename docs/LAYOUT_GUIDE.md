# Layout Guide

Comprehensive guide to Nemosyne's 7 layout algorithms.

## Available Layouts

### 1. Force-Directed (`nemosyne-graph-force`)
- Uses physics simulation to position nodes
- Good for: Network graphs, social connections
- Properties: `iterations`, `repulsionStrength`, `attractionStrength`

### 2. Tree (`nemosyne-tree`)
- Hierarchical radial layout
- Good for: Org charts, file systems, taxonomies
- Properties: `depth`, `branchingFactor`

### 3. Timeline Linear (`nemosyne-timeline-linear`)
- Time-based horizontal layout
- Good for: Time series, event sequences
- Properties: `timeScale`, `spacing`

### 4. Timeline Spiral (`nemosyne-timeline-spiral`)
- Archimedean spiral for temporal data
- Good for: Cyclical time patterns, historical data
- Properties: `turns`, `radiusStep`

### 5. Scatter (`nemosyne-scatter`)
- 3D position encoding
- Good for: Correlations, clusters, distributions
- Properties: `x`, `y`, `z` encodings

### 6. Globe (`nemosyne-globe`)
- Geographic projection on sphere
- Good for: Geospatial data, global patterns
- Properties: `lat`, `lon` encodings

### 7. Categorical Grid (`nemosyne-categorical-grid`)
- Grid layout for categorical data
- Good for: Comparisons, dashboards
- Properties: `columns`, `rowHeight`, `columnWidth`

## Layout Selection

The `TopologyDetector` automatically suggests layouts based on data structure, or you can manually specify using the `layout` parameter.

---

*For API details, see [API_REFERENCE_COMPLETE.md](API_REFERENCE_COMPLETE.md)*
