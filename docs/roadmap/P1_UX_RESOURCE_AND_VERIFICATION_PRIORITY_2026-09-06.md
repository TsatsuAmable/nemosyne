# P1 Priority 1 — UX, Resource Efficiency & Verification Convergence

**Status:** ACTIVE PRIORITY-1 EXECUTION ADDENDUM  
**Established:** 6 September 2026  
**Canonical product/research vision:** `docs/Nemosyne_Definitive_Vision_and_Roadmap.md`  
**Canonical implementation-status authority:** `docs/ROADMAP.md`  
**Governing UX doctrine:** `docs/Nemosyne_UX_Semantic_Efficiency_Doctrine.md`  
**Product-transition programme:** `docs/roadmap/P1_PRODUCT_TRANSITION_PLATFORM_AND_LEARNING_PLAN.md`  

> This document reorders the next implementation tranches. It does not create a new scientific authority and does not disclose private/IP-gated research formalisms. `docs/ROADMAP.md` remains the canonical status ledger; this addendum defines the currently selected Priority-1 work until its finite exit is reached.

---

## 1. Why this is now Priority 1

Nemosyne is not a game, virtual film set, or point-cloud renderer. Its value comes from helping an investigator perceive and manipulate meaningful structure in data with very low interaction friction while preserving authoritative evidence underneath.

The immediate product objective is therefore:

> **Make the investigation experience natural, immediate, stable and information-economical on the weakest supported hardware, while ensuring that additional hardware headroom buys greater analytical scale, richer resident structure and longer stable sessions rather than compensating for an inefficient baseline.**

Priority 1 precedes further feature expansion, broad learned-Moneta work, and non-essential world elaboration because poor interaction, excessive rendering cost, resource accumulation, and duplicated hand-written substrate would otherwise contaminate both product learning and later scientific evaluation.

The governing distinction is:

```text
source dataset scale
    !=
resident analytical working set
    !=
visible semantic working set
    !=
Three.js scene-object count
```

A large source dataset must not imply a proportionally large scene graph.

---

# 2. Priority-1 user-experience contract

## 2.1 Three protected UX invariants

### Interaction fidelity

Core actions must feel predictable and physically credible:

- point;
- touch;
- select;
- grab;
- move/manipulate;
- locomote;
- inspect;
- expand/refine;
- collapse/return;
- compare;
- challenge;
- record.

The user should not need to learn implementation quirks or modality-specific command systems. Hand, controller and desktop input continue to converge through Nemosyne interaction semantics rather than forking product meaning.

### Responsiveness

Perceptual acknowledgement of user intent must be immediate even when analytical refinement continues asynchronously. Long-running work should progressively crystallise into useful structure rather than block the user behind an all-or-nothing wait.

### Session stability

A session that begins smoothly but degrades through memory growth, GPU-resource accumulation, WASM growth, thermal pressure, repeated allocation, or disposal spikes is a product failure. Stability across realistic investigation duration is part of UX, not a later optimisation.

## 2.2 Information-economical visual language

Visual detail is justified when it improves:

- analytical interpretation;
- orientation;
- confidence/uncertainty comprehension;
- discoverability of actions;
- accessibility;
- comfort;
- provenance or investigation context.

Decorative geometry, materials, particles, lighting complexity, persistent labels and environmental detail do not receive budget merely because hardware can render them.

The preferred representation is the cheapest perceptually effective embodiment that retains the meaningful structure required by the current governed representation contract.

## 2.3 Progressive semantic detail

The product should increasingly behave as:

```text
open dataset
  -> schema / coarse structure becomes available
    -> useful overview becomes interactive
      -> selected/focused structure refines
        -> bounded observations become available on demand
          -> exact datum/provenance remains recoverable
```

The world should become useful early and refine progressively. Faster hardware increases how much detail can remain resident and how quickly refinement can occur; it must not create a different scientific authority.

## 2.4 Durable meaning, disposable projection

Preserve the architectural boundary already established by the semantic-efficiency doctrine:

> **Durable investigation/representation state must not depend on the lifetime of Three.js scene objects.**

