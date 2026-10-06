# P1-PT8 gesture model update loop post-implementation review

**Risk:** HIGH  
**Disposition:** ADOPT, subject to the final exact PR head passing all required repository promotion gates with no unresolved review blocker.

## Reviewed claim

PT8 provides a repository-runnable governed gesture-model update path from the exact PT6 L2 snapshot through reproducible training, immutable candidate artifacts, held-out evaluation, model-specific qualification, explicit human promotion review, PT7 signed shadow/canary/production deployment metadata, and exact rollback.

This is an implementation and governance claim only. It is not evidence that any candidate gesture model is physically effective for live users, that repository shadow/canary fixtures equal production cohorts, or that a production learning service has been deployed.

## Adversarial findings and fix-forward

1. **Qualification rebinding:** the initial promotion surface could rely on a qualification reference without revalidating the complete qualification object against the exact held-out reports. Promotion now validates the full object, digest, model binding and validation/test reports.
2. **Runtime treatment bypass:** model-registry state alone was insufficient authority for adaptive rollout. Promotion now requires Product mode with `perceptionGestureTreatment: ADAPTIVE_ALLOWED`; frozen and Research treatments fail closed.
3. **Abstract trainer gap:** the first tranche could orchestrate a trainer interface without closing PT7's explicit PT8 trainer deferral. PT8 now contains a concrete Node -> Python -> ONNX executor bound to immutable trainer, environment, training-code and source-commit identities.
4. **Legacy direct-deployment bypass:** the historical module retrainer could overwrite the live ONNX asset after scalar thresholds. That path is fenced as explicit legacy/bootstrap tooling; the governed PT8 path emits immutable candidates and has no automatic promotion authority.
5. **Snapshot-reference gap:** PT6 snapshots intentionally retain governed sample references rather than copied features. PT8 now resolves only exact snapshot members back to the trusted L2 source, refusing missing, extra or rebound records before training.
6. **Holdout leakage:** the PT8 trainer uses train data for fitting, validation for early stopping, then evaluates test only after weights are frozen. Test metrics are evidence and never automatic promotion authority.
7. **Typecheck regression:** final CI exposed four implicit-any parameters in test doubles. They were fixed through explicit contextual interface typing without changing production behavior.

## Evidence surface

- `tests/pt8-gesture-model-update-loop.test.ts` falsifies forged qualification evidence, frozen-treatment adaptation, stage sequencing and exact rollback.
- `tests/pt8-gesture-training-feature-resolution.test.ts` exercises the real governed SQLite projection and rejects source rebinding.
- PT6D and PT7 tests remain authoritative for snapshot integrity, held-out report integrity, reproducible job/receipt lineage, signatures, replay refusal and model-registry lifecycle.
- `governance/production-readiness.json` records PT8 repository evidence separately from PT9, deployed-service evidence and physical/live-human qualification.

## Residuals

- Automatic retraining scheduling remains intentionally absent.
- Promotion remains an explicit human/governance decision, not a metric threshold.
- Live shadow/canary cohort evidence and physical-device/human-performance qualification remain external empirical work.
- Production learning-plane deployment remains deferred by policy.
- Learned Moneta remains PT9.

No residual found in this review requires broadening PT8 or adding a second analytical authority. Promotion is appropriate only if the final exact head remains synchronized with `main` and all required CI, CodeQL and approval evidence is green.
