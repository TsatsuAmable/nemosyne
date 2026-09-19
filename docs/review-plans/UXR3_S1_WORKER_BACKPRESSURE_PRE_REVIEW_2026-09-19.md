# UXR3-S1 Worker backpressure adversarial pre-review

**Integration base:** `main@2c87fe73fa133d64e4f434cba9731fbb5be73dbb`
**Scope:** bounded Worker analytical execution/registration admission, cancellation, stale completion, and telemetry. No physical-memory, latency, or scientific-performance claim.

## Observed production seam

`WorkerAnalyticalPort` owns `_pending`, `_pendingRegistrations`, and `_registrationPromises`. `execute()` inserts every non-stale request into `_pending` before `postMessage`; no local admission ceiling is present. `registerDataset()` deduplicates identical registration keys, but distinct registrations can accumulate. `supersede()` removes only work made stale by generation/version/fingerprint fences. Worker-side supersession is best-effort signalling while the local fence remains authoritative.

Focused baseline on this exact main: `atlas-async-execution` + `rf035-worker-resident-registration` = 20/20 PASS. Existing tests establish fencing, identity, registration residency and transport behavior, but do not falsify unbounded same-generation pending execution growth.

## Adversarial findings

1. **Producer/consumer imbalance:** same-generation callers can grow `_pending` without a hard cardinality/work bound if the worker drains slowly.
2. **Cancellation gap:** supersession only cancels identity-stale work; a burst of still-current requests has no generic cancellation/admission policy.
3. **Registration pressure:** registration deduplication bounds duplicate keys, not a burst of distinct current identities.
4. **Stale completion safety is stronger than admission safety:** late results are fenced, but work may already have consumed queue/worker resources.
5. **Telemetry blind spot:** transfer diagnostics measure payloads, not pending depth, rejected/coalesced work, queue age, or completion-after-supersession.
6. **Authority hazard:** generic backpressure must not choose which analytical result is scientifically preferable. Admission policy may use operation/resource metadata and caller-supplied supersession semantics, never infer analytical importance from payload contents.
## Smallest justified implementation contract

- Add an explicit bounded pending-execution admission policy at the Worker port boundary, with operation-aware limits supplied as presentation/runtime policy rather than analytical inference.
- Fail closed or explicitly coalesce only where the caller declares requests supersedable; never silently discard arbitrary current analytical work.
- Bound distinct pending registrations independently from executions while preserving identical-key deduplication.
- Keep `supersede()` identity fencing authoritative and make cancellation idempotent across local and worker completion races.
- Expose bounded diagnostics: current/peak pending executions and registrations, admissions refused/coalesced, stale completions, and cancellation counts. Do not label these as physical memory or latency evidence.
- Preserve request identity/provenance and typed refusal/failure behavior.

## Required falsifiers before promotion

1. Flood same-generation executions against a non-draining fake transport and prove pending state cannot exceed the configured bound.
2. Prove a rejected/coalesced request cannot later become authoritative when a delayed worker result arrives.
3. Race `supersede()` with result delivery and prove exactly-once settlement with no pending leak.
4. Flood distinct registrations and prove the independent registration bound while duplicate-key requests still share one promise.
5. Dispose under saturation and prove all admitted promises settle and all counters/maps return to zero.
6. Verify analytical payload contents do not influence generic admission priority.

## Disposition

**PASS TO IMPLEMENTATION, bounded scope.** The defect is a software backpressure/resource-lifecycle gap, not evidence of incorrect analytical results. Implement the smallest generic admission/cancellation layer at `WorkerAnalyticalPort`; rerun the focused Worker suites plus new saturation/race falsifiers, then perform an exact-head post-implementation adversarial review. Physical Quest evidence remains a separate UXR5 claim boundary.