# DEPRECATED: confound-register.md

> Superseded by [docs/study/CONFOUNDS.md](study/CONFOUNDS.md).
>
> This older file is retained only as a historical note. It is not authoritative.
> Use the canonical confounds register under [docs/study](study) instead.

### Study 1 — Conventional 2D vs Immersive VR

Status: DRAFT — pending literature-precedent selection and external methodology review.
This file is not frozen. Do not begin recruitment against this version.

Per the execution document's §10, minimum required confounds and record shape. Each entry below
is seeded with a reasonable default control/measurement approach; all are subject to revision by
the external methodology reviewer (item 5 of the review checklist — order/practice effects — and
item 6 — exclusions/missing data — cover several of these directly).

---

## 1. Condition order

```text
Confound:            Order (2D→VR vs VR→2D) affects outcome independent of interface
Mechanism:            General task familiarity, fatigue, or strategy transfer from
                       condition 1 to condition 2
Affected conditions:  Both
Control:              Counterbalanced between-subjects — Group A (2D→VR), Group B (VR→2D)
Measurement:           Order recorded as a covariate in confirmatory_export_schema
Residual risk:        Medium — within-subject repeated measures cannot fully eliminate
                       order effects, only balance them across the sample
Owner:                Study owner
Status:               Open — design decision frozen (counterbalanced), rehearsal pending
```

## 2. Learning / carry-over

```text
Confound:            Participant learns the analytical task itself during condition 1,
                       inflating condition 2 performance regardless of interface
Mechanism:            Task-general skill acquisition (e.g. "how to spot a cluster")
                       independent of interface-specific skill
Affected conditions:  Second condition in each participant's sequence
Control:              Equivalent-but-non-identical task instances per condition
                       (see representation-equivalence.md §3); training given before
                       BOTH conditions, not just the first
Measurement:           Task-instance difficulty-matching validated pre-study;
                       completion-time trend across trials logged
Residual risk:        Medium — matching difficulty is itself a judgment call requiring
                       either precedent or pilot validation
Owner:                Study owner + external reviewer (task-instance matching method)
Status:               Open — pending task-instance equivalence validation
```

## 3. Training

```text
Confound:            Unequal training quality/duration biases toward the better-trained
                       condition
Mechanism:            Training scripted or delivered inconsistently between 2D and VR
Affected conditions:  Both
Control:              Single written training script per condition, equivalent duration,
                       reviewed for parity before rehearsal
Measurement:           Training duration logged per participant; training script version
                       recorded in metadata.json
Residual risk:        Low, if script parity is verified in rehearsal (Gate 6)
Owner:                Study owner
Status:               Open — parity review not yet scheduled
```

## 4. VR novelty

```text
Confound:            Novelty of VR itself (excitement, unfamiliarity, or anxiety) affects
                       engagement/performance independent of the analytical interface's
                       actual usefulness
Mechanism:            Most participants likely have less prior VR exposure than 2D/desktop
                       exposure — asymmetric baseline familiarity
Affected conditions:  VR
Control:              Record prior VR experience as a covariate; consider a brief
                       VR-familiarization period (non-task) before the VR condition,
                       equivalent in spirit to 2D's implicit familiarity
Measurement:           Prior-VR-experience questionnaire item; comfort/presence
                       questionnaire post-VR-condition
Residual risk:        Medium-high — this is one of the harder confounds to fully control
                       and should be an explicit discussion point with the external
                       reviewer, not resolved unilaterally
Owner:                Study owner + external reviewer
Status:               Open — flagged for review, not yet resolved
```

## 5. Hardware performance and latency

