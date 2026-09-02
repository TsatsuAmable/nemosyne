# P1-PT PT1A — CI feedback post-review

**Date:** 2 September 2026  
**Base:** `main@fd53ae22797f6c2e77f4a8791bb67706a6f042a2`  
**Reviewed branch:** `chore/pt1-ci-feedback`  
**Status:** REVIEW ACTIVE / EXACT-HEAD HOSTED EVIDENCE REQUIRED

## Review scope

This review attacks the first PT1 reduction before promotion. The change removes the historical UV0 browser capture from universal required CI, preserves it as exact-head risk-triggered/manual evidence, moves two dependency-free repository guards ahead of `npm ci`, and repairs stale canonical roadmap status.

## Findings before hosted evidence

### 1. UV0 trigger scope was initially too narrow — FIXED FORWARD

The first trigger list named `src/app`, `src/vr`, `src/moneta`, `src/atlas` and the UV0 inventory explicitly. Adversarial review found that the five canonical UV0 states also depend on source data and investigation/replay paths, so that list could silently miss a production TypeScript change capable of altering the baseline.

The trigger was widened to `src/**` plus `wasm/**` and the relevant build/config/spec inputs. This deliberately sacrifices some potential runner savings to preserve evidence coverage. PT1 can narrow it later only with measured dependency/defect evidence.

### 2. Cheap-guard reordering initially bypassed a self-checking script contract — FIXED FORWARD

`docs:check` verifies that required CI invokes the canonical `npm run docs:check` entrypoint. An intermediate edit called the underlying Node script directly. Review caught this before promotion and restored the package-script entrypoint while keeping it before `npm ci`. The same pattern is used for `ci:actions-check`.

### 3. Universal required evidence remains materially intact

The revised `Node 24` aggregate still requires:

- static analysis including typecheck, lint, documentation integrity, action pinning and architecture boundaries;
- all sharded Vitest coverage plus global thresholds;
- Rust unit tests;
- ordinary production build;
- production Chromium and collaboration smoke.

The ordinary production build retains the negative proof that UV0 instrumentation is absent from shipped `dist/`. The fast UV0 inventory/source-audit test remains in the ordinary test corpus. CodeQL, architecture policy, approval and promotion workflows are not removed or weakened.

### 4. Evidence-class boundary remains intact

The new UV0 workflow is browser evidence only. It does not claim physical Quest/controller/direct-touch/comfort evidence. Quest remains a reference platform under the current product-transition strategy.

### 5. Canonical roadmap overclaim avoided

C1-C4 are recorded as landed, but Stream C remains `IMPLEMENTATION LANDED / REVIEW ACTIVE` because physical-input evidence remains outstanding. QV2 is recorded as ADB machine-attributed while QV4 adjudication remains open. PT0 is complete and PT1 active; later PT stages remain plans rather than completion claims.

## Hosted evidence still required

Do not promote this tranche until the unchanged final head proves:

1. ordinary CI succeeds with the revised required-job graph;
2. the dedicated `P1-UV0 baseline evidence` workflow triggers on this PR, checks out the exact PR head and reproduces the state-asserted browser evidence;
3. action-pinning and documentation-integrity checks accept both workflow changes;
4. CodeQL and architecture policy remain green;
5. approval/promotion evidence is bound to the unchanged head;
6. no review thread identifies a missed risk-trigger surface or weakened required guard.

## Provisional disposition

**TARGETED ADOPT, pending exact-head hosted evidence.**

No blocking design finding remains after the two fix-forward corrections above. Final `ADOPT` requires the hosted evidence listed above and a final exact-head re-read.
