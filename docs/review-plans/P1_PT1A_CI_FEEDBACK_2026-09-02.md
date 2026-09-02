# P1-PT PT1A — CI feedback baseline and first bounded reduction

**Date:** 2 September 2026  
**Base:** `main@fd53ae22797f6c2e77f4a8791bb67706a6f042a2` (#619 merged)  
**Branch:** `chore/pt1-ci-feedback`  
**Status:** PRE-IMPLEMENTATION ADVERSARIAL CONTRACT

## Product / engineering value

PT1 reduces the time between a change and a trustworthy result. The objective is not fewer checks. It is less repeated work per exact-head decision while preserving the evidence that can falsify production, scientific, security and architectural regressions.

## Bounded baseline

Five recent successful exact-head `CI` pull-request runs were sampled because they correspond to the final reviewed heads of #615–#619:

| PR / head | CI run | Wall clock |
| --- | ---: | ---: |
| #615 / `6ea9f245` | `33537686681` | 312 s (5m12s) |
| #616 / `3e90ea82` | `33559800358` | 341 s (5m41s) |
| #617 / `d136cfe5` | `33568881446` | 228 s (3m48s) |
| #618 / `43aff918` | `33572178043` | 204 s (3m24s) |
| #619 / `968e3df1` | `33595196248` | 493 s (8m13s) |

For this deliberately small recent sample:

- p50 = **312 s (5m12s)**;
- interpolated p95 = **462.6 s (about 7m43s)**.

This is an initial operational baseline, not a universal benchmark. Queueing, runner cache state and touched-path evidence workflows vary between PRs.

## Measured duplicate cost

On clean #618 CI run `33572178043`, the required `P1-UV0 baseline evidence` job ran from about 23:42:09 to 23:44:23, roughly **134 seconds**. The log shows:

- a second cold release WASM + Vite instrumented build dominated the first ~75 seconds;
- a second `playwright install --with-deps chromium` path consumed roughly another ~29 seconds;
- the actual single state-asserted UV0 Playwright test took about **15 seconds**.

UV0 is a retained baseline/evidence checkpoint. `tests/uv0-baseline-inventory.test.ts` already provides a fast, ordinary-suite inventory/source-audit ratchet, and the ordinary production build separately proves UV0 instrumentation is absent from production artifacts. The expensive browser capture remains valuable when the visible-product baseline or its owning surfaces change, but it is not unique evidence for every unrelated PR.

## PT1A implementation hypothesis

1. Remove `P1-UV0 baseline evidence` from the universal required `CI` workflow.
2. Preserve the exact state-asserted browser evidence in a dedicated workflow that runs:
   - manually; and
   - automatically when UV0 evidence files or broad visible-product/UI ownership surfaces change.
3. Keep the fast UV0 inventory/source-audit test in ordinary Vitest coverage.
4. Keep the production negative proof that ordinary `dist/` excludes UV0 instrumentation.
5. Run dependency-free `docs:check` and GitHub Action pin validation before `npm ci` in static analysis so cheap governance failures fail before dependency installation.

## Invariants

PT1A must not remove or weaken:

- TypeScript typecheck;
- ESLint;
- documentation integrity;
- immutable GitHub Action pinning;
- architecture boundary fixture/enforcement;
- global Vitest coverage thresholds and all three shards;
- Rust unit tests;
- ordinary production build and UV0/dev-tool negative proofs;
- production Chromium + collaboration smoke;
- CodeQL;
- architecture policy;
- Q8/Q9/approval exact-head governance;
- UV0 state-asserted browser evidence for changes that can plausibly alter the visible baseline.

The dedicated UV0 workflow must check out the exact PR head rather than relying on the synthetic merge checkout for evidence identity.

## Adversarial falsifiers

Reject or fix forward if any of the following is true:

1. `Node 24` can become green without a previously required production/scientific/security check other than the deliberately demoted UV0 historical-baseline capture.
2. A change to `src/validation/uv0-inventory.ts`, the UV0 browser spec, `WorldUIManager`, core VR/UI/product-shell sources, or the dedicated UV0 workflow itself does not trigger UV0 browser evidence.
3. The dedicated UV0 workflow can report evidence for a checkout different from the PR head it names.
4. Ordinary production build stops proving UV0 instrumentation is absent.
5. The fast UV0 inventory/source audit disappears from ordinary coverage.
6. The change reclassifies browser evidence as physical XR evidence.
7. The change increases the required success-path critical path through a new dependency or serial gate.
8. A failing existing guard is deleted or relaxed merely to obtain green CI.

## Non-goals

- no change to test thresholds;
- no reduction in CodeQL/security/architecture authority;
- no CI caching of mutable build outputs across different source identities;
- no broad workflow consolidation in the same tranche;
- no claim that five runs establish a long-term SLO;
- no product/runtime/analytical behavior change.

## Promotion evidence

Before adoption:

- workflow syntax/action-pin checks pass;
- ordinary exact-head CI is green with the revised required set;
- the new path-triggered UV0 workflow runs on this PR and reproduces the state-asserted baseline at the exact head;
- CodeQL, architecture, approval and promotion evidence remain green;
- post-implementation adversarial review explicitly checks the falsifiers above.
