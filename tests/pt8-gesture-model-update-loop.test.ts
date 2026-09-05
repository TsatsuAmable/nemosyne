import { describe, expect, it } from 'vitest';

import { GESTURE_CLASSES } from '../modules/gesture-intelligence/src/contracts.ts';
import {
  GOVERNED_PURPOSES,
  type ImmutableReferenceV1,
  type RuntimeComponentReferenceV1,
  type RuntimeProvenanceV1,
} from '../src/governance/index.ts';
import {
  buildGestureEvaluationReportV1,
  type GestureEvaluationReportV1,
  type GestureEvaluationSplit,
} from '../src/learning/GestureEvaluationReport.ts';
import {
  GestureModelUpdateError,
  GestureModelUpdateLoopV1,
  buildGesturePromotionReviewV1,
  buildGestureQualificationEvidenceV1,
  gestureEvaluationReportReferenceV1,
  gestureQualificationEvidenceReferenceV1,
  type GesturePromotionDisposition,
  type GestureQualificationEvidenceV1,
  type GestureQualificationStage,
  type GestureTrainingExecutorV1,
} from '../src/learning/GestureModelUpdateLoop.ts';
import {
  buildGestureTrainingDatasetBindingV1,
  buildReproducibleTrainingJobManifestV1,
  buildTrainingJobReceiptV1,
  type ReproducibleTrainingJobManifestV1,
} from '../src/learning/ReproducibleTrainingJob.ts';
import {
  RuntimeModelRegistryV1,
  buildRuntimeRegistryEntryV1,
  modelRegistryEntryReferenceV1,
  runtimeRegistryEntryReferenceV1,
  type OperationalModelRegistryEntryV1,
  type RuntimeRegistryEntryV1,
} from '../src/learning/RuntimeModelRegistry.ts';
import {
  buildGestureTrainingSnapshotV1,
  type GestureLearningSampleRefV1,
  type GestureTrainingSnapshotV1,
} from '../src/vr/input/GestureLearningContracts.ts';

function ref(id: string, character: string, version = '1.0.0'): ImmutableReferenceV1 {
  return Object.freeze({
    schemaVersion: '1',
    id,
    version,
    digest: Object.freeze({ algorithm: 'SHA256', value: character.repeat(64) }),
  });
}

function runtimeComponent(id: string, character: string): RuntimeComponentReferenceV1 {
  return Object.freeze({
    schemaVersion: '1',
    componentId: id,
    version: '1.0.0',
    artifactDigest: Object.freeze({ algorithm: 'SHA256', value: character.repeat(64) }),
  });
}

function runtime(): RuntimeProvenanceV1 {
  return Object.freeze({
    schemaVersion: '1',
    components: Object.freeze({
      applicationBuild: runtimeComponent('nemosyne-app', '1'),
      deploymentConfiguration: runtimeComponent('private-preview', '2'),
      wasmKernel: runtimeComponent('rust-kernel', '3'),
      representationTreatment: runtimeComponent('representation-ontology', '4'),
      monetaEngine: runtimeComponent('moneta-engine', '5'),
      fitnessModel: null,
      nil: runtimeComponent('nil-runtime', '6'),
      perceptionGestureTreatment: runtimeComponent('gesture-bootstrap', '7'),
      uiTreatment: runtimeComponent('ui-treatment', '8'),
      platformRuntime: runtimeComponent('browser-runtime', '9'),
    }),
    randomSeeds: Object.freeze({ representation: 17, layout: 23 }),
  });
}

function productRuntimeEntry(adaptiveGesture = true, suffix = 'adaptive'): RuntimeRegistryEntryV1 {
  return buildRuntimeRegistryEntryV1({
    schemaVersion: '1',
    policyVersion: 'runtime-provenance-registry-v1',
    runtimeId: `runtime-private-preview-${suffix}`,
    runtimeVersion: '1.0.0',
    createdAt: '2026-09-05T08:00:00.000Z',
    mode: 'PRODUCT',
    dataset: ref('dataset-fixture', 'a'),
    runtime: runtime(),
    treatmentDisposition: {
      representationTreatment: 'FROZEN',
      monetaEngine: 'FROZEN',
      fitnessModel: 'NOT_APPLICABLE',
      nil: 'FROZEN',
      perceptionGestureTreatment: adaptiveGesture ? 'ADAPTIVE_ALLOWED' : 'FROZEN',
      uiTreatment: 'FROZEN',
    },
  });
}

