# Nemosyne User Experience Design Doctrine

**Subtitle:** Meaning-preserving, resource-aware spatial research  
**Status:** Normative product and UX design guide  
**Date:** 6 September 2026  
**Authority:** Derived from and subordinate to `docs/Nemosyne_Definitive_Vision_and_Roadmap.md`. Where this document conflicts with the Definitive Vision, the Definitive Vision governs.  
**Related implementation specification:** `docs/Nemosyne_VR_UI_Design_System_and_Agent_Spec.md`

---

## 1. Purpose

Nemosyne is not a game, a movie, a virtual showroom, or a conventional visualisation application transplanted into a headset. It is a research instrument whose job is to help a researcher perceive, manipulate, investigate and preserve meaningful structure in data.

The user experience must therefore optimise for **investigable meaning**, not visual abundance.

The governing UX question is:

> **What is the cheapest perceptually effective representation that preserves the information the researcher needs to understand, challenge and investigate the data?**

A representation is not better because it contains more objects, more polygons, more animation or more literal row-level detail. It is better when it preserves more useful analytical meaning per unit of human attention and computational resource.

This doctrine defines how Nemosyne should balance:

- semantic fidelity;
- perceptual legibility;
- natural and realistic interaction;
- responsiveness and comfort;
- computational and memory efficiency;
- long-session stability;
- progressive scale across hardware classes;
- reproducibility and scientific provenance.

---

## 2. The UX north star

Nemosyne should feel like a calm, responsive scientific instrument whose world continuously reorganises itself around what is meaningful to investigate.

The experience should preserve four invariants across hardware classes and dataset sizes:

1. **Meaning remains trustworthy.** Abstraction may reduce visible detail, but must not silently change analytical meaning, uncertainty, provenance or important alternatives.
2. **Interaction remains natural and predictable.** Pointing, touching, grabbing, selecting, locomotion and manipulation must behave consistently enough that the researcher thinks about the data rather than the interface.
3. **Responses remain perceptually immediate.** Nemosyne should acknowledge intent immediately even when analytical work completes asynchronously.
4. **Sessions remain stable over time.** A session that feels good after five minutes must not degrade through accumulated objects, memory, textures, buffers, garbage collection pressure or thermal load.

Everything else is elastic. Richer hardware should buy greater analytical depth, a larger resident working set, richer semantic detail and longer stable sessions. It should not be required to compensate for an inefficient baseline implementation.

---

## 3. Experience priority order

When design goals conflict, Nemosyne SHOULD resolve them in this order:

1. **Semantic fidelity**: preserve statistical meaning, structure, uncertainty, provenance, exceptional cases and relevant alternatives.
2. **Perceptual legibility**: choose an embodiment that a researcher can understand without unnecessary cognitive or visual load.
3. **Interaction fidelity**: make meaningful objects and controls behave predictably, comfortably and consistently.
4. **Responsiveness and frame stability**: preserve low-latency feedback and stable motion.
5. **Computational economy**: spend only the resources required to preserve the first four goals.
6. **Visual richness**: add detail only when it improves interpretation, orientation, confidence or comfort.

Decorative fidelity MUST NOT consume resources needed for semantic fidelity, interaction quality or session stability.

---

## 4. Dataset scale is not scene scale

Nemosyne MUST separate the size of the authoritative dataset from the size of the live spatial scene.

A dataset containing millions of observations does not imply millions of live Three.js objects. The full dataset can remain authoritative in Atlas and Rust/WASM while the Spatial Runtime holds only the analytical summaries, geometry, interaction state and local detail required for the current investigation.

The preferred conceptual pipeline is:

```text
authoritative dataset
  -> analytical hierarchy
  -> semantic / representation hierarchy
  -> view- and intent-dependent working set
  -> small interactive scene projection
```

For example, a large dataset may progressively become:

```text
millions of rows
  -> thousands of analytical aggregates
  -> hundreds of visible semantic structures
  -> tens of high-detail structures
  -> a few actively manipulated objects
```