GPU buffers, meshes, labels, cached layouts and other materialisations may be released and reconstructed without losing dataset identity, provenance, semantic target identity, selection lineage, investigation state or replay meaning.

---

# 3. Priority-1 execution order

No further feature stream outranks this work unless an explicit security/data-loss blocker appears.

```text
P1.0 baseline + canonical budgets
  -> P1.1 hot-loop/resource hygiene
    -> P1.2 rendering cardinality reduction
      -> P1.3 mature-substrate replacement and UI convergence
        -> P1.4 streaming + bounded residency + reclamation
          -> P1.5 verification infrastructure retarget
            -> P1.6 physical Quest and long-session qualification
              -> resume product/learning roadmap
```

Each tranche requires fresh-main sync, bounded implementation, adversarial review, exact-head evidence, fix-forward, and finite STOP before the next tranche.

---

# 4. P1.0 — Establish one canonical performance/resource contract

**Goal:** remove conflicting implicit budgets and establish measured device-class envelopes.

Current code contains incompatible assumptions, including a 60fps-style `16.67ms` default in `PerformanceBudget` while the VR adaptive frame governor targets approximately `11.1ms` for 90Hz operation. Priority 1 must replace these accidental constants with an explicit measured contract.

Required work:

- define target frame-rate classes per platform/runtime rather than one universal threshold;
- record p50/p95/p99 CPU/frame timing, not only average FPS;
- capture renderer calls, triangles, points/instances and scene-object counts;
- track JS heap trend where observable;
- track WASM buffer capacity/resident-state proxies;
- track Worker transfer/materialisation bytes and timing;
- add GPU-resource proxies where direct memory measurement is unavailable;
- record dropped-frame bursts rather than only totals;
- record dataset source N separately from analytical, representation and render cardinalities;
- measure time-to-first-useful representation and time-to-requested refinement;
- make the measured Quest contract an evidence artifact, not a permanent assumption about future devices.

**Exit:** one versioned performance/resource manifest governs product measurements and removes contradictory defaults.

---

# 5. P1.1 — Eliminate unnecessary steady-state work

**Goal:** reduce cost before introducing new dependencies or more elaborate adaptive systems.

Default rule:

> **Zero avoidable heap allocation per steady-state XR frame.**

Known review targets include transient `THREE.Vector3` / `THREE.Ray` creation in hot input/near-field paths and any repeated creation of arrays/hit structures that can safely be retained and reused.

Required work:

- audit XR/input/interaction/update loops for per-frame allocation;
- introduce retained scratch vectors, rays, matrices and bounded reusable hit arrays;
- remove duplicate traversal where one pass can safely serve multiple interaction modalities;
- avoid dispose/recreate churn for resources that can be updated or pooled;
- ensure cleanup itself is time-sliced where bulk destruction would create a frame-time cliff;
- instrument before/after evidence so code deletion is not mistaken for an optimisation without measured effect.

**Exit:** the steady-state interaction/render loop is allocation-minimal and instrumented well enough to detect regressions.

---

# 6. P1.2 — Reduce render cardinality before adding renderer complexity

**Goal:** make source scale independent of draw-call and scene-object growth.

Priority sequence:

1. use native Three.js `InstancedMesh` where many semantically distinct objects share geometry/material;
2. evaluate `BatchedMesh` where heterogeneous static/semi-static geometry benefits;
3. retain stable semantic identity independent of `instanceId`/batch index;
4. reduce unnecessary material clones and state changes;
5. use culling/LOD only after semantic cardinality has first been reduced;
6. keep exact datum access in the analytical/drill-down path rather than retaining a mesh per source row.

`ObjectPool` remains useful for allocation control, but pooling individual meshes is not accepted as a draw-call solution.

**Exit:** at least the highest-count current representation path demonstrates materially lower scene-object/draw-call growth without semantic identity loss.

---

# 7. P1.3 — Replace hand-rolled commodity substrate where replacement is measurably better

The project should own product semantics and Nemosyne-specific interaction policy. It should not indefinitely own low-level infrastructure already implemented more robustly elsewhere when the mature alternative is lighter or performance-neutral in the actual Quest workload.

