# PR Auto Remediation

Automatic PR mutation is currently **disabled**. `.github/workflows/pr-auto-remediation.yml` is a manual, read-only stub and does not react to reviews or CI failures, post comments, commit changes, or push to PR branches.

This is deliberate during the Moneta migration-completion sprint. Automatic review/fix loops were creating extra pushes, repeated Copilot reviews, repeated CI starts, and scope expansion from non-blocking findings.

## Current operating model

1. Required CI and architecture gates remain authoritative.
2. Copilot review remains useful for early defect discovery, but findings are classified as `BLOCKER`, `DEFER`, or `SUGGESTION` according to `.github/copilot-instructions.md`.
3. Only blocker-class findings interrupt the active migration slice.
4. Valid non-blocking findings are recorded for pre-preview or hardening work instead of spawning automatic code changes.
5. A PR may merge when required gates are green and all blocker findings have been dispositioned. Non-blocking review ideas do not require implementation in the current PR.

## Why automatic review remediation is paused

A review-triggered write creates a feedback loop:

`push -> review -> auto-fix push -> CI/re-review -> new comment -> auto-fix push`

Even when every individual suggestion is reasonable, that loop can reduce throughput and continuously widen PR scope. During migration completion, preserving one implementation thread and one semantic authority is more valuable than opportunistically polishing every adjacent subsystem.

## Future re-enablement criteria

Do not re-enable automatic mutation merely because credentials are available. A replacement workflow should first prove that it can:

- act only on blocker-class findings with a concrete failure mode;
- ignore or track `DEFER` and `SUGGESTION` findings without modifying the branch;
- avoid repeated review/fix cycles on the same semantic issue;
- run focused ownership-aligned verification rather than the full repository suite for every small edit;
- preserve the Rust/WASM analytical-authority invariant;
- never modify workflow/ruleset, dependency, secret/authentication, or deployment policy automatically;
- cap remediation attempts and fail closed to human inspection.

CI-failure remediation may be reconsidered separately because a required failing gate is already blocker-class by definition. It should still use a bounded attempt count and the smallest verification set capable of proving the fix.

## Migration completion policy

The executable cadence and migration ledger live in `docs/MONETA_MIGRATION_COMPLETION_SPRINT.md`. After that sprint is complete, this policy can be revisited as part of pre-preview hardening.