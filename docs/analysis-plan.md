# DEPRECATED: Analysis Plan — "Find the Fraud"

> Superseded by [docs/study/ANALYSIS_PLAN.md](study/ANALYSIS_PLAN.md).
>
> This legacy draft is retained only as a historical note. It is not authoritative.
> Any active study governance should reference the canonical study package under [docs/study](study).

**Written and frozen BEFORE data collection begins.** The point of this document is to
make post-hoc cherry-picking across RQ1–RQ5 impossible — every comparison below is
decided now, not chosen after looking at which one produced a nice result.

## Primary outcome
**[fill in before freezing — recommendation: task accuracy]**, since it most directly
operationalizes "improve human discovery and understanding" from the core hypothesis.
State explicitly: accuracy on what, scored how, against what ground truth (`scoring.json`).

## Secondary outcomes
- Completion time
- Confidence rating
- Workload (instrument specified in `protocol.md` — validated NASA-TLX or explicitly
  documented custom short-form, per Stable Release Gate 5's requirement; do not modify
  a validated instrument and still call it by that name)
- Navigation cost (from telemetry — e.g. distance traveled / operations performed
  relative to a minimal-path baseline for the task)
- Recall (if a delayed-recall condition is included in this study; if not, state that
  explicitly rather than leaving it ambiguous)

## Planned condition comparisons
State each comparison this study is designed to make, in advance:
- 2D vs. VR on primary outcome
- [add secondary-outcome comparisons as needed — same discipline applies]

## Exclusion rules
Define before data collection, not after seeing who "looks like an outlier":
- Incomplete trials (excluded from primary outcome, included in completion-rate reporting)
- Trials where observer protocol-state logs show researcher intervention beyond the
  study's declared state (Passive/Prompt/Assisted) — flag and review, don't silently
  exclude or silently include
- [participant eligibility criteria, prior-VR-experience handling, etc.]

## Missing-data treatment
**[fill in — e.g. how partial trials, technical failures mid-trial (Gate 0 defects
notwithstanding), or abandoned sessions are handled in the primary analysis]**

## Planned qualitative coding
For observer notes and any verbal debrief data:
- Coding scheme: **[fill in — e.g. the tag set from Gate 2.5's console: confusion /
  hesitation / discovery / navigation-difficulty / gesture-difficulty / verbal-query, plus
  open coding for anything outside that set]**
- Who codes, and whether inter-rater reliability is checked (recommended if more than one
  coder touches the data)

## What would change this plan
Nothing, once frozen and the study starts — that's the point. If a genuine flaw is found
mid-study, document the deviation explicitly (date, reason, what changed) rather than
silently editing this file. A study whose analysis plan visibly changed mid-collection is
still more trustworthy than one that pretends it didn't.
