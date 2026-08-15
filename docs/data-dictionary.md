# DEPRECATED: Data Dictionary — "Find the Fraud"

> Superseded by [docs/study/DATA_DICTIONARY.md](study/DATA_DICTIONARY.md).
>
> This legacy draft is retained only as a historical note. It is not the authoritative study schema.
> Use the canonical data dictionary under [docs/study](study) instead.

Required by Stable Release Gate 5. Lives here (inside the frozen package) rather than
only in the code/docs tree, so the study is reproducible from protocol through analysis
without cross-referencing the codebase. Every field actually captured by the frozen
build must have a row here before Gate 6 rehearsal.

| Field | Source | Meaning | Unit | Sampling | Derived? | Retention class | Participant-facing disclosure |
|---|---|---|---|---|---|---|---|
| `participantId` | Assigned at consent | Pseudonymous ID, e.g. `P014` | — | Once | No | Study dataset | Yes — explained at consent |
| `trialId` | Generated per trial | Unique trial identifier | — | Once per trial | No | Study dataset | No (internal) |
| `condition` | Assigned via `condition-order.json` | 2D / VR-3D | — | Once per trial | No | Study dataset | No (internal, though participant experiences it directly) |
| `headYaw` *(VR-3D only)* | XR camera pose | Head rotation about vertical axis | radians | Per frame | No | Ephemeral (aggregate only, not raw stream, unless justified) | Yes — general "movement is tracked" disclosure |
| `navigationTime` | Derived from task events | Time spent in locomotion vs. inspection | ms | Per trial | Yes | Study dataset | Yes |
| `selectionSequence` | Task event log | Ordered list of selected nodes/objects | — | Per trial | No | Study dataset | Yes |
| `observerEvent` | Gate 2.5 console | One of `observer.entered/prompted/paused/resumed/marked/reset/assisted` | — | Per researcher action | No | Study dataset | Yes — participant informed they're being observed |
| `workloadScore` | End-of-trial prompt | Self-reported workload | instrument-specific scale | Once per trial | No | Study dataset | Yes |
| `correctness` | Scored against `scoring.json` ground truth | Task outcome | binary or scaled — define in `scoring.json` | Once per trial | Yes | Study dataset | No (internal scoring) |

**Instructions for completing this dictionary for a real build:**
1. Enumerate every field actually written by the trial-recording pipeline (Gate 5) and
   the observer console (Gate 2.5) — don't hand-guess from this template.
2. For each, fill in the row honestly, including whether it's raw or derived — this
   distinction is what the data-minimization principle in the Stable Release roadmap's
   Gate 5 governance section depends on: prefer derived measures over raw trajectories
   wherever the analysis plan doesn't specifically need the raw stream.
3. Any field with no clear "participant-facing disclosure" answer is a signal that the
   consent document (`consent.md`) needs updating before this field is collected, not a
   reason to leave the column blank.
