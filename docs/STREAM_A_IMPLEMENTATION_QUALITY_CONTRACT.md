# Stream A Implementation Quality Contract

> **Binding roadmap execution rules for the forward implementation stream.** These rules define the minimum quality bar for code described as implemented, complete, production-ready, or ready for independent review. They exist because Stream B has repeatedly found implementations that match the planned class/module shape while missing the actual production behavior, authority boundary, semantics, or evidence required by the design.

## Prime directive

**Attack the design before implementing it, then write production-ready code with complete error handling, real production wiring, correct ownership, explicit semantics, authoritative tests, and a second adversarial review of the result. Do not use shortcuts, placeholders, fake implementations, silent fallbacks, or evidence that proves only a mock of the claimed production path.**

A task is not complete because a type, class, worker, renderer, state machine, test, or API exists. It is complete only when the intended user/runtime path actually uses it, the governing acceptance behavior is demonstrated, and the post-implementation adversarial review finds no unresolved blocker.

## 0. Adversarial review before implementation

Stream A follows the project-wide adversarial implementation protocol in `AGENTS.md`.

Before writing code for high-risk work, the implementing agent must create a compact **pre-implementation adversarial contract** containing:

1. **Invariant:** the exact behavior/property that must hold when the change is correct.
2. **Authority and production path:** the canonical owner plus the live entry point/call path that must enforce the property.
3. **Failure modes:** how the proposal could silently corrupt data, drift authority, mislead the investigator, fail at scale or recovery, or pass an isolated test while production remains wrong.
4. **Falsifying evidence:** the cheapest authoritative tests/checks that would expose those failures; identify or write these before implementation where practical.
5. **Non-goals/dependencies:** what remains deliberately out of scope and which dependent claims must not be promoted by this tranche.

High-risk includes blocker/high roadmap findings and changes touching scientific/analytical semantics, Rust/WASM boundaries, dataset identity/provenance/replay, security/privacy/trust, concurrency/recovery, large-N/resource behavior, or WebXR/core interaction semantics. Purely editorial or demonstrably mechanical non-semantic changes may claim the low-risk exemption defined in `AGENTS.md`.

The pre-review is intentionally bounded. It must improve the implementation slice, not expand the slice into a repository-wide audit. Valid adjacent work becomes `DEFER` unless it blocks the changed path.

If the pre-review discovers that the proposed implementation changes a durable architecture/trust boundary, public persistence/network format, scientific semantic contract, or governed interaction grammar, stop and use the RFC/ADR process before coding.

## 1. Implement the behavior, not the scaffolding

- Do not satisfy a roadmap item by adding an abstraction that production never instantiates or calls.
- Trace the full path from user/runtime entry point to the owning implementation and back to the visible/persisted result.
- When introducing a replacement path, update all relevant consumers. Do not leave the old synchronous, row-based, fallback, compatibility, or presentation path as the de facto production path unless the design explicitly requires it.
- No placeholder methods, dummy values, hard-coded stand-ins, TODO implementations, fake success responses, or "temporary" production branches are permitted in a completion PR.
- If a tranche deliberately lands only infrastructure/scaffolding, label it **IMPLEMENTATION PARTIAL** and state exactly what remains. Never call scaffolding complete.

**Common failure caught by Stream B:** P1-B introduced `WorkerAnalyticalPort`, but production `World` still selected the inline path. The architecture existed; the product behavior did not.

## 2. Use real lifecycle and authority identities

- Never hard-code generation, version, fingerprint, handle, session, request, provenance, or capability identities when a real authority already owns them.
- Thread lifecycle generations and dataset versions from their canonical owner through every asynchronous request and result fence.
- Treat handles as capability-local. A WASM handle from one runtime instance/thread must never be assumed valid in another.
- Cross-thread/runtime identity travels through governed stable identity such as fingerprint plus explicit registration, not foreign numeric handles.
- Stale results must be rejected deterministically after dataset mutation, runtime recovery, session replacement, or generation change.

