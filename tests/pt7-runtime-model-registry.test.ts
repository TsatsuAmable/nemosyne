import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  GOVERNED_PURPOSES,
  type ImmutableReferenceV1,
  type RuntimeComponentReferenceV1,
  type RuntimeProvenanceV1,
} from '../src/governance/index.ts';
import {
  FileLearningArtifactStoreV1,
  LearningArtifactStoreError,
} from '../src/learning/FileLearningArtifactStore.ts';
import {
  deploymentManifestReferenceV1,
  signModelDeploymentManifestV1,
  type ModelDeploymentManifestContentV1,
} from '../src/learning/ModelDeploymentManifest.ts';
import {
  buildGestureTrainingDatasetBindingV1,
  buildReproducibleTrainingJobManifestV1,
  buildTrainingJobReceiptV1,
  trainingJobReceiptReferenceV1,
} from '../src/learning/ReproducibleTrainingJob.ts';
import {
  RuntimeModelRegistryError,
  RuntimeModelRegistryV1,
  buildRuntimeRegistryEntryV1,
  modelRegistryEntryReferenceV1,
  runtimeRegistryEntryReferenceV1,
  type RuntimeModelRegistryIssueCode,
  type RuntimeRegistryEntryV1,
} from '../src/learning/RuntimeModelRegistry.ts';
import {
  buildGestureTrainingSnapshotV1,
  type GestureLearningSampleRefV1,
} from '../src/vr/input/GestureLearningContracts.ts';

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function directory(): string {
  const value = mkdtempSync(join(tmpdir(), 'nemosyne-pt7-'));
  directories.push(value);
  return value;
}

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

function runtime(fitnessModel: RuntimeComponentReferenceV1 | null = null): RuntimeProvenanceV1 {
  return Object.freeze({
    schemaVersion: '1',
    components: Object.freeze({
      applicationBuild: runtimeComponent('nemosyne-app', '1'),
      deploymentConfiguration: runtimeComponent('private-preview', '2'),
      wasmKernel: runtimeComponent('rust-kernel', '3'),
      representationTreatment: runtimeComponent('representation-ontology', '4'),
      monetaEngine: runtimeComponent('moneta-engine', '5'),
      fitnessModel,
      nil: runtimeComponent('nil-runtime', '6'),
      perceptionGestureTreatment: runtimeComponent('gesture-bootstrap', '7'),
      uiTreatment: runtimeComponent('ui-treatment', '8'),
      platformRuntime: runtimeComponent('browser-runtime', '9'),
    }),
    randomSeeds: Object.freeze({ representation: 17, layout: 23 }),
  });
}

function productRuntimeEntry(): RuntimeRegistryEntryV1 {
  return buildRuntimeRegistryEntryV1({
    schemaVersion: '1',
    policyVersion: 'runtime-provenance-registry-v1',
    runtimeId: 'runtime-private-preview',
    runtimeVersion: '1.0.0',
    createdAt: '2026-09-05T08:00:00.000Z',
    mode: 'PRODUCT',
    dataset: ref('dataset-fixture', 'a'),
    runtime: runtime(),
    treatmentDisposition: {
      representationTreatment: 'ADAPTIVE_ALLOWED',
      monetaEngine: 'ADAPTIVE_ALLOWED',
      fitnessModel: 'NOT_APPLICABLE',
      nil: 'FROZEN',
      perceptionGestureTreatment: 'FROZEN',
      uiTreatment: 'FROZEN',
    },
  });
}

function sample(index: number): GestureLearningSampleRefV1 {
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
        digest: Object.freeze({ algorithm: 'SHA256', value: (index + 10).toString(16).padStart(64, '0') }),
      }),
      policy: ref('derived-gesture-notice', 'c'),
    }),
    label: Object.freeze({
      schemaVersion: '1',
      rulesVersion: '1.0.0',
      source: 'EXPLICIT_CONFIRMATION',
      predictedGesture: 'idle',
      assignedGesture: 'idle',
      evidenceId: `gesture-label-${index}`,
      recordedAt: '2026-09-05T07:30:00.000Z',
    }),
  });
}

function snapshot() {
  return buildGestureTrainingSnapshotV1(
    Array.from({ length: 6 }, (_, index) => sample(index + 1)),
    {
      snapshotId: 'gesture-training-2026-09-05',
      snapshotVersion: '1.0.0',
      createdAt: '2026-09-05T07:45:00.000Z',
      splitSeed: 'pt7-fixed-split',
      validationFraction: 0.2,
      testFraction: 0.2,
    },
  );
}

