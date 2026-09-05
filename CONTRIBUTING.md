# Contributing to Nemosyne

Nemosyne is an experimental scientific/WebXR research instrument. Contributions should optimize for correctness, reproducibility, security, spatial usability, and inspectability rather than feature count alone.

## Before changing code

1. Read `AGENTS.md` for the engineering contract.
2. Read the current status block at the top of `docs/ROADMAP.md`.
3. Read the governing vision when the change affects product direction, scientific semantics, architecture, or UX.
4. Inspect the real production call path before adding a new abstraction or helper.
5. Classify the change under the risk-tiered adversarial implementation protocol in `AGENTS.md`: high-risk, standard-risk, or low-risk exemption. High-risk work requires the pre-implementation adversarial contract before implementation; standard-risk work requires focused verification plus one bounded post-implementation falsification pass; low-risk exemptions must be demonstrably non-semantic.

Executable configuration is authoritative for commands, versions, CI topology, and coverage policy. Use `package.json`, `.github/workflows/`, the Vitest configs, and `rust-toolchain.toml` rather than copying values from prose.

## Adversarial implementation cycle

High-risk work uses this sequence:

```text
live-check remote main
        ↓
pre-implementation adversarial contract
        ↓
identify falsifying tests/checks
        ↓
implement the smallest coherent change
        ↓
focused authoritative verification
        ↓
post-implementation adversarial review
        ↓
fix BLOCKER findings / record DEFER items
        ↓
re-check remote main and raise/finalize PR
```

The pre-implementation contract records the invariant, canonical authority/production path, likely failure modes, falsifying evidence, and non-goals/dependencies. The post-implementation review attacks the final code and real call path rather than merely confirming that the implementation matches its own design.

Standard-risk work starts with the bounded implementation and focused checks, then gets one post-implementation falsification pass before promotion. It does not need a formal pre-review or standalone review document. Low-risk editorial/mechanical work may use the exemption and ordinary diff/check review.

Use an independent agent/reviewer when the risk or evidence would materially benefit from independent challenge. Multiple reviewers should be used only for genuinely different failure classes, not to repeat the same general review in different words.

## Branch and PR discipline

- Live-check remote `main` before starting a branch and again before raising/finalizing the PR.
- Do not push directly to `main`.
- Keep a PR focused on one coherent semantic change.
- Describe the risk surface and the invariant or expected behavior the change is intended to preserve or establish.
- For high-risk work, include the pre-implementation adversarial contract and post-implementation adversarial disposition in the PR.
- For standard-risk work, include focused verification and one bounded adversarial disposition in the PR; do not create review-plan/review files solely as process receipts.
- Prefer fix-forward work on the current architecture over parallel shadow implementations.
- Do not weaken tests, coverage, scientific semantics, security checks, or architectural boundaries to obtain a green build.

## Verification

Run the smallest ownership-aligned checks while iterating. For high-risk work, derive those checks from the failure modes in the pre-implementation adversarial contract. For standard-risk work, target the changed behavior and its nearest production path. Before claiming completion, obtain the production-path and CI evidence appropriate to the affected surface and perform the review required by the selected risk tier.

A helper or unit test does not prove a shipped property when the live runtime uses a different entry point. Security, scientific, persistence, recovery, concurrency, performance, and UX claims require evidence through the production boundary responsible for enforcing them.

A green CI result does not by itself satisfy required adversarial review or justify `VERIFIED COMPLETE`.

Useful entry points are listed in `package.json`, including `typecheck`, `lint`, `docs:check`, focused test suites, full coverage, browser smoke, and the hygiene audit.

## Architecture and scientific boundaries

- Rust/WASM is the sole analytical and scale-sensitive computational authority.
- TypeScript owns orchestration, interaction, persistence adapters, and rendering, not an independent analytical implementation.
- Runtime-local WASM handles are capabilities, not durable identities.
- Missing or invalid observations must not silently become legitimate numeric values.
- Scientific names and confidence-like claims must match the mathematics and evidence actually computed.
- Approximation, refusal, model identity, and investigator-visible transformations must be explicit and provenance-bearing where relevant.

## When an RFC is required

Follow `docs/RFC_PROCESS.md` before implementation when a proposed change materially alters an architectural or trust boundary, public persistence/network format, scientific semantics, or the interaction grammar listed there. Ordinary bug fixes and bounded implementation work do not require an RFC.

If a high-risk pre-implementation adversarial review reveals that a seemingly bounded fix actually changes one of those governed boundaries, stop implementation and use the RFC/ADR process first.

Accepted architectural decisions are recorded under `docs/architecture/decisions/`. Do not silently reverse an accepted ADR. Supersede it with a new decision record when the architecture genuinely changes.

## Documentation

`docs/PROJECT_DOCS_INDEX.md` and `docs/DOCS_MANIFEST.json` define documentation authority and lifecycle. Historical material belongs under `docs/archive/`. Avoid creating new status documents when `ROADMAP.md`, an ADR, or an existing technical reference is the correct home.

Update the roadmap only when execution state, sequence, a durable finding, or completion truth changes. Routine implementation narration and standard-risk review belong in the PR. Standalone review documents are for durable programme/research evidence, milestone/finding closure, or future audit needs.

Run `npm run docs:check` when changing engineering instructions, documentation authority, governance files, or canonical references.