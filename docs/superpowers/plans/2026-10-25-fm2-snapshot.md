# FM2-SNAPSHOT Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Carry the verified Rust-issued direct empirical-distribution identity into `SemanticSnapshotV1` and expose a normal Atlas direct-compilation path that acquires it through the existing inline or Worker analytical port.

**Architecture:** Add an optional, identity-bound direct-distribution reference to the V1 snapshot body without changing snapshots that do not use this consumer. The reference is created only from a port-validated binding and the Rust source envelope is normalized into the existing deterministic snapshot compiler. Atlas provides an asynchronous direct-distribution compilation entry point that captures through the configured port, refuses stale or mismatched results, and then calls the existing synchronous compiler.

**Tech Stack:** TypeScript, Vitest, real Rust/WASM runtime, existing `InlineAnalyticalPort`/`WorkerAnalyticalPort`, Nemosyne V1/V2/V3/V4 package replay.

**Spec:** `docs/work/FM2_RUST_DIRECT_DISTRIBUTION_BINDING_V1.md`, RFC 0010, RFC 0011, and `AGENTS.md`.

## Global Constraints

- Rust/WASM remains the sole analytical and source-issuance authority; TypeScript may validate, normalize, orchestrate, and persist references but must not author evidence claims.
- Snapshot V1 remains backward compatible: the new field is additive and omitted for legacy/non-direct snapshots; existing V1/V2/V3/V4 replay paths remain unchanged.
- Direct capture must use the configured port's runtime-local handle, generation, dataset version/fingerprint, and kernel provenance; no module-global or caller-supplied fallback is permitted.
- Invalid, stale, cross-runtime, wrong-consumer/profile, altered-source, and refused results fail closed.
- Output identity must be deterministic for equal Rust source/request inputs; timestamps and presentation/decision metadata remain outside snapshot identity.

## High-risk pre-implementation adversarial contract

**Invariant:** A direct-distribution snapshot is admitted only when its `directDistributionReference` is derived from a binding validated from the selected Rust runtime for the Atlas's current generation/version/fingerprint, fixed direct consumer/profile, kernel version, exact source digest/receipt identity, and Rust source envelope. Snapshot identity includes only the decision-independent analytical source projection; the exact request-bound source digest, receipt, source bytes, and full request remain in the governed replay carrier.

**Authority and production path:** Rust's `moneta_prepare_direct_distribution_binding_v1` mints the source bytes/digest/receipt identity. `InlineAnalyticalPort` or `WorkerAnalyticalPort` obtains and revalidates that result. `AtlasCore.compileDirectDistributionEmbodiment` converts the validated binding to `SemanticSnapshotV1` and delegates to `InvestigationAggregate.compileDirectEmbodiment`, which remains the normal direct compiler. `NemosyneSession`/package replay remains the durable carrier authority.

**Failure modes:** a stale generation or dataset result is compiled; a caller handle crosses into a different Worker runtime; a forged/rehashed source or wrong consumer/profile is treated as evidence; a refused Rust producer is replaced by legacy semantic output; snapshot IDs vary with decision/timestamp metadata; the new field contaminates legacy snapshots or legacy package replay; a captured reference is not preserved by the existing replay carrier.

**Falsifying evidence:** real-WASM inline and Worker production-path tests for positive capture/compile, deterministic equal requests, stale generation/fingerprint refusal, separate-runtime handle refusal, malformed/forged/wrong-profile binding refusal, Rust refusal without fallback, and snapshot reference validation. Existing real-WASM carrier export/restore/replay tests must still pass, including V1 isolation; a test must prove the normal compile path can retain the same binding in the existing session carrier.

**Non-goals/dependencies:** no new evidence policy, receipt type, analytical estimator, public package format, browser/Quest qualification, or TS-authored receipt. The existing `DirectDistributionReplayCarrierV1` and package formats are reused; normal-shell Chromium qualification remains FM2-BROWSER.

## Review Focus

- A binding from a different runtime with a numerically valid handle must refuse at the Worker boundary; covered by the real Worker/port test.
- A result arriving after generation/fingerprint supersession must not reach snapshot normalization or compilation; covered by inline and Worker stale tests.
- A wrong consumer/profile or altered source bytes must refuse before snapshot identity is computed; covered by binding/reference validation tests.
- Equal Rust source/request inputs must produce byte-identical snapshot/reference identity despite decision metadata; covered by snapshot determinism tests.
- Legacy snapshots/packages must remain free of the direct field and direct replay admission; covered by V1 package isolation tests.

### Task 1: Add the typed direct reference and snapshot normalizer

**Files:**
- Modify: `src/moneta/representation/SemanticSnapshotV1.ts`
- Test: `tests/moneta-semantic-snapshot.test.ts`

**Interfaces:**
- Consumes: validated `DirectDistributionBindingV1` and its Rust `source` envelope.
- Produces: additive `DirectDistributionReferenceV1`, `normalizeDirectDistributionBindingToSnapshot(binding)`, and snapshot validation of the fixed identity correspondence.

- [ ] Write failing tests for deterministic binding normalization, fixed consumer/profile/source identity, wrong identity refusal, and unchanged legacy snapshot shape.
- [ ] Run the focused snapshot test and observe the missing API/validation failure.
- [ ] Implement the minimal additive body field and normalizer; include no TS-generated receipt/evidence tuple.
- [ ] Re-run the focused snapshot test and verify it passes.

### Task 2: Wire normal Atlas direct compilation through the existing port

**Files:**
- Modify: `src/atlas/AtlasCore.ts`
- Test: `tests/fm2-worker-direct-distribution-wasm.test.ts` or a focused FM2 snapshot WASM test registered in `tests/config/test-groups.ts`

**Interfaces:**
- Consumes: `captureDirectDistributionBinding`, the new snapshot normalizer, and existing direct compiler options.
- Produces: async `compileDirectDistributionEmbodiment(request, options?)` returning the existing `DirectEmbodimentCompileResult`; `getActiveDirectSnapshot()` for the retained typed snapshot.

- [ ] Write failing real-WASM tests for inline and Worker compilation, deterministic snapshot identity, stale/cross-runtime refusal, and Rust refusal without legacy fallback.
- [ ] Run the focused WASM test and observe the missing Atlas entry point/failure.
- [ ] Implement capture → normalize → existing direct compiler delegation with generation/fingerprint checks and no fallback.
- [ ] Re-run the focused WASM test and verify it passes.

### Task 3: Prove persistence and legacy isolation, update the FM2 work record

**Files:**
- Modify: `tests/fm2-replay-governed-direct-distribution-wasm.test.ts`
- Modify: `tests/config/test-groups.ts` only if a new WASM test file was required
- Modify: `docs/work/FM2_RUST_DIRECT_DISTRIBUTION_BINDING_V1.md`

- [ ] Add a production-path assertion that a normally compiled direct snapshot's binding is retained by the existing session carrier/export/restore/replay path.
- [ ] Add or retain an explicit V1 package assertion that direct fields/carriers do not become admissible through legacy replay.
- [ ] Run the focused replay and legacy tests and verify positive/negative results.
- [ ] Update the work record only to reflect verified FM2-SNAPSHOT implementation while leaving browser/human/Quest qualification open.

### Final verification

- [ ] Run focused snapshot, real-WASM Worker, replay, typecheck, lint, and applicable docs checks.
- [ ] Perform a separate post-implementation adversarial pass against the production call graph and the contract above; record BLOCKER/DEFER/SUGGESTION disposition in the handoff/commit notes.
- [ ] Commit task-specific changes and leave the worktree clean.
