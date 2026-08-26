# Decision Record: P1-U Whole-Product Investigation UX Audit & Journey Architecture

## Status
**ACCEPTED / IMPLEMENTED**

## Context
Nemosyne is designed as a spatial cyberspace environment for multi-dimensional data analysis. Previous sprints developed individual subsystems (Moneta representation solver, VR hand/controller interactions, Atlas investigation branching, TechnoCore and IceVault spatial landmarks). However, the overall user experience risked fragmenting into a "floating-dashboard archipelago" with disparate command walls and disconnected workflows.

This decision formalizes the whole-product Senior VR/UI/UX audit and introduces the **10-Phase Canonical Investigator Journey** as the governing operational lifecycle.

---

## The 10-Phase Canonical Investigator Journey

$$\text{Load} \to \text{Orient} \to \text{Explore/Ask} \to \text{Manipulate} \to \text{Inspect} \to \text{Test/Falsify} \to \text{Compare} \to \text{Capture Finding} \to \text{Navigate Palace} \to \text{Share/Replay}$$

| Phase | Name | Objective | Primary Spatial & Analytical Interaction |
|---|---|---|---|
| 1 | **`LOAD`** | Ingest canonical dataset | Kernel/Atlas dataset loading with zero row-rematerialisation. |
| 2 | **`ORIENT`** | Establish spatial perspective | Baseline topology inference, viewpoint placement, sparse cyberspace horizon. |
| 3 | **`EXPLORE_ASK`** | Intent query & search | Natural language or category query via `IntentCompiler` / `StructureExplainer`. |
| 4 | **`MANIPULATE_REPRESENTATION`** | Semantic representation switch | Moneta arbitration, RepresentationGraph execution, density/aggregate/field switching. |
| 5 | **`INSPECT_STRUCTURE`** | Structural probing | Inspection of cluster hulls, density voxels, or nodes via HolographicInspector. |
| 6 | **`TEST_FALSIFY`** | Hypothesis testing & filtering | Applying analytical operations (filters, anomalies, slices) via Rust/WASM. |
| 7 | **`COMPARE`** | Multi-branch comparison | Multi-state investigation branching and diffing in `AtlasCore`. |
| 8 | **`CAPTURE_FINDING`** | Record analytical finding | Storing structured findings with input/output fingerprints in `InvestigationAggregate`. |
| 9 | **`NAVIGATE_MEMORY_PALACE`** | Spatial landmark transition | Navigating between spatial anchors, using TechnoCore analytical lens modes (`statistical`, `anomaly`, `off`). |
| 10 | **`SHARE_REPLAY`** | Export & tamper verification | Serializing session state and replaying deterministic investigation traces. |

---

## Spatial Hierarchy & Interface Principles

1. **Spatial Center as Focus**: The primary analytical embodiment (density field, aggregate pillars, time ribbon, manifold graph) occupies the spatial center ($z \approx -4\text{m}$ to $-8\text{m}$).
2. **Colocated Contextual Surfaces**: Non-task command walls are replaced by contextual toolbars that attach directly to the selected spatial structure (`ContextualTaskSurface`).
3. **On-Demand Wrist Menu**: The `HandWheelMenu` provides progressive disclosure (Novice $\to$ Analyst $\to$ Researcher $\to$ Developer) and remains hidden until summoned.
4. **TechnoCore as Functional Hub**: TechnoCore is an interactive analytical lens and computational activity hub rather than a passive decorative sculpture.
5. **Modality Parity**: All 10 journey phases are fully operable across Desktop (Keyboard/Mouse) and XR (Quest 3S 6DoF Controllers and Hand Tracking).
