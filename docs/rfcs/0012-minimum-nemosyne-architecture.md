# RFC 0012 — Minimum Nemosyne architecture: remove before adapting

**Status:** PROPOSED; architecture scope reduction for owner review

**Governing authority:** [Definitive Vision](../Nemosyne_Definitive_Vision_and_Roadmap.md).
**Execution:** [ROADMAP](../ROADMAP.md). **Detailed retained contracts:** [dataset embodiment design](../architecture/MONETA_DATASET_FIRST_SEMANTIC_EMBODIMENT.md).

## 1. Context and decision requested

The previous ADAPT proposal retained too many planned mechanisms as apparent delivery prerequisites.
The vision requires useful discovery, evidence, inspectable composition, dual epistemic purposes,
durable investigation and improvement from human evidence. Those responsibilities do not require a
separate resident subsystem for every metaphor, modality, model family or research technique.

Approve a four-subsystem product and remove speculative machinery from its default execution path.
Retain the semantic/trust distinctions in RFC 0010/0011. Consolidation concerns executable ownership,
stores and scheduling; it does not collapse evidence into proposals or preference into truth.

This is a proposal for architecture and deletion work, not a claim that the named files are unused.
No executable code is deleted by this RFC. Changes to accepted deployment or public-format contracts
require the corresponding amendment before implementation. An accepted resulting ADR is pending.

## 2. Smallest architecture

```text
local dataset -> Rust evidence/query runtime -> governed bounded snapshot
                                               |
investigation state/intent --------------------> representation compiler
                                               | admitted plan + explanation
                                               v
                                      desktop / WebXR surface
                                               |
                                     semantic commands / critique
                                               v
                               investigation history + .nemosyne capture

optional offline research: consented evidence export -> evaluation/training/search
                           -> versioned proposal/prior artifact -> product validation
```

| Product subsystem | Single responsibility and retained authorities | Minimum implementation |
| --- | --- | --- |
| **1. Data and evidence runtime** | Rust owns data and N-dependent analytics; existing evidence policy owns permitted claims | Existing Rust/WASM plus bounded Worker queries, receipts, current disposition checks and family-specific outputs. Compute only requested analyses. |
| **2. Investigation** | Own committed intent/purpose, branches, discoveries, feedback, artifact selection and durable history | Existing InvestigationAggregate with Atlas as its application facade; persistence adapters and exact model references. One authoritative investigation store, with immutable history and materialized scene capture. |
| **3. Representation compiler (Moneta + Forma)** | Construct a bounded proposal, check feasibility/evidence, bind meaning, budget and explain the admitted result | Small deterministic evidence-bound composition grammar, inspectable alternatives, existing admission and spatial compiler. These remain separate functions/contracts within one subsystem. |
| **4. Presentation and input** | Display plans, collect actions and preserve bounded resources | One scene/interaction/lifecycle owner; desktop and WebXR are adapters. NIL remains the semantic command boundary. One inspector and history/alternative views expose the investigation. |

The smallest delivery has one dataset, two supported governed phenomena, a few explicit compositions,
bounded detail, one visual backend usable on desktop/Quest, explanation, confirmed critique, branch,
test/conclusion capture and save/reopen. Unsupported analyses return explicit refusal. Exploratory
work supports attributed human-authored or imported conjectures through existing admission and
disclosure. This proves the core loop, but does not by itself complete machine-generated abduction,
learned improvement or every Full Moneta exit.

The **full vision uses the same four subsystems**: qualified priors and generated compositions enter
the compiler through an optional bounded proposal/artifact seam. Offline research acquires and evaluates
them. Once qualified, an explicit request can run a bounded local generator or external producer; its
output crosses normal admission and is captured. Human-origin conjectures cannot be presented as proof
of predictive-model value. The later learned/synthesis capability remains a real delivery obligation,
with no requirement to host training, evolutionary populations or a world model inside the application.

## 3. Remove, merge, defer or externalize