```text
Confound:            Frame-rate drops, tracking loss, or interaction latency in VR
                       degrade task performance for reasons unrelated to the
                       representation itself
Mechanism:            VR hardware/software performance issues distinct from the
                       analytical-interface manipulation
Affected conditions:  VR
Control:              Gate 3 hardware validation (frame rate, latency, memory, tracking,
                       interaction reliability) completed before Gate 5 can close;
                       performance-envelope.md defines acceptable thresholds
Measurement:           Frame-rate/latency telemetry logged per trial; sessions exceeding
                       threshold flagged for exclusion review
Residual risk:        Low, contingent on Gate 3 passing and performance-envelope.md
                       thresholds being enforced, not just documented
Owner:                Engineering (Gate 3) + study owner (exclusion policy)
Status:               Open — depends on Gate 3 completion
```

## 6. Researcher intervention

```text
Confound:            Uneven researcher assistance (more help given in one condition)
                       inflates that condition's apparent performance
Mechanism:            Observer console OBSERVE/SUGGEST/ASSIST/INTERVENE actions applied
                       inconsistently across conditions or participants
Affected conditions:  Both
Control:              Single documented intervention policy and threshold, identical
                       across conditions; every intervention logged as an ObserverEvent
Measurement:           ObserverEvent log — type, timestamp, condition, target,
                       justification — reviewed for cross-condition balance post-hoc
Residual risk:        Low, if intervention logging is complete and reviewed
                       (Gate 2.5 dependency)
Owner:                Study owner
Status:               Open — depends on Gate 2.5 completion
```

## 7. Information asymmetry

```text
Confound:            One condition incidentally exposes more or different information
                       than the other (e.g. VR's spatial layout reveals structure a 2D
                       table view hides, or vice versa, beyond the intended manipulation)
Mechanism:            Interface-specific incidental information leakage not covered by
                       the "available information" row in representation-equivalence.md
Affected conditions:  Both
Control:              Explicit "available information" checklist per condition,
                       reviewed against the actual rendered interface, not just the
                       intended design
Measurement:           Manual audit — screenshot/recording review comparing information
                       accessible in each condition for the same task instance
Residual risk:        Medium — this is easy to miss because it can be subtle (e.g. VR
                       spatial arrangement implicitly encoding a variable 2D doesn't)
Owner:                Study owner + external reviewer
Status:               Open — audit not yet performed
```

## 8. Measurement asymmetry

```text
Confound:            Outcome measurement itself behaves differently across conditions
                       (e.g. click-based vs gesture-based response capture has different
                       precision or response-time characteristics)
Mechanism:            Interaction modality affects how outcomes are captured, not just
                       how tasks are performed
Affected conditions:  Both
Control:              Single outcome-capture definition, condition-agnostic where
                       possible (e.g. explicit confirmation action required in both,
                       rather than passive gaze/hover in VR vs explicit click in 2D)
Measurement:           Outcome-capture method documented per condition in
                       data-dictionary.md; response-time distributions compared for
                       modality artifacts during synthetic-analysis testing
Residual risk:        Medium — response-time comparisons across modalities are known
                       to be methodologically tricky; may need to be a secondary rather
                       than primary outcome if this can't be fully resolved
Owner:                Study owner + external reviewer
Status:               Open — flagged for explicit reviewer attention
```

---

## Summary table

| # | Confound | Residual risk | Status | Depends on |
|---|---|---|---|---|
| 1 | Condition order | Medium | Open | Design frozen |
| 2 | Learning/carry-over | Medium | Open | Task-instance validation |
| 3 | Training | Low | Open | Script parity review |
| 4 | VR novelty | Medium-high | Open | External review |
| 5 | Hardware performance/latency | Low | Open | Gate 3 |
| 6 | Researcher intervention | Low | Open | Gate 2.5 |
| 7 | Information asymmetry | Medium | Open | Manual audit |
| 8 | Measurement asymmetry | Medium | Open | External review |

No entry may move to "Resolved" without either (a) the specified dependency completing and being
verified, or (b) explicit external reviewer sign-off recorded in `methodology-review.md`.

---

## Sign-off

| Field | Value |
|---|---|
| Version | DRAFT v0.1 |
| Frozen | ☐ No — pending review |
| Reviewed against commit | — |
| External reviewer disposition | — |
