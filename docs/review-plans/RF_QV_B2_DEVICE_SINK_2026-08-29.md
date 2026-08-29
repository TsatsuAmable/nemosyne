# RF-QV B2 — QV2 local device declaration + QV3 isolated evidence sink — adversarial contract

Date: 29 August 2026
Base: `main@862c1bb` (#531, B1 merged)
Stream: B — B2 (QV2 + QV3)
Status: implementation complete — pre-implementation contract and post-implementation adversarial review recorded; no blockers; deferred work tracked below

## Problem

B1 (QV0/QV1) emits an attributable manifest but (a) reads device facts only as a minimal two-field read with no operator-facing store/CLI, and (b) still funnels all load-test evidence from both generic dev and governed validation sessions into one undifferentiated `logs/loadtest-results.jsonl`. B2 makes the device declaration a real local store with truthful reuse, and makes the existing `loadtestResultsPlugin()` validation-context aware so governed sessions get per-run isolated evidence directories while generic dev stays byte-identical.

## Invariant

When B2 is correct:

1. **QV2 — no guessed hardware/firmware.** Every field in `logs/validation/device.json` is an investigator-declared string (label, `declaredQuestModel`, `declaredFirmwareVersion`, `investigator`), is never inferred from the browser/runtime, and remains distinct from runtime-measured `QuestRuntimeEnvironment` fields (`userAgent`, `webgl`, `xr`, `platform`, …). A governed mode (`quest-perf`/`quest-ux`/`quest-10m`) launched with a missing `declaredQuestModel` or `declaredFirmwareVersion` is promotion-ineligible and records a truthful invalidation; the informational `quest` mode still runs without a missing-declaration invalidation. The operator can view and change the active declaration through a thin CLI.
2. **QV3 — no evidence mixing.** A POST tagged with the active validation session identity appends to `logs/validation/<sessionLabel>/loadtest-results.jsonl`; a POST that is untagged, malformed, or tagged with a different session identity never writes into the active session's file (it falls back to the existing generic `logs/loadtest-results.jsonl`). A run with no active validation session behaves byte-identically to today's plugin.
3. **QV3 — failures are evidence.** Every launched session gets `disposition.json` (with `gateDisposition.status` + reasons) and an `analysis.json` placeholder in its evidence directory; a run that aborts before Vite (WASM build failure) is recorded as `FAIL` rather than left unclassified. Session tags only ever name a validated safe path component under `logs/validation/`.

## Authority and production path

- **Truth owner (declared facts):** `logs/validation/device.json` — read by `readDeviceDeclaration`, written by the CLI `node scripts/quest-device-declaration.mjs set`. The launcher (`buildValidationContext`) injects a governed-mode missing-declaration invalidation into the manifest; the pure `deriveValidationManifest`/`validateValidationManifest` B1 contract is unchanged.
- **Truth owner (runtime facts):** unchanged `QuestTelemetry.captureQuestRuntimeEnvironment` (browser/XR/WebGL measured, `identityBasis: 'investigator-declared'` only for the two declared fields it reads from query params).
- **Truth owner (session identity + sink routing):** `src/validation/validation-session.ts` (header names + env read + label/id validation, dependency-free) shared by the dev plugin and the client; the routing decision is `dev/loadtest-server.ts::resolveLoadTestSink` (pure) executed by `createLoadTestResultsHandler`, which `loadtestResultsPlugin` mounts.
- **Production path exercised (sink):** `npm run dev:quest:*` → launcher spawns `vite --host` with `VITE_NEMOSYNE_VALIDATION_SESSION_ID/LABEL` env → dev plugin factory reads `process.env` → client `World.ts` `_enrichAndFlushLoadTestSummary` / `_flushQuestBoundarySummary` POST to `/__loadtest-results` with session headers when its own `import.meta.env` carries the identity → plugin routes to the per-session file.
- **Production path exercised (launcher):** launcher writes `manifest.json`, `disposition.json`, `analysis.json` (+ `ux-results.json`/`comfort-observation.json` for `quest-ux`) under `logs/validation/<sessionLabel>/`.

## Failure modes (most plausible ways this silently corrupts)

1. **Path traversal / label injection:** a POST header or active-env label containing `/`, `\`, or `..` escapes `logs/validation/` and writes evidence (or worse) elsewhere. → every session label/id used in a path is validated by `isValidSessionLabel`/`isValidSessionId` (fail closed to the generic sink), and the launcher's own write path retains the B1 containment check (`writeManifestFile`).
2. **Evidence laundering via missing declaration:** the missing-declaration gate is implemented inside the pure manifest derivation, silently changing B1 semantics (the B1 test asserts a clean governed run without a declaration is eligible) or the gate is skipped so governed runs with no device attribution stay eligible. → gate lives in the launcher layer (`applyDeviceDeclarationGate`), B1 pure contract untouched, and the gate is exercised by tests.
3. **Generic-dev behavior change:** routing logic breaks `npm run dev` / `dev:wasm` — e.g. the plugin fails to create `logs/` or the response shape changes. → no-options plugin path is tested against the real handler with real fs writes; generic behavior asserted byte-equivalent (same file, same JSON line, same `{status:'ok'}`).
4. **Session mixing:** a stale/mismatched POST (old label or a different session id) is appended to the active session's file, silently merging evidence from different commits/firmware/browsers/modes. → identity match requires label AND id to equal the active session; anything else routes to the generic sink with a bounded warning.
5. **Aborted/failed run discarded:** the launcher aborts (WASM failure) before any disposition is written, so a failed session leaves no classified artifact. → disposition.json + analysis.json are written immediately after the manifest, and the WASM-failure branch records a `FAIL` disposition before exiting.
6. **Second authority:** the sink/adjudication recomputes thresholds or the client fabricates a session identity. → no thresholds are read or recomputed anywhere in B2; the client only echoes the identity the launcher placed in its own env; `analysis.json` is an explicit `pending` placeholder, not an analysis result.
7. **Sink is decorative:** the context-aware routing is exported but never reached by the real plugin. → `loadtestResultsPlugin` delegates to `createLoadTestResultsHandler`; the handler-level tests exercise the exact function Vite mounts.

## Falsifying evidence

1. `readDeviceDeclaration` round-trips a written declaration (all four fields); a missing/malformed file yields all-null fields.
2. `buildValidationContext({mode:'quest-perf', …})` with null device → `promotionEligible:false`, an invalidation naming the missing `declaredQuestModel`/`declaredFirmwareVersion`, and still `validateValidationManifest.ok`; `mode:'quest'` with null device → no declaration invalidation.
3. `captureQuestRuntimeEnvironment` returns runtime-measured `userAgent`/`webgl`/`xr` that are structurally distinct from the declared fields, and the declared fields flow verbatim into the manifest.
4. `resolveLoadTestSink` + real-handler tests: active session + matching tag → per-session file; no active session → generic file; active session + no tag → generic file; active session + mismatched id/label → generic file, session file untouched; malicious label (`../`) → generic file, no write outside the temp root.
5. `writeEvidencePlaceholders` produces `disposition.json` (status + reasons) and `analysis.json`; a `FAIL` disposition (WASM-abort path) is writable and readable with status + reasons.
6. Existing `tests/quest-validation-manifest.test.ts` still passes unchanged.
7. `package.json` still has `"dev": "vite --host"` and `"dev:wasm": "npm run wasm:dev && vite --host"` unchanged; the new `dev:quest:device` script is additive.

## Non-goals / dependencies

- B2 does **not** implement QV4 adjudication (analysis.json is an explicit `pending` placeholder; disposition at launch is only the launch-gate classification `INVALID_RUN`/`FAIL`/pending-null).
- B2 does **not** touch thresholds, `LoadTestDriver`, `QuestBoundaryProbe`, verdict math, or the analyzer.
- B2 does **not** add label/investigator into the QV0 manifest schema (the B1 schema stays frozen); they remain local operator metadata in `device.json`.
- B2 does **not** create a second telemetry/performance/roadmap authority and adds no npm dependencies.
- B2 does **not** record raw dataset rows, camera trajectories, or unrestricted interaction trails; the sink writes the same bounded per-POST summary objects as today, just to a different file.
- **Dependency:** B2 reuses the B1 env contract (`VITE_NEMOSYNE_VALIDATION_SESSION_ID/LABEL` set by the launcher, read via `import.meta.env` / `process.env`).

## Drift note (pre-implementation discovery)

Remote `main` has advanced to `a1f5e73` (#532, Stream A P1-R1) after this worktree's base `862c1bb`. #532 touches only `wasm/src/**`, `src/wasm/runtime/**`, `src/moneta/representation/**`, and Stream-A docs/tests — none of B2's planned files — so no merge conflict is expected. Per the checkpoint instructions the branch stays on base `862c1bb`; the PR must re-check `main` before raising and reconcile if needed.

---

# Post-implementation adversarial review

Date: 29 August 2026
Reviewer: Stream B (self-review, adversarial contract applied)
Verification run in worktree: focused B1+B2 tests 70/70; `npm run test:fast` 114/114; `npm run test:ui` 13/13; `npm run typecheck` clean; `npx eslint` clean on all changed files; `npm run docs:check` PASSED; real Vite HTTP smoke (explicit-session and env-derived) routes tagged/untagged/mismatched POSTs correctly; real launcher smoke writes manifest+analysis+disposition and records a WASM-abort `FAIL` disposition.

## Adversarial questions

1. **Is the context-aware sink the real path validation runs use, or decorative?**
   Not decorative. `vite.config.ts` mounts `loadtestResultsPlugin()` unchanged; it now delegates to `createLoadTestResultsHandler`, which reads the active session from `process.env.VITE_NEMOSYNE_VALIDATION_SESSION_*` — the exact env the launcher puts into the spawned Vite child. I verified this over real HTTP against a real Vite server mounting the actual plugin: (a) with `activeSession` injected and (b) with only `VITE_NEMOSYNE_VALIDATION_SESSION_*` env set (no option), a tagged POST landed in `logs/validation/<label>/loadtest-results.jsonl`, an untagged POST went to the generic sink, and a mismatched-session POST went to the generic sink with a warning — the active session file contained only matching evidence. The client tags POSTs via `_loadTestPostInit` reading the same env names from `import.meta.env`, the mechanism B1 already proved reaches the served client.

2. **Does it create a second evidence/telemetry authority?**
   No. No thresholds, verdict math, analyzer, or telemetry collector is added or recomputed. The sink routes the same bounded per-POST summary objects to a different file. `analysis.json` is an explicit `pending` placeholder (never a fabricated result). `disposition.json` copies the manifest's own gate state (session identity, `invalidations`, `promotionEligible`) plus a status derived only from that state; it is a view of the B1 manifest, not a new authority. `readValidationSessionEnv`/header names live in one dependency-free shared module so client and server cannot drift.

3. **Do the regressions exercise the real POST `/__loadtest-results` path?**
   Unit tests call `createLoadTestResultsHandler` — the exact handler `loadtestResultsPlugin` mounts — with mocked req/res and real fs against temp logs roots. The real-Vite HTTP smoke exercises the production middleware boundary end-to-end over the network. The one boundary not exercised is the browser client itself (no headset run); the client change is typechecked and guarded, but a physical-headset session would be the remaining proof (QV5/QV6 territory).

4. **Are failed/aborted runs classified rather than discarded?**
   Yes. Every launched session writes `disposition.json` immediately after `manifest.json`; the real launcher smoke confirmed all three files appear before Vite spawn. The WASM-failure branch in `main()` was exercised for real: launching `quest-perf` from a directory without a working `npm run wasm:dev` produced a `FAIL` disposition with reason "WASM dev build failed; session aborted before Vite start" while retaining the manifest's `invalidations`. A dirty-tree or missing-declaration governed launch is classified `INVALID_RUN` with the attribution reasons; a clean, declared 10M boundary run stays `pending` (its non-qualification invalidation is recorded without falsely labelling the run's own-gate evidence invalid).

5. **Did it cross Stream A/C ownership (esp. World.ts)?**
   No. Changed files are Stream-B-owned (Quest validation tooling, validation evidence plumbing, `package.json` reserved during B1/B2) plus `tests/config/test-groups.ts` (Stream B test surface). `World.ts` is the permitted Stream-B exception and is justified here: the load-test flush path is Stream B's owned surface and the session tag must be attached at the fetch call site, which has no narrower seam. The change is minimal (one import, one guarded helper, two call sites); non-session runs return byte-identical fetch init (asserted by the "no session" path and by the fact that the routing test's untagged POST is byte-identical). No `src/moneta`, `src/wasm`, `src/atlas`, signalling, NetworkManager, or pose-serializer file was touched. `vite.config.ts` untouched.

6. **Is the claim narrower than or equal to the evidence?**
   The claims are: (a) QV2 store + CLI + governed-missing-declaration gate — proven by round-trip/missing/malformed/merge tests, launcher-level gate tests (B1 pure derivation left intact), and the real CLI→launcher smoke where `device.json` values flowed verbatim into the manifest; (b) QV3 session-isolated sink with no mixing — proven by unit tests (pure routing matrix + real handler) and the real HTTP smoke; (c) failures are evidence (disposition + analysis at launch, WASM-abort `FAIL`) — proven by unit tests and the real launcher smoke; (d) generic dev byte-identical — proven by the no-session handler tests and unchanged `dev`/`dev:wasm` scripts. Unproven remains the physical-headset client path and any QV4 adjudication outcome; the claims stop at launch/collection, which is the B2 scope.

## Disposition

- **BLOCKER:** none.
- **DEFER (valid, non-blocking):**
  1. **Shared POST rate limiter (60/min) applies to validation sessions.** `devPostRateLimiter` is pre-existing and shared; a load-test run exceeding 60 POSTs/min would get 429s that the client silently swallows, dropping evidence. Not introduced by B2; a session-aware limiter or bounded batching belongs to QV3/QV4 hardening.
  2. **QV4 must not inherit B2's launch-gate status as the final disposition.** B2's `disposition.json` `gateDisposition` is a launch-time classification (pending / INVALID_RUN / FAIL); QV4's adjudicator emits the gate outcome (PASS/FAIL/PARTIAL/BLOCKED). The two semantics must stay mechanically separate; B2 deliberately leaves the launch file pending where adjudication applies.
  3. **`mergeDeviceDeclaration` truncates values at 128 chars silently.** Bounded and intentional for a local store, but a longer model string would be cut without warning; acceptable, revisit if real device strings exceed it.
  4. **Launcher spawns Vite without an 'error' handler (pre-existing B1 behavior).** A missing `vite` binary crashes the launcher with an unhandled error *after* evidence is written — evidence is retained and fail-closed, but the crash is noisy; a cleanup belongs to a launcher polish pass.
  5. **`quest-validate`/informational dispositions are `null` at launch.** When QV4 lands, an explicit "not attempting a governed gate" reason would be clearer than a bare pending.
- **SUGGESTION:**
  1. Echo the per-session sink path on the `[LOAD TEST]` console line when a validation session is active, so the operator sees where evidence landed.
  2. A `quest-device-declaration.mjs clear` subcommand would make "unset all fields" one step; currently `set --model "" --firmware "" …` achieves it.

## Residual risk

- The client tagging path is not exercised on a physical headset (no real Quest run in this checkpoint); it is typechecked, guarded, and contract-tested via the shared env/header module, but a device session is the remaining production-path proof.
- The integration-lane WASM tests fail in this worktree because `wasm/pkg` is a symlink to the main repo and the kernel module is absent (`KernelUnavailableError`); that is environmental and pre-existing, not caused by B2.
- `main()`'s WASM-abort branch was exercised only through the real launcher smoke in a directory without a working wasm build; the exact status code propagation (`wasm.status ?? 1`) is unchanged from B1.
- Remote `main` advanced to `a1f5e73` (#532, Stream A P1-R1) after this base; #532 touches no B2 file, so no merge conflict is expected, but the PR must re-check `main` before raising and reconcile if needed.