“Delete” is the preferred target disposition. Where live callers or archives depend on an item, the
deletion tranche must remove/migrate those callers or keep a narrow read-only decoder. “Externalize”
does not authorize sending datasets or feedback anywhere; local offline packages are the default.

| Item / present source or planned abstraction | Decision | Small replacement or removal condition |
| --- | --- | --- |
| New `DATASET` representation primitive | **DELETE from proposal** | Dataset fingerprint supplies subject identity; primitives describe how meaning is represented. |
| Proposed `DatasetSubjectRefV1` object/store and automatic Snapshot V2 | **DELETE unless DSE0 proves a missing invariant** | Derive the subject key from the canonical fingerprint beside existing contracts. Add a wire field/version only if independent addressability/replay cannot be expressed otherwise. No subject registry. |
| Another persistent semantic-body graph between snapshot and RepresentationGraph | **DELETE** | Body is a view of snapshot plus selected bindings; keep no second mutable semantic world. |
| `SemanticEmbodimentGraphV1` as active second truth graph | **RETIRE production duplication** | Canonical snapshot owns grounded semantics; preserve only compatibility projection/decoder required by named consumers or old packages. Do not keep two writers. |
| `FullMonetaEngine` as mandatory intelligent orchestrator | **MERGE into one compiler request path; delete redundant coordinator after migration** | Atlas/Investigation owns request state; compiler owns generation/admission. Current `synthesizeOrAdapt` always generates/loads advice and runs search, even when advice is bypassed. A direct deterministic compile is required. |
| Mandatory System-1 inference / `FormaSystem1Proposer` for ordinary views | **REMOVE from default path; optional qualified acceleration** | Direct deterministic proposal. No model load or invocation when absent/disabled. Retain consumed artifact identity only when advice was actually used or explicitly benchmarked. |
| Separate System-2 model/runtime platform | **DELETE planned subsystem** | System-2 names explicit composition, constraints, alternatives and challenge functions in the compiler. No second inference stack required. |
| `RepresentationSearchEngine` population search and evolutionary operators | **MOVE research execution outside default product; DEFER interactive search** | Small deterministic enumeration in product. Offline lab may export bounded candidate graphs; retain admission and provenance validation in product. Reintroduce runtime search only for measured task benefit within budget. |
| `RepresentationGenomeHandoff` / genome format as product-wide ontology | **EXTERNALIZE genome interpretation** | Lab translates genomes into existing graph/proposal artifacts; product validates those. Retain legacy format reader only if supported archives require it. A new wire handoff needs explicit governance. |
| World models, shared/recurrent experts, adaptive-depth substrate (R-DSE-8) | **DELETE from committed architecture and roadmap** | No current requirement establishes necessity. Any future named prediction problem starts a separate evidence-led research proposal. |
| Full multimodal `BehaviourPlan`, audio/haptic semantic engines and generic backend/plugin framework | **DELETE speculative scaffolding; DEFER new channels** | One visual/spatial plan first. Ordinary accessibility and interaction feedback remain. A data-bearing new channel requires a demonstrated task and independently validated semantics. |
| Separate Memory Palace, Road Not Taken, TechnoCore, Farcaster, Evidence Vault stores/controllers | **MERGE product projections** | One investigation history/branch state, one inspector, one save/reopen facility, navigation actions. Keep useful names in UX; each does not justify its own state authority. ADR 0012 already removed a duplicate palace store. |
| Standalone Forma knowledge service / automatic critique learner | **DELETE planned service; MERGE local read view** | Versioned mapping manifest plus attributed cases in investigation/persistence. Offline curation may produce qualified priors; critique capture itself never trains or promotes. |
| `src/learning` training jobs, `FormaPriorEvaluator`, fitness evaluation experiments | **MOVE offline execution outside browser product** | Retain bounded export/import, artifact validation, explicit promotion/rollback and pinned inference. Reuse existing job/report formats; no replacement training platform. |
| Multiple model registries as independent promotion authorities | **MERGE overlapping ownership only after inventory** | Keep investigation-selected artifact references. `RuntimeModelRegistry` deployment authorization/training provenance and `FitnessModelRegistry` activation/history are distinct duties; a selected manifest cannot replace them. Preserve both duties and typed checks, then delete only proven duplication. |
| Neural gesture training, object-centric perception models, voice/gaze intelligence | **DEFER optional input helpers** | Controller/hand/mouse direct input through existing NIL. Preserve accessibility-critical supported inputs; add models only when measured friction justifies their data/runtime cost. |
| Default point-per-row overview and layout-first synthesis | **DELETE default route** | Bounded semantic overview; retain an explicitly requested observation/detail path. Unsupported overview must refuse rather than secretly render all rows. |
| Parallel fixed-candidate/graph/semantic-family runtime authorities (`VRTopologyTranslator`, graph adapters, layout classes) | **RETIRE redundant dispatch after caller migration** | One admitted-plan surface. Preserve distinct Rust analytical family builders and exact observation renderer where required. Delete a layout only after proving its needed semantics have a supported route. |
| Separate resolution policy in compiler, governor and scene | **MERGE policy ownership** | Compiler admits semantic cuts under one budget contract; runtime enforces measured resource limits and requests a new variant. Low-level GPU disposal remains runtime-owned. |
| New persistent `SemanticWorkingSet` manager | **DELETE abstraction** | Working set is the admitted plan plus existing lifecycle residency; no extra database, graph or broker. |
| Multi-dataset scene-composition contract and dataset join/recurrence platform | **DEFER** | First compare alternative views of one dataset. Add independent-dataset comparison only when that research question blocks use; retain separate fingerprints and explicit relation authority. |
| Real-time collaboration, presence/avatars, signalling and shared knowledge service | **DEFER hosted profile** | Portable governed packages support asynchronous review. Retain transport security obligations until actual removal; never relabel unauthenticated sharing as safe collaboration. |
| Live streams, generic connectors and River/Tethys behavior | **DEFER** | Versioned static import first. Domain temporal analysis can be supported without live infrastructure. |
| Required cloud governance/database deployment for local investigation | **DEFER hosted profile; retain local custody/consent** | Existing local persistence and package path. RFC0003–0005 and readiness obligations continue to govern hosted features; this RFC does not weaken them. |
| ScriptC, native Quest/Hexagon path, speculative WebGPU compute, WASM threads | **REMOVE from core delivery dependencies** | Existing browser/Rust/Worker/runtime first. Reopen only a measured bottleneck with a bounded experiment and explicit adoption result. |
| Statistical calibration, evidence gates, provenance, consent, export validation, study governance | **KEEP required rules; externalize heavy campaigns only** | Compile/use/import still validate current authority locally or through the existing authoritative service. Offline reports cannot self-authorize admission. |
| RFL/ASR, benchmark generation, model committees and broad experiment harnesses | **KEEP outside shipping application** | Repo/CI or research-lab tooling produces attributed evidence. Keep only runtime controls needed to freeze a treatment, record exposure and enforce permissions. |