This is not loss of fidelity when the abstraction preserves the structure relevant to the current investigation. In many cases it is a gain in useful fidelity because irrelevant visual noise has been removed.

---

## 5. Semantic level of detail

Conventional graphics level of detail reduces polygons with distance. Nemosyne requires a richer concept: **semantic level of detail**.

A structure may be represented at progressively deeper levels such as:

```text
population
  -> subpopulations
  -> distributions / relationships
  -> groups or local structure
  -> individual observations
```

The active level should be influenced by more than physical distance. Relevant signals may include:

- researcher focus and selection;
- current hypothesis or question;
- uncertainty and anomaly importance;
- comparison context;
- representation fitness;
- investigation history;
- available CPU, GPU and memory headroom;
- device class and thermal state;
- explicit request to expand or collapse detail.

Distance MAY be one input, but semantic relevance is the governing input.

The researcher MUST be able to descend into detail and return to a cheaper abstraction without losing investigation meaning or provenance.

---

## 6. Moneta as semantic compression and embodiment intelligence

The long-term Moneta objective is broader than selecting a named layout.

Moneta should progressively become an **adaptive semantic compression and embodiment engine** that maximises investigable information per unit of human attention and computational resource.

Given analytical evidence, investigation intent and researcher context, Moneta should eventually be able to reason about:

- which structures must remain explicit;
- which structures can be aggregated or summarised;
- which exceptions must remain visible despite aggregation;
- which uncertainty must remain perceptible;
- which level of detail is sufficient for the current task;
- which representation best preserves the relevant relationships;
- which alternative representations are important enough to retain or expose;
- how much detail current hardware can sustain without harming UX;
- when to refine, collapse, stream, cache or evict representation detail.

The mature objective is not:

```text
dataset -> choose layout -> render rows
```

It is:

```text
dataset
  -> establish analytical evidence
  -> identify meaningful structures
  -> determine information that must survive abstraction
  -> construct representation hierarchy
  -> choose perceptually appropriate embodiment
  -> allocate detail according to intent and resource headroom
  -> progressively refine or collapse as the investigation changes
```

Moneta MUST NOT sacrifice analytical truth merely to fit a resource budget. If no permissible abstraction preserves necessary meaning, it should expose that limitation, abstain, or require a narrower investigation scope.

---

## 7. Progressive crystallisation instead of blocking load

Large investigations SHOULD become useful progressively rather than waiting for complete dataset materialisation.

The preferred user experience is:

```text
open
  -> inspect schema / metadata
  -> establish coarse analytical summaries
  -> present a meaningful initial representation
  -> stream and refine additional evidence
  -> expose deeper detail and alternatives as they become available
```

The user should see the investigation **crystallise** rather than stare at a monolithic loading state.

Early representations MUST be clearly understood as partial or progressively refining where that distinction matters scientifically.

Nemosyne SHOULD prioritise the earliest useful answer over the earliest complete answer, provided semantic and provenance boundaries remain explicit.

---

## 8. Streaming and bounded working sets

Streaming is a core scalability mechanism, not merely an I/O optimisation.

Nemosyne SHOULD support bounded working sets across:

- dataset chunks;
- analytical products;
- representation detail;
- geometry and GPU buffers;
- Memory Palace neighbourhoods;
- textures and labels;
- derived alternatives and previews.

The active working set should favour:

- what the researcher is manipulating now;
- likely next investigation steps;
- nearby or semantically related Memory Palace structures;
- representation alternatives that are cheap and useful to prefetch;
- evidence required to explain the current state.

Cold detail may be retained as compact summaries, durable investigation state, reloadable chunks or recomputable products rather than live scene objects.

Faster hardware should naturally support larger hot and warm working sets without requiring a different semantic architecture.

---

## 9. Disposable projections, durable meaning

A fundamental ownership rule for the experience is:

> **Spatial scene objects are disposable projections. Semantic investigation state is durable.**

A Three.js mesh, GPU buffer, label, cached BVH or UI surface MUST NOT be the sole owner of scientifically meaningful state.

If a representation is evicted from GPU or scene memory, Nemosyne must be able to reconstruct it from durable semantic state and provenance.

