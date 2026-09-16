# UXR2 Resource Lifecycle Governor and UXR3 Semantic Working-Set Seam

**Status:** Approved design, pre-implementation
**Date:** 16 September 2026
**Integration base:** `main@12ccb1f72ac72a629d1239295bbc647060ef0d83` (#755)
**Canonical roadmap:** `docs/ROADMAP.md`
**Programme:** `docs/roadmap/P1_UXR_SEMANTIC_EFFICIENCY_UX_RUNTIME_AND_VERIFICATION.md`

## 1. Purpose

UXR2 requires the live resource footprint to follow the active investigative working set rather than session age or source dataset cardinality. UXR3 requires semantic detail to remain bounded, reconstructable and independent of transient Three.js object lifetime.

This design introduces one production authority for presentation residency while preserving the existing analytical authority boundary:

> Durable investigation, dataset and representation state own meaning. Runtime/GPU objects are disposable projections of that meaning.

The tranche establishes the first explicit `ACTIVE -> WARM -> COLD -> EVICTED` lifecycle and connects it to semantic working-set declarations without claiming that Worker/WASM residency is solved.

## 2. Scope

In scope:

- deterministic lifecycle policy for presentation resources;
- stable semantic resource identity;
- bounded working-set declarations and residency counts;
- an initial `RepresentationSurface` production adapter;
- amortised retirement/disposal;
- telemetry sufficient to show residency follows semantic demand;
- fail-closed interaction with existing bounded semantic drill-down.

Out of scope:

- changing Moneta analytical or scientific authority;
- inventing new representation-selection heuristics;
- Worker/WASM buffer eviction without an explicit release ABI;
- private discovery-preservation mathematics;
- physical Quest long-session qualification, which remains UXR4/UXR5 evidence.

## High-risk pre-implementation adversarial contract

**Invariant:** presentation residency may shrink or reconstruct without changing analytical meaning, investigation/provenance identity or the currently declared semantic focus; live records remain bounded under any finite policy.

**Authority and production path:** durable dataset/investigation state plus Rust/WASM remain analytical authority. `RepresentationSurface` owns the currently promoted spatial projection. `SemanticWorkingSet` declares desired presentation residency. `ResourceLifecycleGovernor` alone owns presentation lifecycle transitions and cleanup scheduling.

**Primary failure modes:** stale async cleanup revives or destroys a newer representation; cold descriptors retain full datasets/rows and defeat reclamation; session history grows live/tombstone records without bound; pressure evicts current focus; disposal cliffs harm frame pacing; presentation eviction bypasses Worker-residency refusal; telemetry reports requested rather than successful reclamation.

**Falsifying evidence:** pure state-machine tests, forbidden-payload descriptor tests, repeated-cycle boundedness tests, per-tick cleanup-budget tests, stale-revision tests, production `RepresentationSurface` integration tests, semantic-detail fail-closed regressions and telemetry assertions that distinguish requested from completed transitions.

**Non-goals/dependencies:** no Worker/WASM eviction claim, no long-session physical Quest stability claim, no complete UXR3 streaming/backpressure claim, and no new scientific or representation-selection authority. A governed analytical release ABI is a prerequisite for future Worker residency control.

## 3. Existing authority boundaries

`LODManager` remains a perceptual detail/culling helper. It may inform which objects need high visual detail, but it does not own residency.

`AdaptiveFrameGovernor` remains a frame-time pressure controller. Its output may later become a pressure signal to this governor, but it does not decide semantic importance or resource identity.

`RepresentationSurface` remains owner of the currently promoted Moneta spatial projection and selection wiring. It becomes a client of lifecycle policy rather than the policy owner.

`SemanticDetailTransition` remains fail closed against Worker residency. If the exact analytical dataset is not resident, exact/detail inspection refuses. Presentation eviction must not create a hidden path that reconstructs analytical authority from cached rows.

`WorkerAnalyticalPort.hasRegisteredDataset()` remains a transport-local residency fact. This tranche does not add Worker eviction because there is no explicit governed release capability yet.

## 4. Chosen architecture

Add `ResourceLifecycleGovernor` under the VR scalability/runtime boundary. It owns only presentation-resource residency policy and telemetry.

Add a narrow `SemanticWorkingSet` contract that callers use to declare desired residency for stable semantic resources. A declaration carries identity, desired state and priority class only. Resource-family adapters own any bounded reconstruction descriptor and lifecycle hooks. Neither surface carries analytical claims.

The governor stores resource records keyed by a stable `ResourceIdentity`. Each record has current state, desired state, last-touch epoch, a monotonically increasing lifecycle revision, bounded reconstruction descriptor, cost estimates, and lifecycle hooks for detach, cool, reconstruct and dispose. Async hook completion must match the current revision before it may mutate the record.

Lifecycle transitions are deterministic and monotonic within one reconciliation pass. Promotion is driven only by an explicit working-set declaration; pressure may accelerate demotion but may not silently promote semantic detail.

## 5. Lifecycle semantics

States:

- `ACTIVE`: required for current interaction or visible authoritative projection. It must not be evicted by pressure alone.
- `WARM`: not current interaction authority, but reusable runtime objects may remain resident for fast return.
- `COLD`: expensive runtime/GPU objects have been released. Only a bounded reconstruction descriptor and durable external identities remain.
- `EVICTED`: the governor retains no reconstructable presentation payload. Recovery starts again from durable investigation, dataset and representation authority outside the governor.

Allowed state changes:

```text
ACTIVE <-> WARM -> COLD -> EVICTED
COLD -> WARM -> ACTIVE only after an explicit working-set declaration and successful reconstruction
EVICTED -> ACTIVE is not an in-place resurrection; it is a fresh registration from durable authority
```

`ACTIVE -> COLD` and `ACTIVE -> EVICTED` are forbidden direct transitions. An active item must first leave the semantic working set and become `WARM`.

`EVICTED` is an observable terminal transition, not an indefinitely retained cache entry. After the transition is recorded, the live registry drops the resource record; only a bounded telemetry ring may retain the event. A later request is a fresh registration from durable authority.

Eviction never deletes investigation history, dataset identity, decision identity, provenance or scientific evidence. Those live outside this subsystem.

## 6. Resource identity and reconstruction safety

A presentation resource identity must bind at least:

- resource family;
- dataset fingerprint;
- dataset version/generation where applicable;
- representation decision identity;
- semantic object or projection identity.

A stale identity can never satisfy a request for a newer dataset generation, decision or semantic object.

The `COLD` reconstruction descriptor is deliberately restrictive. It may contain bounded primitive values, IDs, hashes, representation-family parameters and references to durable authority. It must not retain a `Dataset`, arbitrary row arrays, full source payloads, Three.js objects, typed GPU buffers or Worker transfer buffers.

## 7. Working-set reconciliation

`SemanticWorkingSet` is declarative. Each reconciliation provides the complete desired set for the relevant resource family rather than an imperative stream of ad-hoc retain/release calls.

The governor compares desired declarations with registered records:

1. matching declared resources are promoted or retained at their requested state;
2. undeclared `ACTIVE` resources become `WARM` only after their owner has detached interaction authority;
3. excess `WARM` resources are queued for cooling according to explicit operational policy;
4. excess `COLD` descriptors are queued for eviction;
5. queued cleanup is processed incrementally under a per-tick work budget.

Operational policy is configuration, not scientific authority. Limits on declarations, active records, warm records, cold descriptors and cleanup operations per tick must be named and observable. Reconciliation validates the complete declaration set atomically; if it exceeds configured active/declaration bounds, the governor refuses that reconciliation and preserves the previous safe state rather than silently choosing which semantic focus to drop. Tests must prove bounded behaviour for arbitrary finite policies rather than treating one chosen number as epistemically privileged.

Pressure inputs such as frame-time degradation or measured resource headroom may request faster demotion. They cannot override the invariant that current semantic focus and analytical meaning are protected first.

## 8. Disposal and frame safety

Lifecycle hooks are split so expensive work can be amortised:

- `detach`: remove interaction/update/scene authority promptly;
- `cool`: release GPU/runtime objects and produce or validate the bounded descriptor;
- `dispose`: release any remaining presentation cache state;
- `reconstruct`: recreate presentation resources from durable authority plus the bounded descriptor.

No loop may synchronously dispose an unbounded collection merely because a dataset or representation changed.

The first implementation uses a deterministic cleanup queue and a configurable maximum number of cleanup operations per tick. A later device-evidence tranche may replace count-based work with measured time budgets if physical profiling justifies it.

## 9. `RepresentationSurface` integration

The currently promoted representation registers one lifecycle resource as `ACTIVE`. Its identity binds dataset/decision/representation context.

On replacement or clear:

- selection and interactable authority are removed first;
- the outgoing projection leaves `ACTIVE` and enters `WARM`;
- cleanup is delegated to the governor rather than an unbounded immediate disposal path;
- the new promoted projection becomes the only `ACTIVE` representation resource.

`RepresentationSurface` retains responsibility for semantic selection identity and interaction binding. The governor never decides what representation Moneta should promote.
The initial adapter does not promise an automatic hidden rehydration cache. A `COLD` record may hold only the bounded identity needed for the existing authoritative load/representation path to recreate the projection. If automatic reconstruction later requires a new callback from durable state, that is a separate reviewed extension.

The outgoing `MonetaDataInput` itself is never retained as the cold descriptor because it may contain a full `Dataset` or row array.

## 10. Semantic-detail interaction

Bounded observation overlays are subordinate to their selected semantic parent. When that parent leaves the active working set, detail overlays clear before the parent can cool.

Exact datum inspection keeps its current Worker-residency check. If the analytical Worker no longer has the registered dataset, inspection returns a typed refusal. The presentation governor must not register datasets, serialise source rows or otherwise repair analytical residency behind that contract.

This keeps the authority chain explicit:

```text
durable dataset / investigation state
  -> Rust/WASM analytical authority
    -> bounded semantic representation state
      -> semantic working-set declaration
        -> ResourceLifecycleGovernor
          -> disposable Three.js / UI projection
```

## 11. Telemetry and observability

Expose a snapshot suitable for dev/verification telemetry containing:

- counts by lifecycle state and resource family;
- declared working-set size;
- queued cleanup count;
- transitions since the previous sample;
- cumulative cooled/evicted/reconstructed counts;
- estimated presentation cost where a resource adapter can provide it;
- policy identity/version used for the sample.

Telemetry is descriptive. Missing browser memory APIs or approximate cost estimates must remain labelled as such rather than converted into false byte-precise claims.

The key software invariant for this tranche is that repeated semantic transitions have a bounded governor record count under a finite policy. Long-session physical memory slope remains a later Quest evidence claim.

## 12. Error handling

Lifecycle hook failure must not corrupt semantic authority. The governor records the failure, refuses unsafe promotion when reconstruction fails, and leaves durable state untouched.

A failed `cool` or `dispose` is observable and retriable only according to explicit policy; it is never reported as successful reclamation.

A reconstruction request whose identity no longer matches current dataset generation, fingerprint or decision is refused as stale.

## 13. Falsifiers and test contract

Implementation is not accepted unless tests can falsify at least these claims:

1. **Active protection:** pressure and capacity reconciliation cannot evict an `ACTIVE` resource that remains explicitly declared active.
2. **Identity safety:** a record from an older dataset generation, fingerprint, decision or semantic object cannot satisfy a newer declaration.
3. **Cold boundedness:** cold descriptors reject or omit `Dataset`, row arrays, Three.js objects and transfer/GPU buffers.
4. **Session-age boundedness:** repeated replace/refine/collapse cycles converge to the configured finite bound rather than increasing record count monotonically.
5. **Amortised cleanup:** a large retirement set consumes no more than the configured cleanup work per tick.
6. **Truth preservation:** cooling or eviction does not mutate investigation identity, provenance or analytical result objects.
7. **Fail-closed detail:** evicted presentation state cannot bypass the existing Worker-residency refusal for semantic detail or exact datum inspection.
8. **Stale async safety:** a delayed lifecycle or reconstruction completion cannot overwrite a newer active representation.
9. **Observable reclamation:** state-transition telemetry reflects actual successful hooks, not requested transitions that failed.
10. **Single authority:** `LODManager` and `AdaptiveFrameGovernor` remain signals/helpers and cannot directly mutate lifecycle records.

Focused tests should cover the pure governor first, then `RepresentationSurface` integration, semantic-detail interaction and telemetry. Existing representation, drill-down, GPU-lifecycle and governor-event-loop tests remain regression evidence.

## 14. Alternatives considered

### A. Extend `AdaptiveFrameGovernor` into the resource governor

Rejected. Frame pacing is one pressure input, not semantic residency authority. Combining them would let transient render performance implicitly own investigation working-set policy and would make non-frame pressures difficult to reason about.

### B. Put lifecycle state directly inside `RepresentationSurface`

Rejected. `RepresentationSurface` is one resource family. UXR2 eventually covers UI, BVHs, representation payloads, Worker transfers and other presentation/runtime resources. Embedding the state machine there would create multiple incompatible lifecycle authorities later.

### C. Immediately govern Worker/WASM dataset residency

Rejected for this tranche. The analytical port can attest residency but has no explicit governed release ABI. Pretending local bookkeeping evicts Worker/Rust memory would create false evidence.

### D. Keep every previous projection warm for instant return

Rejected. It makes residency scale with investigation history and session age, directly violating the programme objective.

### E. Dispose every outgoing projection immediately

Rejected as the long-term policy. It is simple but cannot express bounded reuse, cold reconstruction or amortised cleanup, and risks disposal cliffs. It remains an acceptable fail-safe when lifecycle registration itself cannot be established safely.

## 15. Public contract sketch

The exact TypeScript names may change during implementation, but the boundary should remain equivalent to:

```ts
type ResourceResidency = 'ACTIVE' | 'WARM' | 'COLD' | 'EVICTED';

interface ResourceIdentity {
  family: string;
  datasetFingerprint: string | null;
  datasetGeneration: number | null;
  decisionId: string | null;
  semanticId: string;
}

interface WorkingSetDeclaration {
  identity: ResourceIdentity;
  desired: 'ACTIVE' | 'WARM';
  priority: 'FOCUS' | 'CONTEXT' | 'SPECULATIVE';
}

interface ResourceLifecyclePolicy {
  maxDeclarations: number;
  maxActiveResources: number;
  maxWarmResources: number;
  maxColdDescriptors: number;
  maxCleanupOperationsPerTick: number;
  policyVersion: string;
}
```

Resource-family adapters provide lifecycle hooks and a bounded descriptor validator. They do not expose raw scientific or dataset payloads to the governor. Reconciliation is atomic with respect to declaration validation; lifecycle cleanup itself remains amortised across ticks.

## 16. Delivery sequence

The implementation should land as one forward UXR2 PR with bounded UXR3 seam coverage:

1. pure lifecycle types/state machine and falsification tests;
2. cleanup queue, policy and telemetry tests;
3. `RepresentationSurface` adapter and stale-identity tests;
4. semantic-detail clearing/fail-closed integration tests;
5. roadmap/decision evidence update;
6. independent adversarial review, exact-head verification and normal CI promotion.

If implementation reveals that safe `COLD` reconstruction requires a new durable-state API, stop at safe WARM-to-EVICTED retirement and document the missing seam rather than capturing full datasets in closures.

## 17. Bounded exit for this tranche

This tranche may claim the UXR2 lifecycle authority seam landed when:

- the explicit state machine is production-wired for representation resources;
- working-set reconciliation is bounded under finite policy;
- outgoing projection cleanup is amortised;
- resource-state telemetry is available;
- semantic detail remains fail closed;
- no cold descriptor retains forbidden heavy authority/payload objects;
- exact-head automated evidence passes.

It may not claim long-session Quest resource stability, complete UXR3 streaming/backpressure, or Worker/WASM lifecycle closure. Those remain subsequent evidence/implementation boundaries.
