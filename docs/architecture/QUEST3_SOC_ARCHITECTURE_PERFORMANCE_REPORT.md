# Quest 3 SoC Architecture and Performance Optimization Report

**Date:** 3 October 2026  
**Status:** PRE-FLIGHT / EXPERIMENT PLAN  
**Owner lane:** L4 Runtime & Device Efficiency (currently Mac experimental capacity), with physical Meta Quest 3 qualification when the headset is available  
**Target runtime:** Nemosyne WebXR / Three.js / Rust-WASM on Meta Quest Browser  
**Related:** `docs/architecture/FULL_MONETA_SEMANTIC_EMBODIMENT_ARCHITECTURE_PLAN.md`, `docs/architecture/MONETA_SYSTEM1_SYSTEM2_ONNX_ARCHITECTURE.md`, `docs/P1_ANALYTICAL_RESPONSIVENESS_AND_SPATIAL_FITNESS.md`, `docs/review-plans/P1Q_Q3B_RESOURCE_ENVELOPE_2026-08-28.md`

## 1. Executive summary

Quest 3's Snapdragon XR2 Gen 2 is a heterogeneous mobile SoC with Kryo CPU cores, an Adreno GPU, a Hexagon AI processor, dedicated computer-vision hardware, LPDDR5 memory and an 8 MB system-level cache. Nemosyne, however, currently executes as a WebXR application in Meta Quest Browser. That distinction is architectural: the browser exposes CPU, WebGL/WebGPU and WebXR capabilities, but it does not give the current application a direct Hexagon/QNN execution path.

The immediate optimization programme should therefore optimize the existing **WebXR path first**, then consider a native shell only if measurements show a hard browser ceiling.

The highest-value work is expected to be:

1. replace hard-coded frame assumptions with a measured per-session resource envelope;
2. verify and tune Quest Browser foveation, multiview and frame-rate/render-scale settings;
3. make semantic LOD and visibility a first-class representation compilation stage rather than simply dropping instance count;
4. reduce draw calls, overdraw, allocation churn and interaction/raycast work;
5. reduce Worker/WASM materialisation and transport cost using the already-proven compact-result seam;
6. turn the current frame governor into a general runtime-budget scheduler;
7. benchmark System-1 WASM versus WebGPU and quantization on the physical headset;
8. evaluate native Vulkan/Hexagon/QNN only behind a separate architectural gate.

No optimization may create a second analytical authority. Rust/WASM remains authoritative for analytical facts, and any adaptive visual degradation must preserve the governed meaning of the representation.

## 2. Current Nemosyne baseline and observed gaps

The current runtime already contains useful foundations:

- `src/vr/Engine.ts` uses the WebXR animation loop, records frame time, exposes Three.js renderer statistics, and owns an `AdaptiveFrameGovernor`.
- `src/vr/scalability/AdaptiveFrameGovernor.ts` currently targets 11.1 ms and scales one LOD factor based on a rolling average.
- `src/utils/PerformanceBudget.ts` separately defaults to 16.67 ms, 500 draw calls and other static thresholds.
- `src/vr/scalability/InstancedPointCloud.ts` already uses `THREE.InstancedMesh`, reusable color buffers and update ranges.
- Quest telemetry already records frame cadence, WASM memory, JS heap where available, scene cardinality, visible cardinality and governor throttle events.
- Q3B already demonstrated that full `DatasetJSON` materialisation can be substantially more expensive than compact row-view materialisation, while correctly refusing to generalize the cross-operation end-to-end result.
- The current repository contains no explicit `fixedFoveation`, `setFoveation`, `setFramebufferScaleFactor` or `OCULUS_multiview` configuration. This does **not** prove the runtime is not foveated or multiview; feature/runtime inspection is required.

Two baseline inconsistencies should be corrected before optimization claims are made:

1. the frame governor assumes 90 Hz while the generic performance budget assumes 60 Hz;
2. the current physical telemetry schema is named for `META_QUEST_3S`, while this programme targets Quest 3. Device identity and qualification profiles must not silently conflate the two.

## 3. Governing verification protocol

Every strategy below is an experiment before it is an implementation commitment.

### 3.1 Required physical evidence

Final performance adoption requires a physical Quest 3 run. Desktop/IWER/browser simulation may validate semantics, lifecycle, APIs and instrumentation but cannot establish Quest frame pacing, GPU behavior, thermal behavior or power stability.

