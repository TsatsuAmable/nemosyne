# Nemosyne Artefact Taxonomy

> **Architectural Boundary (Principle P5):** Rendering primitives (Crystal, Plinth, Orb, Beam, Column, Trail) are implementation details and transient visual projections synthesized by `VRTopologyTranslator`. They must never become semantic authorities or data identifiers. The canonical semantic model lives in the `Investigation` domain aggregate.

Nemosyne embodies validated Moneta representation decisions as a family of spatial artefacts. Artefacts are chosen from compact Rust-owned evidence and analytical requirements; they do not establish facts themselves.

---

## 1. Primitives (Atomic Building Blocks)

| Artefact    | Geometry                       | Best For                          | Encodable Channels                 |
| ----------- | ------------------------------ | --------------------------------- | ---------------------------------- |
| **Crystal** | Octahedron / Icosahedron prism | Data nodes, single values         | Color, size, glow, rotation, pulse |
| **Sphere**  | UV sphere                      | Points in space, proximity groups | Radius, color, transparency        |
| **Orb**     | Sphere + halo                  | Important values, alerts, hubs    | Core + aura, pulse                 |
| **Column**  | Cylinder                       | Bar charts, height values         | Height, radius, color, segments    |
| **Node**    | Low-poly geometric             | Network points, entities          | Shape variety, connectivity        |
| **Token**   | Flat disc                      | Categorical labels                | Face texture, stackable            |
| **Plinth**  | Box platform                   | Bases, pedestals, categories      | Size, texture, elevation           |

---

## 2. Connectors (Relationship Visualizers)

| Artefact   | Geometry      | Best For                  | Channels                         |
| ---------- | ------------- | ------------------------- | -------------------------------- |
| **Beam**   | Long cylinder | Direct connections        | Thickness, color, animation      |
| **Trail**  | Ribbon / tube | Paths, flows, time-series | Width, color gradient, particles |
| **Thread** | Thin line     | Weak/subtle connections   | Opacity, dashed vs solid         |
| **Web**    | Planar mesh   | Surfaces, membranes       | Tension, vibration, transparency |

---

## 3. Containers (Spatial Organization)

| Artefact  | Geometry            | Best For                | Channels                       |
| --------- | ------------------- | ----------------------- | ------------------------------ |
| **Ring**  | Torus               | Levels, tiers, clusters | Radius, thickness, orientation |
| **Orbit** | Circular path       | Rotating groups         | Speed, phase, radius           |
| **Field** | Volumetric fog/mesh | Continuous data         | Density, color mapping         |
| **Zone**  | Boundary mesh       | Regions, clusters       | Fade edges, pulsate            |

---

## 4. Topology → Artefact Mapping

| Data Topology        | Primary Artefact                  | Secondary Artefacts      | Behaviour                |
| -------------------- | --------------------------------- | ------------------------ | ------------------------ |
| **Tabular**          | Crystal (one per row)             | Plinth (category base)   | Pulse on value change    |
| **Graph / Network**  | Icosa Node + Beam edges           | Orb for high-degree hubs | Orbital spin, edge pulse |
| **Hierarchy / Tree** | Conical Tree on Plinth ring       | Beam parent-child        | Drill-down, fold/unfold  |
| **Time-Series**      | Time Ribbon / Trail               | Token markers            | Wave oscillation, scrub  |
| **Vector Field**     | Flow Ray streamlines              | Field volume             | Harvest stream           |
| **Geospatial**       | Landscape / Globe bars            | Zone boundary            | Fly-to, height scale     |
| **Flow / Process**   | Channels + Trail                  | Particles                | Pulsing conduit          |
| **Continuous Field** | Height-map landscape / Isosurface | Volumetric fog           | Contour sweep            |

---

## 5. Composites (Complex Artefacts)

| Composite         | Composition                    | Best For        |
| ----------------- | ------------------------------ | --------------- |
| **Datatree**      | Plinths + Columns + Beams      | Hierarchies     |
| **Constellation** | Nodes + Threads + Glow         | Networks        |
| **Timeline**      | Ring + Tokens + Trail          | Time-series     |
| **Landscape**     | Heightmap + Field + Particles  | Continuous data |
| **Flowsystem**    | Channels + Particles + Volumes | Process flows   |

---

## 6. Behaviour System

### Universal behaviours (all artefacts)

- **Hover** — highlight/glow on cursor proximity.
- **Select** — enlarge, elevate, show details.
- **Drag** — reposition in 3D space (where meaningful).
- **Animate** — idle motion (rotation, bobbing, pulsing).

### Topology-specific behaviours

- **Expand/Collapse** — show/hide connected nodes (networks).
- **Drill Down / Fold** — enter subtree or collapse children (hierarchies).
- **Scrub / Play / Zoom Time** — move through time (time-series).
- **Fly To / Layer Toggle** — navigate geospatial data.
- **Filter / Fade** — dim non-matching records (all topologies).
- **Aggregate / Merge** — combine grouped records into a single artefact (tabular).
- **Cluster / Attract** — pull similar records into a zone/ring (all topologies).

---

## 7. Implemented Geometry IDs

The runtime uses the following geometry identifiers in `VRTopologyTranslator`:

| ID                      | Artefact                                      | Three.js geometry                         |
| ----------------------- | --------------------------------------------- | ----------------------------------------- |
| `ICOSA_NODE`            | Crystal / low-poly node                       | `IcosahedronGeometry`                     |
| `CUBE_MATRIX`           | Crystal matrix cell                           | `BoxGeometry`                             |
| `CONICAL_TREE`          | Tree node                                     | `ConeGeometry`                            |
| `FLOW_RAY`              | Vector arrow                                  | `ConeGeometry`                            |
| `GEO_COLUMN`            | Geospatial bar                                | `CylinderGeometry`                        |
| `COLUMN`                | Generic bar                                   | `CylinderGeometry`                        |
| `ORB`                   | Sphere / hub                                  | `SphereGeometry`                          |
| `TOKEN`                 | Flat categorical disc                         | `CylinderGeometry`                        |
| `PLINTH`                | Pedestal / base                               | `BoxGeometry`                             |
| `BEAM`                  | Connection strut                              | `BoxGeometry`                             |
| `RING`                  | Torus tier                                    | `TorusGeometry`                           |
| `FIELD`                 | Wireframe plane                               | `PlaneGeometry`                           |
| `ZONE`                  | Transparent boundary                          | `CylinderGeometry`                        |
| `INSTANCED_POINT_CLOUD` | GPU-instanced points for large datasets       | `InstancedMesh` (`BoxGeometry` or custom) |
| `CLUSTER_VOLUME`        | Transparent hull around a categorical cluster | `SphereGeometry`                          |
| `AGGREGATE_BARS`        | Single bar per aggregated group               | `CylinderGeometry`                        |

## 8. Scalable Rendering for Large / Clustered Datasets

Phase 7 adds a dedicated `src/vr/scalability/` package so the runtime can handle datasets too large for one `Mesh` per row:

| Component                      | Purpose                                                                                                                                                         |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `InstancedPointCloud`          | Builds a `THREE.InstancedMesh` from encoded points; supports matrix/color/scale updates and raycast hit tests.                                                  |
| `SpatialIndex`                 | Uniform-grid index for fast radius queries and 3D DDA raycasts against many points.                                                                             |
| `LODManager`                   | Distance/gaze level-of-detail: full detail nearby, simplified/aggregate mid-range, impostor/far hidden.                                                         |
| `ConstraintEngine` scale rules | `rowCount`, `estimatedDensity`, `outlierCount`, `cardinalityOfColor`, and `isLargeDataset` facts trigger hard/soft constraints that prefer scalable geometries. |

When a dataset exceeds the configured row threshold (default 500), the constraint engine hard-requires `INSTANCED_POINT_CLOUD`, `CLUSTER_VOLUME`, or `AGGREGATE_BARS`, avoiding the per-row mesh cost that would hurt Quest 3S frame times.

## 9. Layout Generators

Canonical TypeScript layout interfaces live under `src/moneta/layouts/`; data-derived coordinates are computed by Rust/WASM and embodied by the translator:

| Layout                   | File                        | Use case                          |
| ------------------------ | --------------------------- | --------------------------------- |
| `GridLayout3D`           | `GridLayout3D.ts`           | Tabular / matrix data             |
| `ForceDirected3D`        | `ForceDirected3D.ts`        | Graphs with optional edge weights |
| `RadialTreeLayout`       | `RadialTreeLayout.ts`       | Hierarchies by level              |
| `TimeSeriesRibbonLayout` | `TimeSeriesRibbonLayout.ts` | Time-series ribbons               |
| `StreamlineLayout`       | `StreamlineLayout.ts`       | Vector-field streamlines          |
| `GeoSurfaceLayout`       | `GeoSurfaceLayout.ts`       | Lat/lon to room-scale x/z         |

## 10. TDA Artefacts (Lightweight Visual Summaries)

Topological Data Analysis artefacts in Nemosyne are represented as lightweight visual summaries rather than full computed geometry. Factories are in `src/moneta/TDAGlyphs.ts`:

| TDA Artefact            | Visual summary           | Purpose                                |
| ----------------------- | ------------------------ | -------------------------------------- |
| **Persistence Barcode** | 2D panel glyph           | Show feature lifetime across scales    |
| **Mapper Graph**        | Mini-constellation       | Show cluster connectivity              |
| **Betti Curve**         | 2D sparkline             | Show topological complexity over scale |
| **Simplicial Complex**  | Wireframe mesh           | Show connectivity at a threshold       |
| **Reeb Graph**          | Skeletal tree            | Show level-set connectivity            |
| **UMAP Manifold**       | Scatter-cloud projection | Show reduced-dimension similarity      |

Full server-side TDA compute is deferred to later phases.

## 11. Functional Landmarks

Two large-scale landmarks in the memory palace have data metaphors and interactions:

| Landmark             | File                                  | Data Metaphor                | Interaction                                             | Feedback                                                                            |
| -------------------- | ------------------------------------- | ---------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **TechnoCore**       | `src/vr/artifacts/TechnoCoreNode.ts`  | Central computation/lens hub | Pinch to cycle `off`/`statistical`/`anomaly` lens modes | Core/ring color tint + pulse scales with analysis-history depth; core tone + haptic |
| **Farcaster Portal** | `src/vr/artifacts/FarcasterPortal.ts` | Data-transformation gate     | Step through to warp and apply the registered operation | Brightens when the user is nearby; zone/operation tone + haptic on warp             |

These landmarks bridge the sci-fi aesthetic of the memory palace with the actual analysis workflow.
