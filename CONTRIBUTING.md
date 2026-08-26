# Contributing to Nemosyne

Nemosyne is an experimental scientific/WebXR research instrument. Contributions should optimize for correctness, reproducibility, security, spatial usability, and inspectability rather than feature count alone.

## Before changing code

1. Read `AGENTS.md` for the engineering contract.
2. Read the current status block at the top of `docs/ROADMAP.md`.
3. Read the governing vision when the change affects product direction, scientific semantics, architecture, or UX.
4. Inspect the real production call path before adding a new abstraction or helper.

Executable configuration is authoritative for commands, versions, CI topology, and coverage policy. Use `package.json`, `.github/workflows/`, the Vitest configs, and `rust-toolchain.toml` rather than copying values from prose.

## Branch and PR discipline

- Do not push directly to `main`.
- Keep a PR focused on one coherent semantic change.
- Describe the risk surface and the invariant the change is intended to preserve or establish.
- Prefer fix-forward work on the current architecture over parallel shadow implementations.
- Do not weaken tests, coverage, scientific semantics, security checks, or architectural boundaries to obtain a green build.

## Verification

Run the smallest ownership-aligned checks while iterating. Before claiming completion, obtain the production-path and CI evidence appropriate to the affected surface.

A helper or unit test does not prove a shipped property when the live runtime uses a different entry point. Security, scientific, persistence, recovery, concurrency, performance, and UX claims require evidence through the production boundary responsible for enforcing them.

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

Accepted architectural decisions are recorded under `docs/architecture/decisions/`. Do not silently reverse an accepted ADR. Supersede it with a new decision record when the architecture genuinely changes.

## Documentation

`docs/PROJECT_DOCS_INDEX.md` and `docs/DOCS_MANIFEST.json` define documentation authority and lifecycle. Historical material belongs under `docs/archive/`. Avoid creating new status documents when `ROADMAP.md`, an ADR, or an existing technical reference is the correct home.

Run `npm run docs:check` when changing engineering instructions, documentation authority, governance files, or canonical references.
