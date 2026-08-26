# Nemosyne engineering agent contract

This is the canonical tool-neutral engineering contract for AI-assisted work in this repository. Tool-specific files such as `CLAUDE.md` and `.github/copilot-instructions.md` must defer to this file instead of restating project facts.

## Sources of truth

Read these in order when they are relevant:

1. `docs/Nemosyne_Definitive_Vision_and_Roadmap.md` — product, research, and architecture direction.
2. `docs/ROADMAP.md` — live implementation status, review findings, and current programme order.
3. `docs/ARCHITECTURE.md` — current technical reference, subordinate to the governing vision while migration is active.
4. Executable configuration — `package.json`, `.github/workflows/*.yml`, `vitest*.config.ts`, `rust-toolchain.toml`, and source code are authoritative for commands, versions, thresholds, and runtime behavior.
5. `docs/PROJECT_DOCS_INDEX.md` and `docs/DOCS_MANIFEST.json` — documentation authority and lifecycle.

**Executable configuration wins over duplicated prose facts.** Do not copy dependency versions, coverage thresholds, CI job topology, test counts, or other machine-readable values into agent instructions. If prose conflicts with executable configuration, fix or archive the prose.

## Mandatory engineering boundaries

1. **Vision alignment:** changes must align with the governing vision. Material alternatives or direction changes must be surfaced explicitly rather than slipped into implementation.
2. **Feature branch and PR discipline:** never push directly to `main`. Develop on a focused branch, verify the claims, and raise a PR.
3. **Rust/WASM analytical authority:** Rust/WASM owns canonical analytical data, N-dependent analysis, statistical/scientific computation, topology, clustering, and scale-sensitive reductions. TypeScript owns orchestration, interaction, persistence adapters, and rendering. Do not add a shadow analytical implementation or silent JavaScript fallback.
4. **Runtime-local handles are capabilities:** a WASM handle belongs only to the runtime instance that created it. Cross-runtime identity uses durable fingerprints and explicit registration.
5. **Scientific honesty:** names such as confidence, significance, probability, density, manifold, uncertainty, or fit must match the mathematics actually computed. Missing/invalid values must not silently become legitimate numeric observations.
6. **Reproducibility:** investigator-visible transformations, analytical decisions, approximation/refusal outcomes, and model identity must remain deterministic or explicitly provenance-bearing.
7. **Fail closed at trust boundaries:** malformed, ambiguous, stale, replayed, unsupported, or untrusted input must not silently become a more privileged or scientifically plausible state.

## Production-path evidence rule

A product property is not considered landed merely because an isolated helper, mock, module, or unit test demonstrates it. When a property governs a production path, evidence must exercise the real production entry point and the authoritative call graph or boundary responsible for enforcing it.

This applies to security, correctness, scientific semantics, privacy/compliance, performance, recovery, concurrency, provenance, persistence, and UX state. Unit tests remain necessary, but they are not sufficient evidence for a shipped-capability claim.

## Development and verification

Use scripts from `package.json`; do not reconstruct commands from old documentation. Common entry points include:

```bash
npm ci
npm run wasm:dev
npm run build
npm run typecheck
npm run lint
npm test
npm run test:all
npm run test:coverage
npm run test:smoke
npm run test:smoke:collaboration
npm run docs:check
npm run audit:hygiene
```

The required CI graph is defined only by `.github/workflows/ci.yml`. Coverage policy is defined only by `vitest.coverage.config.ts`. Rust toolchain policy is defined by `rust-toolchain.toml`. Dependency versions are defined by the package manifests and lockfiles.

During iteration, run the smallest ownership-aligned checks that can disprove the current change quickly. Before claiming completion, obtain the required production-path and CI evidence for the affected risk surface. Do not weaken tests, coverage, assertions, or architecture simply to obtain a green run.

## Three-stream operating model

- **Stream A:** forward implementation under `docs/STREAM_A_IMPLEMENTATION_QUALITY_CONTRACT.md`.
- **Stream B:** independent adversarial review and fix-forward. Green CI is necessary evidence, not proof of architectural or scientific completion.
- **Stream C:** security authority and live-path assurance under `docs/STREAM_C_SECURITY_ASSURANCE.md`.

Use the status vocabulary defined in `docs/ROADMAP.md`. `VERIFIED COMPLETE` requires implementation plus independent review evidence.

## Documentation discipline

- `docs/PROJECT_DOCS_INDEX.md` defines human-facing authority; `docs/DOCS_MANIFEST.json` is the machine-readable lifecycle map.
- Historical reports and superseded plans belong under `docs/archive/`; they must never be treated as current authority.
- Do not create a new status document when the information belongs in `ROADMAP.md`, the findings ledger, an ADR, or an existing technical reference.
- Do not duplicate executable facts in prose. Link to the source instead.
- Any change to a canonical document, agent contract, CI policy, or documentation authority must pass `npm run docs:check`.
- When touching stale documentation, update it or archive it in the same change rather than preserving contradictory truth.

## Review and handoff discipline

- Review diffs and production call paths, not just newly introduced helpers.
- Prefer one high-confidence finding over several speculative comments.
- Block merges for demonstrated correctness, security, reproducibility, authority, material performance, or required-gate failures. Track valid non-blocking work without recursively expanding PR scope.
- Record exact verification evidence and honest residual risk. Never fabricate a pass or treat a skipped/unrun check as green.
- Keep PRs narrow enough that the independent review can reason about the semantic change.

## Local-only agent configuration

Local `.agents/`, `.claude/`, and `.ai/` directories may contain harness/model-routing details and are not repository authority. They must not override this contract, the governing vision, the live roadmap, or executable configuration.