The Mac lane owns orchestration, code changes, browser inspection and evidence packaging. Physical runs should use the existing Quest validation harness plus, where useful:

- OVR Metrics Tool / MQDH performance metrics;
- Chrome DevTools tracing;
- RenderDoc Meta Fork or Quest GPU profiler for render-stage analysis;
- Nemosyne's existing telemetry and deterministic scenario manifests.

### 3.2 A/B discipline

For each optimization:

- use the same source commit except for the single candidate change;
- use the same deterministic dataset and investigation path;
- fix the requested WebXR frame rate and headset state where possible;
- perform an untimed warm-up;
- collect at least three independent short runs for timing claims;
- use a sustained 30-minute run for any strategy expected to alter thermal or memory behavior;
- preserve raw result artifacts and exact device/browser/build identity.

### 3.3 Core metrics

At minimum record:

- target and observed WebXR frame rate;
- frame interval p50/p95/p99 and dropped/missed-frame percentage;
- CPU/GPU utilization or timing where platform tooling exposes it;
- GPU/CPU performance level where platform tooling exposes it;
- draw calls, triangles/points and visible object count;
- JS heap and WASM memory where available;
- worker/materialisation timings for analytical operations;
- governor actions and selected semantic-resolution level;
- thermal/sustained-performance drift;
- visual/interaction correctness;
- analytical fingerprint/replay/provenance equality where the optimization crosses a governed data seam.

A performance change is not adoptable merely because one mean number improves. It must improve the bottleneck that the experiment was designed to test and must not move the failure elsewhere.

## 4. Strategy QSO-0: refresh-aware performance envelope

### Problem

Nemosyne currently has competing frame assumptions: 11.1 ms in `AdaptiveFrameGovernor` and 16.67 ms in `PerformanceBudget`. Meta's WebXR guidance requires applications to reason from the actual target frame rate. Quest Browser exposes supported frame rates and the active session frame rate.

### Design

Introduce a single `XRPerformanceEnvelope` created at session start:

```text
XRPerformanceEnvelope
├── deviceProfile
├── targetFrameRateHz
├── frameBudgetMs
├── renderScaleProfile
├── foveationLevel
├── cpuBudgetClass
├── gpuBudgetClass
├── memoryBudgetClass
└── evidenceIdentity
```

All governors and warnings consume this envelope instead of hard-coded frame times.

### Verification of usefulness

Run the same scene at each supported target frame rate reported by the device. Measure frame stability, visual/interaction quality and sustained thermal drift. A lower target is useful only if it reduces missed frames or improves sustained stability enough to justify the extra motion latency.

### Implementation plan

1. Generalize the Quest telemetry schema to distinguish Quest 3 and Quest 3S.
2. Capture `session.supportedFrameRates`, active frame rate and the derived frame budget.
3. Inject the envelope into `PerformanceBudget` and `AdaptiveFrameGovernor`.
4. Remove independent hard-coded frame budgets.
5. Add replay/telemetry identity for the selected runtime profile.

### Adoption gate

Adopt unconditionally as an architecture cleanup if semantics remain unchanged. Do not select a non-default frame rate until physical A/B evidence supports that profile.

## 5. Strategy QSO-1: fixed foveated rendering

### Problem

Quest scenes are often fragment/fill-rate bound. Meta Quest Browser supports fixed foveated rendering, and Three.js exposes `renderer.xr.setFoveation()`. Nemosyne contains high-contrast labels and data marks, so aggressive foveation can also be visibly harmful.

### Design

Feature-detect and expose bounded foveation levels through the performance envelope. The governor may increase foveation before degrading semantic content when the scene is fragment-bound.

### Verification of usefulness

Use a known fragment-heavy Nemosyne representation and compare foveation levels. Record GPU/frame metrics and capture text/data-legibility checks at the center and periphery.

### Implementation plan

1. Add a runtime capability probe for foveation.
2. Add explicit baseline, low, medium and high test profiles.
3. Record chosen foveation in telemetry.
4. If useful, allow the governor to adjust foveation independently of semantic LOD.
5. Keep text-critical panels at conservative settings or move them to a separate layer if later evidence supports it.

### Adoption gate

Require a repeatable GPU/frame-time improvement without a user-visible loss of data readability or interaction targeting. Otherwise leave foveation at the runtime/default setting.

## 6. Strategy QSO-2: multiview verification and enablement

### Problem

Stereo rendering can duplicate CPU submission and vertex work. Meta recommends multiview on Quest WebGL 2, but application code currently does not prove whether the deployed Three.js path is actually using the Quest multiview extension.

