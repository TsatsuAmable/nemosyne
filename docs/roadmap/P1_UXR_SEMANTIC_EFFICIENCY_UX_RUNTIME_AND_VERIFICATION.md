# P1-UXR — Semantic-Efficiency UX, Runtime Simplification & Verification

**Status:** PRIORITY 1 / PLANNED  
**Established:** 6 September 2026  
**Canonical implementation-status authority:** `docs/ROADMAP.md`  
**Canonical product/research vision:** `docs/Nemosyne_Definitive_Vision_and_Roadmap.md`  
**UX doctrine:** `docs/NEMOSYNE_USER_EXPERIENCE_DESIGN_DOCTRINE.md`  
**Execution policy:** one forward implementation tranche at a time; fresh-main sync, focused falsification, exact-head evidence, fix-forward, merge.

## Purpose

This programme converts the newly established semantic-efficiency and user-experience doctrine into the next implementation priority.

Nemosyne is not a game or a film. Its world exists to help an investigator perceive, question, manipulate and defend meaningful structure in data. The runtime therefore should not maximise scene richness or raw visible row count. It should deliver the cheapest reliable spatial embodiment that preserves the currently required meaning, stays natural to use, responds immediately, and remains stable over long sessions.

The governing optimisation order is:

1. preserve analytical/semantic truth and provenance;
2. make the representation legible and naturally manipulable by a human;
3. protect interaction fidelity and perceptual responsiveness;
4. minimise CPU, GPU, memory, allocation, transfer, draw-call and thermal cost;
5. spend surplus hardware capacity on deeper semantic resolution, larger resident working sets and longer stable sessions rather than compensating for inefficient baseline execution.

The central runtime boundary is:

> **Durable investigation/representation state owns meaning. Three.js/WebXR/GPU objects are disposable projections of that state.**

This programme is intentionally limited to already-public product/engineering direction. Detailed unpublished discovery-preservation mathematics, observer models, loss/certificate algorithms and related IP-sensitive mechanisms remain outside the public repository until the IP review permits publication.

---

# 1. Priority-one execution order

P1-UXR supersedes PT6 as the **next product-development priority** once the currently active integration PR is resolved. PT6-PT10 remain relevant and resume after this bounded programme or when explicitly re-ordered by the product owner.

```text
current open integration work resolved
  -> UXR0 baseline + replacement qualification contract
    -> UXR1 interaction/UI substrate de-customisation
      -> UXR2 render/resource efficiency + lifecycle governor
        -> UXR3 bounded semantic working set + progressive materialisation
          -> UXR4 verification-infrastructure refocus
            -> UXR5 physical Quest qualification + STOP review
              -> resume PT6+ / compositional Moneta prerequisites
```

The programme must not become an indiscriminate dependency-migration sprint. Every substitution needs a named UX/maintenance/performance defect and evidence that the proposed mature implementation is at least performance-neutral on the target device.

---

# 2. User-experience target

## 2.1 Experience invariants

The user should experience:

- **natural interaction:** pointing, touching, grabbing, selecting, moving and navigating behave predictably with minimal learning burden;
- **immediate response:** perceptual acknowledgment is prompt even when deeper analytical work continues asynchronously;
- **semantic economy:** the world contains structures that carry information rather than decorative or row-for-row geometry by default;
- **progressive crystallisation:** large datasets become useful from coarse structure first and refine as evidence arrives, rather than blocking on full materialisation;
- **reversible detail:** structure -> bounded subset -> exact datum/provenance -> return to structure preserves context and identity;
- **stable long sessions:** memory, GPU resources, WASM capacity, scene objects and frame-time tails do not drift upward merely because the investigation remains open;
- **hardware-scaled headroom:** faster devices reveal more simultaneous semantic detail, prefetch and analytical depth without changing the meaning of the investigation.

## 2.2 What is allowed to degrade under pressure

When the device approaches its resource envelope, adaptation order is:

```text
protect analytical truth / provenance
  -> protect interaction feedback and frame pacing
    -> protect current semantic focus
      -> reduce decorative fidelity
        -> reduce distant/background detail
          -> reduce resident semantic resolution
            -> pause speculative work / prefetch
```

Interaction precision and scientific meaning are not ordinary LOD knobs.

---

# 3. UXR0 — baseline and replacement qualification contract

**Mission:** establish the evidence needed to replace hand-written low-level code without replacing verified Nemosyne semantics.

Required work:

