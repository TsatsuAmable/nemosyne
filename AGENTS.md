# Nemosyne engineering agent contract

This is the canonical tool-neutral engineering contract for AI-assisted work in this repository. Tool-specific files such as `CLAUDE.md` and `.github/copilot-instructions.md` must defer to this file instead of restating project facts.

## Sources of truth

Read these in order when they are relevant:

1. `docs/Nemosyne_Definitive_Vision_and_Roadmap.md` - product, research, and architecture direction.
2. `docs/ROADMAP.md` - live implementation status, current Streams A-D, collision rules, review findings, and programme order.
3. `docs/ARCHITECTURE.md` - current technical reference, subordinate to the governing vision while migration is active.
4. Executable configuration - `package.json`, `.github/workflows/*.yml`, `vitest*.config.ts`, `rust-toolchain.toml`, and source code are authoritative for commands, versions, thresholds, and runtime behavior.
5. `governance/production-capabilities.json` and `governance/production-readiness.json` - machine-readable production capability classification plus desired service/deployment/test-readiness obligations; these are subordinate to `docs/ROADMAP.md` for sequencing and completion claims.
6. `docs/PROJECT_DOCS_INDEX.md` and `docs/DOCS_MANIFEST.json` - documentation authority and lifecycle.

**Executable configuration wins over duplicated prose facts.** Do not copy dependency versions, coverage thresholds, CI job topology, test counts, or other machine-readable values into agent instructions. If prose conflicts with executable configuration, fix or archive the prose.

## Mandatory engineering boundaries

1. **Vision alignment:** changes must align with the governing vision. Material alternatives or direction changes must be surfaced explicitly rather than slipped into implementation.
2. **Feature branch and PR discipline:** live-check remote `main` before starting implementation, never push directly to `main`, develop on a focused branch, verify the claims, re-check remote `main` before raising or finalizing the PR, and sync/reconcile drift when necessary.
3. **Rust/WASM analytical authority:** Rust/WASM owns canonical analytical data, N-dependent analysis, statistical/scientific computation, topology, clustering, and scale-sensitive reductions. TypeScript owns orchestration, interaction, persistence adapters, and rendering. Do not add a shadow analytical implementation or silent JavaScript fallback.
4. **Runtime-local handles are capabilities:** a WASM handle belongs only to the runtime instance that created it. Cross-runtime identity uses durable fingerprints and explicit registration.
5. **Scientific honesty:** names such as confidence, significance, probability, density, manifold, uncertainty, or fit must match the mathematics actually computed. Missing/invalid values must not silently become legitimate numeric observations.
6. **Reproducibility:** investigator-visible transformations, analytical decisions, approximation/refusal outcomes, and model identity must remain deterministic or explicitly provenance-bearing.
7. **Fail closed at trust boundaries:** malformed, ambiguous, stale, replayed, unsupported, or untrusted input must not silently become a more privileged or scientifically plausible state.

## Production-path evidence rule

A product property is not considered landed merely because an isolated helper, mock, module, or unit test demonstrates it. When a property governs a production path, evidence must exercise the real production entry point and the authoritative call graph or boundary responsible for enforcing it.

This applies to security, correctness, scientific semantics, privacy/compliance, performance, recovery, concurrency, provenance, persistence, and UX state. Unit tests remain necessary, but they are not sufficient evidence for a shipped-capability claim.

## Adversarial implementation protocol

The assurance burden is **risk-tiered**. The goal is to spend review effort where it can expose a distinct failure class, not to manufacture multiple copies of the same confidence signal.

Every implementation PR must classify itself as **high-risk**, **standard-risk**, or **low-risk exemption**. The classification controls review depth; required CI and exact-head merge protection remain independent of this classification.

### Risk classification

A **high-risk** change is one that touches any of the following, closes a blocker/high review finding, or could plausibly create an undetected correctness or evidence failure at one of these boundaries:

- analytical, statistical, scientific, measurement, Moneta, or representation semantics;
- Rust/WASM/TypeScript authority, ABI, data ownership, or cross-runtime boundaries;
- dataset identity, graph/topology preservation, serialization, persistence, provenance, export/import, digest, or replay;
- security, privacy, authentication/authorization, untrusted input, supply-chain trust, or public network/persistence formats;
- worker/concurrency, recovery, lifecycle generations, cancellation, stale-state handling, or durable mutation;
- large-N complexity, memory/resource envelopes, copies/transfers, rendering hot paths, or performance claims;
- WebXR input, Direct Touch/grab, controller/hand/mouse semantic parity, locomotion, persistent spatial UI, accessibility, or other core interaction grammar;
- an architectural/trust/public-format decision that may require an RFC/ADR;
- a change to required merge gates, promotion authority, evidence attribution, or other machinery whose failure could falsely report an unsafe change as verified.

A **standard-risk** change alters behavior but does not cross one of the high-risk boundaries above. Typical examples are bounded product/UI behavior, ordinary internal refactors with semantic change, maintainability fixes, non-authoritative tooling, or CI/documentation workflow changes that cannot weaken a required safety property. Standard-risk work does **not** require a pre-implementation adversarial contract. It does require focused verification and one post-implementation adversarial pass aimed at falsifying the changed behavior.

Purely editorial prose, formatting-only changes, comments, or demonstrably mechanical refactors with unchanged semantics may use a **low-risk exemption**. The PR must state why the exemption is safe. Low-risk exemptions do not require a formal adversarial pass beyond ordinary diff inspection and applicable automated checks.

If risk is uncertain, choose the higher tier. Do not elevate standard work merely because a template makes high-risk review convenient; risk classification should reflect the changed production/evidence boundary.

### High-risk pre-implementation adversarial contract

Before writing the implementation for high-risk work, record a compact contract in working notes or the PR description containing:

1. **Invariant:** the exact property that must be true when the change is correct.
2. **Authority and production path:** which layer owns the truth and which real entry point/call path must enforce it.
3. **Failure modes:** the most plausible ways the design could silently corrupt data, drift authority, mislead the investigator, fail at scale, fail during recovery, or pass tests while production remains wrong.
4. **Falsifying evidence:** the cheapest authoritative tests/checks that would disprove the design if those assumptions are false. Prefer writing or identifying these before implementation.
5. **Non-goals/dependencies:** what this change deliberately does not solve and which upstream/downstream claims must not be promoted by it.

If the pre-review reveals that the planned fix requires a material architecture, trust, scientific-semantics, public-format, or interaction-grammar change, stop and follow the RFC/ADR process before implementation.

### Post-implementation adversarial review

For **high-risk** work, perform a distinct post-implementation adversarial pass after focused verification. For **standard-risk** work, perform one bounded falsification pass after implementation; a pre-review is not required.

The pass should:

- compare the diff and real production call path against the intended behavior rather than against the code's own abstractions;
- actively try the known failure modes and, for high-risk work, at least one newly inferred failure mode;
- inspect whether tests would fail if the forbidden behavior were reintroduced and whether mocks are being mistaken for production evidence;
- check authority, output identity, provenance, failure semantics, lifecycle/recovery, complexity/peak memory, and user-visible semantics where applicable;
- classify discovered items as `BLOCKER`, `DEFER`, or `SUGGESTION`; fix blockers before merge and record valid deferred work without recursively expanding scope;
- reclassify roadmap/completion claims downward when the evidence does not support them.

Record the useful result in the PR body. A standalone `docs/review*` artifact is warranted only when the review itself is durable programme/research evidence, closes a named milestone/finding, or must be cited independently later. Do not create a review file merely to prove that a review happened.

Use an independent reviewer/agent when the risk or claimed evidence benefits from independent challenge. Multiple reviewers are useful only when they attack materially different failure classes, for example security plus statistical validity, or XR interaction plus persistence/replay. Repeating substantially the same generalist review is not an additional assurance requirement.

A green CI run does not substitute for the required adversarial pass on high-risk or standard-risk implementation work.

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

During iteration, run the smallest ownership-aligned checks that can disprove the current change quickly. For high-risk work, derive those checks from the pre-implementation adversarial contract. For standard-risk work, target the changed behavior and its nearest production path. Before claiming completion, obtain the required production-path and CI evidence for the affected risk surface and complete the review required by the selected risk tier. Do not weaken tests, coverage, assertions, or architecture simply to obtain a green run.

## Current four-stream operating model