A durable investigation should preserve at least the meaning required to reconstruct an appropriate embodiment, including where relevant:

- dataset and version identity;
- analytical evidence and provenance;
- Moneta representation decision;
- representation graph and abstraction level;
- researcher focus and investigation state;
- findings, hypotheses and evidence;
- alternatives and rejected paths where scientifically relevant;
- interaction and model versions required for replay.

This boundary allows WebGL, WebGPU, future WebXR renderers or native clients to embody the same investigation without changing its scientific meaning.

---

## 10. Resource lifecycle and continuous reclamation

Nemosyne SHOULD continuously reclaim resources, but reclamation itself MUST NOT create perceptible frame-time cliffs.

The preferred lifecycle is:

```text
ACTIVE -> WARM -> COLD -> EVICTED
```

**ACTIVE** resources are visible, selected, nearby or immediately required.  
**WARM** resources are likely to return soon and remain cheap to reactivate.  
**COLD** resources preserve inexpensive reconstruction metadata while releasing expensive presentation state.  
**EVICTED** resources retain only durable authoritative or reconstructable state.

Reclamation policy SHOULD consider:

- recency and likelihood of reuse;
- semantic importance;
- reconstruction cost;
- GPU memory pressure;
- JS heap pressure;
- WASM capacity;
- current frame-time headroom;
- session duration and thermal stability.

Cleanup MUST be incremental where possible. Expensive disposal, compaction or reconstruction work should be time-sliced or scheduled during safe windows rather than performed as a large synchronous sweep.

Pools and caches SHOULD be bounded. Keeping every object forever in a pool is deferred leakage, not optimisation.

---

## 11. Avoid allocation before cleaning it up

The cheapest garbage collection is allocation that never occurred.

Steady-state XR paths SHOULD approach zero avoidable heap allocation per frame. Scratch vectors, rays, matrices, hit buffers, pointer state, temporary arrays and other hot-loop structures should be retained and reused where practical.

Likewise:

- update instance buffers rather than recreate large mesh populations;
- reuse Worker and WASM buffers when safe;
- share immutable geometry and materials where semantics permit;
- avoid repeated texture generation for stable UI;
- avoid redundant scene traversals and duplicated hit testing;
- prefer bounded caches over unbounded convenience maps.

Resource cleanup is a safety net. Allocation avoidance is the first defence.

---

## 12. Rendering economy

Nemosyne's renderer should spend GPU and CPU work only where the work carries useful perceptual or interaction value.

Preferred techniques include, when measured to help on target hardware:

- `InstancedMesh` for repeated geometry with shared materials;
- `BatchedMesh` or equivalent batching for compatible heterogeneous geometry;
- shared immutable geometry and materials;
- spatial culling and semantic culling;
- semantic level of detail;
- foveated rendering;
- stereo/multiview reductions where supported;
- reduced update rates for background and peripheral systems;
- bounded label and annotation density;
- GPU-side presentation work where it preserves analytical authority.

The scene graph SHOULD remain much smaller than the dataset whenever a cheaper semantic abstraction is possible.

Decorative effects, particles, complex materials and environmental geometry require an explicit UX justification. Nemosyne is a scientific instrument, not a cinematic environment.

---

## 13. WebGL, WebGPU and compute evolution

Renderer choice is an implementation means, not a product identity.

WebGL/WebXR remains valid while it provides the best supported and measured experience. WebGPU SHOULD be evaluated when it can demonstrably improve frame stability, resource use, batching, compute-assisted presentation, memory behaviour or scale on supported hardware.

Nemosyne MUST NOT migrate rendering technology for novelty alone.

Any WebGPU path should preserve the analytical authority boundary:

> **Rust/WASM decides what the data means. GPU computation may accelerate how that meaning becomes visible.**

Appropriate presentation-adjacent GPU compute may include culling, instance classification, geometry transformation, level-of-detail selection, density-field preparation or other work that does not silently become an independent analytical authority.

Renderer changes must be benchmarked against the same datasets, representations and interaction sequences on real target hardware.