function sample(index: number): GestureLearningSampleRefV1 {
  const gesture = GESTURE_CLASSES[(index - 1) % GESTURE_CLASSES.length];
  return Object.freeze({
    schemaVersion: '1',
    recordId: `gesture-record-${index}`,
    purpose: GOVERNED_PURPOSES.DERIVED_GESTURE_LEARNING,
    profilePseudonymId: `gesture-profile-${index}`,
    featureSchema: ref('gesture-feature-schema', 'b'),
    contentDigest: Object.freeze({ algorithm: 'SHA256', value: index.toString(16).padStart(64, '0') }),
    consent: Object.freeze({
      schemaVersion: '1',
      purpose: GOVERNED_PURPOSES.DERIVED_GESTURE_LEARNING,
      receipt: Object.freeze({
        id: `gesture-consent-${index}`,
        revision: '1.0.0',
        digest: Object.freeze({ algorithm: 'SHA256', value: (index + 100).toString(16).padStart(64, '0') }),
      }),
      policy: ref('derived-gesture-notice', 'c'),
    }),
    label: Object.freeze({
      schemaVersion: '1',
      rulesVersion: '1.0.0',
      source: 'EXPLICIT_CONFIRMATION',
      predictedGesture: gesture,
      assignedGesture: gesture,
      evidenceId: `gesture-label-${index}`,
      recordedAt: '2026-09-05T07:30:00.000Z',
    }),
  });
}

function snapshot(): GestureTrainingSnapshotV1 {
  return buildGestureTrainingSnapshotV1(
    Array.from({ length: 24 }, (_, index) => sample(index + 1)),
    {
      snapshotId: 'gesture-training-2026-09-05',
      snapshotVersion: '1.0.0',
      createdAt: '2026-09-05T07:45:00.000Z',
      splitSeed: 'pt8-fixed-split',
      validationFraction: 0.25,
      testFraction: 0.25,
    },
  );
}

function evaluationReport(
  trainingSnapshot: GestureTrainingSnapshotV1,
  split: GestureEvaluationSplit,
  modelArtifact: ImmutableReferenceV1,
  version: string,
): GestureEvaluationReportV1 {
  return buildGestureEvaluationReportV1(
    trainingSnapshot,
    trainingSnapshot.splits[split].samples.map((entry) => ({
      recordId: entry.recordId,
      profilePseudonymId: entry.profilePseudonymId,
      actualGesture: entry.label.assignedGesture,
      predictedGesture: entry.label.assignedGesture,
    })),
    {
      reportId: `gesture-${split}-${version.replaceAll('.', '-')}`,
      reportVersion: version,
      createdAt: split === 'validation' ? '2026-09-05T08:30:00.000Z' : '2026-09-05T08:31:00.000Z',
      modelArtifact,
      evaluatorArtifact: ref('gesture-evaluator', 'd'),
      split,
    },
  );
}

function trainingManifest(
  trainingSnapshot: GestureTrainingSnapshotV1,
  runtimeReference: ImmutableReferenceV1,
  version: string,
): ReproducibleTrainingJobManifestV1 {
  return buildReproducibleTrainingJobManifestV1({
    schemaVersion: '1',
    policyVersion: 'reproducible-training-job-v1',
    jobId: `gesture-train-${version.replaceAll('.', '-')}`,
    jobVersion: version,
    createdAt: '2026-09-05T08:10:00.000Z',
    outputKind: 'GESTURE_MODEL',
    dataset: buildGestureTrainingDatasetBindingV1(trainingSnapshot),
    trainingCode: ref('gesture-training-code', 'e'),
    sourceCommitSha: '1'.repeat(40),
    environment: ref('python-training-container', 'f'),
    trainer: ref('python-gesture-trainer', '1'),
    trainerEntrypoint: 'nemosyne.training.gesture:v1',
    runtimeBaseline: runtimeReference,
    holdoutPolicy: ref('gesture-holdout-policy', '2'),
    config: { deterministic: true, epochs: 5 },
    randomSeed: 42,
  });
}

function executorFor(modelArtifact: ImmutableReferenceV1): GestureTrainingExecutorV1 {
  return Object.freeze({
    async execute(manifest, trainingSnapshot) {
      const validationReport = evaluationReport(trainingSnapshot, 'validation', modelArtifact, manifest.jobVersion);
      const testReport = evaluationReport(trainingSnapshot, 'test', modelArtifact, manifest.jobVersion);
      return {
        validationReport,
        testReport,
        receipt: buildTrainingJobReceiptV1(manifest, {
          receiptId: `gesture-receipt-${manifest.jobVersion.replaceAll('.', '-')}`,
          receiptVersion: manifest.jobVersion,
          startedAt: '2026-09-05T08:20:00.000Z',
          finishedAt: '2026-09-05T08:32:00.000Z',
          status: 'SUCCEEDED',
          runnerEnvironment: manifest.environment,
          outputModel: modelArtifact,
          evaluationReport: gestureEvaluationReportReferenceV1(testReport),
          logs: ref(`gesture-training-logs-${manifest.jobVersion.replaceAll('.', '-')}`, '3'),
          failureCode: null,
        }),
      };
    },
  });
}

