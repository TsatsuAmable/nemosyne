# XR evidence calibration

**Status:** initial implementation contract  
**Purpose:** reduce scarce physical-device and human-validation effort without allowing simulation to become its own oracle.

The XR Experimental Engine can cheaply exercise many device, fault and dataset envelopes. QV can produce governed S4 physical-device evidence, while human/device studies remain S5. The missing link is a retrospective calibration record pairing cheap S0-S3 evidence with the later S4/S5 result for the same scenario and exact build.

`dev/xr-lab/EvidenceCalibration.ts` supplies that link. It deliberately does not predict qualification and does not upgrade evidence. A valid pair requires exact `scenarioId` and `buildHash` agreement, S0-S3 inputs, and an S4/S5 physical-device or human-study outcome.

Two signals are first-class:

1. **counter-simulation failure**: every cheap source passed but S4/S5 failed;
2. **cheap-evidence disagreement**: cheap sources disagree and should therefore be candidates for escalation rather than averaging-away.

The calibration corpus should eventually support preservation-frontier evaluation: how much Quest/human work can be avoided while preserving physical failures, modality disagreements, usability failures and rare failure classes? Randomly selected audit runs must remain in the protocol so an allocator cannot make its false negatives permanently invisible.

## Hardware opportunity

When an authorised Quest is attached, prefer governed QV evidence for calibration rather than ad-hoc screenshots. High-value physical checks include frame pacing and dropped frames, long-session drift/thermal behaviour, controller/hand tracking and recovery, WebXR lifecycle transitions, target acquisition/occlusion/legibility tasks, browser/runtime identity, WASM boundary behaviour, and scenarios selected because cheap evidence disagrees.

Headless or remotely automated browser control on the Quest may reduce operator ceremony and can verify measurable runtime/interaction invariants. It must not be used to claim comfort, nausea, cognitive workload, discoverability, perceptual usefulness or other S5 outcomes without a human study.

## Recursive engineering loop

`cheap campaign -> disagreement/failure morphology -> select S4/S5 test -> record calibration pair -> identify missed failure class -> strengthen simulator/test/runtime -> rerun -> recalibrate`

A simulator finding is useful when it changes code, tests, campaign design, or escalation policy. A physical surprise is useful when it becomes a regression test or a better fault envelope. The loop should converge by shrinking unknown failure classes, not by making the simulator agree with itself.
