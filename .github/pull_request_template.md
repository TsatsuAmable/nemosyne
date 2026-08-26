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

Follow the risk classification in `AGENTS.md`.

- [ ] **High-risk change:** the pre-implementation adversarial contract below was completed before implementation.
- [ ] **Low-risk exemption:** this change is purely editorial/formatting/comment-only or demonstrably mechanical with unchanged semantics. Explain why below.

### Pre-implementation adversarial contract

For high-risk changes, record the design contract that existed before implementation:

- **Invariant:** What exact property must be true when the change is correct?
- **Authority / production path:** Which canonical owner and real entry point/call path must enforce it?
- **Primary failure modes:** How could this design silently corrupt data, drift authority, mislead the investigator, fail at scale/recovery, or pass tests while production remains wrong?
- **Falsifying evidence:** Which tests/checks would disprove the design if those assumptions are false?
- **Non-goals / dependencies:** What is deliberately out of scope, and which downstream claims must not be promoted by this PR?

For a low-risk exemption, state the reason here instead.

## Architecture governance

- [ ] This change does not alter a durable architecture/trust/public-format decision.
- [ ] An existing ADR governs this change: `ADR-____`.
- [ ] This change requires/implements an RFC or new ADR; link it here.

Follow `docs/RFC_PROCESS.md` for the small set of changes that require an RFC. If the pre-implementation adversarial review reveals that a bounded fix actually changes a governed architecture/trust/scientific/public-format/interaction boundary, stop and use the RFC/ADR process before implementation.

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

List the exact commands/checks run and their results. For high-risk work, connect the evidence back to the failure modes in the adversarial contract.

## Correctness evidence

What invariant, expected behavior, or acceptance criterion demonstrates that this change is correct rather than merely non-crashing?

## Post-implementation adversarial review

For high-risk changes, complete a distinct adversarial pass after focused verification and before claiming completion.

- **Production path attacked:** What real call path/boundary was re-reviewed?
- **Original failure modes:** What happened when the pre-implementation failure cases were exercised?
- **Newly inferred failure mode:** What additional way could the final implementation fail that was not in the original plan, and how was it checked?
- **Test falsifiability:** Why would the relevant regression/boundary tests fail if the forbidden behavior returned?
- **Disposition:** Which `BLOCKER` findings were fixed? Which valid findings were `DEFER`red or left as `SUGGESTION`?
- **Completion/status check:** Does the implementation/evidence really satisfy the roadmap/PR claim, or should it remain `IMPLEMENTATION PARTIAL` / `IMPLEMENTATION LANDED / REVIEW ACTIVE`?

Prefer an independent reviewer/agent for this pass when available. Green CI alone is not the post-implementation adversarial review.

## Review disposition

Review findings use the project-wide policy in `.github/copilot-instructions.md`:

- **BLOCKER** - demonstrated correctness, security/privacy, reproducibility/data-integrity, analytical-authority, material performance, required-process, or required-gate failure. Fix before merge.
- **DEFER** - valid work that does not invalidate this change. Track it without recursively expanding the PR.
- **SUGGESTION** - optional improvement with no demonstrated failure mode.

Call out deliberate tradeoffs and known deferred work. Reviewers should stay inside the declared scope unless they identify a blocker to the changed path.