function qualification(
  stage: GestureQualificationStage,
  modelArtifact: ImmutableReferenceV1,
  validationReport: GestureEvaluationReportV1,
  testReport: GestureEvaluationReportV1,
  version: string,
): GestureQualificationEvidenceV1 {
  const hasShadow = stage !== 'OFFLINE';
  const hasCanary = stage === 'CANARY';
  return buildGestureQualificationEvidenceV1({
    schemaVersion: '1',
    policyVersion: 'gesture-model-qualification-v1',
    evidenceId: `gesture-qualification-${stage.toLowerCase()}-${version.replaceAll('.', '-')}`,
    evidenceVersion: version,
    createdAt: stage === 'OFFLINE' ? '2026-09-05T08:40:00.000Z'
      : stage === 'SHADOW' ? '2026-09-05T09:10:00.000Z'
        : '2026-09-05T09:30:00.000Z',
    stage,
    modelArtifact,
    validationReport: gestureEvaluationReportReferenceV1(validationReport),
    testReport: gestureEvaluationReportReferenceV1(testReport),
    baselineModel: null,
    baselineTestReport: null,
    stabilityArtifact: ref(`gesture-stability-${version}`, '4'),
    stabilityCaseCount: 100,
    stableCaseCount: 98,
    knownFailureArtifact: ref(`gesture-known-failures-${version}`, '5'),
    knownFailureCaseCount: 12,
    knownFailurePassCount: 12,
    latencyArtifact: ref(`gesture-latency-${version}`, '6'),
    latencySampleCount: 500,
    p95LatencyMs: 7.5,
    peakResidentBytes: 8_000_000,
    shadowComparisonArtifact: hasShadow ? ref(`gesture-shadow-${version}`, '7') : null,
    shadowSampleCount: hasShadow ? 100 : 0,
    candidatePreferredCount: hasShadow ? 60 : 0,
    incumbentPreferredCount: hasShadow ? 20 : 0,
    shadowTieCount: hasShadow ? 20 : 0,
    canaryArtifact: hasCanary ? ref(`gesture-canary-${version}`, '8') : null,
    canaryInvocationCount: hasCanary ? 1_000 : 0,
    canaryFailureCount: hasCanary ? 1 : 0,
  }, validationReport, testReport);
}

function review(
  disposition: GesturePromotionDisposition,
  modelArtifact: ImmutableReferenceV1,
  evidence: GestureQualificationEvidenceV1,
  version: string,
  rollbackFromModel: ImmutableReferenceV1 | null = null,
) {
  return buildGesturePromotionReviewV1({
    schemaVersion: '1',
    policyVersion: 'human-reviewed-gesture-promotion-v1',
    reviewId: `gesture-review-${disposition.toLowerCase().replaceAll('_', '-')}-${version.replaceAll('.', '-')}`,
    reviewVersion: version,
    reviewedAt: '2026-09-05T09:45:00.000Z',
    disposition,
    reviewerAuthority: ref('pt8-human-operator', '9'),
    modelArtifact,
    qualificationEvidence: gestureQualificationEvidenceReferenceV1(evidence),
    rollbackFromModel,
  });
}

async function deploymentKeyPair(): Promise<CryptoKeyPair> {
  return await globalThis.crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']) as CryptoKeyPair;
}

async function registerCandidate(
  registry: RuntimeModelRegistryV1,
  loop: GestureModelUpdateLoopV1,
  trainingSnapshot: GestureTrainingSnapshotV1,
  runtimeReference: ImmutableReferenceV1,
  version: string,
  digestCharacter: string,
  parentModel: ImmutableReferenceV1 | null,
) {
  const modelArtifact = ref(`gesture-model-${version}`, digestCharacter, version);
  const result = await loop.executeTraining(executorFor(modelArtifact), {
    manifest: trainingManifest(trainingSnapshot, runtimeReference, version),
    snapshot: trainingSnapshot,
    modelRegistration: {
      modelId: 'gesture-model',
      modelVersion: version,
      createdAt: '2026-09-05T08:35:00.000Z',
      parentModel,
    },
  });
  expect(registry.modelState(modelRegistryEntryReferenceV1(result.model))).toBe('CANDIDATE');
  return result;
}

