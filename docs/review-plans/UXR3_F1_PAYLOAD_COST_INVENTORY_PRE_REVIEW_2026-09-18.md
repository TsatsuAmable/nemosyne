# UXR3-F1 Semantic Family Payload/Cost Inventory and Pre-Implementation Adversarial Review

**Status:** PRE-IMPLEMENTATION REVIEW COMPLETE / IMPLEMENTATION CONTRACT PROPOSED
**Base:** `main@3bc5d706ebb7cc486033ffa5d2787dd688d2633d`
**Scope:** presentation/resource governance only. Rust/WASM remains sole analytical authority.

## Question
What can still grow with source size, concurrent demand, or session history after #763/#764/#769, and what is the smallest generic contract needed before UXR3-F2?

## Inventory findings
| Surface | Existing bound | Gap / risk | F1 disposition |
| --- | --- | --- | --- |
| SemanticMaterialisationGovernor | maxResident=64, maxQueued=32, maxMaterialisationsPerTick=4; identity-safe replacement/reconstruction | Bounds number of resident materialisations, not retained bytes/elements or family-specific render/transfer cost | Add cost admission, without analytical semantics |
| Aggregate payload | MAX_AGGREGATE_GROUPS_V1=4096 | element bound exists; no generic presentation admission of payload bytes/cost | Consume authoritative resource envelope; add measured presentation cost separately |
| Distribution payload | bins 256 + ECDF knots 256 + quantiles 32 | hard element bound exists; family shape differs from generic resident-count metric | Same generic admission contract |
| Density payload | 20x20 = 400 cells | hard element bound exists | Same generic admission contract |
| Cluster payload | Rust-owned bounded payload and existing evidence | separate payload type/envelope means generic TS union is not complete family inventory | Generic cost descriptor must not reinterpret family payload |
| Relationship Graph | RFC bound: 4,096 nodes, 16,384 edges, 2 MiB semantic payload | multi-dimensional cost shows elementCount alone is insufficient | Cost vector, not scalar point proxy |
| WorkerAnalyticalPort execution | stale fencing and pending map; diagnostics capped at 32 | concurrent pending EXECUTE requests are not admission-bounded | UXR3-S1, separate from F1 |
| Worker dataset registration | deduplicated per generation/fingerprint | pending registrations are not globally bounded | UXR3-S1 |
| Diagnostic history | MAX_DIAGNOSTIC_SAMPLES=32 | bounded | no action |

## Adversarial committee findings
### Architecture / authority
**Attack:** a generic TypeScript cost model could become a second analytical authority by deriving family meaning, rewriting Rust resource envelopes, or selecting a different semantic representation under pressure.

**Finding A1, material:** F1 must never infer analytical cost from source rows or inspect family payload contents to decide truth/admissibility. Rust/WASM resource envelopes remain authoritative descriptions of analytical payload structure. The presentation governor may only decide whether an already-authorized semantic payload can be resident/materialised under a presentation budget.

**Falsifier:** presentation-pressure refusal must not change candidate/family/semantic identity, analytical method, information contract, or durable investigation state.

### Performance / resource
**Attack:** resident object count is a weak proxy. One graph and one aggregate can differ radically in bytes, GPU buffers, draw batches and materialisation work.

**Finding P1, material:** use a small versioned cost vector with independently bounded dimensions. Initial dimensions must be measurable or conservatively declared without family inference: retained presentation bytes, semantic elements, render batches, and materialisation work units. Unknown required dimensions fail closed rather than counting as zero.

**Finding P2:** do not claim physical memory from JSON byte estimates, JS heap proxies, or semantic element counts. F2 establishes software admission bounds only.

**Falsifiers:** heterogeneous-cost residents refuse before aggregate budget overflow; replacement is atomic; failed replacement preserves old residency/accounting; release/evict restores exactly admitted cost; duplicates do not double-charge.

### Prior-art / reuse
Reuse admission control, bounded queues/backpressure, weighted resource accounting and explicit cancellation/supersession rather than inventing another scheduler. Existing Nemosyne count-based admission/backpressure and generation fencing are the extension seams. Cite adopted prior-art mechanisms where they materially shape code.

## Proposed UXR3-F1 contract
Introduce presentation-only `SemanticMaterialisationCostV1` on materialisation admission, with versioned independent maxima and admitted-total telemetry. It must:
1. contain no source rows, analytical parameters, scores or representation-selection logic;
2. preserve Rust/WASM `ResourceEnvelopeV1` unchanged;
3. use safe non-negative integers and checked addition;
4. fail closed when a required budget dimension is unknown/invalid;
5. capacity-check candidate plus current totals before invoking materialisation;
6. make COARSE/REFINED replacement atomic: check candidate while old state remains authoritative, swap accounting only after success;
7. not allow queued closures/descriptors to smuggle large analytical payloads;
8. expose software accounting, not physical-device claims.

## Work split
**UXR3-F1a, next:** generic cost contract/accounting in `SemanticMaterialisationGovernor` plus deterministic falsifiers.

**UXR3-F1b/F2:** adapt production semantic-family callers to truthful descriptors from authoritative envelope plus presentation construction facts, one path at a time.

**UXR3-S1:** separately bound `WorkerAnalyticalPort` pending executions/registrations and worker-side execution queues; add cancellation/supersession and imbalance falsifiers. Current pending maps are a real unbounded-concurrency seam.

## Pre-implementation disposition
**PASS WITH FALSIFIERS.** The resident-count governor is a valid cardinality seam but insufficient as a generic resource bound. F1a may add multidimensional presentation-cost admission provided A1/P1/P2 are enforced. Worker transport concurrency is a separate S1 gap and must not be claimed closed by F1.
