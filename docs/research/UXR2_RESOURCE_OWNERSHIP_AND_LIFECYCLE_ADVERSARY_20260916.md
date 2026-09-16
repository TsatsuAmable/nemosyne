# UXR2 resource ownership and lifecycle adversary

**Date:** 2026-09-16  
**Status:** research decision / implementation input, not a product or physical-device completion claim  
**Integration base:** `main@6266a2a12d296e58f143cfafdf5a63ac4cb8eee1`

## Executive finding

UXR2 cannot safely implement `ACTIVE -> WARM -> COLD -> EVICTED` by layering a cache or memory-pressure policy over the current disposal helpers. The missing primitive is **explicit resource ownership**.

`src/utils/Dispose.ts` currently traverses an object graph and disposes geometry, every texture-valued material property, and material objects. It protects only three globally shared geometries through a hard-coded `WeakSet`. This is adequate for resources whose ownership is provably private to the disposed subtree, but the API has no way to express shared materials, shared textures, UIKit resources, BVHs, instance buffers, worker buffers, Rust/WASM capacity, or reconstructed semantic payloads.

The UXR2 roadmap simultaneously requires aggressive sharing and an eviction governor. Those requirements create an ownership problem before they create an eviction-policy problem.

## Adversarial counterexample

Construct two live meshes `A` and `B` that intentionally share one material and texture but have private geometries. Dispose only `A` using `disposeObject(A)`.

Current semantics dispose the shared material and texture even though `B` remains live. The scene graph therefore does not encode sufficient information to decide resource lifetime.

The existing shared-geometry exception demonstrates that this class of problem is already known, but it is encoded as a special case rather than an ownership model.

### Required regression falsifier

A focused test should establish the current unsafe boundary before production semantics change:

1. create two meshes with a shared material + texture;
2. attach both to a live parent;
3. dispose one mesh;
4. assert its private geometry is released;
5. assert the shared material/texture are **not** released while the sibling remains live;
6. release the sibling/last owner;
7. assert shared resources are then released exactly once.

A second falsifier should cover shared geometry outside the three `ObjectPool` singleton geometries, proving that identity-specific allowlists do not scale to the governor.

## Required architecture

Introduce an explicit resource-lifetime authority separate from semantic/investigation authority.

Minimum concepts:

```text
ResourceHandle
  id
  kind
  ownership: PRIVATE | SHARED | EXTERNAL
  residency: ACTIVE | WARM | COLD | EVICTED
  reconstructability: RESIDENT_AUTHORITY | RELOADABLE | RECOMPUTABLE | IRREPLACEABLE
  byteEstimate? / countEstimate?
  owners / leases
  lastUsed
  dispose/release callback
  reconstruct/reload callback where lawful
```

The governor owns residency transitions. Presentation objects hold leases/handles; they do not infer ownership from Three.js ancestry.

### Ownership rules

- `PRIVATE`: one owning projection; may be released with that projection.
- `SHARED`: reference/lease counted; dispose only after the final owner releases it.
- `EXTERNAL`: lifetime is owned by a platform/library/other subsystem; Nemosyne may detach references but must not destroy the underlying resource unless the external contract explicitly transfers ownership.
- durable investigation state, evidence, provenance and semantic identity are **never** presentation resources.
- `EVICTED` means disposable projection/residency is gone, not that research meaning is gone.
- cold/evicted reconstructability must point back to authoritative state, never to a presentation-side analytical reconstruction.

## State semantics

`ACTIVE`: needed by current visible/interactive working set.

`WARM`: not currently visible but expected soon; retain expensive reconstructable GPU/presentation resources within budget.

`COLD`: semantic identity/provenance remains, heavyweight presentation resources released or reduced; reconstruction path is known.

`EVICTED`: no resident disposable projection remains. Re-entry must reconstruct/reload from authoritative state and preserve stable semantic identity.

Transitions must be idempotent and observable. A resource cannot be promoted from `EVICTED` without a valid reconstruction path unless it is explicitly reacquired from an external owner.

