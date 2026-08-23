# Nemosyne Copilot review instructions

Review Nemosyne as a correctness-first scientific/WebXR product, not as a generic web application. Prefer high-confidence findings that can change results, security, reproducibility, performance, or investigator understanding. Avoid style-only comments when lint/format tooling already covers them.

## Moneta migration completion mode

Until `docs/MONETA_MIGRATION_COMPLETION_SPRINT.md` is complete, protect migration cadence. A review comment blocks progress only when it demonstrates at least one of these failure modes:

- incorrect or non-deterministic analytical/representation results;
- a security, privacy, data-integrity, or reproducibility defect;
- a Rust/WASM authority violation, including a scale-sensitive JavaScript fallback or duplicate analytical implementation;
- a Draco compatibility change that creates a second implementation or breaks a required compatibility surface;
- a material large-dataset or XR hot-path regression;
- a required test, build, type, lint, architecture, or integration gate failure.

Valid findings outside that set should not expand the current PR. Classify them as deferred work unless the fix is trivial, local, and cannot trigger another architectural or dependency change.

Every review finding must begin with exactly one disposition:

- **BLOCKER:** must be fixed before merge because it demonstrates one of the failure modes above.
- **DEFER:** valid work that should be tracked for pre-preview/hardening but must not block the current migration slice.
- **SUGGESTION:** optional improvement with no demonstrated failure mode.

Do not use blocking language for speculation, naming/style preferences, broad refactors, future-proofing, additional diagnostics, or optional test expansion. Prefer silence over low-confidence review noise. Do not repeat an existing finding in a new form.

## Review priorities

1. **Correctness before convenience**
   - Flag silent fallback, lossy coercion, invalid defaulting, swallowed errors, and behavior that converts an invalid analytical state into a plausible-looking result.
   - Require deterministic behavior where output is intended to be reproducible.
   - Treat NaN, infinity, malformed values, cycles, invalid schemas, missing identifiers, and partial data as explicit boundary cases.

2. **Rust owns analytical authority and scale-sensitive work**
   - Flag new analytical algorithms, dataset-wide transforms, statistical computations, ranking/scoring logic, or large-data loops implemented independently in TypeScript when a Rust/WASM authority exists or is expected.
   - Flag duplicated JS/Rust implementations that can drift semantically.
   - Prefer zero-copy/columnar or bounded-copy data paths for large datasets. Call out row-major rematerialization, repeated serialization, full-dataset cloning, or avoidable JS↔WASM crossings on hot paths.

3. **Statistical and scientific validity**
   - Treat values named confidence, significance, probability, fit, uncertainty, effect, or similar as scientific claims. Flag unsupported or uncalibrated labels.
   - Check that measurement scale, missingness, grouping, circular/compositional structure, dependence, multiple testing, and sample-size limits are respected where relevant.
   - Prefer explicit provenance and assumptions over opaque heuristic scores.

4. **Reproducibility and investigation integrity**
   - Flag changes that make an investigation depend on hidden runtime state, unstable ordering, non-versioned defaults, or non-recorded transformations.
   - Preserve stable row/entity identity across ingest, analysis, representation, interaction, save/export, and reload.
   - Changes to memory-palace/investigation serialization must remain versionable, portable, and deterministic.

5. **WebXR / spatial UX fitness**
   - Review VR interactions for locomotion comfort, spatial orientation, reachability, occlusion, depth legibility, controller/hand parity where applicable, and graceful desktop fallback.
   - Flag UI that assumes a flat-screen interaction model when the affected flow is used in immersive mode.
   - Prefer progressive disclosure over persistent visual clutter in 3D space.

6. **Security and privacy**
   - Treat imported datasets and investigation files as untrusted input.
   - Flag unsafe HTML/Markdown rendering, path/URL injection, prototype pollution, excessive permissions, exposed secrets, unsafe deserialization, and unbounded resource consumption.
   - Keep GitHub Actions permissions least-privilege and call out unpinned or unnecessarily privileged third-party automation.

7. **Performance regressions**
   - Pay special attention to O(n²) work, allocations inside large loops, repeated parsing/serialization, unnecessary copies, main-thread blocking, render-loop work, excessive draw calls, and WASM boundary chatter.
   - For changes on dataset or render hot paths, require a benchmark or measurable performance evidence only when complexity or allocation behavior materially worsens.

8. **Tests as executable contracts**
   - Require a regression test for blocker-class bug fixes when feasible.
   - Prefer boundary, property, differential, and invariant tests over snapshots for analytical behavior.
   - Flag tests that merely mirror the implementation, assert only non-crashing behavior, depend on timing, or fail to distinguish the intended invariant from a plausible wrong result.
   - For JS/Rust boundary behavior, look for parity tests that prove one semantic authority rather than two implementations agreeing accidentally.

## Review severity and scope

Use blocking language only for **BLOCKER** findings. A blocker must name the concrete failure mode and the smallest affected scope. **DEFER** findings should state why they can safely wait; **SUGGESTION** findings must never imply that merge is unsafe.

Review the PR's declared scope, not every adjacent subsystem. Do not turn a focused migration PR into a repository-wide audit. When a broader issue is discovered, report the smallest useful evidence and classify it for later work instead of recursively expanding scope.

Prefer one strong finding over several weak variations of the same point.