### Design

First instrument, then optimize. Detect `OCULUS_multiview` / relevant multiview support and use GPU capture to determine whether both eyes are being rendered through a multiview target.

### Verification of usefulness

Compare render submission cost, draw-call behavior and CPU/GPU frame time with multiview active versus a controlled non-multiview path where feasible.

### Implementation plan

1. Add a capability/active-state probe.
2. Record multiview state in Quest telemetry.
3. If Three.js already uses it correctly, close the item with evidence.
4. If not, prototype the smallest renderer integration or upstream-compatible patch.
5. Reject a long-lived Three.js fork unless the measured gain is large enough to justify its maintenance cost.

### Adoption gate

No custom renderer/fork solely because the extension exists. Require measured material benefit on representative Nemosyne scenes.

## 7. Strategy QSO-3: frame-rate and framebuffer-scale profiles

### Problem

Rendering every frame at maximum scale can consume fragment bandwidth that adds little scientific value. Three.js can set the XR framebuffer scale before a session, and Quest Browser supports application frame-rate selection.

### Design

Define explicit quality profiles rather than an opaque quality slider:

- `Fidelity`: higher render scale, conservative LOD;
- `Balanced`: normal scale and adaptive foveation;
- `Capacity`: lower scale with higher semantic capacity;
- `StudyLocked`: pinned settings for reproducible research.

The framebuffer scale is selected before session start; in-session adaptation should prefer foveation and semantic LOD because Three.js cannot change framebuffer scale during an active XR session.

### Verification of usefulness

Sweep framebuffer scale and supported frame-rate combinations using the same scenes. Plot headroom against text/mark legibility and interaction accuracy.

### Implementation plan

Add pre-session profile selection and persist the profile into investigation/runtime provenance. Do not silently change render scale during a research treatment.

### Adoption gate

Choose defaults from physical evidence, not a desktop estimate.

## 8. Strategy QSO-4: tile-GPU, overdraw and material austerity

### Problem

XR2 Gen 2 uses a tile-based Adreno GPU. Excessive transparency, overlapping geometry, expensive fragment shaders, texture sampling and avoidable render passes consume memory bandwidth and tile work.

### Design

Audit the render graph for:

- transparent full-screen or near-full-screen geometry;
- translucent panels and stacked overlays;
- unnecessary double-sided materials;
- unnecessary PBR materials/lights on non-hero data marks;
- texture-heavy UI/materials;
- redundant depth/color passes;
- draw order that defeats early depth rejection.

Data marks should prefer simple materials unless a richer material encodes actual information.

### Verification of usefulness

Use RenderDoc/Quest GPU profiling to rank expensive draw calls and identify overdraw/tile-store costs. Compare GPU duration and bus/load-store behavior before and after each isolated change.

### Implementation plan

Start with the most expensive captured draw call or layer. Do not perform a broad visual rewrite. Convert one class at a time and preserve screenshots/visual fixtures.

### Adoption gate

Measured GPU reduction plus visual-semantic parity.

## 9. Strategy QSO-5: draw-call and scene-cardinality compression

### Problem

Quest Browser can become CPU-bound from draw submission even when triangle counts are modest. Nemosyne already has an instanced point-cloud path, but not every repeated representation necessarily uses it.

### Design

Create a render census by representation type and consolidate repeated geometry/material combinations using:

- `InstancedMesh`;
- merged static buffers where interaction semantics permit;
- shared materials/geometries;
- state-change minimization.

Do not merge objects across boundaries that need independent semantic identity unless identity is retained through instance IDs or another deterministic mapping.

### Verification of usefulness

Measure `renderer.info.render.calls`, CPU frame cost and interaction parity. Meta's tooling considers fewer than roughly 300 draw calls desirable, but Nemosyne should derive its own device-specific budget rather than treating that heuristic as a scientific threshold.

### Implementation plan

1. inventory draw calls by representation;
2. select the highest-call repeated family;
3. convert to instancing/shared buffers;
4. preserve object-to-investigation identity mapping;
5. repeat only while profiling shows draw-call pressure.

### Adoption gate

Reduced submission cost with no loss of selection/provenance semantics.

## 10. Strategy QSO-6: semantic LOD and VisibleRepresentationSet

### Problem

The current `InstancedPointCloud.applyLODScale()` reduces visible count by truncating the instance list. That is cheap, but generic truncation can be semantically biased by ordering and is not sufficient for Full Moneta's hardware-adaptive representation goal.