## 4. Contract budget and options rejected

Retain four essential distinctions: grounded snapshot, committed investigation context, proposed
representation graph, and admitted materialized plan with reverse explanation. Conjectural proposals
remain explicitly separate from grounded snapshot facts. Receipts, feedback and model references attach
to those records. Multiple contracts can live in one subsystem without becoming separate services.

Reject a universal world/knowledge graph: it would mix facts, perception, history and proposals.
Reject removing RepresentationGraph in favor of direct renderer parameters: it loses compositional
meaning and alternatives. Reject rewriting the kernel/runtime: existing authority and lifecycle code
already supplies needed behavior. Reject preserving every current module behind a new adapter: that
keeps the runtime cost and maintenance burden. A component survives only if a named invariant or
user operation requires it; otherwise its code and exports should be removed after migration.

## 5. Performance consequences and success

At fixed semantic task complexity, overview transfer, JS traversal, scene elements and hit targets
must be bounded independently of N. Exact Rust ingestion/analysis may remain N-dependent. The direct
compile path loads no optional model, starts no search population, connects no optional service and
retains no parallel semantic graph. Cached work still checks evidence disposition and activation.

Success is a complete production journey: import -> question -> bounded multi-phenomenon view ->
explain -> refine -> alternative/critique -> test -> record conclusion -> save/reopen. It must work
with optional inference/search/network services unavailable. An exploratory conjecture stays visibly
typed and historically inspectable. Later qualified imported priors/candidates must improve a declared
held-out objective without adding another authority. Physical Quest and scoped human studies establish
performance and usefulness; software contract tests alone do not.

