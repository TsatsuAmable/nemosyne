# Analyst Judgement Capture

## Purpose

The Analyst Cockpit must capture researcher refinement without granting UI code authority over Moneta or learned FitnessModels. `AnalystJudgementController` is the application-layer boundary between cockpit controls and the append-only `JudgementLedger`.

## Supported actions

The controller emits the existing Wave 3 evidence kinds:

- pairwise representation preference;
- absolute representation rating;
- weight-adjustment proposal/application evidence;
- alternative rejection with reason codes;
- DiscoveryEpisode outcome linkage.

Every emitted event receives the current investigation/researcher context, full representation provenance, a contiguous investigation sequence, timestamp and unique judgement ID.

## Boundary

The controller does not import Three.js, mutate Moneta weights, train a model, activate a registry artifact, or reinterpret researcher input. Desktop and VR surfaces can call the same methods so capture semantics remain modality-independent.

A later visual cockpit slice can bind panels, buttons and spatial controls to this controller without duplicating domain logic.