### Design

Introduce a governed stage between `RepresentationGraph` and Three.js:

```text
RepresentationGraph
      ↓
RepresentationResourceEnvelope
      ↓
SemanticResolutionPlanner
      ↓
VisibleRepresentationSet
      ↓
GPU render packets / instances
```

The planner may use aggregation, representative sampling, cluster summaries, semantic importance, focus and distance, but it may not fabricate analytical facts. Selection rules are deterministic/versioned in Research Mode.

This is the concrete performance implementation of FM4's "stickman ↔ Mona Lisa" capability.

### Verification of usefulness

For each representation family, compare full versus reduced semantic resolution on:

- frame time and visible cardinality;
- preservation of known structures;
- selection and comparison tasks;
- bias introduced by sampling/aggregation;
- replay determinism.

### Implementation plan

1. define `RepresentationResourceEnvelope`;
2. define `VisibleRepresentationSet` with provenance back to source semantic objects;
3. implement one representation, probably dense point/cluster data;
4. integrate with the frame governor;
5. only then generalize across representation types.

### Adoption gate

Performance benefit plus semantic-preservation tests. Naive order-based truncation must not become the general solution.

## 11. Strategy QSO-7: spatial culling and interaction acceleration

### Problem

Rendering and interaction have different visibility requirements. A large instanced cloud can be one draw call yet still be expensive to raycast or update. Nemosyne already depends on `three-mesh-bvh`, providing an existing acceleration substrate for suitable static geometry.

### Design

Use hierarchical/coarse spatial indexes for:

- view-frustum candidate groups;
- interaction/raycast candidate narrowing;
- detail expansion around focus;
- off-screen update suppression.

For instanced data, use spatial buckets or an instance-level index before invoking fine ray tests. For static triangle geometry, evaluate BVH acceleration.

### Verification of usefulness

Record interaction-update time and selection equivalence on dense scenes. Stress tests should include the same target hit/miss corpus before and after acceleration.

### Implementation plan

Add timing around input/raycast processing, select the dominant path, then introduce one index behind the existing interaction contract.

### Adoption gate

Meaningful p95 interaction CPU reduction with identical target-resolution results.

## 12. Strategy QSO-8: allocation, GC and GPU-buffer discipline

### Problem

Mobile browser runtimes are sensitive to garbage-collection spikes and memory bandwidth. `InstancedPointCloud.setPoints()` currently creates/clones `Vector3` objects and stored-position objects per visible item, while the class already demonstrates the better pattern for colors and update ranges.

### Design

Move hot representation data toward structure-of-arrays:

- typed position/scale/color buffers;
- stable integer/object handles instead of per-frame wrapper objects;
- pooled temporary vectors/matrices;
- dirty ranges for GPU uploads;
- no full matrix/color re-upload when only a small subset changes.

### Verification of usefulness

Use Chrome traces and heap telemetry to compare allocations, GC pauses, frame p95/p99 and upload cost during repeated updates.

### Implementation plan

Refactor one hot path, beginning with `InstancedPointCloud`, while retaining the same public contract. Add property tests for instance mapping and subrange updates.

### Adoption gate

Reduced allocation/GC or upload cost with no interaction regression.

## 13. Strategy QSO-9: compact Worker/WASM result transport

### Problem

The existing Q3B experiment showed a real materialisation-cost signal for full dataset results and larger WASM growth at 32k rows. The next optimization must isolate transport/materialisation from kernel work using the already-specified same-operation A/B.

### Design

Prefer:

- compact row views/handles when scientifically lossless;
- resident Rust/WASM results;
- typed/columnar transfer rather than full object graphs;
- transferable buffers where ownership semantics fit;
- lazy materialisation at the UI boundary.

`SharedArrayBuffer`/threaded WASM is a later option only if cross-origin isolation, complexity and measured benefit justify it.

### Verification of usefulness

Execute the planned same-operation A/B with identical Rust operation and scientific fingerprint. Measure Worker materialisation time, copied bytes/proxies, WASM growth, page heap and maximum frame gap.

### Implementation plan

Complete Q3C first. Select the next transport architecture from those measurements rather than pre-committing to shared memory.

### Adoption gate

Exact analytical fingerprint/provenance parity plus material memory/latency improvement.

## 14. Strategy QSO-10: budgeted frame scheduler

### Problem

