# DEPRECATED: representation-equivalence.md

> Superseded by [docs/study/REPRESENTATION_EQUIVALENCE.md](study/REPRESENTATION_EQUIVALENCE.md).
>
> This legacy draft is retained only as a historical note. It is not authoritative.
> Use the canonical representation-equivalence file under [docs/study](study) instead.

### Study 1 — Conventional 2D vs Immersive VR

Status: DRAFT — pending literature-precedent selection and external methodology review.
This file is not frozen. Do not begin recruitment against this version.

Per the execution document's §9 shape, expanded with the classification rule stated there:
> An intended treatment difference is an experimental manipulation; an uncontrolled difference
> capable of explaining the result is a confound.

Every "Controlled" row below must be identical or equivalent across conditions by construction.
Every "Experimental" row is the manipulation itself and must be explicitly documented, not
incidental. Anything that is neither — a difference that exists but wasn't deliberately chosen as
part of either category — is a confound and belongs in `confound-register.md`, not here.

---

## 1. Equivalence table

| # | Dimension | 2D condition | VR condition | Classification | Verification method |
|---|---|---|---|---|---|
| 1 | Dataset | Same dataset, same version hash | Same dataset, same version hash | Controlled | `dataset-version.txt` match |
| 2 | Feature definitions | Identical variable set, identical derivations | Identical | Controlled | Shared `data-dictionary.md` |
| 3 | Preprocessing | Identical normalization/cleaning pipeline | Identical | Controlled | Same preprocessing code path, both conditions |
| 4 | Missing-data handling | Same imputation/exclusion rule applied before task starts | Same | Controlled | Code review — single shared function |
| 5 | Task | Same task family, equivalent (not identical) instances per §5 of execution doc | Same | Controlled | Task-instance equivalence check (below, §3) |
| 6 | Instructions | Same wording, same reading level, same delivery point in session | Same | Controlled | Verbatim instruction script, both conditions |
| 7 | Ground truth | Same scoring key per task instance | Same | Controlled | Shared scoring key file |
| 8 | Scoring / rubric | Same operational definition of correct/partial/incorrect | Same | Controlled | Single scoring function, condition-agnostic |
| 9 | Information available | Same variables, same summary statistics available on request | Same | Controlled | Explicit "available information" checklist per condition |
| 10 | Training | Equivalent duration and content, adapted for interface | Equivalent duration and content, adapted for interface | Controlled | Training script parity review |
| 11 | Time limit | Same limit unless explicitly justified otherwise | Same unless justified | Controlled | Timer configuration, both conditions |
| 12 | Researcher assistance policy | Same OBSERVE/SUGGEST/ASSIST/INTERVENE policy, same thresholds | Same | Controlled | Observer console shared config |
| 13 | Visual encoding | Conventional 2D chart/table encoding, defined and documented | VR-native spatial encoding, defined and documented | **Experimental** | Both documented in `data-dictionary.md` appendix |
| 14 | Navigation | Mouse/keyboard/scroll | VR locomotion/gesture | **Experimental** | Interaction log schema, both conditions |
| 15 | Embodiment | None (2D screen, no avatar/presence) | Present (VR presence/avatar if applicable) | **Experimental** | N/A — defining property of manipulation |
| 16 | Display | Conventional monitor | HMD | **Experimental** | N/A — defining property of manipulation |

---

## 2. What is deliberately NOT equalized

Per §2 of the execution document, VR is treated as a bundled interface-level manipulation
("conventional 2D analytical interface vs immersive 3D/VR analytical interface"), not a single
isolated variable. Rows 13–16 above are therefore intentionally bundled together as one
manipulation rather than four separately randomized factors. This must be stated explicitly in
`study-protocol.md`'s claim-scope section: the result speaks to "the immersive interface as
implemented," not to any single sub-component (e.g., not isolable to "depth perception alone" or
"navigation style alone"). A future study could decompose this bundle; Study 1 does not attempt to.

---

## 3. Task-instance equivalence check (supports row 5)

Because identical task instances would let a participant carry over the answer from condition 1
to condition 2, task instances must differ across conditions while remaining equivalent in
difficulty. Record, per task-instance pair:

```text
Task family:            <e.g. "identify the 2 largest anomalous clusters">
Instance A (condition 1): <dataset slice / parameter>
Instance B (condition 2): <dataset slice / parameter>
Difficulty-matching method: <e.g. matched by cluster count, separation, noise level>
Validated by: <pilot data / independent rater / precedent method>
```

This becomes part of `literature-precedents.md`'s deviation record if the matching method departs
from the selected primary analogue.

---

## 4. Deviation log (from selected precedent)

To be completed once `literature-precedents.md` selects the 1–2 primary analogues. Template per
the execution document's §7 deviation format:

```text
Precedent:              <citation>
Nemosyne approach:       <what we do instead / additionally>
Reason:                  <why>
Potential consequence:   <what this could affect in the result>
Reviewer disposition:    <pending external review>
```

---

## 5. Sign-off

| Field | Value |
|---|---|
| Version | DRAFT v0.1 |
| Frozen | ☐ No — pending review |
| Reviewed against commit | — |
| External reviewer disposition | — |
