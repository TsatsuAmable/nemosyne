# QCA0 L1 Scale-Knee Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a custody-sealed Quest 3S QCA0 diagnostic that measures the row-addressable production path at 1K, 8K, 32K, 65K, and 100K rows, identifies the first performance knee, and authorizes the next QCA2/QCA4 investigation without making a Moneta Forma or PERF-04 qualification claim.

**Architecture:** Introduce a fixed `quest-qca0` validation mode and `qca0-row-addressable-knee-v1` load profile, but keep dataset construction, `World.loadDataset`, XR-frame collection, evidence delivery, and custody on the existing production call graph. A pure QCA0 analyzer validates exact device/build/profile/representation identity, separates `VALID_CAPTURE`/`INVALID_RUN` from measured red/yellow/green grades, derives the first knee and bounded QCA authorizations, and is projected through the existing finalizer. Reconcile current remote `main` first because it contains overlapping Forma work while this branch contains five QCA integrity fixes that must survive the merge.

**Tech Stack:** TypeScript 6, Three.js/WebXR, Vite 8 middleware, Vitest 5, Node.js 24, Rust/WASM build tooling, ADB-connected Meta Quest 3S.

**Spec:** `docs/superpowers/specs/2026-10-04-qca0-l1-scale-knee-design.md`

## Global Constraints

- The governed profile name is exactly `qca0-row-addressable-knee-v1`; the validation mode is exactly `quest-qca0`; the device target is exactly `META_QUEST_3S`.
- Run a 1K/10s ungraded cold-start warmup, then graded 1K/15s, 8K/15s, 32K/15s, 65K/15s, and 100K/30s steps; wait 5s after each real production load resolves before measuring; do not add a 250K step.
- The comparison is valid only when every completed step is `ROW_ADDRESSABLE`, `candidateId === null`, `semanticEmbodimentStatus === null`, `geometry === 'INSTANCED_POINT_CLOUD'`, `layout === 'GRID_3D'`, source cardinality equals the governed step, and rendered cardinality is present and positive.
- Capture validity is `PENDING`, `VALID_CAPTURE`, or `INVALID_RUN`; frame grades remain observations and must never be translated into PERF-04/PERF-05 gate dispositions or a Moneta Forma claim.
- The knee is the smallest graded cardinality whose recomputed grade is red, or otherwise the first graded cardinality whose p95 crosses above `FRAME_GREEN_MS` or whose dropped rate crosses to `DROPPED_GREEN_PCT` or higher relative to the preceding graded step; the ungraded warmup never establishes a knee.
- At a knee with a preceding graded step, compute four ratios: frame = `knee.p95Ms / max(previous.p95Ms, 1)`, load = `knee.loadDurationMs / max(previous.loadDurationMs, 1)`, scene = the maximum analogous ratio for average triangles, average draw calls, visible scene objects at end, and rendered nodes, and governor = `knee.governorThrottleEvents / max(previous.governorThrottleEvents, 1)`.
- Rank the finite frame, scene, load, and governor ratios descending, breaking ties in that order, and retain the top three as measured bottleneck indicators. Authorize QCA4 only when rendered nodes increase and scene or governor ratio is at least `1.25`; authorize QCA2 only when the load ratio is at least `1.5`; QCA1 remains unauthorized until stage timing identifies an eligible Rust/WASM analytical kernel.
- Rust/WASM remains the analytical authority; TypeScript may orchestrate capture and compute the deterministic diagnostic projection but must not add a shadow scientific implementation.
- Governed evidence must bind a clean exact Git head, machine-captured ADB identity, active XR, one terminal report, and custody verification. No source commit may be made after the final exact-head physical capture.
- Before implementation, fetch and reconcile current `origin/main`; preserve upstream Forma work and re-establish the branch's asynchronous load completion, supersession, Quest-target attribution, and worker-local residency guarantees.

## Review Focus

- A valid-looking report with a semantic candidate or partial/missing rendered cardinality must be `INVALID_RUN`, never a comparable row-addressable capture (Task 3 tests).
- A duplicate, truncated, aborted, non-XR, dirty-build, foreign-device, or wrong-profile terminal report must fail closed without producing a knee (Tasks 3 and 4 tests).
- A later user dataset load that supersedes an in-flight or settled stress load must abort the run and must not restore stale pre-run state over the user's dataset (Task 1 tests).
- A Worker-local dataset residency miss must revoke and recover only that worker registration, not invalidate the authoritative main-thread runtime (Task 1 tests).
- Flat, all-green, first-step-red, and threshold-crossing-without-red sequences must produce deterministic `lastGreenRowCount`, `kneeRowCount`, and QCA authorizations without treating warmup as evidence (Task 3 tests).

