# Learned Fitness Runtime Adoption

Learned Moneta execution is an explicit, pinned opt-in at the representation composition boundary. Bootstrap remains the default runtime and remains authoritative for candidate generation, hard constraints, and canonical raw feature computation.

When learned execution is enabled, Moneta may only re-rank candidates that bootstrap has already declared feasible. The selected registry artifact must be active, promotion-eligible, and match both the exact configured artifact hash and model version. Missing, disabled, unpromoted, hash-drifted, or version-mismatched artifacts fail closed. There is no silent fallback to another learned artifact or to bootstrap after an explicit learned-runtime request.

The resulting `RepresentationDecision` persists both `fitnessModelVersion` and `fitnessModelArtifactHash` in decision provenance, so Investigation snapshots retain the exact learned identity. Controlled studies must pin the same identity through `RuntimeFitnessMode` / `StudyRuntimeVersions`; registry promotion or rollback cannot silently alter a frozen execution context.

Bootstrap weight-sensitivity analysis is intentionally omitted from a learned-ranked decision because it does not describe the learned model's decision surface. Learned-model uncertainty and sensitivity require their own validated analysis rather than recycling bootstrap diagnostics.

This slice does not train models, change promotion policy, permit learned candidate generation, weaken hard constraints, or enable compositional search.
