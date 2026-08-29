# RF-QV B1 — Quest validation manifest (QV0) and launcher (QV1) — adversarial contract

Date: 29 August 2026
Base: `main@a8be01a` (#527)
Stream: B — B1 (QV0 + QV1)
Status: implementation candidate — pre-implementation contract recorded, post-implementation adversarial review pending

## Problem

Physical Quest sessions currently produce weakly attributable evidence: `npm run dev` can fall back to an unversioned build identity, load-test results merge into a common local JSONL sink, and there is no versioned manifest that answers the same attribution questions for every run (exact commit, worktree state, validation mode, owning gate/profile, runtime class, evidence class, session ID, timestamps, artifacts, disposition).

B1 freezes one small versioned manifest contract (QV0) and adds a thin launcher (QV1) that derives attribution truthfully and starts the existing Vite dev server without changing ordinary `dev`/`dev:wasm`.

## Invariant

A governed Quest validation run is attributed truthfully and reproducibly by a single versioned manifest such that:

- every validation-mode run (and only validation-mode runs) emits a manifest whose `buildId` is the **exact resolved Git commit SHA**, never the `unversioned-local-build` fallback;
- `worktree` is recorded as `clean` / `dirty` / `unknown` from `git status --porcelain`, and any state other than `clean` is promotion-ineligible;
- evidence class, runtime class, gates/profile, and mode are derived from one centralized, tested mapping table, and the recorded class never exceeds what the mode actually produces (no evidence laundering: `vite-dev` runtime, trial-class runs stay trial-class, the 10M boundary probe stays non-qualification);
- the manifest schema is versioned and **fails closed** on unknown/missing/malformed fields;
- ordinary `npm run dev` and `npm run dev:wasm` are byte-identical to today.

## Authority and production path

- **Truth owner:** the pure manifest module `src/validation/validation-manifest.ts` (types + mode table + `deriveValidationManifest` + `validateValidationManifest`), shared by the launcher and any later adjudicator/dashboard. No second telemetry, performance, or roadmap authority is created.
- **Production path exercised:** `npm run dev:quest:*` → `node scripts/quest-validation.mjs <mode>` → git discovery (`git rev-parse HEAD`, `git status --porcelain`) → session ID → `deriveValidationManifest` → schema validation → write `logs/validation/<sessionLabel>/manifest.json` → spawn `vite --host` with `VITE_NEMOSYNE_BUILD_ID` (+ mode/session env). The runtime reads the build ID through the existing `QuestTelemetry.captureQuestRuntimeEnvironment` path (`import.meta.env.VITE_NEMOSYNE_BUILD_ID`), unchanged.
- **Runtime class authority:** every dev-mode manifest records `runtimeClass: 'vite-dev'`. Vite dev is not clean-production qualification; IWER is not physical evidence; these facts are enforced by the mode table, not by prose.

## Failure modes (most plausible ways this silently corrupts)

1. **Fallback build identity leaks in:** git resolution fails and the launcher falls back to `unversioned-local-build`, silently producing a manifest that looks attributable but is not. → launcher must **fail closed** (refuse to start, exit non-zero, write no manifest) when HEAD cannot be resolved.
2. **Dirty worktree laundered as clean:** untracked/ignored noise (e.g. the symlinked `node_modules`/`wasm/pkg` present in this worktree, which `git status --porcelain` reports as `??` untracked) is filtered out so a dirty source tree is recorded `clean`. → do not filter porcelain output in B1; record what git reports, conservatively.
3. **Evidence laundering:** `quest-10m` or `quest` mode claims a promotion-grade evidence class, or `vite-dev` is recorded as `clean-production-dist`. → mode table + `promotionEligible` computation encode the ladder; schema rejects unknown classes/modes.
4. **Manifest schema drift:** a future/foreign manifest (different `schemaVersion`, missing required fields) is accepted and later adjudicated. → validator rejects `schemaVersion !== '1'` and missing/malformed required fields, fail-closed.
5. **Derivation logic tested only via mocks:** the launcher's git/session/mapping logic is unit-tested against fakes but the real `main()` path is never exercised end-to-end. → tests exercise both the pure functions (with fake git exec) and the real `main()` against a temp evidence root with real git in this repo.
6. **Second authority:** the launcher forks telemetry/threshold logic or writes roadmap/promotion state. → B1 writes only to git-ignored `logs/validation/`, reuses existing thresholds/profiles by name, and never edits source, `docs/ROADMAP.md`, or GitHub state.
7. **Validation directory not isolated / path escape:** manifest `evidenceDir` is attacker/user-influenced and escapes the validation root. → `writeManifestFile` refuses paths outside `logs/validation`.

## Falsifying evidence

The cheapest authoritative checks that would disprove the design:

1. `validateValidationManifest` returns `ok:false` for a manifest with `schemaVersion: '2'` and for one missing any required field (e.g. `buildId`).
2. `validateValidationManifest` returns `ok:false` when `buildId === 'unversioned-local-build'` and when `evidenceClass`/`runtimeClass`/`mode`/`worktree` are unknown values.
3. `resolveGitHead(fake)` returns the exact fake SHA; `resolveGitHead` throws when the fake reports failure (fail-closed, no fallback).
4. `resolveWorktreeState` returns `clean` for empty porcelain, `dirty` for non-empty, `unknown` on exec failure.
5. `deriveValidationManifest` with `worktree:'dirty'` produces `worktree:'dirty'`, `promotionEligible:false`, and an invalidation reason; with clean tree + governed class it is `promotionEligible:true`; `quest-10m` is never promotion-eligible.
6. Mode table assertions: `quest-perf` → gates `[PERF-04, PERF-05]`, profile `quest-3s-qualification`, evidenceClass `governed-physical-validation`, runtimeClass `vite-dev`; `quest` → `physical-device-trial`; `quest-10m` → `governed-physical-validation` with non-qualification invalidation.
7. `package.json` still contains `"dev": "vite --host"` and `"dev:wasm": "npm run wasm:dev && vite --host"` unchanged.

## Non-goals / dependencies

- B1 does **not** change `QuestTelemetry`, `LoadTestDriver`, `QuestBoundaryProbe`, thresholds, or analysis math.
- B1 does **not** implement QV2 (device declaration store) beyond reading an optional `logs/validation/device.json`, QV3 (isolated per-run evidence sink / runtime linkage), QV4 (adjudicator), QV5 (guided UX runner), QV6 (dashboard), or QV7 (clean-production handoff).
- B1 does **not** reinterpret the 10M boundary probe as qualification; the probe's own `deviceQualifiedAt10m:false` / `promotionBlockedByAudits:true` and the manifest's non-qualification invalidation remain separate, both conservative.
- B1 may not create a second telemetry/performance/roadmap authority, add npm dependencies, or touch `vite.config.ts` (no Vite mode flag is needed because `VITE_*` env vars reach `import.meta.env` unchanged and all dev modes are `vite-dev`).

## Real-path note (pre-implementation discovery)

This worktree (`/Users/tsatsuamable/Documents/nemosyne-b1`) symlinks `node_modules` and `wasm/pkg` to the main repo; `git status --porcelain` therefore always reports `?? node_modules` / `?? wasm/pkg`, so `resolveWorktreeState` will truthfully classify any run from this worktree as `dirty`. That is conservative (promotion-ineligible) and matches the guardrail; B1 records the finding rather than filtering it.

---

# Post-implementation adversarial review

Date: 29 August 2026
Reviewer: Stream B (self-review, adversarial contract applied)
Verification run in worktree: 34 focused tests green; `npm run test:fast` 78/78; `npm run test:ui` 13/13; `npm run typecheck` clean; `npx eslint` clean on changed files; `npm run docs:check` PASSED; real launcher smoke run + served-module build-ID check.

## Adversarial questions

1. **Is the launcher the real path a Quest developer uses, or decorative?**
   The real path is `npm run dev:quest:*` → `node scripts/quest-validation.mjs <mode>` → git discovery → manifest write → spawn `vite --host`. I exercised `main()` end-to-end in this repo: real `git rev-parse HEAD` resolved `a8be01a…`, the real worktree classified `dirty`, `logs/validation/<label>/manifest.json` written, and Vite actually served (`VITE v8.2.2 ready`). I also verified the served `src/vr/scalability/QuestTelemetry.ts` is transformed with the exact SHA substituted into `import.meta.env.VITE_NEMOSYNE_BUILD_ID` (no `unversioned-local-build` fallback). The launcher is the real entry point, not a decorative helper.

2. **Does it create a second authority (telemetry/roadmap/promotion)?**
   No. It reuses the existing build-ID read path (`QuestTelemetry`), references owned profile names (`quest-3s-qualification`, `quest-3s-rust-boundary-10m`) instead of forking thresholds/verdicts, and writes only under git-ignored `logs/validation/`. It never edits source, `docs/ROADMAP.md`, or GitHub/promotion state. No new telemetry collector, no analysis math, no roadmap status vocabulary.

3. **Does the regression exercise the real boundary?**
   Unit tests use fake git exec (as the checkpoint prescribed) but the derivation is also exercised through the real `main()` fail-closed path and through a real-git `buildValidationContext` that resolves this repo's actual HEAD and validates the manifest. A manual real-path run plus the served-module build-ID check provide production-path evidence that the env reaches `import.meta.env`. The one remaining unproven boundary is the physical-headset session itself (runtime capture/linkage is QV2/QV3), which B1 does not claim.

4. **Are evidence classes kept distinct?**
   Yes. The taxonomy is a closed union enforced by the validator (unknown classes rejected). Each mode maps to exactly one class in the tested table; `quest`→`physical-device-trial`, `quest-perf`/`quest-ux`/`quest-10m`→`governed-physical-validation`, and every dev mode→`vite-dev`. `promotionEligible` is a pure consequence of worktree state + evidence class + mode invalidations; trial runs and the 10M boundary probe are never promotion-eligible, and `evidenceClass`/`gateDisposition` are separate fields (tested). No path upgrades simulator→device or dev→production.

5. **Did it cross Stream A/C ownership?**
   No. New/changed files are Stream B-owned: `src/validation/` (validation evidence plumbing), `scripts/quest-validation.*` (Quest validation tooling), `package.json` (Stream-B-reserved during B1/B2), `tests/`, `docs/review-plans/`. `vite.config.ts` untouched. No analytical/WASM/security/collaboration authority files were modified.

6. **Is the claim narrower than or equal to the evidence?**
   The claims are: (a) one versioned manifest schema exists and fails closed — proven by tests; (b) validation modes emit a non-fallback build ID through the real serve path — proven by the served-module check; (c) mode/gate/profile/evidence/runtime mappings are centralized and promotion eligibility cannot be upgraded — proven; (d) `dev`/`dev:wasm` unchanged — proven byte-for-byte. The claim is narrower than the evidence (B1 does not claim runtime linkage, per-mode evidence sinks, adjudication, or any qualification outcome).

## Disposition

- **BLOCKER:** none.
- **DEFER (valid, non-blocking):**
  1. **Runtime↔manifest linkage (QV2/QV3):** the manifest's `sessionId`/`userAgent`/`nominalXrRateHz`/`startedAt` are null at launch; linking on-device telemetry to a session directory and splitting the loadtest sink per session is B2.
  2. **`quest-validate` lane selection (QV6):** currently maps to a conservative `physical-device-trial` orchestration entry; in-session lane selection and a dashboard are later checkpoints.
  3. **`scripts/quest-validation.d.mts` sidecar drift:** the JS launcher and its type sidecar are not mechanically coupled; a future rename could pass typecheck while breaking runtime. Low risk for a test-only surface; revisit if the launcher gains more consumers.
  4. **Session-label second-granularity collision:** two sessions started in the same second share a directory label; `sessionId` (UUID) remains unique. Acceptable for B1.
  5. **Adjudication semantics (QV4):** the validator enforces `promotionEligible ⇔ (invalidations empty)` at launch; a future blocked-by-prerequisite disposition must be represented consistently (e.g. via `gateDisposition.status` or an invalidation) — not constrained further in B1.
- **SUGGESTION:**
  1. **Filter known build/harness paths for worktree state** (symlinked `node_modules`/`wasm/pkg` currently force `dirty` in linked worktrees). Deliberately NOT implemented in B1: filtering risks laundering a genuinely dirty source tree; the conservative classification is the fail-closed choice. Revisit only with explicit "harness-only" provenance semantics.
- **NEW FINDING (pre-implementation):** linked worktrees with symlinked `node_modules`/`wasm/pkg` are always `dirty` under `git status --porcelain`; recorded truthfully, promotion-ineligible, matches the guardrail.

## Residual risk

Physical-headset runtime capture and per-run evidence isolation are not proven by B1; a run from a linked worktree will be recorded `dirty` until B2 device metadata/sink work or an explicit harness-path policy lands. No B1 evidence is claimed to close any roadmap gate.