---

### Task 1: Reconcile Remote Main Without Losing QCA Integrity

**Files:**
- Modify on conflict only: `src/vr/scalability/LoadTestDriver.ts`
- Modify on conflict only: `src/app/devEvidence.ts`
- Modify on conflict only: `src/app/bootstrap.ts`
- Modify on conflict only: `src/atlas/AtlasAsyncExecutionPort.ts`
- Modify on conflict only: `docs/work/quest-compute/QCA0_BASELINE.md`
- Modify on conflict only: files changed by current `origin/main` that overlap these call paths
- Test: `tests/loadtest-driver.test.ts`
- Test: `tests/rf062c-world-production-path.test.ts`
- Test: `tests/atlas-async-execution.test.ts`
- Test: `tests/tec1-governed-capture-worker-runtime.test.ts`
- Test: `tests/validation-operator-panel.test.ts`

**Interfaces:**
- Consumes: current `origin/main` and commits `1349202e`, `06d9cb9e`, `7ee4a15f`, `d4f6dc96`, `e3b8c0ac` from this branch.
- Produces: one merged base in which `LoadTestWorldLike.loadDataset(entry): void | Promise<void>` settles only after production representation construction, supersession aborts fail closed, every governed UXR/QCA profile declares `META_QUEST_3S`, and worker residency loss remains runtime-local.

- [ ] **Step 1: Refresh and inspect the exact integration inputs**

Run: `git fetch origin main && git status --short --branch && git log --oneline --left-right HEAD...origin/main && git diff --stat HEAD...origin/main`

Expected: current remote head and all overlapping files are known; the worktree is clean before merging.

- [ ] **Step 2: Merge current remote main with a merge commit**

Run: `git merge --no-ff origin/main`

Expected: either a completed merge or explicit conflicts limited to inspected files; never resolve by wholesale choosing one side.

- [ ] **Step 3: Resolve conflicts against the production-path invariants**

Retain upstream Forma interfaces while preserving: awaited `World.loadDataset`, load-generation fencing, active-entry ownership checks, no stale restore after external supersession, Quest 3S device attribution, worker-local residency recovery, and the immutable historical record of the earlier invalid engineering baseline in `QCA0_BASELINE.md`.

If the merge stopped for conflicts, run `git add -u && git commit --no-edit` after every conflict marker is resolved and the index contains only the intended merge resolution.

- [ ] **Step 4: Run the focused preservation tests**

Run: `npm run test:integration -- tests/loadtest-driver.test.ts tests/rf062c-world-production-path.test.ts tests/atlas-async-execution.test.ts tests/tec1-governed-capture-worker-runtime.test.ts tests/validation-operator-panel.test.ts`

Expected: PASS, including in-flight supersession, settled-step replacement, asynchronous load completion, device attribution, and worker-local residency cases.

- [ ] **Step 5: Inspect the merge and record the resolved base**

Run: `git diff --check && git status --short --branch && git log -1 --oneline`

Expected: no unmerged paths, no whitespace errors, and the merge commit is the branch head.

### Task 2: Add the Fixed QCA0 Profile and Governed Launcher Mode

**Files:**
- Modify: `src/vr/scalability/LoadTestDriver.ts`
- Modify: `src/validation/validation-manifest.ts`
- Modify: `src/app/devEvidence.ts`
- Modify: `src/vr/ui/ValidationOperatorPanel.ts`
- Modify: `scripts/quest-validation.d.mts`
- Modify: `package.json`
- Test: `tests/loadtest-driver.test.ts`
- Test: `tests/quest-validation-manifest.test.ts`
- Test: `tests/validation-operator-panel.test.ts`
- Test: `tests/quest-validation-process-launch.test.ts`

**Interfaces:**
- Consumes: reconciled `LoadTestProfile`, validation manifest table, and governed operator callbacks from Task 1.
- Produces: `QCA0_PROFILE_NAME`, `Qca0ProfileName`, `QCA0_ROW_ADDRESSABLE_KNEE_PROFILE`, `ValidationMode` member `quest-qca0`, and npm command `npm run dev:quest:qca0`.