async function deploymentKeyPair(): Promise<CryptoKeyPair> {
  return await globalThis.crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']) as CryptoKeyPair;
}

function deploymentContent(
  stage: ModelDeploymentManifestContentV1['stage'],
  modelArtifact: ImmutableReferenceV1,
  modelRegistryEntry: ImmutableReferenceV1,
  runtimeRegistryEntry: ImmutableReferenceV1,
  trainingReceipt: ImmutableReferenceV1,
  evaluationReport: ImmutableReferenceV1,
  previousDeployment: ImmutableReferenceV1 | null,
  rollbackFromModel: ImmutableReferenceV1 | null = null,
  version = '1.0.0',
): ModelDeploymentManifestContentV1 {
  return {
    schemaVersion: '1',
    policyVersion: 'signed-staged-model-deployment-v1',
    manifestId: `gesture-deployment-${stage.toLowerCase()}-${version.replaceAll('.', '-')}`,
    manifestVersion: version,
    createdAt: stage === 'SHADOW' ? '2026-09-05T09:00:00.000Z'
      : stage === 'CANARY' ? '2026-09-05T09:10:00.000Z'
        : stage === 'PRODUCTION' ? '2026-09-05T09:20:00.000Z'
          : '2026-09-05T10:20:00.000Z',
    stage,
    signingKeyId: 'pt7-operator-key',
    modelArtifact,
    modelRegistryEntry,
    runtimeRegistryEntry,
    trainingReceipt,
    evaluationReport,
    operatorReview: ref(`operator-review-${stage.toLowerCase()}`, 'd', version),
    rolloutPercent: stage === 'SHADOW' ? 0 : stage === 'CANARY' ? 10 : 100,
    previousDeployment,
    rollbackFromModel,
  };
}