- inventory steady-state per-frame allocations in VR/input/UI/representation hot paths;
- record baseline draw calls, triangles/instances, scene-object count, JS heap, WASM buffer capacity, Worker transfer volume and frame-time p50/p95/p99;
- distinguish startup/warmup costs from sustained costs;
- establish 5-minute functional, 30-minute resource-trend and 60-minute sustained-device profiles;
- define one A/B qualification harness for mature-library substitutions using the same device, dataset, task script and representation state;
- require UX correctness, semantic parity, allocation/resource behaviour and bundle/dependency cost in every replacement decision;
- retain the current chain-of-custody/evidence manifest so comparisons remain attributable and replayable.

**Exit:** replacement decisions can be made from measured product behaviour rather than library maturity, code volume or taste alone.

---

# 4. UXR1 — interaction and UI substrate de-customisation

Nemosyne should own **semantic interaction policy**. It should not own commodity device-normalisation, pointer mechanics or planar UI machinery when a mature lightweight implementation demonstrably does them better.

## 4.1 Replacement / retention matrix

| Current surface | Direction | Candidate mature substrate | Rule |
| --- | --- | --- | --- |
| Raw controller button/profile interpretation | **REPLACE commodity normalisation** | `@iwsdk/xr-input` / WebXR Input Profiles | Complete the narrow provider seam represented by #688; Nemosyne retains semantic routing, suppression, tracing and explicit fallback. |
| `InputRouter` semantic facade | **KEEP** | N/A | This is Nemosyne policy/meaning, not commodity plumbing. Reduce internals only when parity is proven. |
| Pointer event lifecycle / repeated scene traversal | **A/B QUALIFY** | `@pmndrs/pointer-events` | Adopt only if scene traversal, allocations, event semantics and Quest latency are neutral/better. Keep semantic resolver and interaction policy above it. |
| `InteractableRegistry` BVH acceleration | **KEEP** | `three-mesh-bvh` already used | Mature, performant substrate with Nemosyne semantic metadata layered on top. |
| Custom hand pose/joint defensive tracking | **REDUCE, NOT BLINDLY DELETE** | standards/IWSDK capabilities where equivalent | Preserve Quest robustness and last-valid-pose behaviour unless physical evidence proves an external path better. |
| `NearFieldInteractor` semantic press/contact policy | **KEEP POLICY; DE-CUSTOMISE MECHANICS WHERE PROVEN** | pointer/touch substrate where appropriate | Direct-touch thresholds and semantic commit behaviour remain product UX until empirical evidence changes them. Remove avoidable allocations and duplicated hit plumbing. |
| `SpatialUIRoot` custom pointer synthesis | **REPLACE/THIN** | UIKit + qualified pointer substrate | Do not maintain a second generic pointer event system around UIKit if the supported path satisfies XR requirements. |
| `SpatialPanel` duplicated manipulation mechanics | **A/B QUALIFY** | `@pmndrs/handle` or a thinner local kernel | Adopt only if it deletes meaningful complexity without frame/alloc regression. |
| Legacy `MovablePanel` CanvasTexture UI | **RETIRE** | `@pmndrs/uikit` | Migrate remaining active functionality; eliminate duplicate text painting, scrolling, hit-testing and drag semantics. |
| Custom locomotion | **KEEP CURRENT LIGHTWEIGHT CORE FOR NOW** | `@iwsdk/locomotor` only when collision/general traversal is needed | Do not pay for a richer locomotion stack until product requirements demand it. Benchmark before adoption. |
| Full IWSDK runtime/core | **DO NOT ADOPT** | N/A | Dependency/architecture cost is not justified for the narrow facilities currently required. |

## 4.2 UX acceptance

A replacement is not complete because code was deleted. It must preserve or improve:

- controller and hand selection reliability;
- same-frame semantic input authority;
- hover/capture/cancel semantics;
- direct-touch confidence and recovery under tracking loss;
- reach-zone/system-gesture coexistence;
- panel manipulation predictability;
- desktop/XR semantic parity;
- observable user feedback for disabled/refused/suppressed actions.

**Exit:** commodity mechanics are progressively delegated while Nemosyne-specific interaction semantics remain singular, testable and physically credible.

---

# 5. UXR2 — rendering/resource efficiency and lifecycle governor

**Mission:** make allocation avoidance and bounded resource residency part of the product UX contract.

## 5.1 Immediate hot-path work

- remove avoidable steady-state allocations in pointer, near-field, desktop and renderer update paths;
- reuse vectors, rays, matrices, hit buffers and transient arrays;
- avoid per-object material cloning where instance/material parameters can carry the difference;
- instrument accidental per-frame allocation regressions where practical.

Target rule:

> **Steady-state XR frames should allocate zero managed heap objects in Nemosyne-owned hot paths unless an unavoidable platform/library boundary is documented and measured.**