- [ ] **Step 1: Write failing profile and manifest tests**

Add tests asserting the exact six-step sequence, warmup flag, 5s settle, Quest 3S target, fixed profile binding, governed evidence class, Vite/WASM requirements, empty gates, refusal of profile overrides, and a process-launch invocation for `quest-qca0`.

- [ ] **Step 2: Run the focused tests and confirm the new symbols/mode are absent**

Run: `npm run test:integration -- tests/loadtest-driver.test.ts tests/quest-validation-manifest.test.ts tests/quest-validation-process-launch.test.ts`

Expected: FAIL because `QCA0_ROW_ADDRESSABLE_KNEE_PROFILE` and `quest-qca0` do not exist.

- [ ] **Step 3: Define the profile and manifest authority**

In `validation-manifest.ts`, add `export const QCA0_PROFILE_NAME = 'qca0-row-addressable-knee-v1' as const` and `export type Qca0ProfileName = typeof QCA0_PROFILE_NAME`; add a fixed `quest-qca0` table entry with `gates: []`, `profile: QCA0_PROFILE_NAME`, `evidenceClass: 'governed-physical-validation'`, `runtimeClass: 'vite-dev'`, and `wasmRequired: true`. In `LoadTestDriver.ts`, export `QCA0_ROW_ADDRESSABLE_KNEE_PROFILE: LoadTestProfile` with the exact governed steps.

- [ ] **Step 4: Bind the profile to the real governed operator path**

Extend `resolveGovernedQuestPerformanceProfile(profileName: string | null): LoadTestProfile`, `DevEvidenceHandle.runLoadTest`, and `ValidationOperatorPanel` so `quest-qca0` uses the existing ARM/CONFIRM performance action with QCA-specific copy, while all other modes remain fail closed.

- [ ] **Step 5: Add the launcher command and declaration surface**

Add `"dev:quest:qca0": "node scripts/quest-validation.mjs quest-qca0"` and update `scripts/quest-validation.d.mts` for the expanded mode union without adding a profile override.

- [ ] **Step 6: Run focused tests**