The current engine updates locomotion, desktop controls and every registered `updatable` each frame, then reacts to frame pressure mainly by reducing LOD. Work that is not latency-critical should not automatically compete with input and rendering every frame.

### Design

Replace the single-dimensional governor with a `RuntimeBudgetGovernor` that allocates work classes:

- **critical:** pose/input, locomotion, interaction commit, render;
- **interactive:** visible animation, focus/detail updates;
- **deferred:** panel recomposition, non-visible transforms, housekeeping;
- **background:** analytical jobs/System-1 inference in workers.

The governor may defer or amortize work but may not change scientific results.

### Verification of usefulness

Instrument task-category time and compare p95/p99 frame intervals under burst workloads such as dataset load, representation change and panel activity.

### Implementation plan

1. instrument current updatables by category;
2. identify non-critical frame work;
3. introduce bounded queues and per-frame time slices;
4. move eligible work to workers;
5. integrate semantic LOD and foveation as separate governor actuators.

### Adoption gate

Lower tail latency/stutter without visible input latency or stale scientific state.

## 15. Strategy QSO-11: System-1 provider and quantization matrix

### Problem

FM5 proposes small specialist models. On the WebXR path, Nemosyne can realistically use ONNX Runtime Web WASM and, if feature-qualified on Quest Browser, WebGPU. WebGPU consumes the same Adreno resource pool as rendering, so a faster inference call can still make XR worse.

### Design

Benchmark each candidate model as a **whole-XR workload**:

- deterministic baseline;
- ONNX Runtime WASM;
- ONNX Runtime WebGPU where available;
- FP32/FP16/INT8 variants where supported and meaningful.

Inference remains off the render-critical path.

### Verification of usefulness

Measure inference p50/p95, model load, memory and **simultaneous XR frame pacing**. Evaluate proposal/perception quality separately using the FM5 scientific metrics.

### Implementation plan

Extend FM5-S1D with a Quest provider matrix. Record execution provider and quantization artifact identity in provenance.

### Adoption gate

Select the provider that improves end-to-end product behavior, not the provider with the smallest isolated inference latency.

## 16. Strategy QSO-12: Rust/WASM SIMD and kernel specialization

### Problem

The analytical kernel is already the correct place for analytical computation, but the current repository does not explicitly demonstrate a SIMD-qualified WebAssembly build.

### Design

Build an experimental `wasm32` artifact with SIMD enabled and benchmark only production-representative kernels that have vectorizable hot loops. Keep a scalar-compatible artifact until device/browser support and parity are proven.

WASM threads are a separate, later experiment because Worker topology, cross-origin isolation and synchronization overhead may erase the theoretical gain for Nemosyne's workload.

### Verification of usefulness

Use identical deterministic datasets and compare kernel timing, WASM memory and exact output fingerprints on Quest Browser.

### Implementation plan

1. identify hot Rust kernels from measurements;
2. build scalar and SIMD variants from the same source;
3. add runtime capability detection;
4. A/B on Quest 3;
5. only investigate threads for kernels that remain CPU-bound after SIMD and transport fixes.

### Adoption gate

Exact result parity plus a repeatable kernel/end-to-end gain.

## 17. Strategy QSO-13: WebXR Layers for static/high-clarity surfaces

### Problem

Static sky/background imagery and high-resolution text/UI do not always need to be redrawn into the main projection layer every frame. Meta's WebXR Layers path allows the compositor to retain/update separate layers and can materially reduce GPU work for suitable content.

### Design

Prototype one bounded Nemosyne surface, preferably a static or infrequently updated Evidence Vault/TechnoCore information surface, as a WebXR layer. Do not move spatial data marks that require normal scene depth relationships without proving the interaction semantics.

### Verification of usefulness

Compare projection-layer versus WebXR-layer GPU cost, text clarity and interaction behavior.

### Implementation plan

Add capability detection and a single optional layer prototype. Keep the existing scene implementation as fallback.

### Adoption gate

Material GPU/clarity benefit with correct spatial/interaction behavior.

## 18. Strategy QSO-14: conditional native Quest shell / Hexagon path

### Problem

The Snapdragon XR2 Gen 2 includes Hexagon AI acceleration, but the current Browser/WebXR architecture does not expose Qualcomm QNN/AI Engine Direct directly to Nemosyne. Likewise, native OpenXR can expose optimizations such as deeper Vulkan control and Application SpaceWarp that are not equivalent to the current web stack.

### Design

Treat native execution as a **separate delivery adapter**, not a rewrite of Moneta or the analytical model:

```text
Shared governed Nemosyne contracts
        ├── WebXR adapter (current product path)
        └── Native Quest adapter (experimental)
             ├── OpenXR/Vulkan presentation
             └── optional QNN/Hexagon System-1 provider
```

The Rust analytical authority, RepresentationGraph, NIL and investigation/replay contracts remain shared.

### Verification of usefulness

Do not build this lane merely to access the NPU. Trigger a native feasibility spike only if:

- WebXR profiling shows a persistent platform ceiling after QSO-0 through QSO-13;
- the blocked capability materially affects product usefulness;
- a thin native shell can reuse core contracts without creating architectural duplication.

Then benchmark one System-1 model and one render stress case against WebXR.

### Implementation plan

A minimal spike should prove contract reuse, deployment friction, native/WebXR replay parity and one measurable acceleration path before any product commitment.

### Adoption gate

Native complexity must buy a capability or performance envelope that the optimized WebXR path cannot reasonably provide.

## 19. Prioritization and Mac implementation tranches

| Mac tranche | Strategies | Purpose | Physical Quest required for closure? |
| --- | --- | --- | --- |
| **MAC-Q0 Baseline** | QSO-0 | unify frame/device/resource evidence | Yes |
| **MAC-Q1 Browser fast wins** | QSO-1, QSO-2, QSO-3, QSO-4 | exploit available Quest Browser rendering controls | Yes |
| **MAC-Q2 Representation hot path** | QSO-5, QSO-6, QSO-7, QSO-8 | reduce scene, semantic and interaction cost | Yes for performance; simulation can establish correctness |
| **MAC-Q3 Runtime/data plane** | QSO-9, QSO-10, QSO-12 | reduce transport, scheduling and CPU cost | Yes for final adoption |
| **MAC-Q4 FM5/device intelligence** | QSO-11, QSO-13 | qualify System-1 providers and layer offload | Yes |
| **MAC-Q5 Native feasibility** | QSO-14 | test browser ceiling escape hatch only if triggered | Yes |

The Mac lane may implement instrumentation, deterministic tests, IWER/desktop simulation and code changes while the headset is unavailable. It must mark those results as non-physical evidence. No strategy is promoted on simulator evidence alone when the claimed benefit is Quest frame, GPU, thermal, power or device behavior.

## 20. Recommended execution order

Start with **MAC-Q0**, because the current 60 Hz versus 90 Hz budget split contaminates later comparisons. Then execute QSO-1 and QSO-2 as capability probes before writing new rendering infrastructure. If those reveal a fragment bottleneck, prioritize QSO-4 and foveation. If CPU submission is dominant, prioritize QSO-5. If frame tails correlate with representation updates, prioritize QSO-6/QSO-8/QSO-10. QSO-9 continues the already-established Q3 resource-envelope work. QSO-11 belongs with FM5 qualification. QSO-14 remains deliberately last.

## 21. External technical basis

- Meta Quest Browser WebXR performance workflow and frame budgets: https://developers.meta.com/vr/documentation/web/webxr-perf-workflow/
- Meta WebXR performance overview: https://developers.meta.com/vr/documentation/web/webxr-perf/
- Meta WebXR fixed foveated rendering: https://developers.meta.com/vr/documentation/web/webxr-ffr/
- Meta WebXR multiview: https://developers.meta.com/vr/documentation/web/web-multiview/
- Meta WebXR Layers: https://developers.meta.com/vr/documentation/web/webxr-layers/
- Meta WebXR frame-rate control: https://developers.meta.com/vr/documentation/web/webxr-frames/
- Meta tiled-GPU guidance: https://developers.meta.com/vr/documentation/unity/po-advanced-gpu-pipelines/
- Meta CPU/GPU performance-level guidance: https://developers.meta.com/vr/essentials/cpu-gpu-levels/
- Qualcomm Snapdragon XR2 Gen 2 product brief: https://docs.qualcomm.com/bundle/publicresource/87-73689-1_REV_A_Snapdragon_XR2_Gen_2_Platform_Product_Brief.pdf
- Three.js WebXRManager: https://threejs.org/docs/pages/WebXRManager.html
- ONNX Runtime Web provider guidance: https://onnxruntime.ai/docs/get-started/with-javascript/web.html
- ONNX Runtime WebGPU: https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html
- Qualcomm AI Engine Direct / QNN overview: https://www.qualcomm.com/developer/software/qualcomm-ai-engine-direct-sdk