---

## 14. Responsiveness as an experience contract

A researcher should never wonder whether Nemosyne noticed an action.

Every accepted input SHOULD produce immediate perceptual acknowledgement, even when the authoritative operation is asynchronous.

Longer analytical work SHOULD:

- preserve head and hand responsiveness;
- avoid blocking the render loop;
- expose meaningful progress or intermediate state where possible;
- allow cancellation or safe redirection where the operation permits;
- preserve the distinction between provisional and authoritative results.

Frame pacing is more important than occasional high average frame rate. Validation should therefore emphasise tail latency and dropped-frame behaviour, not averages alone.

Nemosyne should maintain headroom beneath the selected device refresh budget so tracking, compositor work, browser variation, garbage collection and thermal changes do not immediately push the experience into instability.

---

## 15. Long-session UX is a first-class requirement

A research instrument may be used for substantially longer sessions than a short demo. Performance must therefore be evaluated as a function of elapsed time.

Nemosyne SHOULD measure and test:

- frame-time percentiles over time;
- dropped frames and visible stutter;
- JS heap trend;
- Worker/WASM resident capacity;
- GPU geometries, textures and buffers;
- scene object and draw-call trends;
- cache and pool growth;
- thermal or sustained-performance degradation where observable;
- latency of common interactions at the beginning and end of a session.

A system that handles a large dataset for a few minutes and then degrades is not scalable.

Temporal scale is therefore distinct from dataset scale.

---

## 16. Three dimensions of scale

Nemosyne should evaluate scale along three independent axes:

### 16.1 Dataset scale

How much authoritative data can be analysed and addressed.

### 16.2 Perceptual scale

How much meaningful information can be visible and interactable without overwhelming either the researcher or the renderer.

### 16.3 Temporal scale

How long an investigation can continue without resource accumulation, thermal degradation or increasing interaction latency.

A mature Nemosyne improves all three, but it MUST NOT sacrifice the basic UX invariants merely to claim a larger dataset number.

---

## 17. Hardware scaling and the headroom dividend

Quest 3S-class standalone hardware is an efficiency crucible, not the definition of Nemosyne's maximum capability.

The product SHOULD establish a stable interaction and semantic-quality envelope on the weakest supported device. Additional hardware capability should then be converted into a **headroom dividend** such as:

- a larger resident dataset window;
- deeper semantic levels of detail;
- more simultaneous comparisons;
- more prefetched alternatives;
- richer but still meaningful labels and annotations;
- faster analytical refinement;
- larger Memory Palace neighbourhoods;
- longer sessions before resource pressure;
- more ambitious presentation-adjacent computation.

Higher-end hardware SHOULD expand capability rather than merely recover responsiveness lost to an inefficient baseline.

---

## 18. Adaptive resource governor

Nemosyne SHOULD evolve toward an explicit Resource Governor that protects UX while trading elastic fidelity for headroom.

When resources are plentiful, Nemosyne may spend surplus on deeper semantic detail, larger working sets, richer explanations and speculative analytical preparation.

When pressure rises, degradation SHOULD occur in this order:

1. reduce or pause non-essential background work;
2. reduce speculative prefetch and analysis;
3. lower distant or peripheral update frequency;
4. collapse semantically redundant detail;
5. evict cold geometry, textures and analytical products;
6. increase aggregation where analytically permissible;
7. reduce the active working set;
8. only as a last resort, reduce presentation quality that directly affects interaction or interpretation.

The governor MUST protect, in order:

```text
interaction fidelity
  -> frame pacing and comfort
  -> semantic truth and provenance
  -> perceptual legibility
  -> decorative fidelity
```

Resource adaptation MUST NOT silently alter research conditions in deterministic research mode.

---

## 19. Interaction design consequence

Natural interaction is not an excuse for expensive or fragile custom machinery.

Nemosyne SHOULD prefer mature, lightweight and measurable interaction substrates where they reduce duplicated traversal, event machinery or maintenance cost. It SHOULD retain custom implementation where the custom path is simpler, cheaper and necessary for Nemosyne-specific semantics.