Run: `npm run test:integration -- tests/loadtest-driver.test.ts tests/quest-validation-manifest.test.ts tests/validation-operator-panel.test.ts tests/quest-validation-process-launch.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit the fixed profile and mode**

Run: `git add src/vr/scalability/LoadTestDriver.ts src/validation/validation-manifest.ts src/app/devEvidence.ts src/vr/ui/ValidationOperatorPanel.ts scripts/quest-validation.d.mts package.json tests/loadtest-driver.test.ts tests/quest-validation-manifest.test.ts tests/validation-operator-panel.test.ts tests/quest-validation-process-launch.test.ts && git commit -m "feat(qca0): add governed scale-knee profile"`

### Task 3: Implement Pure QCA0 Capture Validation and Knee Analysis

**Files:**
- Modify: `dev/validation-adjudication.ts`
- Test: `tests/quest-validation-adjudication.test.ts`

**Interfaces:**
- Consumes: `ValidationManifest`, `StepResult`, fixed `LOAD_TEST_THRESHOLDS`, and `QCA0_PROFILE_NAME`.
- Produces: `Qca0CaptureStatus = 'PENDING' | 'VALID_CAPTURE' | 'INVALID_RUN'`, `Qca0Authorization = 'QCA2' | 'QCA4'`, `Qca0BottleneckKind = 'FRAME_CADENCE' | 'GPU_SCENE_COST' | 'LOAD_DURATION' | 'GOVERNOR_PRESSURE'`, `Qca0StepObservation`, `Qca0BottleneckIndicator`, `Qca0ScaleKneeAnalysis`, and `analyzeQca0ScaleKneeReport(value: unknown, manifest: ValidationManifest): Qca0ScaleKneeAnalysis`.

- [ ] **Step 1: Write failing happy-path and deterministic-knee tests**

Add table-driven tests for all-green, first-graded-step-red, later red, and yellow/threshold-crossing-without-red reports. Assert warmup exclusion, recomputed grades, `lastGreenRowCount`, `kneeRowCount`, the four exact ratios, top-three stable ranking, deterministic authorizations, and the one-variable QCA2/QCA4 next-experiment text.

- [ ] **Step 2: Write the five fail-closed representation and terminal-shape tests**

Assert `INVALID_RUN` with `kneeRowCount: null` for semantic candidate/READY status, wrong geometry/layout, missing or non-positive rendered count, wrong source cardinality/step sequence, and duplicate/truncated/aborted reports. Also assert non-XR, wrong device/build/profile, and dirty/ineligible manifest inputs cannot produce a valid capture. In the valid fixture, assert unavailable JS heap/WASM/GPU fields remain `null`, never become zero.

- [ ] **Step 3: Run the analyzer tests and confirm failure**

Run: `npm run test:integration -- tests/quest-validation-adjudication.test.ts`

Expected: FAIL because `analyzeQca0ScaleKneeReport` and its types do not exist.

- [ ] **Step 4: Implement report validation and observations**

Implement `analyzeQca0ScaleKneeReport` as a pure function. Reuse the existing physical-runtime, collection-policy, and fixed-threshold checks; require one exact completed six-step report; require every step's representation identity from Global Constraints; recompute each graded result with `computeVerdict`; retain frame, cadence, GPU, scene, memory, load-duration, and governor fields as bounded observations.

- [ ] **Step 5: Implement knee, bottleneck ranking, and authorization derivation**

Use the smallest red graded row count first; otherwise detect the first p95/dropped green-boundary crossing relative to the previous graded step. Compute and rank the four ratios exactly as specified in Global Constraints, retain the top three finite indicators, apply the `1.25` QCA4 and `1.5` QCA2 thresholds, and never emit QCA1. With no knee or no preceding graded step, emit no ratio-based authorization. For QCA4, produce the next experiment “hold source rows and load path at the knee constant; cap submitted/rendered nodes to the preceding graded cardinality”; for QCA2, produce “add stage timing at the knee across Worker/WASM, arbitration, representation construction, and upload without changing execution behavior.”

- [ ] **Step 6: Run the analyzer tests**

Run: `npm run test:integration -- tests/quest-validation-adjudication.test.ts`

Expected: PASS for valid, invalid, and deterministic edge sequences.

- [ ] **Step 7: Commit the pure analyzer**

Run: `git add dev/validation-adjudication.ts tests/quest-validation-adjudication.test.ts && git commit -m "feat(qca0): analyze Quest scale knee"`

### Task 4: Carry Capture Validity Through Finalization and Custody

**Files:**
- Modify: `dev/validation-adjudication.ts`
- Modify: `dev/validation-finalizer.ts`
- Modify: `dev/loadtest-server.ts`
- Test: `tests/quest-loadtest-sink.test.ts`
- Test: `tests/quest-validation-custody.test.ts`
- Test: `tests/quest-validation-closed-loop.test.ts`
- Test: `tests/quest-validation-fidelity.test.ts`

**Interfaces:**
- Consumes: `analyzeQca0ScaleKneeReport` and QCA0 types from Task 3.
- Produces: `ValidationAdjudicationResult.captureStatus`, `ValidationAdjudicationResult.qca0Analysis`, matching `analysis.json`/`disposition.json` fields, a report projection that names capture validity and knee, and unchanged custody verification over all derived artifacts.

- [ ] **Step 1: Write failing pending/valid/invalid closed-loop tests**

Assert: no report yields `captureStatus: 'PENDING'`; one exact valid QCA0 report yields `VALID_CAPTURE`, no gates, aggregate `PARTIAL`, and a populated QCA0 analysis; malformed, aborted, duplicate, or representation-mismatched evidence yields `INVALID_RUN` and no knee. Confirm QCA0 never increments the PERF-04 cohort.

- [ ] **Step 2: Write failing custody and tamper tests**

Finalize valid and invalid QCA0 fixtures. Assert raw evidence is hashed before analysis, `analysis.json` and `disposition.json` preserve capture status and diagnostic result, `custody.json` verifies, and any post-finalization mutation is detected. Assert a missing/corrupt custody record yields `tamper-detected` and is never projected as a verified `VALID_CAPTURE`.

- [ ] **Step 3: Run closed-loop tests and confirm failure**

Run: `npm run test:integration -- tests/quest-loadtest-sink.test.ts tests/quest-validation-custody.test.ts tests/quest-validation-closed-loop.test.ts tests/quest-validation-fidelity.test.ts`

Expected: FAIL because QCA0 is not finalizable and capture validity is not projected.

- [ ] **Step 4: Extend adjudication without inventing a gate**

Add `captureStatus` and nullable `qca0Analysis` to `ValidationAdjudicationResult`. In the `quest-qca0` branch, require exactly one terminal report, call the Task 3 analyzer, leave `gateResults` empty, and keep aggregate status `PARTIAL` with the existing “no governed gate” reason.

- [ ] **Step 5: Extend finalization and operator status projection**

Treat `quest-qca0` as ready when one load-test line exists. Write capture status and QCA0 analysis into derived artifacts and machine report text; keep `readGateDisposition` and PERF qualification progress semantically unchanged. Ensure the sink accepts only the active matching session and still returns a receipt after the durable append.

- [ ] **Step 6: Run closed-loop and custody tests**

Run: `npm run test:integration -- tests/quest-loadtest-sink.test.ts tests/quest-validation-custody.test.ts tests/quest-validation-closed-loop.test.ts tests/quest-validation-fidelity.test.ts`

Expected: PASS, including tamper detection and no PERF cohort inflation.

- [ ] **Step 7: Commit the custody-backed diagnostic path**

Run: `git add dev/validation-adjudication.ts dev/validation-finalizer.ts dev/loadtest-server.ts tests/quest-loadtest-sink.test.ts tests/quest-validation-custody.test.ts tests/quest-validation-closed-loop.test.ts tests/quest-validation-fidelity.test.ts && git commit -m "feat(qca0): custody-seal scale-knee analysis"`

### Task 5: Prove the Real Production Capture Path

**Files:**
- Modify only if a production-path gap is exposed: `src/app/bootstrap.ts`
- Modify only if a production-path gap is exposed: `src/app/devEvidence.ts`
- Test: `tests/rf062c-world-production-path.test.ts`
- Test: `tests/loadtest-driver.test.ts`
- Test: `tests/validation-operator-panel.test.ts`

**Interfaces:**
- Consumes: fixed QCA0 mode/profile from Task 2 and custody analysis from Tasks 3–4.
- Produces: production-path evidence that `World.loadDataset` completes before settle timing, `getActiveSpecInfo` supplies real row-addressable identity, supersession aborts, and the on-device ARM/CONFIRM action invokes the exact QCA0 profile.

- [ ] **Step 1: Add the production-path test before changing production code**

Exercise the real `World` boundary with a QCA0 stress entry and controlled asynchronous representation completion. Assert the driver remains `LOADING` until completion, then captures `INSTANCED_POINT_CLOUD`/`GRID_3D`, null semantic fields, rendered/source cardinality, and load duration; add a competing-load case that aborts without stale restore.

- [ ] **Step 2: Add the operator-path test**

Assert a `quest-qca0` manifest exposes `ARM QCA0`, requires the second confirmation action, and invokes the zero-argument `onStartPerformance` callback exactly once; separately assert `resolveGovernedQuestPerformanceProfile(QCA0_PROFILE_NAME)` returns `QCA0_ROW_ADDRESSABLE_KNEE_PROFILE`. Hidden hotkey/start callbacks may reveal the panel but may not bypass confirmation.

- [ ] **Step 3: Run the production-path tests**

Run: `npm run test:integration -- tests/rf062c-world-production-path.test.ts tests/loadtest-driver.test.ts tests/validation-operator-panel.test.ts`

Expected: PASS without production changes; if a test fails, it identifies an actual call-path gap rather than a mock-only omission.

- [ ] **Step 4: Make only the minimal production fix if Step 3 exposed a gap**

Preserve Rust/WASM authority and the existing `World.loadDataset`/`getActiveSpecInfo` contract; do not add a second representation or analysis path.

- [ ] **Step 5: Re-run the production-path tests**

Run: `npm run test:integration -- tests/rf062c-world-production-path.test.ts tests/loadtest-driver.test.ts tests/validation-operator-panel.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the production-path proof**

