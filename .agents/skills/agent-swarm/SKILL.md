---
name: agent-swarm
description: Use when a Nemosyne task splits into parallel lanes — research fan-out, multi-class review, or disjoint implementation — or when deciding whether to swarm at all.
---

# Nemosyne swarm protocol

Swarm whenever the work is parallelizable; stay single-agent when it is not. The repo's one-tranche rule still holds: parallel lanes must be disjoint in files and authority, and every lane reports back to one lead holding the integration branch.

## Feasibility gate (no swarm when)

- Strictly sequential steps, a single-file change, or a bounded `one_off` fix.
- Lanes would write the same files or the same authority surface.
- High-risk work needing tight design control — one coder, then a review swarm.

## Recipes

**Research fan-out.** N read-only children on the shared checkout, each with a bounded question and a handoff format. No writes, no worktrees. Lead merges handoffs and kills overlap early.

**Review swarm.** One specialist per genuinely different failure class only (analytical authority, Worker/WASM lifecycle, security/robustness, rendering/performance, statistics/study). Repeating the same generalist review twice is not assurance — refuse the duplicate lane. Reviewers work from `git diff` plus the handoff.

**Disjoint implementation lanes.** One isolated worktree per lane, requested per child (isolation is never silent fallback). Lanes integrate via merge commits so each verified head stays a parent. One writer per worktree, always.

## Cheap decisions first (Jev)

Never spend a subagent on a judgment a fast decision model can make. Before fanning out, batch the narrow calls through Jev over the same evidence in one round: rank candidate files/symbols to read, pick which review classes actually apply, triage findings against the rubric, score swarm-vs-single. Read the distribution, not just the winner — a `noul` near 0.5 means Jev cannot tell, so escalate that call to a real lane instead of acting on it. Requires `TYPESAFE_API_KEY` (spends credit); keep credentials out of the evidence, English only for thresholded calls.

## Runtime rules

- Default capacity is 8 agents per tree including the root; grandchildren share it. Raise `agents.execution_capacity` only when spawns are actually rejected.
- Cancellation is cooperative and children commit only when their task explicitly asks — the lead owns integration.
- Coordinate live lanes with session messaging; the runtime journals every spawn and control action for the post-run account.

## Speed knobs

- Reasoning effort per role: `low`/`minimal` for bounded lanes, `medium`/`high` for the lead, `xhigh` only for high-risk integration review.
- Cap lanes with `--max-model-steps` so a stuck child cannot burn the budget; cancel cooperatively at the first checkpoint that answers the question.
- Reuse handoffs and the memory index instead of re-reading the tree; reviewers start from `git diff`, never a fresh exploration.
- Reserve verification capacity before fanning out: an auditor re-runs the exact validation path after lanes merge, exactly as in single-agent work.