Every replacement is benchmark-gated. Library maturity alone is insufficient.

## 7.1 Keep

### `three-mesh-bvh`

Keep the existing BVH-backed `InteractableRegistry` and Nemosyne semantic wrapper. This is mature, focused infrastructure and already avoids a much worse hand-written spatial-query implementation.

### Nemosyne semantic input facade

Keep `InputRouter` as the product-facing semantic boundary. Commodity profile/button/pointer mechanics may be delegated underneath it, but modality-independent Nemosyne semantics, suppression policy, tracing, selection meaning and NIL integration remain Nemosyne-owned.

### Lightweight locomotion while its problem remains lightweight

Do not add a general physics/runtime stack merely to replace working smooth movement, snap turn or simple teleport. Re-evaluate when world collision, gravity, moving environments or robust character traversal become actual product requirements.

## 7.2 Replace / converge

### Legacy CanvasTexture panel/UI path

**Target:** retire `src/vr/ui/MovablePanel.ts` and remaining duplicated CanvasTexture text/control rendering as equivalent functionality moves to the existing `@pmndrs/uikit` spatial UI system.

Benefits sought:

- one panel/control model;
- fewer custom hit-test and scrollbar implementations;
- fewer texture uploads and bespoke canvas redraw paths;
- consistent typography/layout/interaction;
- lower maintenance and test surface.

Do not duplicate UIKit with another UI framework such as `three-mesh-ui`.

### Duplicate panel pointer/capture machinery

`SpatialUIRoot`, `SpatialPanel`, legacy panels and InputRouter currently contain overlapping hover/capture/manipulation responsibilities. Converge toward one pointer/capture path where practical.

**Candidate:** `@pmndrs/pointer-events` is a qualification target because it provides framework-agnostic W3C-like pointer semantics and can combine ray/grab/touch modalities. Adoption requires Quest A/B evidence showing performance neutrality or improvement and no loss of Nemosyne semantic targeting/capture behavior.

### Controller/profile normalization

Prefer standards/profile-aware controller mapping rather than permanent raw gamepad-index assumptions.

**Candidates:** WebXR Input Profiles or a thin `@iwsdk/xr-input` adapter. Do not adopt IWSDK core. Keep Nemosyne's semantic routing and hand-joint behavior behind the provider boundary.

### Controller visual/model boilerplate

Where controller-model rendering is required, use standards/profile-driven model loading rather than growing custom device-specific visual code. This is optional if hidden/minimal controller visuals are cheaper and better for the product.

## 7.3 Qualification only, not default adoption

### `@pmndrs/handle`

Evaluate only if it deletes a meaningful amount of panel/object manipulation code without increasing hot-loop cost, bundle/runtime weight or behavioral ambiguity.

### `@iwsdk/locomotor`

Evaluate only when Nemosyne requires robust world collision, gravity, kinematic environments or richer teleport/collision semantics. Its compatibility with Three and `three-mesh-bvh` is useful, but extra runtime work is not free.

### WebGPU / Three `WebGPURenderer`

Maintain WebGL2 as the production Quest baseline until controlled tests show WebGPU wins the actual Nemosyne workload. Use the same dataset, representation, camera/interaction sequence and session length for comparison. WebGPU compute may accelerate presentation-adjacent work but must not become a second analytical authority.

## 7.4 Explicit non-adoptions

Do not introduce as part of Priority 1 without a separately measured requirement:

- full IWSDK core;
- Babylon.js migration;
- Unity/Unreal rewrite;
- Rapier/full physics merely for ordinary UI/world interaction;
- `three-mesh-ui` alongside UIKit;
- a new rendering abstraction that duplicates Three.js without a demonstrated platform ceiling.

---

# 8. P1.4 — Streaming, bounded residency and continual reclamation

**Goal:** support larger datasets and longer sessions by keeping only a bounded working set active.

The production path should evolve away from:

```text
download all
  -> parse all
    -> copy all
      -> analyse all
        -> render all
```

and toward:

```text
open
  -> identify metadata/schema
    -> progressively load/stream
      -> build governed summaries/structures
        -> make overview usable
          -> refine selected regions
            -> evict or cool inactive materialisations
```

Required work:

- use bounded chunk queues and explicit backpressure;
- prefer transfer/reuse of buffers over repeated copies where safe;
- retain authoritative source/analytical identity while materialisations come and go;
- evolve disposal into a resource-governor model such as:

```text
ACTIVE -> WARM -> COLD -> EVICTED
```

- ACTIVE: currently visible/interactable/refining;
- WARM: likely near-term reuse, retained in bounded cache;
- COLD: semantic/provenance metadata retained while large presentation/GPU assets are released;
- EVICTED: reconstruct/reload/recompute on demand.

The governor must understand shared geometries/materials/textures, UIKit resources, BVHs, instance buffers, WASM/Worker buffers, dataset chunks and derived presentation products well enough to avoid leaks and double disposal.

**Exit:** a repeatable investigation can cycle through multiple representations/details without monotonically growing resources, and cold views can be reconstructed without semantic identity loss.

---

# 9. P1.5 — Retarget the verification infrastructure

The existing governed verification chain remains valuable. The target changes.

Do not make "maximum raw points rendered" the primary Quest success criterion.

The new central verification question is:

> **As source dataset size and session duration increase, does Nemosyne preserve a stable interaction, semantic and resource envelope?**

## 9.1 Preserve existing chain of custody

Keep:

- QV manifest/run identity;
- exact build/commit attribution;
- machine-captured device/browser/runtime attribution where available;
- governed evidence sink;
- automatic adjudication;
- export back to development analysis;
- immutable evidence indexing;
- explicit distinction between simulator/browser evidence and physical-device evidence.

Verification must continue to report back to the project automatically; human transcription must not become the source of truth.

## 9.2 Add resource-envelope evidence

For each governed run record, where observable:

- source dataset rows/columns/dimensions;
- analytical working-set cardinality;
- representation cardinality;
- rendered semantic-object/instance cardinality;
- Three scene-node count;
- renderer draw calls;
- triangles/points/instances;
- p50/p95/p99 frame time;
- dropped-frame bursts;
- main-thread/Worker analytical timing;
- JS heap before/after bounded GC observation where available;
- WASM buffer capacity/resident-state proxies;
- transfer/materialisation bytes;
- resource-governor active/warm/cold/evicted counts;
- time-to-first-useful representation;
- requested-refinement latency;
- exact-detail/provenance recovery latency;
- session elapsed time.

## 9.3 Add scale-invariance falsifiers

Across increasing source N, verify that the following do not grow proportionally without an explicit representation reason:

- scene objects;
- draw calls;
- active interactables;
- resident labels;
- JS-side row materialisation;
- unbounded transfer payloads.

The harness should detect regressions where source cardinality leaks back into presentation cardinality.

## 9.4 Add long-session tiers

Use progressively stronger runs:

- **5 minute:** immediate correctness and responsiveness;
- **30 minute:** memory/resource trend;
- **60 minute:** frame/thermal stability on standalone XR;
- **90–120 minute:** representative investigation soak once the shorter tiers are stable.

A flat or bounded resource curve is the goal. A steadily rising resource curve is a failure even if the first minutes meet frame-rate targets.

## 9.5 Protect interaction during pressure tests

Under resource pressure, verify degradation order:

```text
protect interaction fidelity
  -> protect frame pacing
    -> protect governed semantic truth
      -> reduce decorative fidelity
        -> reduce distant/background detail
          -> reduce active resident analytical window
```

Core input precision and semantic correctness must not be silently traded for visual richness.

## 9.6 Verification result model

QV adjudication should distinguish at least:

- correctness failure;
- interaction/UX failure;
- resource-envelope failure;
- long-session stability failure;
- implementation defect;
- platform ceiling;
- evidence insufficiency.

A platform ceiling should inform platform strategy rather than forcing Nemosyne to weaken the product thesis.

**Exit:** the verification system can automatically demonstrate whether interaction/resource invariants hold across dataset scale and session duration, with attributable evidence returned to the development environment.

---

