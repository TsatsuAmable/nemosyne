# Dependency Modernization Sprint Backlog

## Objective

Run a deliberate platform-modernization sprint after the current Moneta scalability/authority P0 slice and before Gate 9 compositional Moneta. Use the open Dependabot PRs as migration inputs rather than an auto-merge queue. Upgrade major dependencies in controlled waves, then retire bespoke implementations where mature libraries measurably improve correctness, security, maintainability, portability, or performance.

Tracking issue: #300.

## Guardrails

- Treat major upgrades as engineering migrations, not maintenance chores.
- Keep migrations independently reversible and small enough to diagnose.
- Establish behavior and performance baselines before replacement work.
- Preserve Nemosyne-specific research/product semantics where generic libraries cannot express them.
- Preserve the boundary that Rust/WASM owns work materially proportional to dataset size.
- Require parity, property, or metamorphic tests before deleting custom implementations.
- Scientific code requires numerical, determinism, and provenance validation, not just compilation.
- WebXR/rendering migrations require headset/runtime/performance validation, not just desktop build success.
- No migration may silently change canonical serialization, hashing, persisted investigations, analytical semantics, or replay/model provenance.
- Keep the active conveyor belt small: normally one breaking migration plus at most one low-risk maintenance PR at a time.

## Wave 0 — baseline and triage

- [ ] Classify every open Dependabot PR as patch/minor, major-compatible, breaking migration, defer, or reject.
- [ ] Capture CI duration, production build, Playwright smoke, bundle-size, and Rust/WASM benchmark baselines.
- [ ] Add golden/replay fixtures for persisted formats and public/internal APIs where needed.
- [ ] Record breaking changes, migration notes, benchmark impact, rollback, and replacement opportunities for each major migration.

## Wave 1 — low-risk maintenance

Candidates: #291 and #290.

- [ ] #291: validate `colord` numerical changes where CIEDE2000/hue semantics are observable; validate `ws` behavior and security regression coverage.
- [ ] #290: validate TypeScript-ESLint, Vitest/coverage, Marked, Vite, and Vitest patch/minor updates; compare test runtime and build output to baseline.
- [ ] Merge only after CI, CodeQL, dependency review, and Copilot review are clean.

## Wave 2 — GitHub Actions / CI platform

Candidates: #295–#299.

- [ ] Upgrade Pages/configure/deploy/upload/download/cache actions one subsystem at a time.
- [ ] Validate `download-artifact` digest mismatch and decompression behavior.
- [ ] Confirm Pages permissions remain least-privilege.
- [ ] Confirm Node 24 runner requirements are satisfied.
- [ ] Review workflow scripts for maintained Actions that can replace hand-written orchestration.

## Wave 3 — Rust scientific/data foundations

Candidates: #285–#289.

Suggested sequence: `sha2` → `getrandom` → `statrs` → `petgraph` → `ndarray`.

- [ ] `sha2` 0.10 → 0.11: prove canonical hashes/golden fixtures remain stable where the contract is unchanged.
- [ ] `getrandom` 0.2 → 0.4: validate browser/WASM entropy and separation from deterministic seeded research paths.
- [ ] `statrs` 0.17 → 0.19: test distribution boundaries, inverse-CDF behavior, NaN/Inf handling, order statistics, and analytical parity.
- [ ] `petgraph` 0.6 → 0.8: validate graph ordering, stable identity, traversal, serialization/replay, and Memory Palace performance.
- [ ] `ndarray` 0.15 → 0.17: validate layout/stride/view semantics, WASM footprint, and numerical parity.
- [ ] After each upgrade, audit bespoke statistics, graph traversal, array operations, hashing, and RNG glue for mature-library replacements.

## Wave 4 — development toolchain majors

Candidates: #294 and #293.

- [ ] #294: migrate ESLint/@eslint/js 10 deliberately; account for changed recommended rules, removed deprecated APIs, Node requirements, and config semantics.
- [ ] #293: treat TypeScript 7 as a compiler/module-resolution migration; validate emitted declarations, WASM bindings, module resolution, editor/tooling compatibility, and public type contracts.
- [ ] Audit hand-written static checks, guards, and build scripts for replacement by maintained compiler/linter/tooling capabilities.
- [ ] Ensure test/build runtime does not regress materially.

## Wave 5 — rendering/WebXR

Candidate: #292 (`three` 0.168 → 0.185.x).

- [ ] Audit skipped Three.js releases and breaking behavior.
- [ ] Validate loaders, raycasting, transforms, materials, instancing, BVH, WebXR lifecycle, controllers/hands, and render loop.
- [ ] Capture frame-time, draw-call, memory, and bundle-size deltas.
- [ ] Test representative desktop and headset/WebXR paths.
- [ ] Audit custom geometry/raycasting/instancing/BVH/WebXR helpers for replacement by maintained APIs where parity/performance are proven.
- [ ] Preserve NIL and Nemosyne spatial semantics.

## Hand-rolled replacement audit

For every replacement candidate, record existing purpose, candidate library/API, semantic differences, dependency/size cost, performance comparison, parity evidence, migration path, and rollback.

Audit these areas:

- [ ] Statistical distributions, selection/quantiles, distances, and sampling.
- [ ] Graph traversal/search/connectivity/ordering helpers.
- [ ] Array/view/aggregation machinery duplicated by `ndarray`.
- [ ] Hashing/encoding helpers.
- [ ] RNG/entropy wrappers, preserving deterministic replay.
- [ ] Three.js geometry/raycasting/instancing/BVH/WebXR helpers.
- [ ] Build/artifact/cache/deployment scripts duplicated by maintained Actions/Vite features.
- [ ] General parsers/validators/serialization helpers where replacement does not weaken scientific provenance.

## Exit criteria

- [ ] Every high-value major upgrade is merged, deliberately deferred with rationale, or rejected.
- [ ] Normal CI/build/smoke/security gates pass.
- [ ] Scientific/Rust migrations have numerical/parity evidence.
- [ ] Three.js/WebXR migration has runtime/performance evidence.
- [ ] Replacement audit is complete with migrate-or-retain decisions.
- [ ] Removed custom code leaves no duplicate authority path.
- [ ] No material regression in large-dataset/Rust-WASM benchmarks.