function expectRegistryErrorCode(action: () => unknown, code: RuntimeModelRegistryIssueCode): void {
  try {
    action();
    throw new Error(`expected ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(RuntimeModelRegistryError);
    expect((error as RuntimeModelRegistryError).issues.map((issue) => issue.code)).toContain(code);
  }
}

async function expectRegistryRejectionCode(action: Promise<unknown>, code: RuntimeModelRegistryIssueCode): Promise<void> {
  try {
    await action;
    throw new Error(`expected ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(RuntimeModelRegistryError);
    expect((error as RuntimeModelRegistryError).issues.map((issue) => issue.code)).toContain(code);
  }
}

describe('PT7 runtime/model registry and reproducible learning jobs', () => {
  it('deduplicates immutable blobs while refusing id/version rebinding and storage tampering', () => {
    const root = directory();
    const store = new FileLearningArtifactStoreV1({ rootDirectory: root, maxArtifactBytes: 1_024 });
    const bytes = new TextEncoder().encode('gesture-model-v1');
    const descriptor = store.put({ id: 'gesture-model', version: '1.0.0', mediaType: 'application/octet-stream', bytes });
    const alias = store.put({ id: 'same-bytes-different-purpose', version: '1.0.0', mediaType: 'application/octet-stream', bytes });
    expect(alias.digest.value).toBe(descriptor.digest.value);
    expect(new TextDecoder().decode(store.get(descriptor))).toBe('gesture-model-v1');

    expect(() => store.put({
      id: 'gesture-model',
      version: '1.0.0',
      mediaType: 'application/octet-stream',
      bytes: new TextEncoder().encode('different-bytes'),
    })).toThrowError(LearningArtifactStoreError);

    const dataPath = join(root, 'sha256', descriptor.digest.value.slice(0, 2), `${descriptor.digest.value}.bin`);
    writeFileSync(dataPath, new TextEncoder().encode('tampered'));
    try {
      store.get(descriptor);
      throw new Error('expected corrupt store refusal');
    } catch (error) {
      expect(error).toBeInstanceOf(LearningArtifactStoreError);
      expect((error as LearningArtifactStoreError).code).toBe('CORRUPT_STORE');
    }
  });

  it('freezes exact runtime identities and distinguishes Product adaptation from Research treatments', () => {
    const product = productRuntimeEntry();
    expect(product.registryDigest.value).toHaveLength(64);
    const { registryDigest: _productDigest, ...productContent } = product;
    const research = buildRuntimeRegistryEntryV1({
      ...productContent,
      runtimeId: 'runtime-research-freeze',
      mode: 'RESEARCH',
      treatmentDisposition: {
        representationTreatment: 'FROZEN',
        monetaEngine: 'TREATMENT_VARIABLE',
        fitnessModel: 'NOT_APPLICABLE',
        nil: 'FROZEN',
        perceptionGestureTreatment: 'FROZEN',
        uiTreatment: 'FROZEN',
      },
    });
    expect(research.mode).toBe('RESEARCH');

    const { registryDigest: _researchDigest, ...researchContent } = research;
    expect(() => buildRuntimeRegistryEntryV1({
      ...researchContent,
      runtimeId: 'runtime-invalid-research',
      treatmentDisposition: { ...research.treatmentDisposition, monetaEngine: 'ADAPTIVE_ALLOWED' },
    })).toThrowError(RuntimeModelRegistryError);
  });

  it('binds PT6 snapshots to exact job inputs and rejects actual runner-environment drift', () => {
    const trainingSnapshot = snapshot();
    const runtimeReference = runtimeRegistryEntryReferenceV1(productRuntimeEntry());
    const environment = ref('python-training-container', 'e');
    const manifest = buildReproducibleTrainingJobManifestV1({
      schemaVersion: '1',
      policyVersion: 'reproducible-training-job-v1',
      jobId: 'gesture-train-job-1',
      jobVersion: '1.0.0',
      createdAt: '2026-09-05T08:10:00.000Z',
      outputKind: 'GESTURE_MODEL',
      dataset: buildGestureTrainingDatasetBindingV1(trainingSnapshot),
      trainingCode: ref('gesture-training-code', 'f'),
      sourceCommitSha: '1'.repeat(40),
      environment,
      trainer: ref('python-trainer', '1'),
      trainerEntrypoint: 'nemosyne.training.gesture:v1',
      runtimeBaseline: runtimeReference,
      holdoutPolicy: ref('gesture-holdout-policy', '2'),
      config: { epochs: 5, learningRate: 0.01, deterministic: true },
      randomSeed: 42,
    });
    expect(manifest.dataset.dataset.digest.value).toBe(trainingSnapshot.snapshotDigest.value);

    const output = ref('gesture-model-artifact', '3');
    const evaluation = ref('gesture-evaluation-report', '4');
    const logs = ref('gesture-training-logs', '5');
    expect(() => buildTrainingJobReceiptV1(manifest, {
      receiptId: 'gesture-train-receipt-drift',
      receiptVersion: '1.0.0',
      startedAt: '2026-09-05T08:20:00.000Z',
      finishedAt: '2026-09-05T08:30:00.000Z',
      status: 'SUCCEEDED',
      runnerEnvironment: ref('different-container', '6'),
      outputModel: output,
      evaluationReport: evaluation,
      logs,
      failureCode: null,
    })).toThrowError(expect.objectContaining({ name: 'TrainingJobContractError' }) as Error);
  });

  it('requires signed shadow -> canary -> production transitions and supports exact rollback', async () => {
    const registry = new RuntimeModelRegistryV1();
    const runtimeReference = runtimeRegistryEntryReferenceV1(registry.registerRuntime(productRuntimeEntry()));
    const dataset = buildGestureTrainingDatasetBindingV1(snapshot());
    const environment = ref('python-training-container', 'e');
    const keyPair = await deploymentKeyPair();
    const authority = { keyId: 'pt7-operator-key', publicKey: keyPair.publicKey };

    const registerVersion = (version: string, character: string, parentModel: ImmutableReferenceV1 | null) => {
      const job = buildReproducibleTrainingJobManifestV1({
        schemaVersion: '1',
        policyVersion: 'reproducible-training-job-v1',
        jobId: `gesture-job-${version.replaceAll('.', '-')}`,
        jobVersion: version,
        createdAt: '2026-09-05T08:10:00.000Z',
        outputKind: 'GESTURE_MODEL',
        dataset,
        trainingCode: ref('gesture-training-code', 'f'),
        sourceCommitSha: character.repeat(40),
        environment,
        trainer: ref('python-trainer', '1'),
        trainerEntrypoint: 'nemosyne.training.gesture:v1',
        runtimeBaseline: runtimeReference,
        holdoutPolicy: ref('gesture-holdout-policy', '2'),
        config: { epochs: 5, deterministic: true },
        randomSeed: 42,
      });
      const model = ref(`gesture-model-${version.replaceAll('.', '-')}`, character, version);
      const evaluation = ref(`gesture-evaluation-${version.replaceAll('.', '-')}`, character === 'a' ? 'b' : 'c', version);
      const receipt = buildTrainingJobReceiptV1(job, {
        receiptId: `gesture-receipt-${version.replaceAll('.', '-')}`,
        receiptVersion: version,
        startedAt: '2026-09-05T08:20:00.000Z',
        finishedAt: '2026-09-05T08:30:00.000Z',
        status: 'SUCCEEDED',
        runnerEnvironment: environment,
        outputModel: model,
        evaluationReport: evaluation,
        logs: ref(`gesture-logs-${version.replaceAll('.', '-')}`, '9', version),
        failureCode: null,
      });
      const entry = registry.registerModel({
        modelId: 'gesture-model',
        modelVersion: version,
        createdAt: '2026-09-05T08:40:00.000Z',
        kind: 'GESTURE_MODEL',
        targetComponent: 'perceptionGestureTreatment',
        modelArtifact: model,
        parentModel,
      }, job, receipt);
      return { reference: modelRegistryEntryReferenceV1(entry), model, evaluation, receipt };
    };

    const first = registerVersion('1.0.0', 'a', null);
    const firstReceipt = trainingJobReceiptReferenceV1(first.receipt);
    const shadow1 = await signModelDeploymentManifestV1(
      deploymentContent('SHADOW', first.model, first.reference, runtimeReference, firstReceipt, first.evaluation, null),
      keyPair.privateKey,
    );
    await registry.applyDeploymentManifest(shadow1, authority);
    const canary1 = await signModelDeploymentManifestV1(
      deploymentContent('CANARY', first.model, first.reference, runtimeReference, firstReceipt, first.evaluation, deploymentManifestReferenceV1(shadow1)),
      keyPair.privateKey,
    );
    await registry.applyDeploymentManifest(canary1, authority);
    const production1 = await signModelDeploymentManifestV1(
      deploymentContent('PRODUCTION', first.model, first.reference, runtimeReference, firstReceipt, first.evaluation, deploymentManifestReferenceV1(canary1)),
      keyPair.privateKey,
    );
    await registry.applyDeploymentManifest(production1, authority);
    expect(registry.currentProduction()?.modelVersion).toBe('1.0.0');

    const second = registerVersion('2.0.0', 'b', first.model);
    const secondReceipt = trainingJobReceiptReferenceV1(second.receipt);
    const shadow2 = await signModelDeploymentManifestV1(
      deploymentContent('SHADOW', second.model, second.reference, runtimeReference, secondReceipt, second.evaluation, null, null, '2.0.0'),
      keyPair.privateKey,
    );
    await registry.applyDeploymentManifest(shadow2, authority);
    const canary2 = await signModelDeploymentManifestV1(
      deploymentContent('CANARY', second.model, second.reference, runtimeReference, secondReceipt, second.evaluation, deploymentManifestReferenceV1(shadow2), null, '2.0.0'),
      keyPair.privateKey,
    );
    await registry.applyDeploymentManifest(canary2, authority);
    const production2 = await signModelDeploymentManifestV1(
      deploymentContent('PRODUCTION', second.model, second.reference, runtimeReference, secondReceipt, second.evaluation, deploymentManifestReferenceV1(canary2), null, '2.0.0'),
      keyPair.privateKey,
    );
    await registry.applyDeploymentManifest(production2, authority);
    expect(registry.modelState(first.reference)).toBe('RETIRED');
    expect(registry.currentProduction()?.modelVersion).toBe('2.0.0');

    const rollback = await signModelDeploymentManifestV1(
      deploymentContent(
        'ROLLBACK',
        first.model,
        first.reference,
        runtimeReference,
        firstReceipt,
        first.evaluation,
        deploymentManifestReferenceV1(production2),
        second.model,
        '3.0.0',
      ),
      keyPair.privateKey,
    );
    await registry.applyDeploymentManifest(rollback, authority);
    expect(registry.modelState(second.reference)).toBe('ROLLED_BACK');
    expect(registry.currentProduction()?.modelVersion).toBe('1.0.0');
    expect(registry.lifecycleHistory().map((event) => event.reason)).toContain('ROLLBACK_FROM');
    await expectRegistryRejectionCode(registry.applyDeploymentManifest(rollback, authority), 'DEPLOYMENT_REPLAY');
  });

  it('rejects forged signatures and keeps deployment observability aggregate-only', async () => {
    const registry = new RuntimeModelRegistryV1();
    const runtimeReference = runtimeRegistryEntryReferenceV1(registry.registerRuntime(productRuntimeEntry()));
    const environment = ref('python-training-container', 'e');
    const job = buildReproducibleTrainingJobManifestV1({
      schemaVersion: '1',
      policyVersion: 'reproducible-training-job-v1',
      jobId: 'gesture-job-observe',
      jobVersion: '1.0.0',
      createdAt: '2026-09-05T08:10:00.000Z',
      outputKind: 'GESTURE_MODEL',
      dataset: buildGestureTrainingDatasetBindingV1(snapshot()),
      trainingCode: ref('gesture-training-code', 'f'),
      sourceCommitSha: '7'.repeat(40),
      environment,
      trainer: ref('python-trainer', '1'),
      trainerEntrypoint: 'nemosyne.training.gesture:v1',
      runtimeBaseline: runtimeReference,
      holdoutPolicy: ref('gesture-holdout-policy', '2'),
      config: { deterministic: true },
      randomSeed: 7,
    });
    const model = ref('gesture-model-observe', '7');
    const evaluation = ref('gesture-evaluation-observe', '8');
    const receipt = buildTrainingJobReceiptV1(job, {
      receiptId: 'gesture-receipt-observe',
      receiptVersion: '1.0.0',
      startedAt: '2026-09-05T08:20:00.000Z',
      finishedAt: '2026-09-05T08:30:00.000Z',
      status: 'SUCCEEDED',
      runnerEnvironment: environment,
      outputModel: model,
      evaluationReport: evaluation,
      logs: ref('gesture-logs-observe', '9'),
      failureCode: null,
    });
    const registered = registry.registerModel({
      modelId: 'gesture-model-observe',
      modelVersion: '1.0.0',
      createdAt: '2026-09-05T08:40:00.000Z',
      kind: 'GESTURE_MODEL',
      targetComponent: 'perceptionGestureTreatment',
      modelArtifact: model,
      parentModel: null,
    }, job, receipt);
    const modelReference = modelRegistryEntryReferenceV1(registered);
    const keys = await deploymentKeyPair();
    const signed = await signModelDeploymentManifestV1(
      deploymentContent('SHADOW', model, modelReference, runtimeReference, trainingJobReceiptReferenceV1(receipt), evaluation, null),
      keys.privateKey,
    );
    const forged = { ...signed, rolloutPercent: 1 } as typeof signed;
    await expectRegistryRejectionCode(
      registry.applyDeploymentManifest(forged, { keyId: 'pt7-operator-key', publicKey: keys.publicKey }),
      'INVALID_DEPLOYMENT_SIGNATURE',
    );

    await registry.applyDeploymentManifest(signed, { keyId: 'pt7-operator-key', publicKey: keys.publicKey });
    registry.recordObservation({
      schemaVersion: '1',
      recordedAt: '2026-09-05T09:05:00.000Z',
      modelRegistryEntry: modelReference,
      runtimeRegistryEntry: runtimeReference,
      outcome: 'MODEL_LOADED',
      count: 3,
    });
    registry.recordObservation({
      schemaVersion: '1',
      recordedAt: '2026-09-05T09:06:00.000Z',
      modelRegistryEntry: modelReference,
      runtimeRegistryEntry: runtimeReference,
      outcome: 'MODEL_LOADED',
      count: 2,
    });
    expect(registry.observationSnapshot()).toMatchObject([{
      outcome: 'MODEL_LOADED',
      count: 5,
      firstRecordedAt: '2026-09-05T09:05:00.000Z',
      lastRecordedAt: '2026-09-05T09:06:00.000Z',
    }]);

    expectRegistryErrorCode(() => registry.recordObservation({
      schemaVersion: '1',
      recordedAt: '2026-09-05T09:07:00.000Z',
      modelRegistryEntry: modelReference,
      runtimeRegistryEntry: runtimeReference,
      outcome: 'MODEL_LOADED',
      count: 1,
      profilePseudonymId: 'must-not-cross-this-boundary',
    } as never), 'INVALID_OBSERVATION');
  });
});