## 5.2 Draw-call architecture

Before inventing more scene complexity:

- convert large homogeneous mark sets to native Three.js `InstancedMesh` / `BatchedMesh` where semantic identity can be retained through instance mapping;
- share geometries/materials/textures aggressively;
- separate semantic object identity from transient mesh/instance index;
- keep source row count from determining object/draw-call count;
- prefer analytical/semantic aggregation over merely polygon-reducing a point cloud.

## 5.3 Resource governor

Evolve the current adaptive frame logic and disposal helpers into an explicit resource lifecycle:

```text
ACTIVE -> WARM -> COLD -> EVICTED
```

The governor should eventually account for:

- Three.js geometries/materials/textures/instance buffers;
- UIKit resources;
- BVHs;
- resident representation payloads;
- Worker transfer buffers;
- Rust/WASM buffer capacity;
- dataset chunks and derived presentation products.

Rules:

- allocation avoidance is cheaper than cleanup;
- cleanup is time-sliced/amortised where possible;
- no large synchronous disposal cliff should be introduced to save memory;
- eviction must not destroy durable investigation meaning or provenance;
- cold state must be reconstructable or reloadable from authoritative state.

**Exit:** the live scene/resource footprint follows the active working set rather than session age or source dataset cardinality.

---

# 6. UXR3 — bounded semantic working set and progressive materialisation

**Mission:** make dataset scale, perceptual scale and temporal/session scale independent dimensions.

The production pipeline should increasingly resemble:

```text
authoritative dataset
  -> compact analytical evidence / bounded semantic payloads
    -> representation state
      -> device/resource-aware working set
        -> disposable spatial projection
```

Required public implementation work:

- preserve structure-first dataset entry and bounded exact drill-down;
- make representation payloads reconstructable independently of Three.js object lifetime;
- add bounded chunk queues/backpressure where streaming paths would otherwise grow without limit;
- progressively materialise coarse semantic structure before optional finer detail;
- keep refinement/collapse identity stable across device/resource changes;
- make current semantic detail/residency observable in dev/verification telemetry;
- continue RepresentationGraph/primitive-grammar work only through generic, already-public compositional contracts;
- do not publish or implement IP-gated discovery-preservation mathematics in this tranche.

**Exit:** a larger source dataset may increase analytical work, but it does not automatically increase visible object count, draw calls or retained presentation memory.

---

# 7. UXR4 — verification infrastructure refocus

The existing QV infrastructure remains valuable because it already provides attributable device runs, governed manifests, evidence sinks, automatic adjudication and chain of custody. It should be **extended, not discarded**.

The primary question changes from:

> How many raw points can this headset render?

Toward:

> Can Nemosyne preserve a stable interaction, semantic and resource envelope as source scale and session duration increase?

## 7.1 Preserve

Keep:

- machine-captured physical-device attribution;
- clean build/runtime identity;
- per-run evidence sinks;
- raw-evidence hashing and chain of custody;
- automatic analysis/adjudication;
- repeat qualification and explicit invalid/blocked states;
- browser/IWER vs physical-device evidence classification.

## 7.2 Add governed evidence

Add measurements for:

### Interaction

- selection/touch/grab success and cancellation/recovery;
- input-to-visible-feedback latency where measurable;
- dropped/duplicated semantic actions;
- tracking-loss recovery;
- locomotion/panel manipulation task outcomes;
- physical comfort/interaction observations remain explicitly human/device evidence rather than inferred from simulator runs.

### Responsiveness

- time to first meaningful representation;
- time to requested refinement/detail;
- time to return/collapse;
- pending/refused operations surfaced without frozen interaction.

### Frame/render envelope

- frame-time p50/p95/p99;
- XR cadence / dropped-frame signal;
- draw calls;
- triangles/instances;
- live scene object/node count;
- material/texture/geometry counts or practical proxies;
- WebGL/WebGPU renderer identity and foveation/multiview configuration where relevant.

### Memory/resource envelope

- main JS heap trend;
- Worker memory proxies where available;
- WASM memory/buffer capacity trend;
- Rust->JS/Worker transfer bytes;
- representation payload bytes;
- resident cache/pool counts;
- reclamation volume and cleanup-induced frame spikes;
- resource slope over elapsed session time, not only beginning/end snapshots.

### Semantic-scale envelope

Without exposing private research/IP metrics, verify public architectural invariants:

- source N and scene cardinality are not obligatorily proportional;
- unopened semantic structures do not transfer/render all member rows;
- bounded drill-down remains bounded as source N grows;
- semantic identity/provenance survives refine/collapse/evict/reconstruct;
- resource pressure may reduce resident detail but may not silently change analytical authority or mutate investigation history.