The semantic interaction boundary remains Nemosyne-owned. Commodity libraries may provide:

- controller profile mapping;
- pointer mechanics;
- hit testing substrate;
- standard UI layout;
- grab/transform mechanics;
- collision or locomotion primitives;

but they MUST NOT become independent owners of investigation meaning.

Every replacement must be evaluated for:

- interaction fidelity;
- Quest-class CPU and GPU cost;
- steady-state allocations;
- memory footprint;
- scene traversal cost;
- bundle/runtime dependency cost;
- long-session behaviour;
- accessibility and modality parity.

Library maturity alone is not sufficient justification.

---

## 20. Memory Palace consequence

The Memory Palace is a semantic graph with spatial embodiment, not a permanently resident museum of scene objects.

Its durable truth should be graph structure, investigation meaning, evidence, references, representation state and provenance. Spatial geometry may be streamed, reconstructed, simplified or evicted according to context and resource pressure.

Nearby or semantically relevant neighbourhoods may remain warm. Distant branches may collapse to cheap landmarks, summaries or portals until the researcher approaches or requests them.

This allows an investigation to grow over long periods without requiring its entire history to remain resident in GPU and JS memory.

---

## 21. UX acceptance gates

A feature that changes the spatial runtime, Moneta embodiment, interaction substrate, streaming, cleanup or renderer SHOULD be assessed against the following gates.

### Meaning gate

- Does the cheaper representation preserve the information required for the investigation?
- Are uncertainty, exceptions and relevant alternatives preserved or explicitly recoverable?
- Is provenance sufficient to reconstruct or explain the abstraction?

### Interaction gate

- Is the feature easy to acquire, understand and manipulate?
- Does it work with the required input modalities?
- Does it preserve a low-fatigue alternative for essential actions?
- Are state transitions predictable and reversible where appropriate?

### Responsiveness gate

- Does user input receive immediate feedback?
- Does background analytical work remain off the XR critical path?
- Are frame-time tails and stutter acceptable on physical target hardware?

### Resource gate

- Does steady-state resource use remain bounded?
- Are caches, pools, scene objects, GPU resources and WASM buffers reclaimed or reused correctly?
- Does cleanup avoid visible frame spikes?

### Scale gate

- Does the architecture allow stronger hardware to expand working-set size or semantic detail without changing investigation semantics?
- Does the design avoid coupling dataset cardinality directly to live scene-object count?

### Duration gate

- Does the feature remain stable during long sessions?
- Are beginning-of-session and end-of-session interaction latencies comparable?

Physical Quest evidence is required for claims about Quest frame pacing, comfort, thermal behaviour or long-session stability. Desktop Chromium evidence is useful but cannot substitute for device qualification.

---

## 22. Anti-goals

Nemosyne MUST NOT optimise toward any of the following:

- rendering every row merely because the hardware can;
- maximising polygon count, scene complexity or environmental richness;
- treating a literal point cloud as the default definition of dataset fidelity;
- retaining every representation and Memory Palace object in memory indefinitely;
- using higher-end hardware to hide avoidable baseline inefficiency;
- replacing simple code with larger frameworks solely for perceived maturity;
- using abstraction that hides scientifically important structure or uncertainty;
- allowing renderer state to become authoritative investigation state;
- equating faster loading with useful progressive understanding;
- claiming scale from short synthetic benchmarks alone.

---

## 23. Governing design principle

The mature Nemosyne experience should make the world feel richer as its internal representations become cheaper and more meaningful.

The governing principle is:

> **Nemosyne preserves and exposes investigable meaning at the cheapest perceptually sufficient level of abstraction. It spends computation, memory and visual complexity only where they improve understanding, interaction, evidence or confidence. Available hardware headroom expands analytical depth, semantic detail, resident working set and session longevity without changing the underlying scientific meaning.**

The corresponding implementation test is simple:

> **Does this change make Nemosyne better at retaining and exposing meaning, or does it merely make the virtual world more elaborate?**

If the answer is primarily the latter, the feature should not receive the resource budget.