Run: `git add tests/rf062c-world-production-path.test.ts tests/loadtest-driver.test.ts tests/validation-operator-panel.test.ts src/app/bootstrap.ts src/app/devEvidence.ts && git commit -m "test(qca0): prove governed production capture path"`

### Task 6: Verify, Adversarially Review, and Capture Exact-Head Quest Evidence

**Files:**
- Verify: all changed files
- Local evidence only: `logs/validation/<sessionLabel>/`
- Do not modify or commit source after the physical capture

**Interfaces:**
- Consumes: completed implementation from Tasks 1–5 and the pre-implementation adversarial contract in the design spec.
- Produces: a clean exact-head build, full automated evidence, a recorded high-risk adversarial disposition, and one custody-verified physical Quest 3S `VALID_CAPTURE` bundle with knee/authorization observations.

- [ ] **Step 1: Run formatting, static, architectural, documentation, and focused validation**

Run: `npm run format:check && npm run typecheck && npm run lint && npm run architecture:check && npm run docs:check && npm run governance:policy && npm run governance:promotion`

Expected: PASS.

- [ ] **Step 2: Run the complete automated test surface**

Run: `npm run test:all && npm run test:coverage && npm run build`

Expected: PASS with no weakened thresholds, exclusions, or skipped QCA tests.

