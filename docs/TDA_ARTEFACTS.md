# Topological Data Analysis VR Artefacts

## Overview

These artefacts apply **Topological Data Analysis (TDA)** concepts to create shape-aware visualizations. They reveal the underlying structure of data—connected components, loops, voids, and their persistence across scales.

---

## TDA Concepts → VR Artefacts

### 1. **Persistence Barcode** → `topo-persistence-barcode`

**Concept:** Visualize birth/death of topological features (components, holes, voids).

**Visual:** Horizontal bars floating in space, each representing a feature's lifetime.

```javascript
{
  "id": "topo-persistence-barcode",
  "name": "Persistence Barcode",
  "topology": "temporal-persistent",
  "description": "Bars show when features (components, loops, voids) appear/disappear",
  "tda_concept": "persistent_homology",
  "geometry": {
    "type": "box",
    "bar_height": 0.2,
    "bar_depth": 0.1
  },
  "visual_encoding": {
    "x_position": "birth_scale",
    "width": "persistence_lifetime",
    "y_position": "homology_dimension",
    "color": "persistence_strength"
  },
  "sample_data": {
    "dimensions": {
      "H0": [  // Connected components
        { "birth": 0, "death": 1.2, "lifetime": 1.2 },
        { "birth": 0, "death": 2.8, "lifetime": 2.8 },
        { "birth": 0.5, "death": 5.0, "lifetime": 4.5, "significant": true }
      ],
      "H1": [  // 1D holes (loops)
        { "birth": 1.5, "death": 3.2, "lifetime": 1.7 },
        { "birth": 2.0, "death": 6.5, "lifetime": 4.5, "significant": true }
      ],
      "H2": [  // 2D voids
        { "birth": 3.0, "death": 5.5, "lifetime": 2.5, "significant": true }
      ]
    }
  }
}
```

**Interactions:**
- Hover bar → See (birth, death, persistence)
- Click → Highlight related features in other views
- Scrub scale slider → Filter features by persistence threshold

---

### 2. **Simplicial Complex** → `topo-simplicial-complex`

**Concept:** Visualize the mesh of points, edges, triangles, tetrahedra at a specific scale.

**Visual:** Wireframe structure with filled polygons showing topological connectivity.

```javascript
{
  "id": "topo-simplicial-complex",
  "name": "Simplicial Complex",
  "topology": "simplices",
  "description": "Shows connected points, edges, and higher-order simplices at a filtration scale",
  "tda_concept": "vietoris_rips_complex",
  "geometry": {
    "node_radius": 0.15,
    "edge_thickness": 0.02,
    "triangle_opacity": 0.3,
    "tetrahedron_opacity": 0.15
  },
  "visual_encoding": {
    "nodes": "0-simplices (points)",
    "edges": "1-simplices (connections)",
    "triangles": "2-simplices (filled areas)",
    "tetrahedra": "3-simplices (volumetric)"
  },
  "sample_data": {
    "filtration_scale": 2.5,
    "vertices": [
      { "id": 0, "x": 0, "y": 0, "z": 0 },
      { "id": 1, "x": 1.5, "y": 0, "z": 0.5 },
      { "id": 2, "x": 0.8, "y": 1.2, "z": 0 },
      { "id": 3, "x": 0.5, "y": 0.5, "z": 1.2 },
      { "id": 4, "x": 2.0, "y": 1.0, "z": 0.5 }
    ],
    "edges": [[0,1], [0,2], [1,2], [1,3], [2,3], [2,4], [3,4]],
    "triangles": [[0,1,2], [1,3,4]],
    "tetrahedra": [[1,2,3,4]]
  },
  "behaviours": [
    { "trigger": "filtration-change", "action": "rebuild-mesh" },
    { "trigger": "hover-simplex", "action": "highlight-connected" }
  ]
}
```

**Interactions:**
- Slider: Adjust epsilon (filtration scale) → watch simplices appear/disappear
- Click edge → See which vertices define it
- Click triangle → See its boundary edges
- Mode: Show only H0 (components), H1 (cycles), H2 (voids)

---

### 3. **Mapper Graph** → `topo-mapper-network`

**Concept:** Topological skeleton using overlapping intervals and clustering.

