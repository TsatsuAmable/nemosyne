# Nemosyne.world → Nemosyne Analysis Suite Architecture Bridge

This document explains how the **Nemosyne Spatial Data Analysis Suite** relates to the `nemosyne.world` project, which is its ideological, epistemological, and architectural basis.

> `nemosyne.world` is the *reason* for this project, not merely inspiration.

**Project status:** this repository is now the merged canonical runtime of `nemosyne.world/nemosyne`. The earlier A-Frame component framework has been retired in favor of the three.js/WebXR runtime.

---

## What `nemosyne.world` defines

The upstream project (`../nemosyne.world/nemosyne/`, mirrored under `docs/nemosyne-world/`) proposes:

- **Method of Loci / spatial epistemology**: data is remembered and reasoned about through spatial placement.
- **The Crystal** as the atomic unit: a data-bound VR artefact combining rendering, data binding, and behaviours.
- **Artefact taxonomy**: Crystal, Column, Sphere/Orb, Token, Plinth, Beam, Trail, Ring, Field, Zone.
- **Topology → artefact mapping**: tabular, graph, hierarchy, time-series, geospatial, flow, and field data each map to distinct artefact families.
- **TDA artefacts**: persistence barcode, simplicial complex, mapper graph, Reeb graph, UMAP manifold, Betti curve.
- **A-Frame + D3.js component framework**: an HTML-first, declarative framework for VR data visualizations.
- **6-phase roadmap**: Foundation → Specification → Core Framework → Examples → Documentation/Community → Artefact Library → Real-World Deployments.

---

## What this repository implements

This repository is the **working three.js/WebXR runtime core** of the Nemosyne vision. It deliberately does *not* adopt the upstream A-Frame component framework wholesale, because that framework is currently infeasible to port and run on a Meta Quest 3S today. Instead, it keeps the same concepts and adapts them into a performant, testable, ES-module three.js application.

| Upstream concept | Implementation in this repo | Status |
|---|---|---|
| Method of Loci / memory palace | Worlds are built as navigable 3D spaces; datasets become physical landscapes. | Implemented |
| Crystal atomic unit | `DracoTopologyNode` + `VRTopologyTranslator` produce reactive, data-bound meshes. | Implemented |
| Artefact taxonomy | Geometry/behaviour choices in `ConstraintEngine` and `VRTopologyTranslator` map topologies to artefacts. | Partial; expanding |
| TDA artefacts | Persistence barcode, mapper graph, etc., are planned as lightweight visual summaries (panels/glyphs), not full compute. | Deferred |
| A-Frame component framework | Replaced with a three.js/WebXR ES-module runtime. | Adapted |
| D3.js bridge | Encodings (`src/data/Encodings.js`) map data values to color, size, and pulse. | Adapted |
| Live data connectors | `WebSocketAdapter`, `PollingAdapter`, `OpenDataSources` feed streaming data into artefacts. | Implemented |
| Hand tracking + behaviours | `Hands.js`, `Controllers.js`, `InputRouter` implement pointing, pinch, select, drag. | Implemented |
| Draco constraint recommender | `ConstraintEngine` + `VRTopologyTranslator` choose layout/geometry/behaviour/interaction. | Implemented |
| Wheel menu / spatial UI | `PanelManager`, `MovablePanel`, and `HandWheelMenu` provide Quest-native controls. Menu is now body-locked. | Implemented |
| Selection feedback | `SelectionFeedback` in `src/vr/audio/` gives audio tones + pointer-ray flashes. | Implemented |
| Scalable large-dataset artefacts | `InstancedPointCloud`, `ClusterVolume`, `AggregateBars`, `SpatialIndex`, `LODManager` in `src/vr/scalability/`. | Implemented |
| Interaction metaphors | `MetaphorActions.ts` implements Resonance Pulse, Fork Plane, Chrono Dial, Constellation, Beacon, Aleph. | Implemented |
| Multi-user collaboration | Shared avatars, annotations, guided tours. | Deferred |

---

## Directory mapping

```
docs/                       Project docs + GitHub Pages website
artefacts/                  Declarative artefact specification
research/                   Concept notes (Crystal architecture, data topologies)
ARCHITECTURE_BRIDGE.md      This file
src/draco/                  Constraint engine + artefact translator (the "Crystal" factory)
src/data/                   Dataset, parsers, encodings, synthetic/sample data, live connectors
src/vr/                     WebXR runtime, input, world, panels
src/vr/ui/                  MovablePanel, PanelManager, VRConsole, VRMenu, HandWheelMenu
src/vr/artifacts/           World landmarks (DatumPlane, TechnoCoreNode, FarcasterPortal, etc.)
tests/                      Vitest unit tests for every layer
```

---

## Design adaptation notes

1. **Runtime instead of framework**. The upstream project is an A-Frame *framework* intended for broad distribution. This repository is a *runtime application* focused on Meta Quest 3S first, with the framework extraction deferred until the interaction and visual metaphors are proven.

2. **Crystal = DracoTopologyNode + artefact meshes**. The Crystal's reactive data binding is realized by re-solving the Draco spec when data or weights change, and by incrementally updating live-stream meshes.

3. **Behaviours**. Upstream behaviours (hover, click, idle, data-change) map to `InputRouter` callbacks and `VRTopologyTranslator` update loops (`PULSE_QUANTITATIVE`, `ORBITAL_SPIN`, `WAVE_OSCILLATION`).

4. **Live data as River Tethys**. The upstream "River Tethys" metaphor is reused here as the live-data stream connecting zones/datasets.

5. **Zones of Thought**. Depth-based fog and time-dilation are intentional references to Vernor Vinge.

6. **ICE / TechnoCore / Farcaster**. These Gibson/Simmons cyberpunk metaphors remain as decorative world landmarks and transition portals; they are not combat mechanics in the default analysis workflow.

---

## Roadmap alignment

| Upstream phase | This repo's phase |
|---|---|
| 1. Foundation | ✅ Baseline runtime, tests, git. |
| 2. Specification | ✅ Draco spec + artefact taxonomy documented. |
| 3. Core Framework | ✅ three.js/WebXR core, input, panels, live connectors. |
| 4. Examples + Docs | ✅ README, docs/ARTEFACTS.md, docs/INTERACTIONS.md, docs/ARCHITECTURE.md updated for Phase 7. |
| 5. Artefact Library | ✅ Topology→artefact mappings expanded with instanced, cluster-volume, and aggregate-bar paths; interaction metaphors added. |
| 6. Real-World Deployments | ⏳ Quest Browser + local network demos; deployment tooling later. |

---

## Attribution

Upstream documentation is preserved under `docs/nemosyne-world/` and remains the property of its original authors. All runtime code in `src/` and `tests/` is original to this project unless otherwise noted.
