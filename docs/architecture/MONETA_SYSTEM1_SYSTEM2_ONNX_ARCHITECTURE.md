# Moneta System-1 / System-2 and ONNX Architecture Decision

**Status:** proposed architecture for FM5 implementation  
**Date:** 29 September 2026  
**Roadmap owner:** [FM5 - Intuitive Moneta / System-1 Decision Driver](../roadmap/P1_FULL_MONETA_INCREMENTAL_CAPABILITY_PLAN.md#fm5--intuitive-moneta--system-1-decision-driver)  
**Related:** [Full Moneta semantic embodiment architecture](FULL_MONETA_SEMANTIC_EMBODIMENT_ARCHITECTURE_PLAN.md), [Product transition and learning plan](../roadmap/P1_PRODUCT_TRANSITION_PLATFORM_AND_LEARNING_PLAN.md), [Architecture](../ARCHITECTURE.md), [PT8 gesture model review](../review-plans/P1_PT8_GESTURE_MODEL_UPDATE_LOOP_2026-09-05.md)

## 1. Decision summary

Nemosyne should not build one general "System-1 ONNX model", and System-2 should not be represented as an ONNX model.

The architecture is:

1. **System-1 Perception**: a small, fast, object-centric temporal model may infer bounded physical interaction cues from hand, gaze, object and runtime context.
2. **System-1 Forma/Representation Proposal**: a small, fast model or transparent learned ranker may propose bounded representation primitives, template/binding candidates, compositions or search ordering from already-governed semantic/Moneta features, investigation intent and perceptual/device budget.
3. **Deterministic resolvers** convert System-1 outputs into typed proposals. Perception does not directly emit NIL commands; representation learning does not bypass Moneta hard constraints.
4. **System-2 Moneta** remains the explicit reasoning, evidence-admission, alternative-generation, search, challenge and representation-authority layer. It may consume System-1 proposals as heuristics but must be able to ignore, challenge, reproduce and replace them.
5. **ONNX is a deployment/runtime format, not an architectural authority.** Use it where a learned nonlinear model demonstrates value. Do not force transparent linear ranking, deterministic interaction resolution, or System-2 reasoning into ONNX.

This preserves the existing ontology boundary:

```text
physical input
  -> System-1 perception cues
    -> deterministic interaction resolver
      -> InteractionIntent
        -> NIL
          -> Investigation / Atlas

governed evidence + intent + candidate features
  -> System-1 Forma/representation proposal
    -> Moneta System-2 constraints/reasoning/search
      -> governed RepresentationDecision / RepresentationGraph
        -> deterministic Moneta Forma admission/compiler
          -> PerceptualEmbodimentPlan
```

## 2. Architectural evaluation

### 2.1 Current assets

The repository already has most of the required governance infrastructure:

- PT6-PT8 provide governed collection, user-disjoint snapshots, reproducible training, ONNX candidate export, held-out evaluation, explicit promotion and rollback.
- `modules/gesture-intelligence/` provides a standalone 56-feature gesture model specimen with heuristic and ONNX paths.
- `src/vr/perception/MultimodalPerceptionEnvelope.ts` demonstrates freezeable perception metadata, but its fixed confidence thresholds and string `resolvedAction` synthesis are laboratory-only and are not an acceptable production semantic boundary.
- `src/fitness/` provides content-addressed learned fitness artifacts, pairwise feature snapshots, promotion policy and exact model pinning.
- `LearnedMonetaRuntime` already constrains learned ranking to operate after bootstrap candidate generation and hard constraints.
- NIL already defines the modality-independent interaction boundary.

The main gap is therefore not "add ONNX". It is to define a common, governed System-1 contract and decide which tasks deserve learned inference.

### 2.2 Scope split

| Capability | System | Learned model? | ONNX default? | Authority |
| --- | --- | --- | --- | --- |
| Physical hand/object intent cues | System-1 perception | Yes, if better than deterministic baselines | **Yes candidate** | Advisory only |
| Named symbolic gesture vocabulary | System-1 perception | Experimental only | Optional | Advisory only |
| Gaze target candidate | Perception/runtime | Usually geometric/deterministic | No | Advisory targeting |
| Voice transcription / NLU | Separate modality provider | Provider-specific | No shared requirement | Advisory until NIL |
| Representation candidate ranking | System-1 Forma/representation | Yes | **Not initially required** | Advisory only |
| Representation/composition proposal | System-1 Forma/representation | Yes when bounded | Optional | Advisory only |
| Perceptual binding/template proposal | System-1 Forma/representation | Only after deterministic FM3 grammar is qualified | Optional | Advisory only; Forma/System-2 admits |
| Hard scientific constraints | System-2 Moneta | No learned authority | No | Moneta |
| Evidence admissibility | System-2 / evidence protocol | No | No | Evidence authority |
| Alternative generation/challenge | System-2 Moneta | Search/reasoning | No ONNX requirement | Moneta |
| Evolutionary/adversarial representation search | System-2 laboratory/search | Algorithmic, may use learned heuristics | Learned heuristics may use ONNX | Search remains explicit |
| NIL semantic command | Interaction authority | No direct model output | No | NIL |

### 2.3 Why not one multimodal ONNX model?

A single fused model would couple unrelated update rates, evidence sources, training corpora and failure modes:

- physical perception is frame/trajectory-based and latency-sensitive;
- representation choice is event-driven and evidence-sensitive;
- voice has separate privacy, model-size and provider concerns;
- scientific admissibility must remain explicit and fail-closed;
- a fused model makes treatment freezing, replay, debugging and promotion harder;
- model changes would unnecessarily perturb unrelated behaviours.

The correct reusable unit is therefore a **System-1 model contract**, not a single System-1 model.

## 3. System-1 common contract

Every learned System-1 artifact must expose, at minimum:

- model ID and semantic purpose;
- model version and content hash;
- exact feature-schema version;
- training-snapshot hash and curation-policy hash;
- trainer/environment/source revision identities;
- ONNX/ORT opset and operator inventory when applicable;
- input/output names, shapes, dtypes and bounded dimensions;
- model byte size and expected working-memory envelope;
- evaluation reports and declared target device/runtime profiles;
- calibration status;
- known failure/OOD conditions;
- promotion stage;
- research-treatment freeze status;
- runtime execution provider actually used;
- inference latency and fallback/abstention reason.

A System-1 result must distinguish:

- raw score/logit;
- calibrated probability, only when calibration has been demonstrated for that output;
- `ABSTAIN` / `UNKNOWN`;
- model/runtime provenance;
- input feature-schema identity;
- inference timestamp and observation age.

The word `confidence` must not be used as a generic label for an arbitrary score.

## 4. System-1 Perception Model

### 4.1 Product goal

Infer **object-centric interaction cues**, not a secret gesture language.

The first production model should answer questions such as:

- is this movement intentional interaction or incidental motion?
- which object is most likely targeted?
- is the user approaching, retreating, holding, releasing or transforming?
- is movement bimanually coordinated?
- is the interaction stable enough to commit?
- is tracking quality sufficient to interpret the action?
- is the user hesitating or repeatedly failing to acquire a target?

Named gestures such as `scoopUp` or `pushForward` remain optional experiments. They do not define the core command vocabulary.

### 4.2 Feature schema V2

The existing 56-vector remains a frozen V1 baseline. V2 should be a short temporal sequence containing only bounded, versioned inputs needed for intent inference.

Candidate per-frame features:

- left/right hand or controller position/orientation;
- pinch/grab/contact state from deterministic device signals;
- linear/angular velocity and acceleration;
- hand-to-hand distance and relative transform;
- selected/hovered/nearest interactable identity encoded as bounded categorical/context features;
- hand-to-target relative position/direction/distance;
- object affordances and interaction mode;
- gaze target candidate/dwell, where consent/runtime supports it;
- tracking-validity masks;
- head-relative transforms where required for invariance.

Raw camera imagery is explicitly out of scope.

### 4.3 Model family

First neural candidate:

```text
bounded temporal feature window
  -> small per-frame projection
    -> tiny temporal convolution network
      -> cue heads + UNKNOWN/ABSTAIN
```

A small TCN is preferred over a transformer for the first candidate because the problem is short-window temporal classification/regression, model/runtime footprint matters, and the architecture can remain within broadly supported ONNX operators.

The deterministic baseline remains mandatory. A neural model is promoted only if it improves the bounded product metrics.

### 4.4 Output boundary

The model emits typed `InteractionCue` values, never string actions:

```text
InteractionCueSet
  intentionality
  targetLikelihood[]
  grabLikelihood
  releaseLikelihood
  transformLikelihood
  approachRetreat
  bimanualCoordination
  trackingQuality
  abstainReason?
```

A deterministic, versioned resolver combines these cues with object affordances and interaction state to produce `InteractionIntent`. Only then can NIL be constructed.

This prevents a learned perception model from becoming a hidden second command system.

## 5. System-1 Forma / Representation Proposal Model

### 5.1 Product goal

Quickly propose promising representation primitives, bounded compositions, metaphor/template IDs, perceptual-binding candidates or search ordering so System-2 and deterministic Moneta Forma can spend expensive reasoning/admission effort where it is useful. The model proposes where to look; it does not author the final perceptual plan.

### 5.2 Inputs

Only canonical governed inputs may be consumed:

- candidate raw fitness components;
- dataset structure/evidence references already admitted by Moneta;
- versioned `InvestigationIntent`;
- representation/ontology identity;
- candidate/RepresentationGraph bounded features;
- qualified `PerceptualBinding` / metaphor-template features once FM3 Forma contracts exist;
- information-preservation/loss descriptors;
- device/perceptual budget and channel availability;
- explicit researcher-context fields allowed by policy.

The model must not traverse raw datasets independently or manufacture analytical features in TypeScript.

### 5.3 Initial model decision

Do **not** replace the existing transparent pairwise/ranking-linear path merely to obtain an ONNX file.

Sequence:

1. current linear learned ranker remains the baseline;
2. define a richer, versioned proposal-feature schema when FM1-FM4 inputs are stable;
3. compare transparent linear ranking with a very small MLP/nonlinear ranker;
4. export to ONNX only if the nonlinear candidate produces material held-out benefit or a runtime-portability benefit.

Likely nonlinear candidate after deterministic Forma baselines exist:

```text
bounded canonical semantic + intent + candidate/template features
  -> Dense 32
    -> Dense 16
      -> proposal priority / pairwise preference / abstention head
```

Do not train a model to emit raw renderer parameters. Proposal outputs must name bounded registered representation/template/binding choices that System-2/Forma can independently validate.

### 5.4 Training before FM6

FM5 must not smuggle human-adaptive learning forward ahead of FM6.

Permitted FM5 training evidence:

- known-answer representation controls;
- reproducible System-2 search/evaluation outcomes;
- synthetic/metamorphic task variants with explicit labels;
- governed historical pairwise evidence already admissible under the existing learning contracts.

A useful FM5 experiment is **distillation from System-2 + deterministic Forma**: run slower governed reasoning/search and binding admission over a bounded corpus and train System-1 to predict which representation/binding/template candidates are worth exploring first. The student proposal does not inherit System-2 or Forma authority.

New product judgement/discovery-outcome adaptation belongs to FM6/PT9.

## 6. System-2 Moneta

System-2 is not an ONNX model requirement.

It owns:

- hard constraints;
- evidence admissibility and ABSTAIN;
- explicit candidate/composition reasoning;
- alternatives and Road Not Taken;
- sensitivity/stability checks;
- challenge/falsification;
- bounded grammar/search;
- evolutionary/adversarial laboratory search;
- explanation/provenance;
- final governed `RepresentationDecision`.

System-1 may alter **search order, proposal priority or candidate coverage**. It may not redefine truth, admissibility or final scientific meaning.

If future System-2 search uses a learned heuristic, that heuristic is another System-1-style advisory artifact inside the search algorithm and is governed separately.

## 7. Runtime architecture

### 7.1 Execution provider decision

For web/XR, use ONNX Runtime Web behind a provider-neutral port.

Baseline order:

1. **WASM** for small models and broad compatibility;
2. **WebGPU** only when feature-detected and measured to improve the target model/device envelope;
3. **WebNN** is not a production dependency at this stage;
4. deterministic fallback or ABSTAIN when no qualified runtime exists.

ONNX Runtime's current web guidance explicitly positions WASM as suitable for very lightweight models and WebGPU for more compute-intensive models. WebGPU/WebNN operator support is a subset of WASM support, so model export must remain within a qualified operator set.

### 7.2 Render-loop isolation

No synchronous model execution on the XR render critical path.

- perception inference runs in a dedicated worker or equivalent isolated scheduling path;
- render code consumes the latest bounded, timestamped cue result;
- stale results are rejected by observation-age policy;
- representation inference is event-driven, not per-frame;
- inference must not acquire analytical authority handles or Three.js scene ownership.

### 7.3 Initial engineering budgets

These are design targets to falsify on target hardware, not claims of achieved performance:

| Budget | Initial target |
| --- | --- |
| Main-thread inference work | none; orchestration/copy only |
| Perception output freshness | <= 100 ms p95 at consumption |
| Representation proposal latency | <= 100 ms p95 after canonical features are available |
| Cold model load | measured and surfaced; must not block XR session start |
| Model/runtime memory | bounded by device profile and recorded in qualification |
| Thermal/long-session impact | measured during UXR device qualification |

Promotion is based on measured Quest/browser and desktop profiles rather than these numbers alone.

## 8. ONNX artifact constraints

Initial production-compatible ONNX artifacts should:

- use fixed or tightly bounded tensor shapes;
- avoid custom operators;
- avoid external model-data dependencies;
- publish the required operator/opset inventory;
- pass ONNX checker/runtime load tests;
- pass source-framework vs ONNX numerical-parity tests;
- pass deterministic fixture tests for feature ordering and output interpretation;
- reject schema/model-card mismatch before inference;
- be content-addressed and distributed through the governed model registry;
- support exact rollback.

Quantization is an evaluated optimization, not a default claim. ONNX Runtime supports static and dynamic 8-bit quantization, but quantization can reduce accuracy and may fail to improve performance on some hardware. Candidate quantized artifacts therefore require separate parity, quality and device benchmarks.

A reduced-operator or ORT-format runtime build may be considered if runtime binary size becomes a measured deployment bottleneck. Do not introduce that complexity pre-emptively.

## 9. Training and evidence requirements

### 9.1 Perception

Required dataset properties:

- explicit consent and purpose separation;
- participant-disjoint train/validation/test;
- session-disjoint holdout where feasible;
- device/runtime stratification;
- abundant incidental-motion/negative examples;
- tracking-loss and partial-observation examples;
- target/context ambiguity examples;
- accessibility/handedness variation where collected;
- label provenance for user confirmation/correction;
- derived features by default;
- raw trajectory capture only under separate explicit research consent.

Primary product metrics should include:

- false activation rate;
- missed-intent rate;
- target-selection error;
- ABSTAIN/OOD behaviour;
- user/session/device generalisation;
- end-to-end interaction completion/friction;
- calibration metrics only for outputs represented as probabilities.

Aggregate classification accuracy alone is insufficient.

### 9.2 Representation proposal

Required evaluation:

- user/investigation/dataset-group disjointness appropriate to the evidence source;
- pairwise/top-k candidate agreement where relevant;
- candidate-coverage recall against System-2;
- regret or utility loss relative to the governed slower baseline;
- ABSTAIN/OOD performance;
- known-answer controls;
- stability under irrelevant input perturbation;
- latency/footprint;
- subgroup failure analysis by dataset structure and investigation-intent class.

The key FM5 question is not "is the classifier accurate?" It is "does the fast proposal reduce System-2 work or improve useful candidate coverage without making decisions less trustworthy?"

## 10. Personalisation

Initial personalisation may alter only explicitly bounded calibration parameters such as:

- movement-scale normalization;
- dwell/commit thresholds;
- handedness/preferences;
- device-specific normalization.

On-device neural weight updates are out of scope for FM5.

Any later personalized model must be separately versioned, reversible, attributable, freezeable in Research Mode and evaluated against the global model. Personalisation must not silently change existing investigation replay.

## 11. Privacy and security

- raw hand trajectories and gaze are treated as purpose-bound interaction data;
- derived features are preferred for product learning;
- raw capture is opt-in and retention-governed;
- voice audio/transcripts are governed separately from hand/gaze features;
- no inference result may authorize privileged/network actions directly;
- model artifacts are content-addressed and promotion-signed;
- model loading enforces byte-size, shape, dtype, operator and schema bounds;
- no custom ONNX operator or arbitrary code-loading path is permitted in the initial runtime;
- model/runtime identity is included in study treatment and replay provenance.

## 12. Trade-offs and explicit decisions

| Question | Decision | Cost accepted |
| --- | --- | --- |
| One fused System-1 model? | **No. Specialist models behind a common contract.** | More artifact/version management |
| Named gesture vocabulary as core UX? | **No. Object-centric cues/direct manipulation first.** | Some evocative gestures remain experimental |
| Learned model directly emits NIL? | **No. Deterministic resolver owns intent -> NIL boundary.** | Resolver must be designed/tested |
| ONNX for every System-1 component? | **No. Use only when learned nonlinear inference earns it.** | Multiple runtime implementations |
| ONNX for System-2? | **No.** | System-2 remains explicit and potentially slower |
| Runtime default | **WASM first; WebGPU qualified opportunistically.** | May leave some acceleration unused initially |
| WebNN | **Not a dependency.** | Revisit when broadly deployable |
| Online weight learning | **No in FM5.** | Slower adaptation, much cleaner governance |
| Replay | **Record proposal/result; do not rerun inference implicitly.** | More persisted provenance |
| Failure behaviour | **ABSTAIN/fallback, never fabricated certainty.** | Some interactions/proposals remain unresolved |
| Quantization | **Benchmark-gated optimization.** | More artifact variants if adopted |

## 13. Implementation tranches

### FM5-S1A - contract and runtime boundary

- define `System1ModelArtifactV1`, `System1InferencePort`, result provenance and ABSTAIN semantics;
- define worker/runtime adapter and execution-provider reporting;
- generalize the useful PT7/PT8 artifact lineage/promotion machinery without coupling perception models to `FitnessModelRegistry`;
- freeze research-treatment identity and replay rules.

### FM5-S1B - object-centric perception

- specify Perception Feature Schema V2;
- build deterministic baseline;
- build tiny TCN candidate;
- replace `MultimodalPerceptionEngine` string-action semantics with typed cue contracts or archive it;
- route cue resolver -> `InteractionIntent` -> NIL;
- keep named gesture recognition behind an experimental flag.

### FM5-S1C - Forma / representation proposal

- wait for the FM3 `PerceptualBinding` / `PerceptualEmbodimentPlan` grammar to stabilize before pinning proposal outputs;
- define FM1-FM4 semantic/intent/device proposal feature schema;
- define bounded `FormaProposalSet` outputs over registered representation primitives, templates, bindings and search-order hints;
- retain deterministic policy + linear learned ranker as baselines;
- build System-2 + deterministic Forma distillation/evaluation corpus;
- test tiny nonlinear ranker only if the bounded proposal task justifies it;
- adopt ONNX only if it materially improves proposal coverage/cost without reducing trustworthiness.

### FM5-S1D - qualification

- source-framework/ONNX parity;
- device/browser execution-provider matrix;
- Quest and desktop latency/memory/thermal profiles;
- failure injection, stale-output and model-unavailable tests;
- research freeze/replay tests;
- STOP / CONTINUE / REVISE review against deterministic baselines.

FM6 may then add governed researcher/discovery-outcome learning to the qualified System-1 Forma/representation lane.

## 14. Falsifiers

Revise or stop this architecture if any of the following occurs:

- a learned perception component must emit domain commands directly to achieve usable latency;
- the deterministic cue resolver cannot preserve input-modality semantic parity;
- the small temporal model is not materially better than deterministic interaction logic;
- ONNX Runtime footprint or scheduling measurably harms XR stability;
- the representation proposal model fails to reduce search work or improve candidate coverage;
- System-1 advice causes hard-constraint or evidence-admission bypass;
- replay requires rerunning mutable inference to reproduce investigation meaning;
- model versioning/promotion complexity exceeds the product value;
- a single shared model is empirically simpler and safer after independent specialist baselines exist.

## 15. External runtime constraints checked

- ONNX Runtime Web supports WASM plus optional WebGPU/WebNN execution providers; its web guidance recommends WASM for very lightweight models and WebGPU for more compute-intensive models: <https://onnxruntime.ai/docs/tutorials/web/>
- ONNX Runtime WebGPU support and configuration: <https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html>
- ONNX Runtime quantization guidance and caveats: <https://onnxruntime.ai/docs/performance/model-optimizations/quantization.html>
- Reduced operator builds for constrained web/mobile environments: <https://onnxruntime.ai/docs/reference/operators/reduced-operator-config-file.html>
- PyTorch's current ONNX exporter is based on `torch.export`: <https://docs.pytorch.org/docs/main/onnx_export.html>

These are implementation constraints, not substitutes for Nemosyne's own target-device qualification.
