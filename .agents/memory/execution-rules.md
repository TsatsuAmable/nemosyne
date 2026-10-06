# Execution rules (pointer)

Authoritative contract: `AGENTS.md` at repo root. Live status and tranche order: `docs/ROADMAP.md`.

- Default: one forward tranche at a time. Research/review may run concurrently only on disjoint file surfaces.
- Live-check remote `main` before starting and before raising/finalizing a PR. Never push to `main`. One focused branch per change.
- One worktree = one writer. Never use the canonical `main` checkout as a scratchpad.
- Risk tiers: high-risk needs a pre-implementation adversarial contract plus post-implementation review; standard-risk needs focused verification plus one bounded falsification pass; low-risk exemption must be demonstrably non-semantic.
- Routine narration belongs in the PR, not in `docs/ROADMAP.md`.