## Why this is the UXR2/UXR3 seam

The roadmap requires the live footprint to follow the active working set rather than session age or source cardinality, while UXR3 requires representation payloads to remain reconstructable independently of Three.js lifetime. Explicit ownership is the bridge: the governor can shed projection resources without deleting the semantic object they project.

This also avoids a tempting architecture error: making `WorldRendererLifecycle` the global resource authority. That class currently owns particular renderer/dashboard/TDA lifetimes. It should become a **client** of the governor for its resources, not the universal lifetime registry.

## Instrumentation contract

Before adaptive eviction is enabled, expose at least:

- live handles by kind and residency;
- estimated resident bytes where measurable, otherwise explicit `unknown` rather than fabricated precision;
- owner/lease counts for shared resources;
- transition counts and reasons;
- reconstruction/reload latency;
- synchronous disposal duration and largest disposal batch;
- refused/blocked evictions with reason;
- leaked-handle detector at dataset/world teardown.

Renderer `info.memory` may be used as a corroborating GPU-object proxy, not a complete memory authority.

## Verification ladder

### S0/S1 deterministic software

- shared material/texture last-owner semantics;
- private-resource release;
- idempotent release and no double-dispose;
- external resources never destroyed without ownership transfer;
- state-machine transition legality;
- semantic identity survives COLD/EVICTED reconstruction;
- no eviction of IRREPLACEABLE state;
- deterministic budget-pressure victim ordering given equal telemetry/seed.

### S2 browser/IWER

- repeated representation enter/refine/collapse cycles do not monotonically increase registered live resources;
- source dataset cardinality does not directly determine retained presentation resources;
- disposal is amortised rather than a single interaction-blocking cliff.

### S4 physical Quest

Required only for claims about actual headset memory pressure, frame-time impact, thermal behaviour, or comfort. Software tests may establish lifetime correctness but not physical fitness.

## Scope boundary

Do **not** combine this tranche with:

- a new analytical authority;
- Moneta scientific admission changes;
- physical Quest completion claims;
- a universal byte estimator for browser/GPU/WASM memory;
- RepresentationGraph discovery mathematics;
- arbitrary LRU eviction before ownership/reconstructability are explicit.

## Research/statistical surveillance note

No September-2026 statistical result found in this cycle overturns the standing Moneta evidence architecture. Two recent compositional-data directions strengthen its conservatism rather than changing it: structural-zero models make zero semantics part of the model, and recent high-dimensional compositional work continues to treat the simplex/relative geometry as procedure-specific. Effective-rank work likewise remains task/sample/noise dependent. Therefore no new universal effective-dimension or compositional threshold should be introduced from this scan.

## Finding / hypothesis / speculation

**Finding:** current disposal semantics cannot represent general shared-resource lifetime, while UXR2 explicitly requires both aggressive sharing and governed eviction.

**Hypothesis:** an ownership/lease layer introduced before adaptive eviction will let UXR2 bound residency without corrupting shared rendering resources or durable investigation meaning, and will provide the exact seam UXR3 needs for reconstructable projections.

**Speculation:** once ownership telemetry exists, the best eviction policy may be semantic-value-aware rather than pure LRU, but that should be tested later. The ownership model must not encode that policy prematurely.

## Recommended implementation order

1. Add failing shared material/texture and non-singleton shared-geometry falsifiers.
2. Introduce `ResourceHandle`/lease registry with PRIVATE/SHARED/EXTERNAL ownership and lifecycle state, initially without adaptive eviction.
3. Route one bounded production surface through it, preferably representation projection resources rather than global world teardown.
4. Add teardown leak assertions and transition telemetry.
5. Only then add deterministic budget-driven WARM/COLD/EVICTED policy.
6. Connect UXR3 reconstruction to authoritative representation/semantic payload state.
7. Qualify repeated-cycle behaviour in browser/IWER, then physical Quest when the claim becomes device-dependent.