## 7.3 Qualification profiles

Introduce or evolve governed profiles around:

1. **5-minute functional run** — interaction correctness, responsiveness, scene/resource baseline;
2. **30-minute resource run** — heap/WASM/GPU proxy trends, cache behaviour and reclamation;
3. **60-minute sustained-device run** — frame-tail stability, thermal/power symptoms where observable, long-session resource slope;
4. **scale staircase** — increasing source datasets with bounded semantic working-set expectations rather than raw visible-point success as the principal verdict;
5. **renderer A/B run** — same dataset/task/representation comparing WebGL and WebGPU only when both paths are product-capable enough for a fair comparison.

Raw-point stress remains a useful diagnostic profile, but it is not the product-scale success criterion.

## 7.4 Adjudication model

QV4/QV successors should distinguish:

- **interaction failure**;
- **responsiveness failure**;
- **frame/render failure**;
- **resource-growth failure**;
- **semantic-scale invariant failure**;
- **evidence/attribution invalidity**.

One red class must not be hidden inside an aggregate score.

**Exit:** the validation system can prove that increasing data scale or session duration does not merely shift failure from FPS to memory, interaction or unbounded scene growth.

---

# 8. UXR5 — physical qualification and STOP

Run the revised qualification on the Quest 3S-class reference device after UXR1-UXR4 are implemented.

Minimum STOP evidence:

- commodity input substitution is physically reliable or has an explicit rollback disposition;
- UIKit/panel path no longer depends on active legacy CanvasTexture UI for the canonical journeys;
- no known steady-state allocation regression remains in measured Nemosyne hot paths;
- high-cardinality homogeneous representations use bounded/instanced/batched projection where appropriate;
- scene/draw-call growth is demonstrably decoupled from source N for verified semantic families;
- 30-minute resource trends are bounded enough to justify a 60-minute run;
- 60-minute run does not show unexplained monotonic resource/latency degradation that invalidates the target experience;
- exact datum/provenance recovery remains correct after semantic detail transitions and resource reclamation;
- automated evidence capture/finalisation produces a complete chain-of-custody package.

Only physical evidence can close physical input/comfort/sustained-device claims.

---

# 9. Relationship to full Moneta

This programme does **not** replace the existing path toward compositional Moneta. It prepares the runtime and verification substrate that full Moneta requires.

Continue to preserve these existing architectural directions:

- Rust/WASM owns analytical/scale-sensitive truth;
- Moneta owns representation reasoning, not raw-row traversal;
- RepresentationGraph and a versioned primitive/composition grammar remain the long-term representation language;
- hard feasibility remains separate from preference/utility;
- Moneta must be able to abstain when evidence is insufficient;
- candidate and sensitivity/search work remain explicitly bounded;
- research conditions remain versioned/freezeable/replayable;
- human judgement/learning remains evidence, not automatic scientific ground truth.

The later private research/IP track may change the **meaning and objective of Moneta's constraints**. The generic solver/compiler chassis can continue to mature publicly without publishing that private formalism.

---

# 10. IP/publication firewall

Until the patent review reaches a publication decision, public implementation and documentation under this programme must not disclose the enabling details of unpublished mechanisms such as:

- a formal discovery envelope or exact protected-distinction taxonomy;
- epsilon-style discovery-preservation/sufficiency calculations;
- exception-selection/residual/influence algorithms intended to protect unknown discoveries;
- perturbation-governed compression decisions beyond already-public generic stability analysis;
- epistemic-compression certificate generation rules;
- explicit human-observer recoverability objective functions;
- the exact joint objective/solver formulation coupling epistemic, human and machine costs.

Public work may provide generic extension points, bounded representation contracts, ordinary provenance, resource cost telemetry, reversible detail and mature-library/runtime improvements without encoding those private policies.

---

# 11. Finite exit and handoff

P1-UXR stops when:

- the canonical XR/UI interaction path is materially simpler and the retained custom code has an explicit product-specific reason to exist;
- adopted mature substrate has Quest evidence showing no material UX/performance/resource regression;
- legacy duplicated planar UI machinery is retired from canonical journeys;
- renderer resource use follows the semantic working set rather than raw data cardinality;
- resource lifecycle/reclamation and long-session behaviour are observable and bounded;
- QV can adjudicate interaction, responsiveness, render, resource and semantic-scale envelopes independently;
- physical reference-device evidence closes the claimed interaction/sustained-session boundaries;
- the programme has not disclosed the private IP-gated research formalism.

After STOP, resume the product-transition sequence with PT6+ and compositional-Moneta prerequisites using the improved runtime and verification substrate.