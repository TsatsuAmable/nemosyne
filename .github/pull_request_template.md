## Summary

Describe what changed and why. Keep this focused on user, investigator, scientific, security, or engineering impact.

## Programme / finding

Name the roadmap workstream, RF finding, or bounded maintenance goal advanced by this PR. If none applies, state the concrete engineering reason for the change.

## Risk surface

Check every area materially affected by this change:

- [ ] Analytical / statistical correctness
- [ ] Rust ↔ WASM ↔ TypeScript boundary
- [ ] Dataset ingest, identity, serialization, or reproducibility
- [ ] WebXR / VR interaction or spatial UI
- [ ] Rendering performance or large-dataset performance
- [ ] Security, privacy, permissions, or untrusted input
- [ ] Build, CI, deployment, dependencies, or supply chain
- [ ] Documentation / engineering governance
- [ ] None of the above

For checked areas, briefly state the main failure mode considered and how it was mitigated.

## Adversarial implementation contract

Follow the risk classification in `AGENTS.md`. **Select exactly one** of the following:

- [ ] **High-risk change:** a production/evidence authority or other high-risk boundary is affected. The pre-implementation adversarial contract below was completed before implementation, and a distinct post-implementation adversarial review is required.
- [ ] **Standard-risk change:** behavior changes without crossing a high-risk authority/evidence boundary. No formal pre-review is required; focused verification plus one bounded post-implementation falsification pass is required.
- [ ] **Low-risk exemption:** this change is purely editorial/formatting/comment-only or demonstrably mechanical with unchanged semantics. Explain why below.

Selecting more than one or none is not a valid disposition for an implementation PR.

### High-risk pre-implementation adversarial contract

For high-risk changes only, record the design contract that existed before implementation:

- **Invariant:** What exact property must be true when the change is correct?
- **Authority / production path:** Which canonical owner and real entry point/call path must enforce it?
- **Primary failure modes:** How could this design silently corrupt data, drift authority, mislead the investigator, fail at scale/recovery, or pass tests while production remains wrong?
- **Falsifying evidence:** Which tests/checks would disprove the design if those assumptions are false?
- **Non-goals / dependencies:** What is deliberately out of scope, and which downstream claims must not be promoted by this PR?

For a standard-risk change, state the intended behavior and primary failure mode in the risk-surface section instead. For a low-risk exemption, state the exemption reason there.

## Architecture governance

- [ ] This change does not alter a durable architecture/trust/public-format decision.
- [ ] An existing ADR governs this change: `ADR-____`.
- [ ] This change requires/implements an RFC or new ADR; link it here.

Follow `docs/RFC_PROCESS.md` for the small set of changes that require an RFC. If a high-risk pre-implementation review reveals that a bounded fix actually changes a governed architecture/trust/scientific/public-format/interaction boundary, stop and use the RFC/ADR process before implementation.

## Focused verification

Run the smallest ownership-aligned checks that prove this PR's claims. The full suite, broad coverage, device/browser matrix, fuzzing, and deep performance validation belong at integration/milestone checkpoints unless the PR directly changes those surfaces.

- [ ] Typecheck / compile checks relevant to changed code
- [ ] Focused affected tests
- [ ] Rust tests when Rust-owned behavior changed
- [ ] Focused JS/WASM boundary tests when the boundary changed
- [ ] Production-path test for a claimed runtime/security/scientific property
- [ ] Relevant build or WebXR/browser smoke test when that surface changed
- [ ] Benchmark/performance evidence when a hot path materially changed
- [ ] `npm run docs:check` when governance/canonical docs changed

List the exact commands/checks run and their results. For high-risk work, connect the evidence back to the failure modes in the adversarial contract. For standard-risk work, show that the changed behavior and its nearest production path were exercised.

## Correctness evidence

What invariant, expected behavior, or acceptance criterion demonstrates that this change is correct rather than merely non-crashing?

## Post-implementation adversarial review

Required for **high-risk** and **standard-risk** implementation changes. Keep standard-risk review compact; the purpose is falsification, not ceremony.

- **Production path attacked:** What real call path/boundary or changed behavior was re-reviewed?
- **Failure mode exercised:** What plausible failure was checked and what happened?
- **Newly inferred failure mode:** Required for high-risk work; optional for standard-risk work when one is material.
- **Test falsifiability:** Why would the relevant regression/boundary tests fail if the forbidden behavior returned?
- **Disposition:** Which `BLOCKER` findings were fixed? Which valid findings were `DEFER`red or left as `SUGGESTION`?
- **Completion/status check:** Does the implementation/evidence really satisfy the roadmap/PR claim, or should it remain `IMPLEMENTATION PARTIAL` / `IMPLEMENTATION LANDED / REVIEW ACTIVE`?

Record the useful result here. Do **not** create a standalone `docs/review*` file merely to prove that this pass happened. Separate review artifacts are for durable programme/research evidence, milestone/finding closure, or future audit needs.

Use independent review when it adds a genuinely different challenge. Multiple reviewers should attack materially different failure classes rather than repeat the same general review.

## Review disposition

Review findings use the project-wide policy in `.github/copilot-instructions.md`:

- **BLOCKER** - demonstrated correctness, security/privacy, reproducibility/data-integrity, analytical-authority, material performance, required-process, or required-gate failure. Fix before merge.
- **DEFER** - valid work that does not invalidate this change. Track it without recursively expanding the PR.
- **SUGGESTION** - optional improvement with no demonstrated failure mode.

Call out deliberate tradeoffs and known deferred work. Reviewers should stay inside the declared scope unless they identify a blocker to the changed path.