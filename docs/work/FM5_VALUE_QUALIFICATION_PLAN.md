# FM5 value-qualification plan

**Status:** STAGE 1 COMPLETE — GATE FAILS. Measured outcome (deterministic, pinned in `tests/fm5-value-proxy-gate.test.ts`): 0/4 positive deltas, 0/4 ABSTAIN vs the lenient bar (≥50% positive, ≤25% ABSTAIN). Advice proposes on every case yet never beats bypass on these fixtures: finite but valueless deltas, exactly the STOP condition. FM5 value claim stops; tranche returns to advisory design. The test pins the null result (CI truthful) and trips on any future change either way.
**Roadmap row:** FM5 `VALUE QUALIFICATION OPEN`. **Risk tier of proposed work:** standard-risk for the proxy gate (measurement-only, no behavior change); human/device stages need study-governance approval first.

## Goal

Replace "finite deltas" with a value claim: System-1 advice must clear a decision-quality bar *and* a target-device cost bar before FM5 counts toward the FM8 exit.

## Two stages

**Stage 1 — proxy gate (implementable now, no humans/hardware).** Extend the R5/R7/R8 probes into a pass/fail gate over a frozen case battery (both budgets, multiple row counts): advised utility exceeds bypassed by at least a fixed margin on a fixed fraction of cases, ABSTAIN rate stays bounded, and every figure reproduces exactly on rerun. A proxy gate is necessary, never sufficient: it licenses the human study, it is not the value claim.

**Stage 2 — investigator + device study (requires owner decisions below).** Advised vs unadvised investigation outcomes on fixed tasks (success, time-to-decision, decision quality), plus on-device advised-vs-bypassed cost (wall-clock, peak memory) on the Quest target. Follows `docs/study/` governance: frozen protocol, consent, pre-registered analysis — no ad-hoc human runs.

## Falsifiers

- Proxy gate fails: advice does not beat bypass by the margin → FM5 value claim stops, back to advisory design.
- Device cost exceeds budget headroom → advice stays desktop-only; no target-device value claim.
- Human study shows no decision improvement → ABSTAIN-forward posture: advice remains optional disclosure, never a capability claim.

## STOP / REVISE

Does measured advice improve investigator outcomes enough to justify its cost and complexity, or is it sophisticated machinery with finite but valueless deltas? A null result is a valid, publishable outcome — do not weaken the margin to manufacture a pass.

## Owner decisions required

1. Proxy margin and pass fraction for Stage 1 (e.g. min utility delta, min case fraction, ABSTAIN cap).
2. Stage 2 cohort: owner-as-pilot (N=1), lab cohort, or deferred.
3. Target device for cost measurement: Quest 3S physical rerun (ties to QCA) or desktop-constrained proxy only.
4. Whether Stage 2 lives under the flagship `docs/study/` package or a standalone FM5 protocol.
