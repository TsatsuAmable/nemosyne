# P1-Q Q9 required-gate race fix

**Status:** IMPLEMENTATION LANDED / REVIEW ACTIVE

**Date:** 2026-08-29

## Problem

Q9 was a non-required `pull_request` workflow that evaluated immediately when a PR opened or moved heads. Required checks such as Node 24 and CodeQL were usually still pending, so the first Q9 run failed. Once the required branch-protection checks became green, auto-merge could merge the PR before a manual Q9 rerun completed. The result was repeated red Q9 noise after otherwise governed merges and, more importantly, Q9 was observational rather than an actual pre-merge promotion gate.

Observed repeatedly on #516, #517, #518 and #520.

## Governing invariant

> A PR must not satisfy the existing required `approval-gate` until exact-head promotion evidence is valid on the still-open PR.

The gate must prove, on the same head SHA:

1. repository-owner approval authority is satisfied;
2. Node 24 and CodeQL are successful;
3. the PR head has not moved;
4. the PR is still open;
5. no exact-head `CHANGES_REQUESTED` review remains;
6. the adversarial/promotion disposition marker exists.

GitHub's existing review-thread-resolution rule remains the authority for unresolved inline threads.

## Design

### Required `approval-gate`

`approval-gate` remains the required status check already named in the live ruleset. It now:

1. verifies owner approval on the exact event head;
2. invokes `scripts/check-promotion-evidence.mjs`;
3. boundedly waits for `Node 24` and `CodeQL SAST (javascript-typescript)`;
4. performs the remaining Q9 exact-head/review/marker checks before becoming successful.

This deliberately does **not** add a second required check or require a live ruleset mutation.

The promotion controller invoked from `approval-gate` does not list `approval-gate` among its prerequisites, avoiding a circular dependency.

### Standalone Q9 audit

The non-required Q9 workflow remains useful as an independent governance audit. It waits for Node 24, CodeQL and `approval-gate`. If auto-merge occurs immediately after the required approval gate succeeds, the standalone audit may continue against the merged PR with `--allow-merged`.

`--allow-merged` does not bypass evidence: exact head, required checks, review disposition and adversarial/promotion marker are still verified. It only relaxes the open-state requirement for this non-required post-merge audit. The required approval gate never uses `--allow-merged`.

## Failure modes attacked

- **Premature failure:** required checks are still queued/in progress when Q9 starts.
- **Merge race:** auto-merge closes the PR between prerequisite completion and a manual Q9 rerun.
- **Head movement during wait:** an old waiting gate accidentally blesses a newer head.
- **Completed failed prerequisite:** polling waits forever instead of failing promptly.
- **Duplicate check-run attempts:** an older failed attempt shadows a newer rerun.
- **Governance weakening:** post-merge tolerance accidentally becomes available to the required pre-merge gate.
- **Approval fabrication:** Q9 is mistaken for or manufactures owner approval.

## Falsifying evidence

This PR itself is the production-path test because it changes the required workflow:

- the PR's `approval-gate` must remain in progress while Node 24 or CodeQL are incomplete;
- it must fail immediately if either prerequisite completes non-successfully;
- it must succeed only while the exact PR head is still open and the PR body contains a valid adversarial disposition;
- the PR must not auto-merge before that required `approval-gate` succeeds;
- the standalone Q9 audit must eventually succeed on the same exact head, whether it finishes immediately before or just after merge;
- governance-policy drift, action-pinning, docs checks and ordinary CI must remain green.

## Non-goals

- no weakening or removal of Node 24, CodeQL or approval requirements;
- no live ruleset rewrite;
- no new approval authority;
- no polling of arbitrary optional workflows;
- no change to analytical/runtime/application behavior;
- no claim that Q9 replaces GitHub's required review-thread-resolution rule.

## Post-implementation adversarial review checklist

Before promotion, inspect the live workflow timeline rather than relying on static YAML:

1. confirm `approval-gate` waits rather than fails while prerequisites are pending;
2. confirm the exact head does not move during the wait;
3. confirm action-pinning and governance-policy checks remain green;
4. confirm the shared controller's merged-PR allowance is present only in standalone Q9;
5. confirm no auto-merge occurs before the required approval gate succeeds;
6. inspect review threads and the PR's adversarial disposition;
7. classify this tranche `VERIFIED COMPLETE` only after a real PR demonstrates the race is closed.