# 10. P1.6 — Physical Quest qualification

Quest 3S remains the efficiency crucible and reference standalone-XR platform, not the product ceiling.

After P1.0–P1.5 land:

- run the existing physical interaction suite;
- verify controller and hand behavior after any substrate replacement;
- run scale tiers with the same semantic task sequence;
- execute 5/30/60 minute tiers before attempting long soaks;
- record comfort/fatigue observations separately from software timing;
- classify failures as Nemosyne defects, implementation defects, evidence limitations or platform ceilings;
- do not infer physical fitness from IWER/Chromium simulator evidence.

**Finite exit:** Priority 1 closes only when the product has a measured stable interaction/resource envelope, the principal high-cost hand-written commodity paths have either been replaced or explicitly retained by benchmark evidence, and QV can continuously detect regressions in those properties.

---

# 11. Effect on the existing product/Moneta roadmap

Priority 1 **reorders**, but does not discard, the current path.

Preserve:

- Rust/WASM analytical authority;
- Atlas dataset/version/provenance authority;
- progressive semantic drill-down;
- RepresentationGraph/composition direction;
- hard-feasibility versus preference separation;
- bounded Moneta search;
- abstention;
- research freeze/provenance;
- human judgement and later governed learning.

Do not advance broad learned-Moneta ranking merely because training infrastructure is available. The bootstrap candidate system remains useful, but later Moneta learning must not become the permanent representation theory by inertia.

After Priority 1, resume the product-transition sequence with the resource/UX substrate and verification evidence as prerequisites for strong learning claims.

---

# 12. Public implementation boundary while IP review is active

The public project may implement generic infrastructure that is independently useful and already consistent with the published product vision, including:

- resource accounting/governance;
- semantic-detail hierarchy;
- bounded streaming/residency;
- generic hard/soft solver interfaces;
- RepresentationGraph composition infrastructure;
- reversible expand/collapse;
- analytical evidence and uncertainty plumbing;
- performance/interaction verification.

Do **not** place unpublished invention-candidate formalisms, algorithms or enabling tests into this public repository until the IP review/filing decision explicitly clears them. In particular, avoid publishing private mathematical definitions or concrete optimization mechanisms whose novelty is still being assessed.

This boundary is an IP-publication precaution, not a scientific-authority rule.

---

# 13. Priority-1 acceptance matrix

| Area | Required evidence before STOP |
| --- | --- |
| UX | natural point/touch/select/grab/manipulate/locomote/refine/recover journeys on physical target hardware |
| Responsiveness | p50/p95/p99 timing plus time-to-first-useful and refinement latency |
| Rendering | reduced draw-call/object growth; stable semantic identity across instancing/batching |
| Resource use | bounded JS/WASM/GPU-proxy trends; no steady long-session accumulation |
| Cleanup | ACTIVE/WARM/COLD/EVICTED or equivalent bounded reclamation proven without disposal spikes |
| Libraries | each adopted mature replacement demonstrates behavioral parity and performance neutrality/improvement; rejected candidates documented |
| Streaming | bounded queues/backpressure and progressive usability on representative datasets |
| QV | evidence automatically captured, adjudicated and returned to development with exact device/build/run custody |
| Scale | increasing source N does not automatically increase scene/render cardinality |
| Scientific boundary | Rust remains analytical authority; presentation optimisations do not manufacture new analytical truth |
| IP boundary | no unpublished invention-candidate formalism is disclosed by the public implementation tranche |

---

# 14. Immediate first tranche after this planning PR

Once the current unrelated open integration PR is resolved, begin **P1.0 + P1.1 as one bounded implementation tranche**:

1. establish the canonical Quest/device-class performance-resource manifest;
2. reconcile the 60fps/90Hz budget mismatch;
3. instrument p50/p95/p99 and resource trends;
4. remove identified steady-state `Vector3`/`Ray` allocations and equivalent hot-loop churn;
5. add regression tests/evidence for allocation/resource counters where practical;
6. adversarially review the result;
7. merge only on exact-head correctness/build/evidence pass;
8. then proceed to P1.2 instancing/batching.

This is the selected next execution direction.