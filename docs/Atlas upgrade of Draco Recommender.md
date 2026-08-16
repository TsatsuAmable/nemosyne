# **Nemosyne.world V5: Actionable Feature Specification**

## **Spatial Analytical Intelligence, DatasetSpace and Draco**

**Document type:** Technical Product Specification  
**Role:** Technical Product Owner  
**Product:** nemosyne.world  
**Repository:** [TsatsuAmable/nemosyne](https://github.com/TsatsuAmable/nemosyne?utm_source=chatgpt.com)  
**Status:** Proposed architecture / implementation baseline  
**Target:** Stable research release  
**Primary architectural change:** Reposition Draco from a visual-metaphor recommender to an interactive spatial analytical intelligence layer.

> **Governance note:** This is detailed proposal material, not the authority for product status or
> release scope. Use [PRODUCT_ARCHITECTURE_AND_GOVERNANCE.md](PRODUCT_ARCHITECTURE_AND_GOVERNANCE.md)
> for the approved release split and `docs/ROADMAP.md` for implementation truth.

### Repository alignment (2026-08-15)

This document is a proposed V5 architecture, not a record of shipped capability. The
canonical implementation status is `docs/ROADMAP.md`; its phase checkboxes and validation
evidence take precedence over the epics and migration phases described here.

- **Phase 22.3:** Started in the repository. Current work is low-strain UX, input correctness,
  onboarding wiring, accessibility, and analysis completeness. These improvements support the
  Atlas principles of researcher control, legibility, and reproducible interaction, but do not
  constitute Atlas.
- **Phase 21.3:** Started at the readiness stage and gated by the B2 load-test staircase.
  Rust scene-graph migration and production command-buffer use remain unimplemented until
  measured `logs/loadtest-results.jsonl` evidence supports the decision.
- **Draco status:** The existing constraint engine and VR translator remain the current Draco
  Embodiment Engine v1. Atlas Phase 0 is therefore a planning constraint: do not expand visual
  metaphor rules while DatasetSpace and analytical recommendation boundaries are being defined.
- **DatasetSpace and Atlas epics:** Proposed follow-on architecture. No new `DatasetSpace`,
  `Atlas`, or analytical guidance API should be marked implemented without a
  corresponding roadmap entry, source evidence, tests, and validation result.

The alignment rule is: roadmap state records what exists and what is verified; this Atlas
document records the intended architectural destination and acceptance model.

---

## **1\. Executive product decision**

### **Decision**

Nemosyne should **not continue expanding the current Draco constraint rules as the primary route to the stable release**.

The existing Draco implementation is useful infrastructure, but its responsibility is currently too close to:

> dataset facts → visual specification → VR artefact

The product needs to become:

> dataset → analytical model → persistent spatial representation → discovered structures → researcher interaction/context → Atlas guidance → VR embodiment

This is not a cosmetic refactor. It is a change in the product's core analytical model.

The existing codebase already contains several pieces that make this achievable:

* `Dataset` and dataset operations  
* clustering  
* topological data analysis  
* analysis history  
* session persistence  
* Draco constraint solving  
* 3D layout generators  
* VR topology translation  
* telemetry/data interpretation  
* an existing analytics layer

The repository structure confirms that analytics, data, Draco, VR, AI and networking are already separated at the source level.

The particularly important discovery is that Nemosyne **already has a lightweight TDA implementation** in `TDAMapper.ts`, including Mapper, persistence intervals and Betti-0 analysis.

That means the proposed architecture is not a greenfield rewrite. It is primarily an **architectural recomposition of capabilities the project already possesses**.

---

# **2\. Product objective**

## **2.1 Product vision**

Nemosyne should allow a researcher to enter an immersive representation of an entire dataset, perceive and manipulate its spatial structure, investigate statistically or topologically meaningful phenomena, and connect those discoveries to research questions, observations and empirical evidence.

The 3D environment is therefore not primarily a chart.

It is a:

> **persistent spatial analytical representation of the dataset.**

The researcher should be able to move between:

WHOLE DATASET  
      ↓  
SPATIAL REGION  
      ↓  
STRUCTURE / CLUSTER  
      ↓  
NEIGHBOURHOOD  
      ↓  
OBSERVATION  
      ↓  
RAW ATTRIBUTES / EVIDENCE

without losing the relationship between those levels.

---

# **3\. Product principles**

These principles should become acceptance criteria for architecture decisions.

### **P1. Whole-dataset first**

The system must construct a representation of the **full analytical dataset**, rather than making individual datapoints the primary unit of recommendation.

### **P2. Space has analytical semantics**

A spatial position must have a documented analytical provenance.

The system must be able to answer:

> Why are these observations near each other?

### **P3. Structure is first-class**

Clusters, regions, boundaries, trajectories, anomalies and relationships must be representable independently of individual datapoints.

### **P4. Analytical truth is deterministic**

Statistical, clustering, embedding and structural calculations must be reproducible.

LLMs may interpret, explain and suggest, but must not be the authoritative source for empirical measurements.

### **P5. Visual metaphor is downstream**

Geometry, colour, animation and interaction are representations of an analytical model, not substitutes for one.

### **P6. Researcher remains in control**

Every automated recommendation must be inspectable, rejectable and overrideable.

### **P7. Exploration is evidence**

Researcher interactions, observations and analytical transformations must be recordable and reproducible.

### **P8. VR is part of the research method**

The system must support researcher observation, participant/observer roles, controlled intervention and collaborative observation as first-class product capabilities, not as post-release extras.

---

# **4\. Target architecture**

The target architecture should become:

                        ┌────────────────────┐  
                         │   Research Context  │  
                         │ hypothesis/question │  
                         │ task / population   │  
                         └─────────┬──────────┘  
                                   │  
                                   ▼  
┌─────────────┐          ┌────────────────────┐  
│ Raw Dataset │─────────▶│    DatasetModel    │  
└─────────────┘          └─────────┬──────────┘  
                                   │  
                          ┌────────┴─────────┐  
                          ▼                  ▼  
                  Feature Model       Relationship Model  
                          │                  │  
                          └────────┬─────────┘  
                                   ▼  
                         ┌────────────────────┐  
                         │   Spatial Engine   │  
                         │ embedding / graph  │  
                         │ scale / provenance │  
                         └─────────┬──────────┘  
                                   ▼  
                         ┌────────────────────┐  
                         │    DatasetSpace    │  
                         └─────────┬──────────┘  
                                   │  
                     ┌─────────────┼─────────────┐  
                     ▼             ▼             ▼  
                  Regions      Structures    Trajectories  
                     │             │             │  
                     └─────────────┼─────────────┘  
                                   ▼  
                         ┌────────────────────┐  
                         │       Draco        │  
                         │ analytical guidance│  
                         └─────────┬──────────┘  
                                   │  
                    ┌──────────────┼──────────────┐  
                    ▼              ▼              ▼  
               Recommend       Explain       Embody  
                    │              │              │  
                    └──────────────┼──────────────┘  
                                   ▼  
                         ┌────────────────────┐  
                         │     VR / WebXR     │  
                         └─────────┬──────────┘  
                                   │  
                                   ▼  
                              Researcher  
                                   │  
                     ┌─────────────┼─────────────┐  
                     ▼             ▼             ▼  
                  actions      observations   collaboration  
                     │             │             │  
                     └─────────────┼─────────────┘  
                                   ▼  
                              Draco context

---

# **5\. Feature roadmap**

I recommend structuring implementation into **eight capability epics**, rather than treating "Draco" as a single feature.

| Epic | Capability | Priority |
| ----- | ----- | ----- |
| A | DatasetSpace foundation | P0 |
| B | Spatial embedding and structure discovery | P0 |
| C | Draco analytical intelligence | P0 |
| D | VR embodiment and semantic interaction | P0 |
| E | Research context and provenance | P0 |
| F | Collaborative research/observation | P0 for research release |
| G | LLM/SLM semantic layer | P1 |
| H | Advanced adaptive intelligence | P2 |

The critical point is that **A+B must precede the mature version of C**.

---

# **6\. Epic A: DatasetSpace**

## **A1. DatasetSpace domain model**

Introduce:

interface DatasetSpace {  
  id: string;  
  datasetFingerprint: string;  
  version: number;

  embedding: SpatialEmbedding;  
  points: SpatialPoint\[\];  
  regions: SpatialRegion\[\];  
  structures: SpatialStructure\[\];  
  relationships: SpatialRelationship\[\];

  scales: SpatialScale\[\];  
  provenance: SpatialProvenance;

  createdAt: number;  
}

### **SpatialPoint**

interface SpatialPoint {  
  id: string;  
  rowIndex: number;

  position: {  
    x: number;  
    y: number;  
    z: number;  
  };

  regionIds: string\[\];  
  structureIds: string\[\];

  attributes: Record\<string, unknown\>;  
}

### **SpatialRegion**

interface SpatialRegion {  
  id: string;  
  memberPointIds: string\[\];

  centroid: Vector3;  
  bounds: Bounds3;  
  density: number;

  parentRegionId?: string;  
  childRegionIds: string\[\];  
}

### **SpatialStructure**

interface SpatialStructure {  
  id: string;

  type:  
    | 'CLUSTER'  
    | 'BOUNDARY'  
    | 'ANOMALY'  
    | 'DENSITY'  
    | 'GRADIENT'  
    | 'TRAJECTORY'  
    | 'COMPONENT'  
    | 'TOPOLOGICAL\_FEATURE';

  confidence: number;

  memberPointIds: string\[\];  
  regionIds: string\[\];

  evidence: AnalyticalEvidence\[\];  
}

---

## **A2. Spatial provenance**

Every DatasetSpace must record:

interface SpatialProvenance {  
  featureColumns: string\[\];  
  normalisation: string;  
  distanceMetric: string;  
  embeddingMethod: string;  
  embeddingParameters: Record\<string, unknown\>;  
  randomSeed?: number;

  generatedAt: number;  
  algorithmVersion: string;  
}

### **Acceptance criteria**

A researcher must be able to determine:

* which variables created the space  
* how variables were normalised  
* which distance function was used  
* which embedding method was used  
* which algorithm/version produced it  
* whether randomness was involved

This is essential for research reproducibility.

---

# **7\. Epic B: Spatial analysis engine**

This is where the existing codebase becomes particularly valuable.

`DatasetOperations.ts` already contains deterministic clustering implementations, including k-means-style clustering and hierarchical clustering.

`TDAMapper.ts` already provides:

* Mapper graphs  
* persistence intervals  
* Betti-0 curves

and explicitly positions these as lightweight deterministic approximations suitable for live VR datasets.

Therefore the first implementation should **extend and formalise these capabilities rather than replacing them**.

---

## **B1. Spatial embedding**

Create:

src/analytics/spatial/  
    SpatialEmbedding.ts  
    DistanceModel.ts  
    SpatialNormalisation.ts  
    SpatialSpaceBuilder.ts

Initial supported embedding modes:

1. PCA  
2. deterministic feature projection  
3. existing TDA-derived spatial representation  
4. graph-derived embedding where applicable

Do **not** make the initial stable release dependent on an external ML service.

---

## **B2. Neighbourhood graph**

Generate a graph over the complete dataset:

interface SpatialGraph {  
  nodes: SpatialPointId\[\];  
  edges: SpatialEdge\[\];  
}

interface SpatialEdge {  
  source: string;  
  target: string;  
  distance: number;  
  weight: number;  
}

This graph becomes a foundational analytical object.

---

## **B3. Density analysis**

Generate:

interface DensityField {  
  samples: DensitySample\[\];  
  peaks: DensityPeak\[\];  
  valleys: DensityValley\[\];  
}

This supports the user's ability to perceive:

* dense populations  
* sparse areas  
* transitions  
* voids  
* boundaries

rather than simply seeing thousands of points.

---

## **B4. Cluster discovery**

Replace the current heuristic:

sqrt(rowCount)

cluster estimate in Draco with actual clustering results.

The existing clustering code can become one provider.

Output:

Cluster {  
  id  
  members  
  centroid  
  density  
  cohesion  
  separation  
  stability  
}

### **Important**

`clusterCount` must no longer mean:

> "my heuristic estimate of how many clusters might exist."

It should mean:

> "the number of clusters produced by a named, reproducible clustering procedure."

---

## **B5. Topological structures**

Promote the existing `TDAMapper` functionality into the DatasetSpace pipeline.

For example:

Mapper  
   ↓  
Mapper regions  
   ↓  
Mapper graph  
   ↓  
Spatial structures

and:

Persistence  
   ↓  
stable components/features  
   ↓  
structural evidence

The existing implementation should initially be treated as a lightweight live-VR approximation, with its limitations documented rather than hidden.

---

# **8\. Epic C: Atlas analytical guidance**

## **C1. Change Draco's responsibility**

The new analytical API should not return only:

DracoSpec

It should return an `Atlas` guidance object:

Atlas

with:

interface Atlas {
  id: string;

  target: RecommendationTarget;

  action: AnalyticalAction;

  rationale: RecommendationRationale\[\];

  evidence: AnalyticalEvidence\[\];

  confidence: number;

  suggestedView: ViewConfiguration;

  suggestedInteraction?: InteractionConfiguration;

  expectedOutcome?: string;  
}

---

## **C2. Analytical actions**

Initial action vocabulary:

EXPLORE\_REGION  
COMPARE\_REGIONS  
INSPECT\_CLUSTER  
INSPECT\_BOUNDARY  
FOLLOW\_TRAJECTORY  
INVESTIGATE\_ANOMALY  
CHANGE\_EMBEDDING  
CHANGE\_SCALE  
REVEAL\_RELATIONSHIP  
COMPARE\_CONDITIONS  
INSPECT\_TOPOLOGY

This is the critical shift.

Draco should recommend **analytical actions**, not merely geometry.

---

# **9\. C3. Preserve the existing constraint engine**

Do not delete `ConstraintEngine.ts`.

Instead reposition it.

Current:

ConstraintEngine  
    ↓  
DracoSpec

Target:

Atlas
        ↓  
EmbodimentConstraints  
        ↓  
ConstraintEngine  
        ↓  
VR representation

The existing layout/geometry/behaviour/interaction vocabulary can therefore survive as the **embodiment layer**.

The current implementation already defines these channels and a large set of constraints for topology, scale, clusters, outliers, correlations and temporal properties.

That is useful infrastructure.

It is simply no longer the top-level analytical decision-maker.

---

# **10\. C4. Recommendation evidence**

Every recommendation should be explainable.

Example:

{  
  "action": "INSPECT\_BOUNDARY",  
  "target": "region-boundary-17",  
  "confidence": 0.84,  
  "evidence": \[  
    {  
      "type": "density-gradient",  
      "value": 0.81  
    },  
    {  
      "type": "cluster-separation",  
      "value": 0.77  
    },  
    {  
      "type": "persistence",  
      "value": 0.72  
    }  
  \]  
}

The UI should be able to say:

> "This boundary is recommended because the separation persists across three spatial scales."

Not:

> "Draco thinks this looks interesting."

The latter is delightful for a demo and poisonous for scientific reproducibility.

---

# **11\. Epic D: Semantic VR embodiment**

The VR translator remains valuable.

The current repository already contains:

* `VRTopologyTranslator`  
* layout implementations  
* geometry types  
* interaction types  
* instanced point cloud support

within `src/draco`.

Refactor this into:

Analytical structure  
       ↓  
Embodiment specification  
       ↓  
VRTopologyTranslator  
       ↓  
Three.js/WebXR scene

---

## **D1. Whole-space rendering**

The default VR state must represent the **whole DatasetSpace**.

The user must not enter directly into a single recommended cluster.

Initial scene:

Whole DatasetSpace  
    │  
    ├── regions  
    ├── density  
    ├── structures  
    └── observations

Draco may highlight a region, but must not hide the analytical context without explicit user action.

---

# **12\. D2. Semantic zoom**

Implement zoom as:

zoomToRegion()  
zoomToCluster()  
zoomToNeighbourhood()  
zoomToObservation()

rather than simply scaling the Three.js world.

At each scale, the system changes information density.

Example:

Dataset  
  ↓  
Region boundaries visible  
  ↓  
Cluster labels appear  
  ↓  
Individual observations appear  
  ↓  
Attributes become inspectable

---

# **13\. D3. Spatial manipulation**

Implement the V5 gestures as commands against DatasetSpace.

| UX gesture | Technical operation |
| ----- | ----- |
| World grab | `transformSpace()` |
| Two-hand expand | `expandRegion()` / semantic zoom |
| Pinch | `setSpatialScale()` |
| Split | `createSpatialSlice()` |
| Sweep | `navigateAxis()` |
| Grab anomaly | `isolateStructure()` |
| Point | `inspectTarget()` |
| Teleport | `moveToSpatialTarget()` |
| Reset | `restoreSpaceTransform()` |

The gesture recogniser should emit semantic commands, not manipulate Three.js directly.

Gesture  
 ↓  
Interaction Command  
 ↓  
DatasetSpace / ResearchContext  
 ↓  
Renderer

This keeps interaction testable without requiring VR hardware.

---

# **14\. Epic E: Research context**

Introduce:

interface ResearchContext {  
  studyId?: string;  
  researchQuestion?: string;  
  hypothesis?: string;

  targetPopulation?: string\[\];  
  variablesOfInterest?: string\[\];

  currentTask?: string;

  currentRegionId?: string;  
  currentStructureId?: string;

  comparisonTargets?: string\[\];

  observerMode?: boolean;  
}

Atlas recommendations then depend on:

DatasetSpace  
\+  
ResearchContext  
\+  
Current exploration state  
\+  
Researcher history

rather than dataset schema alone.

---

# **15\. Epic F: Research activity and evidence model**

This is essential for the empirical purpose of Nemosyne.

Create:

interface ResearchEvent {  
  id: string;  
  timestamp: number;

  actorId: string;

  type:  
    | 'NAVIGATION'  
    | 'INSPECTION'  
    | 'FILTER'  
    | 'TRANSFORMATION'  
    | 'DRACO\_RECOMMENDATION'  
    | 'RECOMMENDATION\_ACCEPTED'  
    | 'RECOMMENDATION\_REJECTED'  
    | 'ANNOTATION'  
    | 'OBSERVATION'  
    | 'COLLABORATION';

  targetIds: string\[\];

  parameters: Record\<string, unknown\>;  
}

This becomes the analytical activity ledger.

---

# **16\. Researcher observation mode**

Because collaboration/direct observation is part of the research methodology, stable release must support:

### **Roles**

RESEARCHER  
OBSERVER  
PARTICIPANT  
FACILITATOR

### **Observer mode**

Observer can:

* watch participant position  
* see participant selections  
* see current spatial region  
* see active transformations  
* add private/public observations  
* annotate events  
* avoid changing the participant's analytical state unless authorised

### **Protocol-controlled intervention**

The system should distinguish:

OBSERVE  
SUGGEST  
ASSIST  
INTERVENE

These are not interchangeable.

Every intervention should be recorded.

---

# **17\. Collaboration architecture**

The existing networking layer should be integrated with the ResearchEvent model rather than creating a separate interaction history.

Target:

Participant A  
     │  
     ▼  
ResearchEvent  
     │  
     ├──────────────┐  
     ▼              ▼  
Shared state      Observer feed  
     │              │  
     ▼              ▼  
Participant      Researcher

The collaboration system should synchronise:

* avatar/presence  
* spatial position  
* DatasetSpace version  
* selected region  
* active analytical transformation  
* annotations  
* intervention state

but should not necessarily synchronise every render-frame event.

---

# **18\. Epic G: Analysis history becomes spatial history**

The existing `AnalysisHistory` is already a useful foundation. It currently stores operation, parameters, timestamp and before/after dataset states and supports undo/redo, serialisation and replay.

Extend it.

Instead of:

DatasetOperation

support:

ResearchOperation

containing:

dataset transformation  
spatial transformation  
analytical transformation  
navigation  
recommendation  
observation  
annotation  
collaboration event

Example:

{  
  "operation": "CHANGE\_EMBEDDING",  
  "parameters": {  
    "method": "PCA",  
    "features": \["reactionTime", "accuracy", "movement"\]  
  },  
  "spatialSpaceBefore": "space-01",  
  "spatialSpaceAfter": "space-02"  
}

This creates a reproducible analytical trail.

---

# **19\. Epic H: Session model**

`SessionStore` already persists a JSON snapshot containing the dataset, camera pose, operation history, settings and tour progress.

Extend the snapshot schema to include:

interface NemosyneSession {  
  dataset;  
  datasetSpace;  
  researchContext;

  analysisHistory;  
  researchEvents;

  activeRecommendation;  
  recommendationHistory;

  collaborationState;

  cameraPose;  
  spatialTransform;

  schemaVersion;  
}

This is important because a saved Nemosyne session should mean:

> "This is the analytical world and research state."

not simply:

> "This is the dataset and camera position."

---

# **20\. LLM / SLM integration**

This should be **Phase 2**, not the foundation.

## **LLM responsibilities**

Use the model for:

### **Intent parsing**

Researcher:

> "Show me where the participants diverge most strongly."

LLM:

intent \= FIND\_MAXIMUM\_GROUP\_SEPARATION

### **Recommendation explanation**

> "Why are you suggesting this cluster?"

LLM explains deterministic evidence.

### **Hypothesis interaction**

> "Could this boundary be related to reaction time?"

Draco translates that into an analytical request.

### **Natural-language exploration**

> "Compare this region with the one on the other side of the space."

The model resolves the referents against DatasetSpace.

---

# **21\. LLM must not own empirical computation**

The following remain deterministic:

embedding  
distance  
clustering  
density  
correlation  
statistical tests  
topological analysis  
anomaly detection  
spatial membership  
confidence calculations

The LLM receives results.

It does not invent them.

This separation is particularly important if Nemosyne is used to generate empirical evidence.

The original Draco concept is itself constraint-oriented and designed around formalised visualisation knowledge rather than unconstrained language generation. ([GitHub](https://github.com/uwdata/draco?utm_source=chatgpt.com))

Nemosyne should retain that useful determinism while extending Draco's scope.

---

# **22\. Research-backed statistical execution**

Atlas statistical calculations should execute in Rust/WASM through maintained statistical
libraries wherever a suitable implementation exists. TypeScript should own request validation,
rendering, and fallback orchestration, not duplicate statistical formulas. An external reference
implementation is a validation oracle only; it is not the production execution path.

## **22.1 Method policy**

Methods are selected by research question and declared with assumptions, estimand, missing-data
policy, seed, resampling unit, numerical precision, and evidence status:

| Question | Initial method family | Published technique reference | Atlas status |
|---|---|---|---|
| Summary and uncertainty | Robust summaries, bootstrap intervals | Efron (1979), *Bootstrap Methods: Another Look at the Jackknife* | Descriptive/exploratory |
| Multiple comparisons | Benjamini-Hochberg false discovery rate | Benjamini & Hochberg (1995) | Validation before confirmatory use |
| Missing data | Explicit missingness patterns; multiple-imputation contract | Rubin (1987), *Multiple Imputation for Nonresponse in Surveys* | Study/offline analysis until validated |
| Clustering | K-means, hierarchical, DBSCAN with stability diagnostics | Hennig (2007), *What are the True Clusters?* | Exploratory unless externally validated |
| Dimensionality reduction | PCA/MDS baseline; UMAP as sensitivity analysis | McInnes, Healy & Melville (2018), UMAP | Exploratory |
| TDA | Mapper, Betti-0, persistence with stability checks | Chazal et al., persistence-diagram stability literature | Exploratory/not validated |
| Effect sizes | Standardized mean differences and confidence intervals | Lakens (2013), *Calculating and Reporting Effect Sizes* | Confirmatory only under frozen protocol |

No visual separation, cluster label, anomaly score, correlation, topological feature, or VR
navigation metric may be presented as causal or population-level evidence without a defined
sampling design, estimand, diagnostics, and human-study validation.

## **22.2 Preferred Rust providers**

The preferred production path is Rust/WASM crates behind versioned Atlas `AnalysisSpec` and
`AnalysisResult` contracts:

- `ndarray` for columnar and matrix storage.
- `nalgebra` for linear algebra, decompositions, PCA, and MDS primitives.
- `statrs` for probability distributions and validated statistical primitives.
- `rand_chacha` with explicit seeds for reproducible bootstrap, permutation, and clustering.
- `petgraph` for graph metrics and structural analysis.
- `rstar` or `kiddo` for spatial indexing and nearest-neighbour queries.
- `geo` for declared geographic coordinate systems and distance operations.
- `sha2`, `serde`, and `serde_json` for content hashes and versioned provenance envelopes.
- `linfa` sub-crates may be adopted for clustering or reduction only after crate-level WASM,
  numerical, maintenance, license, and bundle-size checks.

Rust crates are preferred over self-implemented replacements. A method may be implemented in
house only when no suitable maintained crate exists, and then requires a published-method
specification, fixture tests, numerical tolerances, and comparison against an independent
reference implementation. TDA crates require separate evaluation; the existing lightweight TDA
implementation remains an explicitly exploratory fallback rather than a scientific authority.

## **22.3 Execution and evidence contract**

Every result records:

- method, crate/plugin, version, and implementation digest;
- dataset and feature hashes, normalization, distance metric, and missing-value policy;
- estimator, assumptions, diagnostics, sample size, and effective sample size;
- seed, resampling unit, numerical precision, and execution backend;
- estimate, interval type, interval limits, and evidence status;
- warnings when the method is exploratory, underpowered, unstable, or not validated.

Rust/WASM and TypeScript fallback providers must implement the same schemas and policies. They
must agree exactly on labels, counts, bounds, and categorical outputs; floating-point measures
use declared absolute/relative tolerances. External R/Python/scientific implementations are
used for conformance checks and published-method validation, not as a runtime dependency.

Interactive VR analysis is exploratory by default. Confirmatory study analysis requires a frozen
protocol, prespecified estimand, participant-level inference, missing-data rules, multiplicity
policy, effect sizes, intervals, and an independently rerunnable analysis bundle.

## **22.4 Rust module boundary**

```text
wasm/src/analysis/
  spec.rs          # validated methods, parameters, estimands, seeds
  result.rs        # typed result and validity envelope
  provenance.rs    # hashes, crate/plugin versions, backend
  diagnostics.rs   # assumptions, warnings, failures
  descriptive.rs
  uncertainty.rs
  association.rs
  anomaly.rs
  clustering.rs
  graph.rs
  temporal.rs
  spatial.rs
  reduction.rs
  tda.rs
```

The ABI remains pointer/length based with bounds-checked, versioned envelopes. Rust owns
calculation buffers; TypeScript owns plugin selection, cancellation, capability negotiation,
privacy policy, and presentation. No statistical module may import Three.js, WebXR, or renderer
state.

---

# **23\. Non-functional requirements**

## **NFR-1: Reproducibility**

Given:

dataset fingerprint  
\+  
algorithm version  
\+  
parameters  
\+  
seed

the same DatasetSpace must be reproducible.

---

## **NFR-2: VR frame rate**

Analytical recomputation must not block the render loop.

Use:

UI thread  
    │  
    ├── rendering  
    └── interaction  
          │  
          ▼  
       workers  
          │  
          ├── embedding  
          ├── clustering  
          ├── TDA  
          └── recommendation

The existing Draco solver worker provides a precedent for this architectural direction.

---

## **NFR-3: Progressive computation**

Large datasets should load:

schema  
 ↓  
coarse DatasetSpace  
 ↓  
regions  
 ↓  
structures  
 ↓  
detail

rather than waiting for every analysis to finish.

---

## **NFR-4: Analytical provenance**

Every derived spatial structure must carry:

source dataset  
algorithm  
parameters  
version  
timestamp

---

## **NFR-5: Explainability**

Every automated Atlas recommendation must have:

reason  
evidence  
confidence  
target  
action

---

## **NFR-6: Graceful degradation**

Nemosyne must remain functional without an LLM.

Minimum mode:

Dataset  
 → DatasetSpace  
 → deterministic analysis  
 → deterministic Draco  
 → VR

Enhanced mode:

\+  
LLM semantic interface

---

# **24\. Performance budgets**

For stable release I would establish explicit budgets rather than vague "low latency".

### **Interaction**

| Operation | Target |
| ----- | ----- |
| point/region selection | \<50 ms |
| semantic zoom initiation | \<100 ms |
| gesture-to-command | \<50 ms |
| camera/world manipulation | frame-bound |
| local inspection | \<100 ms |

### **Analytical**

| Operation | Target |
| ----- | ----- |
| basic DatasetSpace creation | \<2 s for reference dataset |
| local region analysis | \<500 ms |
| Draco deterministic recommendation | \<250 ms |
| background full analysis | non-blocking |

The exact budgets should subsequently be benchmarked against representative datasets rather than treated as universal laws.

---

# **25\. Stable-release scope**

I would define the stable release as **the smallest version that demonstrates the complete analytical loop**.

It must contain:

### **Required**

* Dataset ingestion  
* DatasetSpace  
* reproducible spatial embedding  
* whole-dataset 3D representation  
* neighbourhood structure  
* clustering  
* basic density analysis  
* existing TDA capabilities integrated  
* semantic zoom  
* region/cluster/observation hierarchy  
* deterministic Atlas recommendations
* recommendation explanation  
* manual override  
* recommendation history  
* spatial interaction  
* AnalysisHistory integration  
* SessionStore integration  
* researcher observation mode  
* participant/observer roles  
* collaboration  
* event/observation capture  
* protocol-controlled intervention  
* reproducible study harness  
* 2D / VR comparison conditions
* counterbalancing  
* trial/outcome capture  
* frozen experiment package  
* release rehearsal

### **Not required for stable release**

* sophisticated autonomous LLM agent  
* fully learned recommendation policy  
* complex gesture foundation models  
* arbitrary multimodal models  
* large-scale distributed analytics  
* every proposed visual metaphor  
* every advanced TDA feature

This prevents the project from becoming a technological Christmas tree.

---

# **26\. Feature acceptance matrix**

| Capability | Status | Acceptance test |
| ----- | ----- | ----- |
| Full DatasetSpace | **PROPOSED** | Entire reference dataset represented in one coherent space |
| Spatial provenance | **PROPOSED** | Coordinates can be traced to method/features |
| Clusters | **PROPOSED** | Actual reproducible cluster computation |
| Regions | **PROPOSED** | Regions can be entered/exited/inspected |
| Density | **PROPOSED** | Density structures represented |
| TDA | **PROPOSED** | Existing Mapper/TDA integrated into spatial model |
| Datapoint inspection | **PROPOSED** | Individual observations remain inspectable |
| Semantic zoom | **PROPOSED** | Region → cluster → observation navigation |
| Atlas analytical guidance | **PROPOSED** | Recommends analytical action |
| Draco v1 visual embodiment | **CURRENT** | Existing ConstraintEngine handles embodiment |
| LLM | **NO, optional** | System remains fully functional without it |
| Research context | **PROPOSED** | Hypothesis/question can influence guidance |
| Research events | **PROPOSED** | Actions and observations recorded |
| Observer mode | **PROPOSED** | Observer can monitor participant |
| Collaboration | **PROPOSED** | Multiple roles can share analytical session |
| Intervention control | **PROPOSED** | Intervention permissions enforced and recorded |
| Session persistence | **PROPOSED** | Full analytical world reloads |
| Reproducible experiment harness | **PROPOSED** | Study package can be frozen/replayed |

---

# **27\. Proposed codebase changes**

The current source structure is already reasonably well separated across `analytics`, `data`, `draco`, `vr`, `network`, `ai`, `ui` and related modules.

I recommend evolving it rather than restructuring the entire repository.

src/  
├── analytics/  
│   ├── TDAMapper.ts                 existing  
│   ├── spatial/  
│   │   ├── DatasetSpace.ts          NEW  
│   │   ├── SpatialEmbedding.ts     NEW  
│   │   ├── SpatialGraph.ts         NEW  
│   │   ├── DensityAnalysis.ts      NEW  
│   │   ├── ClusterAnalysis.ts      NEW  
│   │   ├── StructureDiscovery.ts   NEW  
│   │   └── SpatialProvenance.ts    NEW  
│  
├── data/  
│   ├── Dataset.ts                   existing  
│   ├── DatasetOperations.ts        existing  
│   ├── AnalysisHistory.ts           extend  
│   ├── SessionStore.ts              extend  
│   └── ResearchEvents.ts            NEW  
│  
├── draco/  
│   ├── ConstraintEngine.ts          retain/refactor  
│   ├── DracoSolverWorker.ts         extend  
│   ├── Atlas.ts                      NEW
│   ├── DracoAnalyst.ts              NEW  
│   ├── DracoEvidence.ts             NEW  
│   ├── DracoResearchContext.ts      NEW  
│   ├── DracoTopologyNode.ts         refactor  
│   ├── VRTopologyTranslator.ts      retain/refactor  
│   └── ...  
│  
├── ai/  
│   ├── IntentInterpreter.ts          NEW  
│   ├── RecommendationExplainer.ts   NEW  
│   └── LLMProvider.ts                NEW  
│  
├── research/  
│   ├── Study.ts                      NEW  
│   ├── StudyProtocol.ts              NEW  
│   ├── Participant.ts                NEW  
│   ├── Observer.ts                   NEW  
│   ├── ResearchEvent.ts              NEW  
│   ├── Observation.ts                NEW  
│   └── ExperimentHarness.ts          NEW  
│  
├── network/  
│   └── ...  
│  
└── vr/  
    └── ...

---

# **28\. Migration strategy**

## **Phase 0: Architectural freeze**

**Do not add further Draco metaphor rules.**

Document the current API and freeze it as:

> Draco Embodiment Engine v1

This prevents additional technical debt accumulating in the wrong layer.

---

## **Phase 1: DatasetSpace**

Build:

Dataset  
 ↓  
SpatialEmbedding  
 ↓  
DatasetSpace

with one deterministic embedding and provenance.

**Exit criterion:** the complete dataset can be loaded into a persistent spatial representation independent of Draco.

---

## **Phase 2: Structure discovery**

Integrate:

* existing clustering  
* TDA Mapper  
* Betti-0  
* persistence  
* density  
* neighbourhood graph

**Exit criterion:** structures are first-class objects rather than inferred indirectly by the renderer.

---

## **Phase 3: Draco analytical layer**

Build:

DatasetSpace  
\+  
ResearchContext  
\+  
StructureDiscovery  
        ↓  
Atlas

**Exit criterion:** Draco can recommend *where/what/how to investigate*, not merely what geometry to render.

---

## **Phase 4: VR semantic interaction**

Implement:

* semantic zoom  
* region navigation  
* structure isolation  
* slicing  
* world transform  
* inspection  
* reset  
* teleportation

**Exit criterion:** every major V5 interaction maps to a testable analytical command.

---

## **Phase 5: Research instrumentation**

Implement:

* ResearchEvent  
* observation records  
* researcher/participant roles  
* observer mode  
* intervention control  
* collaboration  
* replay

**Exit criterion:** a complete research session can be reconstructed from the event history.

---

## **Phase 6: Experiment harness**

Implement:

Study  
 ├── participants  
 ├── conditions  
 ├── counterbalancing  
 ├── tasks  
 ├── trials  
 ├── outcomes  
 ├── observations  
 └── frozen configuration

Support standard 2D and VR as the controlled experimental conditions. Desktop 3D is not an
Atlas product feature or study condition. `DesktopControls` remains only as a non-VR input
fallback for development, accessibility, and recovery.

**Exit criterion:** a study can be executed, captured and replayed without manually reconstructing the configuration.

---

## **Phase 7: LLM layer**

Only after deterministic Atlas is operational.

Implement:

Natural language  
 ↓  
Intent parser  
 ↓  
Atlas analytical API
 ↓  
Deterministic evidence  
 ↓  
Recommendation  
 ↓  
LLM explanation

**Exit criterion:** removing the LLM does not remove core analytical capability.

---

# **29\. Definition of Done for Atlas**

Atlas should not be considered complete when it produces attractive VR scenes.

It is complete when the following scenario works end-to-end:

> A researcher loads a dataset containing multiple variables and observations. Nemosyne constructs a reproducible spatial representation of the complete dataset. The system identifies meaningful spatial structures. The researcher enters the dataset space, navigates into a region, expands a cluster, compares it with another region, inspects individual observations, and changes the analytical projection. Draco explains why a structure has been highlighted and recommends a next analytical action. The researcher can accept or reject that recommendation. Every transformation and observation is recorded. Another researcher can reload the session and reproduce the analytical state.

That is the **golden path**.

---

# **30\. Product success criteria**

The architecture should ultimately be judged against Nemosyne's research hypothesis, not the sophistication of its rendering engine.

The most important metrics become:

### **Spatial comprehension**

Can researchers identify dataset-level structures that are difficult to perceive in 2D?

### **Discovery**

Does the system help researchers identify meaningful relationships, clusters, transitions or anomalies?

### **Analytical efficiency**

Does immersive spatial exploration reduce time-to-insight for defined research tasks?

### **Reproducibility**

Can another researcher reconstruct the analytical path that produced an observation?

### **Recommendation usefulness**

Do Atlas recommendations lead to productive analytical actions?

### **Research validity**

Can the system support a controlled empirical comparison between canonical 2D and VR without
changing the underlying analytical task?

### **Qualitative evidence**

Can researchers observe and record participant behaviour in the VR environment while preserving the relationship between:

participant behaviour  
\+  
dataset state  
\+  
researcher observation  
\+  
system intervention  
\+  
experimental outcome

That final relationship is especially important for Nemosyne's research ambitions.

---

# **31\. Final architectural position**

I would make this the central statement of the product specification:

> **Nemosyne is not a system for putting datasets into 3D. It is a system for constructing an analytically meaningful spatial world from a dataset and enabling researchers to investigate that world.**

And therefore:

> **Draco is not primarily a visualisation recommender. Draco is the analytical guidance layer that interprets dataset structure, research intent and researcher activity to recommend meaningful investigative actions and their appropriate spatial embodiment.**

The current codebase is actually closer to this destination than it first appears. The repository already has a dataset abstraction, deterministic data operations and clustering, a TDA layer, analysis history, persistent sessions, Draco constraints and VR translation.

The main architectural job is therefore **not to invent another pile of features**.

It is to put those pieces into the correct causal order:

                ┌─────────────────────┐  
                 │     FULL DATASET    │  
                 └──────────┬──────────┘  
                            ↓  
                 ┌─────────────────────┐  
                 │   DATASET MODEL     │  
                 └──────────┬──────────┘  
                            ↓  
                 ┌─────────────────────┐  
                 │    DATASET SPACE    │  
                 │  "Where everything  │  
                 │   meaningfully is"  │  
                 └──────────┬──────────┘  
                            ↓  
                 ┌─────────────────────┐  
                 │ STRUCTURE DISCOVERY │  
                 │ clusters / regions  │  
                 │ topology / density  │  
                 │ anomalies / paths   │  
                 └──────────┬──────────┘  
                            ↓  
                 ┌─────────────────────┐  
                 │       DRACO         │  
                 │ "What should I      │  
                 │ investigate next?"  │  
                 └──────────┬──────────┘  
                            ↓  
                 ┌─────────────────────┐  
                 │   VR EMBODIMENT     │  
                 │ "How should I       │  
                 │ experience it?"     │  
                 └──────────┬──────────┘  
                            ↓  
                 ┌─────────────────────┐  
                 │     RESEARCHER      │  
                 └──────────┬──────────┘  
                            ↓  
                 ┌─────────────────────┐  
                 │ OBSERVATION / DATA  │  
                 │ / COLLABORATION     │  
                 └──────────┬──────────┘  
                            │  
                            └──────→ back to Draco

**That is the architecture I would now use as the governing specification for the stable-release roadmap.**

It also gives you a much cleaner product boundary: **analytics establishes what exists, DatasetSpace establishes where it exists, Draco decides what is worth investigating, and VR determines how the researcher experiences it.** The LLM then sits above that machinery as a semantic interface, rather than becoming the machinery itself.