**Visual:** Network graph where nodes represent clusters, edges show overlap.

```javascript
{
  "id": "topo-mapper-network",
  "name": "Mapper Graph",
  "topology": "graph-cluster",
  "description": "Topological skeleton showing data shape through lens projection and clustering",
  "tda_concept": "mapper_algorithm",
  "geometry": {
    "node_shape": "sphere",
    "node_size": "cluster_size",
    "edge_style": "curved-tube"
  },
  "visual_encoding": {
    "node_color": "lens_filter_value",
    "node_size": "cluster_cardinality",
    "edge_thickness": "overlap_strength",
    "node_position": "graph_layout_force_directed"
  },
  "sample_data": {
    "filter_function": "PCA_1",
    "intervals": [
      { "id": "A", "filter_range": [-3, -1], "cluster_count": 2 },
      { "id": "B", "filter_range": [-2, 0], "cluster_count": 3 },
      { "id": "C", "filter_range": [-1, 1], "cluster_count": 2 },
      { "id": "D", "filter_range": [0, 2], "cluster_count": 3 },
      { "id": "E", "filter_range": [1, 3], "cluster_count": 2 }
    ],
    "clusters": [
      { "id": "A1", "interval": "A", "size": 15, "centroid": [-2.5, 0, 0] },
      { "id": "A2", "interval": "A", "size": 12, "centroid": [-1.8, 0.5, 0.2] },
      { "id": "B1", "interval": "B", "size": 20, "centroid": [-1.5, -0.2, 0] },
      { "id": "B2", "interval": "B", "size": 18, "centroid": [-0.8, 0.3, 0.1] },
      { "id": "B3", "interval": "B", "size": 14, "centroid": [-0.5, -0.5, 0] },
      { "id": "C1", "interval": "C", "size": 22, "centroid": [0, 0, 0] },
      { "id": "C2", "interval": "C", "size": 19, "centroid": [0.5, 0.2, 0] }
    ],
    "edges": [
      { "source": "A1", "target": "B1", "overlap": 8 },
      { "source": "A2", "target": "B3", "overlap": 6 },
      { "source": "B1", "target": "C1", "overlap": 12 },
      { "source": "B2", "target": "C1", "overlap": 9 },
      { "source": "B3", "target": "C2", "overlap": 7 }
    ]
  }
}
```

**Interactions:**
- Hover node → Expand to show member points
- Click edge → Highlight overlapping points
- Change lens → Recompute mapper graph (switch PCA to eccentricity, density, etc.)
- Brush select → Show points in selected interval regions

---

### 4. **Reeb Graph** → `topo-reeb-contours`

**Concept:** Shows evolution of level sets connected components.

**Visual:** Centipede-like structure showing merges and splits of contours.

```javascript
{
  "id": "topo-reeb-contours",
  "name": "Reeb Graph",
  "topology": "level-set-evolution",
  "description": "Visualizes how level set components merge, split, appear and disappear across a scalar field",
  "tda_concept": "reeb_graph",
  "geometry": {
    "contour_type": "tubular-mesh",
    "node_type": "critical-points",
    "arc_style": "level-set-surface"
  },
  "visual_encoding": {
    "y_position": "function_value",
    "arc_thickness": "contour_size",
    "node_type": "critical_type (min, max, saddle)",
    "color": "branch_id"
  },
  "sample_data": {
    "scalar_function": "height",
    "critical_points": [
      { "id": "min1", "type": "minimum", "value": 0.2, "position": [0, 0, 0] },
      { "id": "sad1", "type": "saddle", "value": 2.5, "position": [1, 2, 0] },
      { "id": "sad2", "type": "saddle", "value": 4.8, "position": [2, 1, 0] },
      { "id": "max1", "type": "maximum", "value": 7.2, "position": [1, 3, 0] }
    ],
    "contour_arcs": [
      { "from": "min1", "to": "sad1", "contour_size": [10, 50, 120, 200] },
      { "from": "sad1", "to": "sad2", "branches": ["branch_a", "branch_b"], "sizes": [150, 180, 200] },
      { "from": "sad2", "to": "max1", "merged": true, "sizes": [220, 180, 120] }
    ]
  }
}
```