- [ ] **Step 3: Perform and record the high-risk adversarial review**

Compare the diff and real production call graph to the spec. Attempt the five Review Focus failures plus one newly inferred failure. Classify every item `BLOCKER`, `DEFER`, or `SUGGESTION`; fix and re-verify blockers before continuing. Record the invariant, authority path, commands, dispositions, and residual risk in the eventual PR body rather than creating another review document.

- [ ] **Step 4: Re-fetch remote main and resolve only material drift**

Run: `git fetch origin main && git merge-base --is-ancestor origin/main HEAD; git diff --name-only HEAD...origin/main`

Expected: current `main` is either already an ancestor or the diff proves disjointness. If it conflicts with or changes a QCA authority seam, merge it and repeat Steps 1–3 before hardware capture.

- [ ] **Step 5: Freeze the exact candidate head**

Run: `git status --porcelain && git rev-parse HEAD && git log -1 --oneline`

Expected: empty status and one recorded 40-character head SHA. From this point onward, make no source or documentation commits.

- [ ] **Step 6: Launch the governed QCA0 lane**

Run: `adb devices -l && npm run dev:quest:qca0`

Expected: exactly one authorized Quest 3S is attributed, the manifest binds the frozen head with `worktree: clean`, WASM builds, and Vite exposes the governed session URL.

- [ ] **Step 7: Execute the on-device run**

Enter XR, open the validation panel, select `ARM QCA0`, then `CONFIRM QCA0`. Keep the headset active until all six steps complete and the evidence receipt is shown.

Expected: no abort/supersession, exactly six steps, row-addressable identity at every step, and one terminal summary.

- [ ] **Step 8: Finalize and verify custody**

Stop the launcher normally so finalization runs, then inspect `manifest.json`, `analysis.json`, `disposition.json`, `custody.json`, and `report.md` in the emitted session directory. Run `npm run quest:evidence-status`, then verify the exact bundle with `node --experimental-strip-types --input-type=module -e "import { verifyFinalizedCustody } from './dev/validation-finalizer.ts'; const result = verifyFinalizedCustody(process.argv[1]); console.log(JSON.stringify(result, null, 2)); if (!result.ok) process.exit(1)" "logs/validation/<sessionLabel>"` using the emitted label.

Expected: `captureStatus: VALID_CAPTURE`, custody verification succeeds, build/device/session identities match, and knee plus QCA2/QCA4 authorizations are reported as observations rather than PERF/Moneta claims.

- [ ] **Step 9: Prepare the exact-head handoff without changing the head**

Record the session label, exact build SHA, device fingerprint, raw evidence digest, custody bundle digest, knee, last green step, top three bottleneck indicators, authorizations, automated commands, adversarial dispositions, and residual risks in the PR body. Defer any tracked roadmap/status projection to a docs-only integration follow-up so the physical evidence remains bound to the implementation head.

- [ ] **Step 10: Re-check remote main and raise the focused PR**

Run: `git fetch origin main && git diff --name-only HEAD...origin/main && git status --porcelain`

Expected: no material unreviewed collision and an empty worktree. Push the existing `codex/qca0-baseline-integrity` branch, create the PR with the prepared high-risk evidence, and attach the PR to the task. If remote main changed a QCA authority seam, stop and repeat reconciliation, verification, and physical capture rather than publishing stale exact-head evidence.
