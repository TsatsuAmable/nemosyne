---
name: github-hygiene
description: Use when raising a Nemosyne PR, checking CI gates, or merging — roadmap sync, remote-main drift, commit style, exact-head evidence, required checks, and merge confirmation.
---

# Nemosyne PR lifecycle

Ship one focused branch to `main` without breaking the repo's evidence and promotion rules. Subordinate to `AGENTS.md`, `docs/ROADMAP.md`, and the PR template. Never push directly to `main`.

## 1. Sync before starting and before raising

- `git fetch origin main`; record local HEAD, branch, and `HEAD..origin/main` drift.
- Work on a focused branch from a current base. If `origin/main` moved under you, reconcile drift (rebase or merge) rather than stacking silently.
- One worktree = one writer; never use the canonical `main` checkout as a scratchpad.

## 2. Roadmap touch rule

Update `docs/ROADMAP.md` only when execution status, sequencing, a durable finding, or a completion claim actually changes. Routine narration, verification detail, and standard-risk review belong in the PR body, not the roadmap. Run `npm run docs:check` after any governance/canonical-doc change.

## 3. Commit style

Conventional, repo-matching subjects: `type(scope): imperative subject` — e.g. `docs(roadmap): …`, `feat(moneta): …`, `test(moneta): …`, `chore(deps): …`. One coherent semantic change per PR. Never commit secrets; never amend a failed commit (fix forward).

## 4. Pre-PR gates (risk-tiered)

- Focused ownership-aligned checks first (`typecheck`, `lint`, smallest owning suite); escalate to `test:all` / `build` / `docs:check` / `audit:hygiene` as the risk surface demands.
- High-risk: pre-implementation contract in the PR plus independent post-implementation review. Standard-risk: focused verification plus one bounded falsification pass. Low-risk exemption: state why semantics are unchanged.
- Fill the PR template completely: summary, programme/finding, prior art (explicit "none" if none), exactly one risk-tier box, verification commands with results, and the **exact 40-char reviewed head** with `PASS` disposition. Prefer `npm run governance:pr:create --title <t> --body-file <f> --dry-run` first to validate promotability.

## 5. Raise, gate, merge

- Raise with `gh`; required CI is defined only by `.github/workflows/ci.yml` (`static`, `coverage-*`, `production-build`, `rust`, `playwright-smoke`, `required`). A green run never substitutes for the required adversarial review.
- If CI fails: fix forward on the branch (no weakening tests/coverage/assertions for green), re-verify the moved head, and re-record head + disposition — head movement revokes prior evidence.
- Merge only with exact-head evidence bound to the immutable head being integrated. Parallel tranches integrate via merge commits so the verified head stays a parent. Re-check `origin/main` immediately before finalizing.
- After merge: confirm the merge commit on `main`, watch the post-merge `ci.yml` push run to green, and append one concise completion line to the historical ledger when the roadmap claims a completion.