The active implementation topology is defined in `docs/ROADMAP.md`. The previous A/B/C execution wave is complete; historical files keep their original stream labels for provenance and must not be treated as current ownership.

- **Stream A - Progressive Disclosure & Semantic Drill-down:** owns the generic structure/region/group -> bounded observation subset -> datum/provenance contract and production transition semantics. It is the shared semantic integration spine.
- **Stream B - Source-Authoritative Structural Representations:** owns representation-specific source graph/hierarchy/temporal/geospatial/spectral scientific contracts, Rust/WASM payloads and thin adapters. It must consume Stream A's generic drill-down contract rather than invent a competing one.
- **Stream C - Visible Investigator Product Convergence:** owns product shell/world-object presentation, epistemic-object usefulness, state legibility and desktop/XR task parity. It consumes analytical truth and may not infer scientific facts from visual presentation.
- **Stream D - Assurance & Private-Preview Readiness:** owns Quest validation operations plus the unresolved security/privacy/supply-chain/WASM assurance work and later qualification/production-readiness gates. The legacy file `docs/STREAM_C_SECURITY_ASSURANCE.md` is now a Stream D subordinate finding set despite its historical name.

Default concurrency is one open implementation PR per current stream. Stream D may use disjoint QV and security-assurance sub-lanes only when changed-file sets and governance contracts do not collide. Shared integration files named in `docs/ROADMAP.md` are exclusive integration seams: do not create competing versions of the same generic contract across branches.

Independent adversarial review is **cross-cutting process, not a fifth stream**. Each stream must obtain the review/evidence required by its checkpoint and risk tier before promotion.

Use the status vocabulary defined in `docs/ROADMAP.md`. `VERIFIED COMPLETE` requires implementation plus the programme-specific evidence and independent review disposition where the programme explicitly requires independence.

## Documentation discipline

- `docs/PROJECT_DOCS_INDEX.md` defines human-facing authority; `docs/DOCS_MANIFEST.json` is the machine-readable lifecycle map.
- Historical reports and superseded plans belong under `docs/archive/`; historical stream names in retained review/evidence documents are provenance, not live ownership.
- Do not create a new status document when the information belongs in `ROADMAP.md`, the findings ledger, an ADR, or an existing technical reference.
- Do not duplicate executable facts in prose. Link to the source instead.
- Update `docs/ROADMAP.md` only when execution status, programme sequencing, a durable finding, or a claimed completion state actually changes. Routine implementation activity, verification detail, and review narration belong in the PR rather than creating roadmap churn.
- Create standalone review/review-plan documents only when they are durable evidence needed by a programme, research treatment, milestone/finding closure, or future audit. Ordinary standard-risk review belongs in the PR body.
- Service/deployment/test-readiness debt belongs in `governance/production-readiness.json`. Any PR that adds or materially changes a service boundary, production capability requiring a service, deployment dependency, or verification obligation must update that registry and regenerate `docs/PRODUCTION_READINESS.md`; deferral must be explicit rather than omitted.
- Any change to a canonical document, agent contract, CI policy, or documentation authority must pass `npm run docs:check`.
- When touching stale documentation, update it or clearly subordinate its status to `docs/ROADMAP.md` rather than preserving contradictory operational truth.

## Review and handoff discipline

- Review diffs and production call paths, not just newly introduced helpers.
- For high-risk changes, handoff/PR material must contain the pre-implementation adversarial contract, verification evidence, post-implementation adversarial disposition, and honest residual risk.
- For standard-risk changes, handoff/PR material needs the risk classification, focused verification, one bounded adversarial disposition, and any material residual risk. Do not require a separate review-plan/review document.
- For low-risk exemptions, state why semantics and required evidence are unchanged.
- Prefer one high-confidence finding over several speculative comments.
- Block merges for demonstrated correctness, security, reproducibility, authority, material performance, required-process, or required-gate failures. Track valid non-blocking work without recursively expanding PR scope.
- Record exact verification evidence and honest residual risk. Never fabricate a pass or treat a skipped/unrun check as green.
- Keep PRs narrow enough that the required review can reason about the semantic change.

## Local-only agent configuration

Local `.agents/`, `.claude/`, and `.ai/` directories may contain harness/model-routing details and are not repository authority. They must not override this contract, the governing vision, the live roadmap, or executable configuration.