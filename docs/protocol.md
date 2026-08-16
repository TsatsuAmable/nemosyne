# DEPRECATED: Nemosyne Flagship Study Protocol — "Find the Fraud"

> Superseded by [docs/study/PROTOCOL.md](study/PROTOCOL.md).
>
> This file is retained only as a legacy draft. It is not authoritative for active study governance.
> Use the canonical protocol under [docs/study](study) instead.

**Status:** DRAFT skeleton. Fill in and freeze before Gate 6 rehearsal; version this file
via `version.json`, not by editing it after the study starts.

## Core hypothesis under test
For defined analytical tasks involving relationships and multidimensional structure,
spatial representation and embodied interaction can improve human discovery and
understanding compared with conventional 2D representation, without unacceptable costs in
precision, workload, navigation, or comfort.

## Conditions
1. **2D** — canonical 2D control (see `datasets/` and `scoring.json`; same dataset, task
   wording, and scoring rubric as the VR condition, per Stable Release Gate 5)
2. **VR-3D** — Nemosyne, WebXR/headset path

## Task
Fraud-01 (see `tasks.json` for the machine-readable version). Participant is given a
transaction dataset and asked to identify the anomalous/fraudulent node(s), using
whichever representation and operations the condition provides (Compare is available in
both conditions in equivalent form — verify this before freezing the protocol).

## Participant flow
1. Consent (see `consent.md`) and observation disclosure
2. Condition assignment (see `condition-order.json` — counterbalanced, do not assign
   manually per-participant)
3. Brief task framing (identical wording across conditions — deviation here is a
   confound; log any ad-libbing in the observer console under a `deviation` note)
4. Trial (see Gate 2's exit checklist for what "complete" means operationally)
5. Outcome capture (answer, correctness, completion time, confidence, workload — see
   `scoring.json` and `analysis-plan.md`)
6. Debrief / optional qualitative interview

## Researcher role during trial
Observer protocol state for this study: **[fill in — Passive / Prompt / Assisted]**,
recorded per trial in the session data, not assumed constant across the study.

## What this protocol explicitly does NOT test
Copy the Known Limitations list from the Stable Release roadmap's Gate 6 section here
verbatim before freezing, so the protocol document itself states what a result from this
study cannot be used to claim.