async function promoteToProduction(
  loop: GestureModelUpdateLoopV1,
  model: OperationalModelRegistryEntryV1,
  runtimeReference: ImmutableReferenceV1,
  validationReport: GestureEvaluationReportV1,
  testReport: GestureEvaluationReportV1,
  version: string,
  keyPair: CryptoKeyPair,
) {
  const modelReference = modelRegistryEntryReferenceV1(model);
  const offline = qualification('OFFLINE', model.modelArtifact, validationReport, testReport, version);
  await loop.applyPromotion({
    stage: 'SHADOW', modelRegistryEntry: modelReference, runtimeRegistryEntry: runtimeReference,
    qualification: offline, validationReport, testReport,
    review: review('APPROVE_SHADOW', model.modelArtifact, offline, version),
    manifestId: `gesture-shadow-${version}`, manifestVersion: version, createdAt: '2026-09-05T10:00:00.000Z', rolloutPercent: 0,
    signingKeyId: 'pt8-operator-key', privateKey: keyPair.privateKey, publicKey: keyPair.publicKey,
  });

  const shadow = qualification('SHADOW', model.modelArtifact, validationReport, testReport, version);
  await loop.applyPromotion({
    stage: 'CANARY', modelRegistryEntry: modelReference, runtimeRegistryEntry: runtimeReference,
    qualification: shadow, validationReport, testReport,
    review: review('APPROVE_CANARY', model.modelArtifact, shadow, version),
    manifestId: `gesture-canary-${version}`, manifestVersion: version, createdAt: '2026-09-05T10:10:00.000Z', rolloutPercent: 10,
    signingKeyId: 'pt8-operator-key', privateKey: keyPair.privateKey, publicKey: keyPair.publicKey,
  });

  const canary = qualification('CANARY', model.modelArtifact, validationReport, testReport, version);
  await loop.applyPromotion({
    stage: 'PRODUCTION', modelRegistryEntry: modelReference, runtimeRegistryEntry: runtimeReference,
    qualification: canary, validationReport, testReport,
    review: review('APPROVE_PRODUCTION', model.modelArtifact, canary, version),
    manifestId: `gesture-production-${version}`, manifestVersion: version, createdAt: '2026-09-05T10:20:00.000Z', rolloutPercent: 100,
    signingKeyId: 'pt8-operator-key', privateKey: keyPair.privateKey, publicKey: keyPair.publicKey,
  });
  return canary;
}