Use the detailed design's cost/benchmark protocol, including cold analysis, warm views, rare exceptions,
refinement, peak memory and task-equivalent controls. Report removed default calls/dependencies and
retained compatibility adapters alongside measured timings. Fewer modules alone is not success if
investigation meaning, accessibility, recovery or useful performance is lost.

## 6. Migration and revised delivery

1. **DSE0 — reduction preflight:** confirm the four-subsystem decision, build a caller/export/archive
   inventory for each removal, select two existing analytical phenomena and verify the direct compile
   path. Prefer deriving subject identity with existing schemas. Resolve only necessary public-format
   changes now; multi-dataset schema and generalized generator contracts are deferred.
2. **DSE1 — smallest complete grounded loop:** stable dataset selection, deterministic bounded body,
   explanation, attributed critique, basic alternative/branch and package restoration. Remove default
   whole-row, compulsory advice/search and duplicate state from this route.
3. **DSE2 + DSE3 — useful depth and dual mode:** preserve detail/return under budgets; finish explicit
   conjectural proposal/disclosure and critique-to-alternative flow. Reuse existing Investigation/NIL
   actions and captured artifacts. No generic modality engine or training runtime.
4. **DSE6 — continuous qualification:** begin physical/task checks with DSE1, then qualify the completed
   loop. Do not wait for DSE4/5. QCA optimization follows measured costs in this reduced path.
5. **DSE4 multi-dataset and DSE5 runtime search/inference — conditional:** reopen for a named blocking
   research task and measured incremental value. Offline acquisition/evaluation of learned priors and
   generated candidates may continue; the full vision's learning and synthesis exits remain open.

For each executable deletion: record live entry points, migrate/remove callers and exports, preserve
supported archive reads and negative controls, run relevant production/replay tests, and delete the
old implementation in that tranche. Do not create permanent dual-write bridges. Capture rollback as
versioned code/artifacts, not a second active authority. Update capability/readiness registries when
their deployed/service obligations actually change; this proposal leaves their current records intact.

## 7. Research still required

The unresolved questions are useful semantic compositions, task-preserving detail policies, reliable
critique/meaning measures, conspicuous conjecture disclosure and physical performance. Each already has
an objective/success criterion in R-DSE-1–7. Search/evolution research belongs outside the product until
it beats deterministic composition on declared held-out tasks and resource cost. No additional world
model or adaptive-depth programme is a prerequisite. Failure of the small loop to support discovery
must trigger revision of the representations or workflow before adding intelligence infrastructure.

## 8. Verification and adversarial contract

Invariant: removal reduces active responsibilities while preserving analytical authority, dual-purpose
typing, explanation, immutable investigation, learning evidence and exact supported replay. Attack the
actual import -> Atlas -> compiler -> surface -> action -> archive path with optional producers absent,
malformed imported artifacts, stale results, tight budgets and old archives. A newly plausible failure
is moving learning/search outside the app while also accidentally moving its admission checks; all
imported outputs must still face product enforcement. DSE0 must identify these production falsifiers
before deleting code. Acceptance of this RFC authorizes its scoped implementation planning, not an
unreviewed repository-wide deletion.
