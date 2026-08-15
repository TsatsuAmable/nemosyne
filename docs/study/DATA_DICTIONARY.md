# Data dictionary

Status: Draft. This file must be finalized before the study is frozen.

| Field | Source | Meaning | Unit | Sampling | Derived? | Participant disclosure |
|---|---|---|---|---|---|---|
| participantId | assigned at consent | pseudonymous participant identifier | — | once per participant | no | yes |
| condition | assigned via randomization plan | 2D / VR-3D | — | once per trial | no | yes, as experienced by participant |
| trialId | generated per trial | unique trial identifier | — | once per trial | no | no |
| correctness | scoring pipeline | correctness of response against ground truth | binary or scaled score | once per trial | yes | no |
| completionTime | event log | elapsed time for trial completion | ms | once per trial | yes | yes |
| confidence | participant self-report | confidence rating | instrument scale | once per trial | no | yes |
| workloadScore | participant self-report | workload rating | instrument scale | once per trial | no | yes |
| observerEvent | researcher console | structured event log of intervention or deviation | — | per event | no | yes |
| navigationCost | derived telemetry | movement or navigation effort | model-dependent | once per trial | yes | yes |

## Instructions
1. Enumerate every field actually written by the trial pipeline.
2. Distinguish raw vs. derived measurements.
3. Ensure every field in the final dictionary is reflected in the consent text.
4. Do not include fields in the final dictionary that are not actually captured by the final study build.
