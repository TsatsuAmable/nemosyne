# PR Auto Remediation

Automatic PR mutation is currently **disabled**. This is an engineering-safety policy, not a migration-specific exception.

The governing project contract is `AGENTS.md`; review dispositions are defined in `.github/copilot-instructions.md`.

## Current operating model

1. Required CI and architecture gates remain authoritative evidence.
2. Review findings are classified as `BLOCKER`, `DEFER`, or `SUGGESTION`.
3. Only blocker-class findings should automatically interrupt the active implementation slice.
4. Valid non-blocking findings are recorded in the appropriate roadmap/findings stream rather than spawning branch mutations.
5. A PR may merge only when required gates are green and blocker findings have been dispositioned; green CI alone does not imply `VERIFIED COMPLETE`.

## Why automatic mutation remains disabled

A review-triggered write can create a feedback loop:

`push -> review -> auto-fix push -> CI/re-review -> new comment -> auto-fix push`

Even when individual suggestions are reasonable, that loop can reduce throughput, widen scope, and repeatedly consume CI. Nemosyne instead keeps remediation bounded and independently reviewable.

## Re-enablement criteria

Do not enable automatic mutation merely because credentials are available. A future workflow must first prove that it can:

- act only on blocker-class findings with a concrete failure mode;
- ignore or track `DEFER` and `SUGGESTION` findings without modifying the branch;
- deduplicate semantically equivalent findings;
- run focused ownership-aligned verification before full fan-in;
- preserve Rust/WASM analytical authority and production-path evidence requirements;
- never automatically modify workflow/ruleset, dependency, secret/authentication, or deployment policy;
- cap remediation attempts and fail closed to human inspection;
- record exactly what it changed and which checks were rerun.

CI-failure remediation may be reconsidered separately because a required failing gate is already blocker-class by definition. It must still use bounded attempts and the smallest verification set capable of proving the fix.