**Common failure caught by Stream B:** async P1-B requests used literal `generation: 1`, defeating the documented recovery-generation fence.

## 3. Fail closed and make failure unambiguous

- Handle every realistic failure mode at the owning boundary: invalid input, unavailable kernel, malformed output, worker failure, transport failure, stale capability, missing registration, unsupported operation, allocation failure, empty output, incompatible version, and disposed state.
- Do not swallow exceptions unless the operation is explicitly best-effort and the ignored failure cannot corrupt authority, state, or user understanding.
- Never use the same return shape for a legitimate `null`/empty analytical result and a runtime/kernel failure.
- Never replace a failed authoritative result with a plausible-looking JavaScript approximation, stale result, default visualization, or previous analytical answer unless that behavior is explicitly governed and visible to the investigator.
- Error messages must identify the failed boundary and preserve enough context for diagnosis without exposing private dataset contents.
- Resource acquisition must have deterministic cleanup on success, failure, supersession, recovery, and disposal.

**Common failure caught by Stream B:** Worker errors were resolved as `{ value: null, error }`, making kernel failure ambiguous with a valid null result.

## 4. Preserve the architecture boundary under pressure

- Rust/WASM owns canonical data, N-dependent analysis, data-derived reduction/layout, clustering, topology, statistics, and other governed analytical facts.
- TypeScript/JavaScript may orchestrate, schedule, embody, interact, and persist, but must not recreate analytical work merely because doing so is convenient for a renderer or UI feature.
- Bounded rendered object count does **not** prove bounded analytical work. Inspect the computation leading to those objects.
- Do not materialize full rows, duplicate canonical datasets, transpose/rebuild large matrices, or perform O(N) reduction in presentation code when the design requires Rust-owned compact evidence/payloads.
- Reuse established canonical substrates instead of inventing parallel data representations for each tranche.

**Common failure caught by Stream B:** P1-R bounded the number of Three.js meshes but still performed O(N) aggregate/density/cluster reduction over rows/positions in TypeScript.

## 5. Treat missing, zero, empty, and invalid data correctly

- Never use truthiness when zero, empty string, false, or an empty collection is a valid domain value.
- Distinguish `0`, missing, invalid, NaN, infinity, empty, and unavailable according to the data contract.
- Honor validity/null bitmaps and row-index semantics at every columnar/typed boundary.
- Invalid/missing values must not silently become numeric zero or another plausible scientific value.
- Add edge-case tests for zero, negative values where allowed, missing values, duplicate values, empty datasets, one-row datasets, high cardinality, extreme magnitude, and malformed values where relevant.

**Common failures caught by Stream B:** aggregate zero values were converted to `1`; typed-column TDA ignored validity and admitted invalid values as `0.0`.

## 6. Scientific and semantic claims must be literally true

- A representation name, ontology description, provenance label, confidence term, or algorithm label must describe the mathematics actually executed.
- Do not call a fixed voxel histogram a continuous density estimator unless it actually implements the governed density-estimation method.
- Do not label category envelopes as analytically derived clusters unless the cluster assignments come from the authoritative clustering result.
- If an implementation is an approximation, heuristic, prior, layout surrogate, or visual summary, name it as such and record its parameters/provenance.
- When implementation cannot yet meet the intended semantic contract, narrow the claim or mark the candidate unsupported/partial. Do not fabricate equivalence.
- Preserve the distinction between measured evidence, engineering priors, model utility, statistical uncertainty, and calibrated confidence.

**Common failure caught by Stream B:** Moneta ontology descriptions claimed density/PDF/cluster/manifold semantics stronger than the actual embodiment mathematics.

## 7. Production path first, mocks second

