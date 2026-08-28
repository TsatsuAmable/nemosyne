# P1-Q Q9 Exact-Head Promotion Controller

**Date:** 28 August 2026
**Baseline:** `main@600bd43e...` (#507 merged, #506 Q8 merged)
**Status:** IMPLEMENTATION LANDED / PILOT / REVIEW ACTIVE

## Purpose

Replace promotion races and misleading governance labels with one explicit,
machine-checkable promotion authority that is truthful about what it enforces
(Q9) and closes RF-052 (a ruleset named as an approval gate that required zero
approving reviews and did not require the `approval-gate` check).

## Design

### Intended policy manifest

`governance/promotion-policy.json` declares the intended branch-protection
contract for `main`:

- ruleset name must match live enforcement;
- required checks: `Node 24`, `CodeQL SAST (javascript-typescript)`,
  `approval-gate`;
- review-thread resolution enforced;
- `required_approving_review_count: 0` is **deliberate**: the approval
  authority is the `approval-gate` workflow (owner approval on the exact PR
  head), not a GitHub approving review. The controller never manufactures an
  approval.

### Exact-head promotion evidence controller

`scripts/check-promotion-evidence.mjs --pr <n> --sha <exact-head>
--required-checks "Node 24,CodeQL SAST (javascript-typescript),approval-gate"`
verifies, in order:

1. **exact-head** — the PR head SHA equals the expected promotion SHA; any head
   movement fails closed and revokes, requiring re-verification on the new head;
2. **required checks green on that exact SHA** (queried against the expected
   SHA's check-runs, never a different commit);
3. **no unresolved `CHANGES_REQUESTED` review** on the exact head;
4. **promotion-evidence/adversarial disposition marker** present (the
   post-implementation adversarial review section at any heading level, a
   promotion-evidence label, or the adversarial-contract disposition).

It exits non-zero on any failure and prints a verdict that is explicitly
"promotion evidence only — not an approval."

### Governance drift check (RF-052 / RF-009 / RF-034)

`scripts/check-governance-policy.mjs` (`npm run governance:policy`) fetches the
live ruleset via `gh` and fails if the ruleset name, required status checks,
review-thread resolution, or approving-review count drift from the manifest. This
is the periodic policy check that prevents repository governance from silently
drifting.

### CI wiring (non-required pilot)

`.github/workflows/p1q-q9-promotion-controller.yml` runs on every `main` PR
(opened/synchronize/reopened/ready) plus `workflow_dispatch`:

- `npm run governance:policy` (drift check);
- `npm run governance:promotion` with the PR number and exact head SHA.

The workflow is non-required and does not block merges while the pilot measures
signal. Promotion to a required gate requires measured value and acceptable cost
per the P1-Q contract.

## Live governance reconciliation (RF-052)

Before this tranche, the active ruleset `Protect main — require PR + CI +
approval-gate` had `required_approving_review_count: 0` and did **not** list
`approval-gate` among required status checks — the name implied an approval gate
that was not enforced. This tranche updated the live ruleset so `approval-gate`
is a required status check, making the name truthful while keeping zero GitHub
approving reviews because the approval authority is the workflow, not a GitHub
review. The manifest and drift check now hold that state mechanically.

## Falsifying evidence

- governance drift check passes only when the live ruleset matches the
  manifest (verified: `drift: false`, required checks include `approval-gate`);
- controller accepts the exact merged head only when checks are green and no
  `CHANGES_REQUESTED` is open;
- controller fails on a stale/wrong SHA (`HEAD MOVEMENT DETECTED`, exit 1);
- controller fails on a closed PR (no promotion evidence applies, exit 1);
- controller fails when required checks are missing/red on the exact SHA.

## Evidence boundaries

Q9 proves only that promotion evidence can be verified mechanically at the
exact head. It does not prove scientific correctness, device fitness, or that a
green controller implies `VERIFIED COMPLETE`. It does not manufacture approvals
or imply independent human review where repository policy does not require one.

## Residual / next

- Promote the controller to a required PR gate only after measuring signal and
  wall-clock cost across a bounded window of PRs.
- The `Continuous Copilot Review` ruleset remains disabled; RF-052 permits this
  as long as automated review is not presented as an approval gate.
- Roadmap snapshot reconciliation continues under RF-009/RF-034 discipline.

## Pilot defects caught (post-merge)

PR #510 auto-merged at its head before the CI fixes landed; the following were
caught by exercising the pilot on the merged workflow and on #511:

1. `gh` in CI requires `GH_TOKEN=${{ github.token }}` (GITHUB_TOKEN is not read
   as GH_TOKEN automatically); added to both controller steps.
2. `metadata: read` is not a valid GitHub Actions permission scope (metadata is
   implicit at read-only); removed — the workflow previously failed validation
   with zero jobs.
3. The controller's PR query omitted the `body` field, so the
   adversarial-disposition marker check could never pass; `body` added to the
   jq projection.

All three are fixed on `main` via #511 and verified end-to-end against a real
green PR head (`verified: true`, exact head, required checks green, clean
threads, marker present).