**Interactions:**
- Drag vertical slider → Show contour slice at that level
- Click critical point → See its neighborhood
- Animate → Sweep through function values showing contour evolution

---

### 5. **UMAP Manifold** → `topo-umap-manifold`

**Concept:** Low-dimensional embedding preserving topological structure.

**Visual:** Cloud of points showing global shape and local clusters.

```javascript
{
  "id": "topo-umap-manifold",
  "name": "UMAP Manifold",
  "topology": "manifold-embedding",
  "description": "Dimensionality reduction preserving both local neighbors and global topology",
  "tda_concept": "umap_embedding",
  "dimensionality": 3,
  "geometry": {
    "point_shape": "sphere",
    "point_size": "selection_weight"
  },
  "visual_encoding": {
    "position": "umap_coordinates",
    "color": "original_class",
    "size": "centrality",
    "opacity": "local_density",
    "neighbors": "edge_lines"
  },
  "sample_data": {
    "n_neighbors": 15,
    "min_dist": 0.1,
    "metrics": { "trustworthiness": 0.94, "continuity": 0.96 },
    "points": [
      { "id": 0, "x": -2.3, "y": 1.2, "z": 0.5, "class": "A", "neighbors": [12, 45, 78] },
      { "id": 1, "x": -2.1, "y": 1.4, "z": 0.3, "class": "A", "neighbors": [0, 23, 56] },
      { "id": 50, "x": 1.5, "y": -1.8, "z": -0.2, "class": "B", "neighbors": [51, 52, 89] }
    ]
  }
}
```

**Interactions:**
- Brush select → Show points in region, reveal original high-D data
- Neighbor probe → Highlight k-nearest neighbors
- Rotate view → See manifold from different angles
- Parameter adjust → Change n_neighbors, watch manifold reconfigure

---

### 6. **Betti Curve** → `topo-betti-evolution`

**Concept:** Track Betti numbers across filtration values.

**Visual:** Stacked area chart in 3D showing number of components, holes, voids over scale.

```javascript
{
  "id": "topo-betti-evolution",
  "name": "Betti Curve",
  "topology": "homology-evolution",
  "description": "Shows how Betti numbers (β₀, β₁, β₂) change across filtration scales",
  "tda_concept": "betti_number_tracking",
  "geometry": {
    "chart_type": "stacked-area-3d",
    "layer_height": "betti_number"
  },
  "sample_data": {
    "filtration": [0, 0.1, 0.2, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0],
    "betti_0": [50, 45, 38, 25, 12,  8,  5,  3,  2,  1,  1],
    "betti_1": [ 0,  0,  2,  8, 15, 18, 19, 17, 12,  5,  2],
    "betti_2": [ 0,  0,  0,  0,  1,  3,  6,  8,  9,  7,  4]
  }
}
```

---

## TDA Artefact Behaviours

### `threshold-scrub`
Adjust epsilon/filtration scale, watch simplices appear/disappear.

### `persistence-filter`
Toggle to show only features above persistence threshold.

### `homology-dimension-toggle`
Show/hide H0, H1, H2 features independently.

### `local-neighborhood-expand`
Click component → Expand to show constituent points.

### `cross-highlight`
Select in barcode → Highlight in complex → Highlight in mapper.

---

## Implementation Example

```html
<nemosyne-crystal
    type="topo-persistence-barcode"
    data="complex_persistence"
    dimensions="[H0, H1, H2]"
    threshold="0.5"
    behaviours="threshold-scrub, homology-dimension-toggle, cross-highlight">
</nemosyne-crystal>
```

---

## Mathematical Foundation

Each artefact implements:
- **Filtration**: Scale parameter ε controlling connectivity
- **Homology Hₖ**: k-dimensional holes (H₀=components, H₁=cycles, H₂=voids)
- **Persistence**: Lifetime of feature [birth, death]
- **Barcode**: Visualization of all (birth, death) pairs
- **Diagram**: Scatter plot of (birth, death) points with diagonal = death line

**Key Insight:** Features far from diagonal (high persistence) are "real"; near diagonal (low persistence) are noise.

---

These TDA artefacts bridge computational topology and VR—revealing the shape hidden in data.