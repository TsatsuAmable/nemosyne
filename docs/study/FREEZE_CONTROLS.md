# V3 Study Freeze Controls

## Purpose

Controlled Nemosyne studies must make the treatment configuration reproducible and must fail closed when the runtime changes during an active participant session.

`src/study/StudyFreezeManifest.ts` defines the protocol-visible freeze contract. The manifest records the study/protocol identity, condition and task definitions, adaptive-behaviour policy, and the exact runtime version vector used by the treatment:

- Rust/WASM kernel version when bound by the runtime;
- Moneta engine version;
- bootstrap FitnessModel version;
- Representation Ontology version;
- NIL version;
- participant-facing UI treatment version (`uiTreatmentVersion` — panel-layout
  revision, intent-wheel taxonomy and reference-frame policy; see
  [`UI_TREATMENT.md`](UI_TREATMENT.md)).

The manifest is deterministically fingerprinted. The current protocol remains `DRAFT`; it must not be promoted to `FROZEN` until an exact Rust/WASM kernel version is supplied.

## Runtime enforcement

`StudyFreezeGuard` snapshots the manifest and runtime-version vector. `ExperimentRunner` checks the guard at participant/trial lifecycle boundaries. If the version provider changes after session capture, the runner throws instead of silently continuing under a different treatment.

Custom tasks or condition sets are rejected unless `allowProtocolVariation: true` is explicitly supplied. Such pilot/method-development runs receive their own configuration hash and therefore cannot masquerade as the declared study configuration.

Every completed `TrialMetrics` record and `StudySessionExport` carries the captured `studyConfigHash` and runtime version vector.

## Boundary

Freeze controls do not assert empirical validity. They make treatment identity inspectable and reproducible. Adaptive or learned behaviour remains outside the stable study path until its provenance and evaluation contracts are separately validated.