- Every completion claim must have evidence from the actual layer being claimed.
- Mock tests prove orchestration contracts only. They do not prove real WASM, real Worker, browser, XR, network, file-system, or device behavior.
- Name tests truthfully. A mock/inline parity test must not be called a real-Worker or real-WASM end-to-end test.
- For cross-runtime features, include at least one test that crosses the real boundary: Worker/WASM, browser/WASM, WebRTC/browser, export/import/replay, or physical XR as applicable.
- For UX completion, integration tests that manually call each subsystem are not usability evidence. Drive the real product controls/path in Playwright. For WebXR interaction/layout/reference-frame claims that a simulator can exercise, add the governed IWER simulator tier through the real WebXR/InputRouter path; validate on target hardware when the claim is device-dependent. Simulator success must never be reported as physical Quest qualification.
- Benchmark claims require recorded measurements. Never check off "measured" because a measurement hook or benchmark function exists.

**Common failures caught by Stream B:** the P1-U "E2E" journey manually advanced phases with a kernel mock; P1-B "real WASM async parity" used a mock bridge and inline transport.

## 8. Tests must be capable of failing for the defect they claim to prevent

- Before accepting a regression/architecture test, mentally or mechanically inject the forbidden behavior and verify the test would fail.
- Avoid source-string tests when a behavioral or type-level test is practical. If source guards are necessary, assert that the inspected slice/range is non-empty and bounded by valid markers.
- Test both positive behavior and the important fail-closed/negative cases.
- Put exhaustive mathematics/property/metamorphic testing beside the Rust authority; use TS tests for orchestration, embodiment, interaction, and boundary contracts.
- Do not duplicate mathematical assertions in JS merely to increase coverage counts.
- A green suite is evidence only for the properties the tests actually assert.

**Common failure caught by Stream B:** the P1-R source guard sliced between methods in reverse source order, produced an empty string, and passed vacuously.

## 9. Concurrency must be designed around races, not the happy path

- Identify the authoritative lifecycle owner before adding workers, promises, cancellation, recovery, reconnect, streaming, or asynchronous UI transitions.
- Explicitly handle: result-after-supersession, result-after-dispose, recovery during in-flight work, duplicate request IDs, out-of-order completion, worker crash, transport failure, dataset replacement, stale registrations, and repeated initialization.
- Supersession/cancellation semantics must be documented and tested independently from runtime failure semantics.
- Do not mutate durable state until the result has passed generation/version/fingerprint validation.
- Preserve the last valid presentation only when the UX contract explicitly allows it and clearly distinguishes it from a new analytical result.

## 10. Output identity and provenance must describe the output

- Never reuse an input fingerprint as an output hash/fingerprint unless the operation is proven identity-preserving.
- Compute or retrieve authoritative output identity after mutation/reduction and verify it before ledger persistence.
- Provenance must include algorithm/version, input identity, output identity, parameters, approximation/reduction mode, and relevant runtime/model versions.
- Persisted/replayed state must fail closed when authoritative identities disagree.

**Common failure caught by Stream B:** `applyAnalysisAsync` used the input dataset fingerprint as `outputHash`.

## 11. Performance work must measure the real bottleneck

- State expected complexity and memory behavior for scale-sensitive code before implementation.
- Do not infer scalability from visible object count, bounded candidate count, or asynchronous function signatures.
- Measure allocation, copy/transfer, scheduling, computation, rendering, and frame impact separately where relevant.
- Avoid full-dataset copies and transposes at analytical boundaries. Account for peak memory, not just steady-state storage.
- Add scale benchmarks separately from deterministic correctness gates and record the tested hardware/runtime.
- SharedArrayBuffer, WASM threads, SIMD, GPU compute, caching, and approximation are evidence-led optimizations, not default complexity.

## 12. UI/UX implementation must change the actual experience

- Do not mark a UX requirement complete because a policy/state/coordinator class exists.
- Verify what the user actually sees on startup and during the canonical investigation tasks.
- Default scene/UI must remain sparse; persistent panels and world objects require an explicit investigator role.
- Contextual controls must be spatially/contextually attached in the rendered product, not merely filtered by a logical `ContextualTaskSurface` object.
- Functional world objects such as TechnoCore must have real input routing, visible state, undo/recovery semantics, and analytical/control effects. Decorative persistent objects must be removed or demoted.
- Preserve desktop/XR semantic parity while allowing modality-specific mechanics.

