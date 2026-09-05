# Claude Code adapter

Follow `AGENTS.md` as the canonical engineering contract for this repository. Do not duplicate project architecture, CI topology, coverage thresholds, dependency versions, live roadmap state, or other machine-readable facts here.

## Pickup sequence

1. Read `AGENTS.md`.
2. Read the top status block of `docs/ROADMAP.md` for live programme state.
3. Read `docs/PROJECT_DOCS_INDEX.md` for documentation authority.
4. Inspect the actual code and executable configuration for the subsystem being changed.

## Claude-specific working practice

- Use focused reads and diffs rather than repeatedly loading the full repository.
- Treat local `.claude/`, `.agents/`, and `.ai/` material as harness working memory only; it cannot override repository policy.
- For implementation work, live-check remote `main`, apply the risk tier from `AGENTS.md`, keep one focused branch/PR, and perform only the review required by that tier: high-risk gets pre- and post-implementation adversarial review, standard-risk gets one bounded post-implementation falsification pass, and low-risk non-semantic work may use the exemption.
- Prefer an independent agent/reviewer when it adds a materially different challenge. Do not multiply review merely by repeating the same generalist pass.
- When a property matters in production, follow the production-path evidence rule in `AGENTS.md`; an isolated helper test is not proof that the live runtime enforces the property.
- For command names, versions, CI jobs, coverage policy, and test selection, read `package.json`, `.github/workflows/`, and the relevant config files rather than this adapter.

If this file ever disagrees with `AGENTS.md`, `AGENTS.md` wins and this adapter should be corrected.