describe('PT8 governed gesture model update loop', () => {
  it('binds retraining to the exact PT6 snapshot, PT7 receipt, model artifact and held-out reports', async () => {
    const registry = new RuntimeModelRegistryV1();
    const runtimeReference = runtimeRegistryEntryReferenceV1(registry.registerRuntime(productRuntimeEntry()));
    const loop = new GestureModelUpdateLoopV1(registry);
    const output = await registerCandidate(registry, loop, snapshot(), runtimeReference, '1.0.0', 'a', null);

    expect(output.model.kind).toBe('GESTURE_MODEL');
    expect(output.model.targetComponent).toBe('perceptionGestureTreatment');
    expect(output.validationReport.split).toBe('validation');
    expect(output.testReport.split).toBe('test');
    expect(output.model.evaluationReport).toEqual(gestureEvaluationReportReferenceV1(output.testReport));
  });

  it('keeps metrics as evidence rather than automatic promotion authority', () => {
    const trainingSnapshot = snapshot();
    const modelArtifact = ref('gesture-model-evidence-only', 'b');
    const validationReport = evaluationReport(trainingSnapshot, 'validation', modelArtifact, '1.0.0');
    const testReport = evaluationReport(trainingSnapshot, 'test', modelArtifact, '1.0.0');
    const evidence = qualification('OFFLINE', modelArtifact, validationReport, testReport, '1.0.0');

    expect(evidence.testSummary.accuracy).toBe(1);
    expect(evidence).not.toHaveProperty('passedBar');
    expect(evidence).not.toHaveProperty('autoPromote');
  });

  it('rejects forged qualification evidence even when a plausible human review references it', async () => {
    const registry = new RuntimeModelRegistryV1();
    const runtimeReference = runtimeRegistryEntryReferenceV1(registry.registerRuntime(productRuntimeEntry()));
    const loop = new GestureModelUpdateLoopV1(registry);
    const output = await registerCandidate(registry, loop, snapshot(), runtimeReference, '1.1.0', 'b', null);
    const valid = qualification('OFFLINE', output.model.modelArtifact, output.validationReport, output.testReport, '1.1.0');
    const forged = { ...valid, evidenceDigest: { algorithm: 'SHA256' as const, value: '0'.repeat(64) } } as GestureQualificationEvidenceV1;
    const keyPair = await deploymentKeyPair();

    await expect(loop.applyPromotion({
      stage: 'SHADOW',
      modelRegistryEntry: modelRegistryEntryReferenceV1(output.model),
      runtimeRegistryEntry: runtimeReference,
      qualification: forged,
      validationReport: output.validationReport,
      testReport: output.testReport,
      review: review('APPROVE_SHADOW', output.model.modelArtifact, forged, '1.1.0'),
      manifestId: 'forged-shadow', manifestVersion: '1.1.0', createdAt: '2026-09-05T10:00:00.000Z', rolloutPercent: 0,
      signingKeyId: 'pt8-operator-key', privateKey: keyPair.privateKey, publicKey: keyPair.publicKey,
    })).rejects.toBeInstanceOf(GestureModelUpdateError);
  });

  it('refuses model adaptation when the Product runtime freezes gesture treatment', async () => {
    const registry = new RuntimeModelRegistryV1();
    const runtimeReference = runtimeRegistryEntryReferenceV1(registry.registerRuntime(productRuntimeEntry(false, 'frozen')));
    const loop = new GestureModelUpdateLoopV1(registry);
    const output = await registerCandidate(registry, loop, snapshot(), runtimeReference, '1.2.0', 'c', null);
    const offline = qualification('OFFLINE', output.model.modelArtifact, output.validationReport, output.testReport, '1.2.0');
    const keyPair = await deploymentKeyPair();

    await expect(loop.applyPromotion({
      stage: 'SHADOW',
      modelRegistryEntry: modelRegistryEntryReferenceV1(output.model),
      runtimeRegistryEntry: runtimeReference,
      qualification: offline,
      validationReport: output.validationReport,
      testReport: output.testReport,
      review: review('APPROVE_SHADOW', output.model.modelArtifact, offline, '1.2.0'),
      manifestId: 'frozen-shadow', manifestVersion: '1.2.0', createdAt: '2026-09-05T10:00:00.000Z', rolloutPercent: 0,
      signingKeyId: 'pt8-operator-key', privateKey: keyPair.privateKey, publicKey: keyPair.publicKey,
    })).rejects.toMatchObject({
      issues: expect.arrayContaining([expect.objectContaining({ code: 'RUNTIME_ADAPTATION_FORBIDDEN' })]),
    });
  });

  it('runs human-reviewed shadow -> canary -> production and exact rollback through PT7', async () => {
    const registry = new RuntimeModelRegistryV1();
    const runtimeReference = runtimeRegistryEntryReferenceV1(registry.registerRuntime(productRuntimeEntry()));
    const loop = new GestureModelUpdateLoopV1(registry);
    const trainingSnapshot = snapshot();
    const keyPair = await deploymentKeyPair();

    const v1 = await registerCandidate(registry, loop, trainingSnapshot, runtimeReference, '2.0.0', 'd', null);
    const v1Qualification = await promoteToProduction(loop, v1.model, runtimeReference, v1.validationReport, v1.testReport, '2.0.0', keyPair);
    expect(registry.currentProduction()?.modelVersion).toBe('2.0.0');

    const v1Reference = modelRegistryEntryReferenceV1(v1.model);
    const v2 = await registerCandidate(registry, loop, trainingSnapshot, runtimeReference, '2.1.0', 'e', v1Reference);
    await promoteToProduction(loop, v2.model, runtimeReference, v2.validationReport, v2.testReport, '2.1.0', keyPair);
    expect(registry.currentProduction()?.modelVersion).toBe('2.1.0');

    await loop.applyRollback({
      targetModelRegistryEntry: v1Reference,
      runtimeRegistryEntry: runtimeReference,
      qualification: v1Qualification,
      validationReport: v1.validationReport,
      testReport: v1.testReport,
      review: review('APPROVE_ROLLBACK', v1.model.modelArtifact, v1Qualification, '2.0.1', v2.model.modelArtifact),
      manifestId: 'gesture-rollback-2-0-0',
      manifestVersion: '2.0.1',
      createdAt: '2026-09-05T11:00:00.000Z',
      signingKeyId: 'pt8-operator-key',
      privateKey: keyPair.privateKey,
      publicKey: keyPair.publicKey,
    });

    expect(registry.currentProduction()?.modelVersion).toBe('2.0.0');
    expect(registry.modelState(modelRegistryEntryReferenceV1(v2.model))).toBe('ROLLED_BACK');
    expect(registry.modelState(v1Reference)).toBe('PRODUCTION');
  });
});