**Common failure caught by Stream B:** P1-U defined the 10-phase journey and contextual policy while the runtime still booted the existing dashboard/panel constellation and TechnoCore was not truly wired as an analytical control.

## 13. No completion by checkbox

Before marking a roadmap item complete, the Stream A worker must answer all of these:

1. What pre-implementation invariant, authority path, failure modes, falsifying evidence, and non-goals governed this implementation?
2. What exact production entry point uses this implementation?
3. What canonical authority owns the data/result/lifecycle involved?
4. What happens on every important failure and stale-state path?
5. What proof shows the real production path, not a mock or unused abstraction, executes correctly?
6. What edge cases would make the result plausible but wrong?
7. Does any semantic/UX/scientific claim exceed what is actually implemented?
8. What is the complexity and peak-memory behavior at the target scale?
9. Are output identity and provenance correct after the operation?
10. Would the added regression tests fail if the discovered bug were reintroduced?
11. What did the post-implementation adversarial review try to break, and what did it find?
12. Is there any shortcut, placeholder, hard-coded authority value, silent fallback, swallowed error, or deferred wiring still present?

If any answer is unknown or unresolved, do **not** mark the tranche `COMPLETED`. Use `IMPLEMENTATION PARTIAL` or `IMPLEMENTATION LANDED / REVIEW ACTIVE` and list the remaining work explicitly.

## 14. Required PR language for Stream A

Every Stream A implementation PR should state:

- **Pre-implementation adversarial contract:** invariant, authority/production path, primary failure modes, falsifying evidence and non-goals/dependencies; or the explicit low-risk exemption and rationale.
- **Production path changed:** exact entry points and consumers now using the implementation.
- **Authority/ownership:** which layer owns computation, identity, lifecycle, and persistence.
- **Failure behavior:** how invalid input, unavailable dependencies, stale state, recovery, and disposal behave.
- **Scale behavior:** expected complexity, allocations/copies and any approximation threshold.
- **Evidence:** separate mock/unit, Rust/WASM boundary, browser/Worker, XR/device, benchmark, and research evidence without conflating them.
- **Post-implementation adversarial review:** what was attacked after implementation, which blockers were fixed, and which valid residuals were deferred.
- **Known residuals:** anything deliberately left incomplete, with roadmap IDs/checklist items.
- **Completion status:** `IMPLEMENTATION PARTIAL`, `IMPLEMENTATION LANDED`, or evidence supporting `VERIFIED COMPLETE`. Do not use "complete" merely because CI is green.

## 15. Post-implementation adversarial review

After focused tests are green and before the PR is described as complete:

1. Re-read the pre-implementation contract without using the implementation as the definition of correctness.
2. Trace the changed property through the real production path and inspect all changed authority boundaries.
3. Exercise every listed failure mode plus at least one failure mode inferred from the final code that was not in the original plan.
4. Verify that the relevant tests would fail if the prohibited behavior were restored, and distinguish mock evidence from real boundary/product evidence.
5. Check for silent defaults, lossy copies, stale identities, missing provenance, hidden fallback, lifecycle leaks, complexity cliffs, modality drift, or narrowed semantics.
6. Classify findings as `BLOCKER`, `DEFER`, or `SUGGESTION`. Fix blockers before merge. Record valid deferred work without recursively widening the PR.
7. Reassess the roadmap/status claim. Downgrade it when implementation or evidence is narrower than the exit gate.

Prefer a different agent/reviewer from the implementer. When that is unavailable, the implementing agent must explicitly switch from implementation defense to falsification: search for evidence that the design is wrong, not reasons it is probably right.

## Review heuristic

A useful adversarial question for both streams is:

> **If the new class/function/test were deleted, would the real user-visible or authoritative production behavior change?**

If the answer is no, the implementation is probably scaffolding, unused wiring, or evidence theater rather than completion.
