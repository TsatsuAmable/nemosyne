# Nemosyne Copilot review instructions

Project-wide engineering invariants are defined in `AGENTS.md`. Review Nemosyne as a correctness-first scientific/WebXR product, not as a generic web application. Prefer high-confidence findings that can change results, security, reproducibility, performance, or investigator understanding. Avoid style-only comments when lint/format tooling already covers them.

Every review finding must begin with exactly one disposition:

- **BLOCKER:** must be fixed before merge because it demonstrates a concrete correctness, security/privacy, reproducibility/data-integrity, analytical-authority, material performance, required-process, or required-gate failure.
- **DEFER:** valid work that should be tracked but does not invalidate the current change.
- **SUGGESTION:** optional improvement with no demonstrated failure mode.

Do not use blocking language for speculation, naming/style preferences, broad refactors, future-proofing, optional diagnostics, or test expansion without a demonstrated risk. Prefer silence over low-confidence review noise and do not repeat an existing finding in a new form.

## Adversarial implementation protocol review

Apply the pre/post adversarial implementation protocol from `AGENTS.md` to implementation PRs.

For a high-risk change, verify that the PR or linked working material identifies:

- the invariant the change is intended to establish or preserve;
- the canonical authority and real production path that must enforce it;
- concrete failure modes that could make the implementation plausible but wrong;
- falsifying tests/checks at the cheapest authoritative layer;
- non-goals/dependencies that prevent the tranche from overclaiming completion; and
- a post-implementation adversarial disposition describing what was attacked after implementation, blockers fixed, and valid residuals deferred.

A missing or content-free adversarial contract on high-risk work is a required-process failure. Do not accept checkbox text that merely paraphrases the implementation. The contract must be capable of falsifying the design.

For a claimed low-risk exemption, verify that the change is genuinely editorial, formatting-only, comment-only, or mechanically non-semantic. If the diff affects runtime behavior, authority, evidence, persistence, security, performance, or interaction semantics, the exemption is invalid.

The post-implementation pass should attack the final production call path and test strength. Look specifically for a failure mode that the original pre-review did not anticipate. Green CI does not substitute for this review.

## Review priorities

1. **Production-path enforcement**
   - Apply the production-path evidence rule from `AGENTS.md`.
   - Flag security, privacy, recovery, concurrency, persistence, UX, or scientific claims that are proved only by unused helpers, mocks, or isolated modules while the live entry point takes another path.

2. **Correctness before convenience**
   - Flag silent fallback, lossy coercion, invalid defaulting, swallowed errors, and behavior that converts invalid analytical state into plausible-looking output.
   - Require deterministic behavior where outputs are intended to be reproducible.
   - Treat NaN, infinity, malformed values, cycles, invalid schemas, missing identifiers, and partial data as explicit boundary cases.

3. **Rust owns analytical authority and scale-sensitive work**
   - Flag analytical algorithms, dataset-wide transforms, statistical computations, ranking/scoring logic, or large-data reductions independently implemented in TypeScript when Rust/WASM owns the semantics.
   - Flag duplicated JS/Rust implementations that can drift.
   - Call out row-major rematerialization, repeated serialization, full-dataset cloning, or avoidable JS↔WASM crossings on hot paths.

4. **Statistical and scientific validity**
   - Treat confidence, significance, probability, fit, uncertainty, effect, density, manifold, and similar terms as scientific claims.
   - Check measurement scale, missingness, grouping, circular/compositional structure, dependence, multiple testing, sample-size limits, and approximation semantics where relevant.
   - Prefer explicit provenance and assumptions over opaque heuristic scores.

5. **Reproducibility and investigation integrity**
   - Flag hidden runtime state, unstable ordering, non-versioned defaults, or non-recorded transformations that affect an investigation.
   - Preserve durable dataset/entity identity across ingest, analysis, representation, interaction, save/export, and replay.

6. **WebXR / spatial UX fitness**
   - Review immersive interactions for locomotion comfort, orientation, reachability, occlusion, depth legibility, controller/hand behavior, and desktop fallback.
   - Flag flat-screen assumptions on immersive paths and persistent 3D clutter without investigator utility.

7. **Security and privacy**
   - Treat datasets, investigation files, network messages, and dev-ingest endpoints as untrusted boundaries.
   - Flag unsafe rendering/deserialization, privilege fail-open behavior, replay weaknesses, path/URL injection, prototype pollution, excessive permissions, secrets exposure, and unbounded resource consumption.
   - Keep GitHub Actions permissions least-privilege and scrutinize unnecessary third-party runtime trust.

8. **Performance regressions**
   - Pay attention to O(n²+) work, allocations in large loops, repeated parsing/serialization, copies, main-thread blocking, render-loop work, draw calls, and WASM boundary chatter.
   - Require benchmark or resource evidence when a change materially affects a dataset, Worker, WASM, or XR hot path.

9. **Tests as executable contracts**
   - Require regression coverage for blocker-class bug fixes when feasible.
   - Prefer boundary, property, differential, invariant, and real production-path tests over snapshots or mock-only existence proofs.
   - For JS/Rust boundaries, tests should prove one semantic authority rather than two implementations agreeing accidentally.
   - Check that the tests would fail if the failure mode named in the pre-implementation adversarial contract were reintroduced.

## Scope

Review the PR's declared scope. When a broader problem is discovered, report the smallest useful evidence and classify it for later work instead of recursively expanding the PR, unless it is a blocker to the changed path.
