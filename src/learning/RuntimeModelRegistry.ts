import type {
  ImmutableReferenceV1,
  RuntimeComponent,
  RuntimeProvenanceV1,
  Sha256DigestV1,
} from '../governance/GovernedEventContracts.ts';
import { canonicalSha256Hex } from '../security/CryptoHash.ts';
import {
  deploymentManifestReferenceV1,
  verifySignedModelDeploymentManifestV1,
  type SignedModelDeploymentManifestV1,
} from './ModelDeploymentManifest.ts';
import {
  LEARNING_SAFE_ID,
  LEARNING_STABLE_VERSION,
  cloneImmutableReferenceV1,
  deepFreezeLearning,
  exactObjectKeys,
  immutableReferenceKeyV1,
  isImmutableReferenceV1,
  isLearningUtcTimestamp,
  isSha256DigestV1,
  sameImmutableReferenceV1,
  validateRuntimeProvenanceV1,
} from './LearningContractPrimitives.ts';
import {
  trainingJobManifestReferenceV1,
  trainingJobReceiptReferenceV1,
  validateReproducibleTrainingJobManifestV1,
  validateTrainingJobReceiptV1,
  type ReproducibleTrainingJobManifestV1,
  type TrainingJobReceiptV1,
  type TrainingOutputKind,
} from './ReproducibleTrainingJob.ts';

export const RUNTIME_REGISTRY_SCHEMA_VERSION = '1' as const;
export const RUNTIME_REGISTRY_POLICY_VERSION = 'runtime-provenance-registry-v1' as const;
export const OPERATIONAL_MODEL_REGISTRY_SCHEMA_VERSION = '1' as const;
export const OPERATIONAL_MODEL_REGISTRY_POLICY_VERSION = 'operational-model-registry-v1' as const;

export const ADAPTIVE_RUNTIME_COMPONENTS = Object.freeze([
  'representationTreatment',
  'monetaEngine',
  'fitnessModel',
  'nil',
  'perceptionGestureTreatment',
  'uiTreatment',
] as const satisfies readonly RuntimeComponent[]);

export type AdaptiveRuntimeComponent = (typeof ADAPTIVE_RUNTIME_COMPONENTS)[number];
export type RuntimeTreatmentDisposition = 'FROZEN' | 'ADAPTIVE_ALLOWED' | 'TREATMENT_VARIABLE' | 'NOT_APPLICABLE';
export type RuntimeRegistryMode = 'PRODUCT' | 'RESEARCH';

export interface RuntimeRegistryEntryContentV1 {
  readonly schemaVersion: typeof RUNTIME_REGISTRY_SCHEMA_VERSION;
  readonly policyVersion: typeof RUNTIME_REGISTRY_POLICY_VERSION;
  readonly runtimeId: string;
  readonly runtimeVersion: string;
  readonly createdAt: string;
  readonly mode: RuntimeRegistryMode;
  readonly dataset: ImmutableReferenceV1;
  readonly runtime: RuntimeProvenanceV1;
  readonly treatmentDisposition: Readonly<Record<AdaptiveRuntimeComponent, RuntimeTreatmentDisposition>>;
}

export interface RuntimeRegistryEntryV1 extends RuntimeRegistryEntryContentV1 {
  readonly registryDigest: Sha256DigestV1;
}

export type OperationalModelLifecycleState = 'CANDIDATE' | 'SHADOW' | 'CANARY' | 'PRODUCTION' | 'RETIRED' | 'ROLLED_BACK';
export type OperationalModelTargetComponent = 'fitnessModel' | 'perceptionGestureTreatment';

export interface OperationalModelRegistryEntryContentV1 {
  readonly schemaVersion: typeof OPERATIONAL_MODEL_REGISTRY_SCHEMA_VERSION;
  readonly policyVersion: typeof OPERATIONAL_MODEL_REGISTRY_POLICY_VERSION;
  readonly modelId: string;
  readonly modelVersion: string;
  readonly createdAt: string;
  readonly kind: TrainingOutputKind;
  readonly targetComponent: OperationalModelTargetComponent;
  readonly modelArtifact: ImmutableReferenceV1;
  readonly trainingJob: ImmutableReferenceV1;
  readonly trainingReceipt: ImmutableReferenceV1;
  readonly evaluationReport: ImmutableReferenceV1;
  readonly parentModel: ImmutableReferenceV1 | null;
}

export interface OperationalModelRegistryEntryV1 extends OperationalModelRegistryEntryContentV1 {
  readonly registryDigest: Sha256DigestV1;
}

export interface RegisterOperationalModelInputV1 {
  readonly modelId: string;
  readonly modelVersion: string;
  readonly createdAt: string;
  readonly kind: TrainingOutputKind;
  readonly targetComponent: OperationalModelTargetComponent;
  readonly modelArtifact: ImmutableReferenceV1;
  readonly parentModel: ImmutableReferenceV1 | null;
}

export interface ModelLifecycleEventV1 {
  readonly sequence: number;
  readonly occurredAt: string;
  readonly modelRegistryEntry: ImmutableReferenceV1;
  readonly fromState: OperationalModelLifecycleState;
  readonly toState: OperationalModelLifecycleState;
  readonly reason: 'SHADOW' | 'CANARY' | 'PROMOTE' | 'SUPERSEDED' | 'ROLLBACK_FROM' | 'ROLLBACK_TO';
  readonly deploymentManifest: ImmutableReferenceV1;
}

export type ModelRuntimeObservationOutcome = 'MODEL_LOADED' | 'MODEL_LOAD_FAILED' | 'INFERENCE_FAILED';

export interface ModelRuntimeObservationV1 {
  readonly schemaVersion: '1';
  readonly recordedAt: string;
  readonly modelRegistryEntry: ImmutableReferenceV1;
  readonly runtimeRegistryEntry: ImmutableReferenceV1;
  readonly outcome: ModelRuntimeObservationOutcome;
  readonly count: number;
}

export interface ModelRuntimeObservationAggregateV1 {
  readonly modelRegistryEntry: ImmutableReferenceV1;
  readonly runtimeRegistryEntry: ImmutableReferenceV1;
  readonly outcome: ModelRuntimeObservationOutcome;
  readonly count: number;
  readonly firstRecordedAt: string;
  readonly lastRecordedAt: string;
}

export type RuntimeModelRegistryIssueCode =
  | 'INVALID_RUNTIME_ENTRY'
  | 'RUNTIME_DIGEST_MISMATCH'
  | 'RUNTIME_VERSION_COLLISION'
  | 'INVALID_MODEL_ENTRY'
  | 'MODEL_DIGEST_MISMATCH'
  | 'MODEL_VERSION_COLLISION'
  | 'TRAINING_LINEAGE_MISMATCH'
  | 'UNKNOWN_RUNTIME'
  | 'UNKNOWN_MODEL'
  | 'INVALID_DEPLOYMENT_SIGNATURE'
  | 'DEPLOYMENT_BINDING_MISMATCH'
  | 'INVALID_LIFECYCLE_TRANSITION'
  | 'DEPLOYMENT_REPLAY'
  | 'INVALID_OBSERVATION';

export interface RuntimeModelRegistryIssueV1 {
  readonly code: RuntimeModelRegistryIssueCode;
  readonly path: string;
  readonly message: string;
}

export class RuntimeModelRegistryError extends Error {
  readonly issues: readonly RuntimeModelRegistryIssueV1[];

  constructor(issues: readonly RuntimeModelRegistryIssueV1[]) {
    super(issues.map((issue) => `${issue.path}: ${issue.message}`).join('; '));
    this.name = 'RuntimeModelRegistryError';
    this.issues = Object.freeze([...issues]);
  }
}

function cloneRuntimeProvenance(runtime: RuntimeProvenanceV1): RuntimeProvenanceV1 {
  const components = Object.fromEntries(Object.entries(runtime.components).map(([name, reference]) => [
    name,
    reference === null ? null : {
      schemaVersion: '1' as const,
      componentId: reference.componentId,
      version: reference.version,
      artifactDigest: { algorithm: 'SHA256' as const, value: reference.artifactDigest.value },
    },
  ])) as unknown as RuntimeProvenanceV1['components'];
  return {
    schemaVersion: '1',
    components,
    randomSeeds: { ...runtime.randomSeeds },
  };
}

function validateTreatmentDisposition(
  mode: RuntimeRegistryMode,
  runtime: RuntimeProvenanceV1,
  disposition: Readonly<Record<AdaptiveRuntimeComponent, RuntimeTreatmentDisposition>>,
): RuntimeModelRegistryIssueV1[] {
  const issues: RuntimeModelRegistryIssueV1[] = [];
  if (!exactObjectKeys(disposition, ADAPTIVE_RUNTIME_COMPONENTS)) {
    return [{ code: 'INVALID_RUNTIME_ENTRY', path: 'treatmentDisposition', message: 'must classify every adaptive runtime component exactly once' }];
  }
  for (const component of ADAPTIVE_RUNTIME_COMPONENTS) {
    const value = disposition[component];
    const reference = runtime.components[component];
    if (!['FROZEN', 'ADAPTIVE_ALLOWED', 'TREATMENT_VARIABLE', 'NOT_APPLICABLE'].includes(value)) {
      issues.push({ code: 'INVALID_RUNTIME_ENTRY', path: `treatmentDisposition.${component}`, message: 'unknown treatment disposition' });
      continue;
    }
    if (reference === null && value !== 'NOT_APPLICABLE') {
      issues.push({ code: 'INVALID_RUNTIME_ENTRY', path: `treatmentDisposition.${component}`, message: 'null runtime components must be explicitly NOT_APPLICABLE' });
    }
    if (reference !== null && value === 'NOT_APPLICABLE') {
      issues.push({ code: 'INVALID_RUNTIME_ENTRY', path: `treatmentDisposition.${component}`, message: 'present runtime components may not be marked NOT_APPLICABLE' });
    }
    if (mode === 'RESEARCH' && value === 'ADAPTIVE_ALLOWED') {
      issues.push({ code: 'INVALID_RUNTIME_ENTRY', path: `treatmentDisposition.${component}`, message: 'Research Mode must freeze adaptive state or declare it as a treatment variable' });
    }
    if (mode === 'PRODUCT' && value === 'TREATMENT_VARIABLE') {
      issues.push({ code: 'INVALID_RUNTIME_ENTRY', path: `treatmentDisposition.${component}`, message: 'Product Mode may freeze or adapt a component but may not masquerade as a research treatment' });
    }
  }
  return issues;
}

export function buildRuntimeRegistryEntryV1(input: RuntimeRegistryEntryContentV1): RuntimeRegistryEntryV1 {
  const content: RuntimeRegistryEntryContentV1 = {
    schemaVersion: RUNTIME_REGISTRY_SCHEMA_VERSION,
    policyVersion: RUNTIME_REGISTRY_POLICY_VERSION,
    runtimeId: input.runtimeId,
    runtimeVersion: input.runtimeVersion,
    createdAt: input.createdAt,
    mode: input.mode,
    dataset: cloneImmutableReferenceV1(input.dataset),
    runtime: cloneRuntimeProvenance(input.runtime),
    treatmentDisposition: { ...input.treatmentDisposition },
  };
  const candidate = {
    ...content,
    registryDigest: { algorithm: 'SHA256' as const, value: canonicalSha256Hex(content) },
  };
  const issues = validateRuntimeRegistryEntryV1(candidate);
  if (issues.length > 0) throw new RuntimeModelRegistryError(issues);
  return deepFreezeLearning(candidate);
}

export function validateRuntimeRegistryEntryV1(entry: RuntimeRegistryEntryV1): readonly RuntimeModelRegistryIssueV1[] {
  const issues: RuntimeModelRegistryIssueV1[] = [];
  if (
    !entry ||
    entry.schemaVersion !== RUNTIME_REGISTRY_SCHEMA_VERSION ||
    entry.policyVersion !== RUNTIME_REGISTRY_POLICY_VERSION ||
    !LEARNING_SAFE_ID.test(entry.runtimeId ?? '') ||
    !LEARNING_STABLE_VERSION.test(entry.runtimeVersion ?? '') ||
    !isLearningUtcTimestamp(entry.createdAt) ||
    (entry.mode !== 'PRODUCT' && entry.mode !== 'RESEARCH') ||
    !isImmutableReferenceV1(entry.dataset)
  ) {
    issues.push({ code: 'INVALID_RUNTIME_ENTRY', path: 'runtime', message: 'runtime registry identity, mode, dataset, or timestamp is invalid' });
  }
  for (const message of validateRuntimeProvenanceV1(entry?.runtime)) {
    issues.push({ code: 'INVALID_RUNTIME_ENTRY', path: 'runtime', message });
  }
  if (entry?.runtime) issues.push(...validateTreatmentDisposition(entry.mode, entry.runtime, entry.treatmentDisposition));
  if (!isSha256DigestV1(entry?.registryDigest)) {
    issues.push({ code: 'RUNTIME_DIGEST_MISMATCH', path: 'registryDigest', message: 'runtime registry digest must be SHA-256' });
  } else {
    const { registryDigest: _digest, ...content } = entry;
    if (canonicalSha256Hex(content) !== entry.registryDigest.value) {
      issues.push({ code: 'RUNTIME_DIGEST_MISMATCH', path: 'registryDigest.value', message: 'runtime registry content does not match its immutable digest' });
    }
  }
  return issues;
}

export function runtimeRegistryEntryReferenceV1(entry: RuntimeRegistryEntryV1): ImmutableReferenceV1 {
  const issues = validateRuntimeRegistryEntryV1(entry);
  if (issues.length > 0) throw new RuntimeModelRegistryError(issues);
  return deepFreezeLearning({
    schemaVersion: '1' as const,
    id: entry.runtimeId,
    version: entry.runtimeVersion,
    digest: { algorithm: 'SHA256' as const, value: entry.registryDigest.value },
  });
}

function validateOperationalModelEntryV1(entry: OperationalModelRegistryEntryV1): RuntimeModelRegistryIssueV1[] {
  const issues: RuntimeModelRegistryIssueV1[] = [];
  if (
    !entry ||
    entry.schemaVersion !== OPERATIONAL_MODEL_REGISTRY_SCHEMA_VERSION ||
    entry.policyVersion !== OPERATIONAL_MODEL_REGISTRY_POLICY_VERSION ||
    !LEARNING_SAFE_ID.test(entry.modelId ?? '') ||
    !LEARNING_STABLE_VERSION.test(entry.modelVersion ?? '') ||
    !isLearningUtcTimestamp(entry.createdAt) ||
    !['GESTURE_MODEL', 'FITNESS_MODEL'].includes(entry.kind) ||
    !['fitnessModel', 'perceptionGestureTreatment'].includes(entry.targetComponent)
  ) {
    issues.push({ code: 'INVALID_MODEL_ENTRY', path: 'model', message: 'operational model identity, kind, target component, or timestamp is invalid' });
  }
  for (const [path, reference] of [
    ['modelArtifact', entry?.modelArtifact],
    ['trainingJob', entry?.trainingJob],
    ['trainingReceipt', entry?.trainingReceipt],
    ['evaluationReport', entry?.evaluationReport],
  ] as const) {
    if (!isImmutableReferenceV1(reference)) {
      issues.push({ code: 'INVALID_MODEL_ENTRY', path, message: 'must be an immutable versioned artifact reference' });
    }
  }
  if (entry?.parentModel !== null && !isImmutableReferenceV1(entry.parentModel)) {
    issues.push({ code: 'INVALID_MODEL_ENTRY', path: 'parentModel', message: 'must be null or an immutable parent-model reference' });
  }
  if (entry?.kind === 'GESTURE_MODEL' && entry.targetComponent !== 'perceptionGestureTreatment') {
    issues.push({ code: 'INVALID_MODEL_ENTRY', path: 'targetComponent', message: 'gesture models may only target the perception/gesture runtime component' });
  }
  if (entry?.kind === 'FITNESS_MODEL' && entry.targetComponent !== 'fitnessModel') {
    issues.push({ code: 'INVALID_MODEL_ENTRY', path: 'targetComponent', message: 'fitness models may only target the existing Moneta fitness-model authority slot' });
  }
  if (!isSha256DigestV1(entry?.registryDigest)) {
    issues.push({ code: 'MODEL_DIGEST_MISMATCH', path: 'registryDigest', message: 'model registry digest must be SHA-256' });
  } else {
    const { registryDigest: _digest, ...content } = entry;
    if (canonicalSha256Hex(content) !== entry.registryDigest.value) {
      issues.push({ code: 'MODEL_DIGEST_MISMATCH', path: 'registryDigest.value', message: 'model registry content does not match its immutable digest' });
    }
  }
  return issues;
}

export function modelRegistryEntryReferenceV1(entry: OperationalModelRegistryEntryV1): ImmutableReferenceV1 {
  const issues = validateOperationalModelEntryV1(entry);
  if (issues.length > 0) throw new RuntimeModelRegistryError(issues);
  return deepFreezeLearning({
    schemaVersion: '1' as const,
    id: entry.modelId,
    version: entry.modelVersion,
    digest: { algorithm: 'SHA256' as const, value: entry.registryDigest.value },
  });
}

function modelArtifactKey(entry: OperationalModelRegistryEntryV1): string {
  return immutableReferenceKeyV1(entry.modelArtifact);
}

export class RuntimeModelRegistryV1 {
  private readonly runtimes = new Map<string, RuntimeRegistryEntryV1>();
  private readonly runtimeVersions = new Map<string, string>();
  private readonly models = new Map<string, OperationalModelRegistryEntryV1>();
  private readonly modelArtifactToRegistry = new Map<string, string>();
  private readonly modelVersions = new Map<string, string>();
  private readonly modelStates = new Map<string, OperationalModelLifecycleState>();
  private readonly latestDeploymentByModel = new Map<string, ImmutableReferenceV1>();
  private readonly appliedDeployments = new Set<string>();
  private readonly everProduction = new Set<string>();
  private readonly lifecycleEvents: ModelLifecycleEventV1[] = [];
  private readonly observations = new Map<string, ModelRuntimeObservationAggregateV1>();
  private currentProductionModelKey: string | null = null;

  registerRuntime(entry: RuntimeRegistryEntryV1): RuntimeRegistryEntryV1 {
    const issues = validateRuntimeRegistryEntryV1(entry);
    if (issues.length > 0) throw new RuntimeModelRegistryError(issues);
    const reference = runtimeRegistryEntryReferenceV1(entry);
    const key = immutableReferenceKeyV1(reference);
    const versionKey = `${entry.runtimeId}@${entry.runtimeVersion}`;
    const existingDigest = this.runtimeVersions.get(versionKey);
    if (existingDigest && existingDigest !== entry.registryDigest.value) {
      throw new RuntimeModelRegistryError([{
        code: 'RUNTIME_VERSION_COLLISION', path: 'runtimeVersion', message: `${versionKey} is already registered with different content`,
      }]);
    }
    this.runtimeVersions.set(versionKey, entry.registryDigest.value);
    if (!this.runtimes.has(key)) this.runtimes.set(key, structuredClone(entry));
    return structuredClone(this.runtimes.get(key)!);
  }

  registerModel(
    input: RegisterOperationalModelInputV1,
    manifest: ReproducibleTrainingJobManifestV1,
    receipt: TrainingJobReceiptV1,
  ): OperationalModelRegistryEntryV1 {
    const lineageIssues = [
      ...validateReproducibleTrainingJobManifestV1(manifest),
      ...validateTrainingJobReceiptV1(receipt, manifest),
    ];
    if (lineageIssues.length > 0 || receipt.status !== 'SUCCEEDED' || !receipt.outputModel || !receipt.evaluationReport) {
      throw new RuntimeModelRegistryError([{
        code: 'TRAINING_LINEAGE_MISMATCH',
        path: 'training',
        message: lineageIssues.length > 0
          ? `training lineage is invalid: ${lineageIssues.map((issue) => issue.code).join(',')}`
          : 'only successful training receipts with immutable model/evaluation outputs may be registered',
      }]);
    }
    if (manifest.outputKind !== input.kind || !sameImmutableReferenceV1(receipt.outputModel, input.modelArtifact)) {
      throw new RuntimeModelRegistryError([{
        code: 'TRAINING_LINEAGE_MISMATCH', path: 'modelArtifact', message: 'registered model kind/artifact must equal the exact reproducible training output',
      }]);
    }
    const content: OperationalModelRegistryEntryContentV1 = {
      schemaVersion: OPERATIONAL_MODEL_REGISTRY_SCHEMA_VERSION,
      policyVersion: OPERATIONAL_MODEL_REGISTRY_POLICY_VERSION,
      modelId: input.modelId,
      modelVersion: input.modelVersion,
      createdAt: input.createdAt,
      kind: input.kind,
      targetComponent: input.targetComponent,
      modelArtifact: cloneImmutableReferenceV1(input.modelArtifact),
      trainingJob: trainingJobManifestReferenceV1(manifest),
      trainingReceipt: trainingJobReceiptReferenceV1(receipt),
      evaluationReport: cloneImmutableReferenceV1(receipt.evaluationReport),
      parentModel: input.parentModel ? cloneImmutableReferenceV1(input.parentModel) : null,
    };
    const entry: OperationalModelRegistryEntryV1 = {
      ...content,
      registryDigest: { algorithm: 'SHA256', value: canonicalSha256Hex(content) },
    };
    const issues = validateOperationalModelEntryV1(entry);
    if (issues.length > 0) throw new RuntimeModelRegistryError(issues);

    const reference = modelRegistryEntryReferenceV1(entry);
    const key = immutableReferenceKeyV1(reference);
    const versionKey = `${entry.modelId}@${entry.modelVersion}`;
    const existingDigest = this.modelVersions.get(versionKey);
    if (existingDigest && existingDigest !== entry.registryDigest.value) {
      throw new RuntimeModelRegistryError([{
        code: 'MODEL_VERSION_COLLISION', path: 'modelVersion', message: `${versionKey} is already registered with different lineage/content`,
      }]);
    }
    const artifactKey = modelArtifactKey(entry);
    const existingArtifactRegistration = this.modelArtifactToRegistry.get(artifactKey);
    if (existingArtifactRegistration && existingArtifactRegistration !== key) {
      throw new RuntimeModelRegistryError([{
        code: 'MODEL_VERSION_COLLISION', path: 'modelArtifact', message: 'one immutable model artifact may not be rebound to a different operational registry identity',
      }]);
    }
    this.modelVersions.set(versionKey, entry.registryDigest.value);
    this.modelArtifactToRegistry.set(artifactKey, key);
    if (!this.models.has(key)) {
      this.models.set(key, structuredClone(entry));
      this.modelStates.set(key, 'CANDIDATE');
    }
    return structuredClone(this.models.get(key)!);
  }

  runtime(reference: ImmutableReferenceV1): RuntimeRegistryEntryV1 | null {
    const value = this.runtimes.get(immutableReferenceKeyV1(reference));
    return value ? structuredClone(value) : null;
  }

  model(reference: ImmutableReferenceV1): OperationalModelRegistryEntryV1 | null {
    const value = this.models.get(immutableReferenceKeyV1(reference));
    return value ? structuredClone(value) : null;
  }

  modelState(reference: ImmutableReferenceV1): OperationalModelLifecycleState | null {
    return this.modelStates.get(immutableReferenceKeyV1(reference)) ?? null;
  }

  currentProduction(): OperationalModelRegistryEntryV1 | null {
    if (!this.currentProductionModelKey) return null;
    const value = this.models.get(this.currentProductionModelKey);
    return value ? structuredClone(value) : null;
  }

  lifecycleHistory(): readonly ModelLifecycleEventV1[] {
    return structuredClone(this.lifecycleEvents);
  }

  latestDeployment(reference: ImmutableReferenceV1): ImmutableReferenceV1 | null {
    const value = this.latestDeploymentByModel.get(immutableReferenceKeyV1(reference));
    return value ? structuredClone(value) : null;
  }

  async applyDeploymentManifest(
    manifest: SignedModelDeploymentManifestV1,
    authority: Readonly<{ keyId: string; publicKey: CryptoKey }>,
  ): Promise<void> {
    const signatureIssues = await verifySignedModelDeploymentManifestV1(manifest, authority.publicKey);
    if (signatureIssues.length > 0 || manifest.signingKeyId !== authority.keyId) {
      throw new RuntimeModelRegistryError([{
        code: 'INVALID_DEPLOYMENT_SIGNATURE',
        path: 'signature',
        message: signatureIssues.length > 0
          ? signatureIssues.map((issue) => issue.code).join(',')
          : 'manifest signingKeyId does not match the configured operator authority',
      }]);
    }
    if (this.appliedDeployments.has(manifest.manifestDigest.value)) {
      throw new RuntimeModelRegistryError([{
        code: 'DEPLOYMENT_REPLAY', path: 'manifestDigest', message: 'the exact signed deployment manifest has already been applied',
      }]);
    }

    const modelKey = immutableReferenceKeyV1(manifest.modelRegistryEntry);
    const model = this.models.get(modelKey);
    if (!model) throw new RuntimeModelRegistryError([{ code: 'UNKNOWN_MODEL', path: 'modelRegistryEntry', message: 'deployment references an unknown operational model' }]);
    const runtimeKey = immutableReferenceKeyV1(manifest.runtimeRegistryEntry);
    if (!this.runtimes.has(runtimeKey)) {
      throw new RuntimeModelRegistryError([{ code: 'UNKNOWN_RUNTIME', path: 'runtimeRegistryEntry', message: 'deployment references an unknown runtime registry entry' }]);
    }
    if (
      !sameImmutableReferenceV1(manifest.modelArtifact, model.modelArtifact) ||
      !sameImmutableReferenceV1(manifest.trainingReceipt, model.trainingReceipt) ||
      !sameImmutableReferenceV1(manifest.evaluationReport, model.evaluationReport)
    ) {
      throw new RuntimeModelRegistryError([{
        code: 'DEPLOYMENT_BINDING_MISMATCH', path: 'manifest', message: 'deployment model/training/evaluation references do not equal the registered immutable lineage',
      }]);
    }

    const state = this.modelStates.get(modelKey)!;
    const deploymentReference = deploymentManifestReferenceV1(manifest);
    const latestForModel = this.latestDeploymentByModel.get(modelKey) ?? null;
    if (manifest.stage === 'SHADOW') {
      if (state !== 'CANDIDATE') this.invalidTransition(state, manifest.stage);
      this.transition(modelKey, state, 'SHADOW', 'SHADOW', deploymentReference, manifest.createdAt);
    } else if (manifest.stage === 'CANARY') {
      if (state !== 'SHADOW' || !latestForModel || !sameImmutableReferenceV1(manifest.previousDeployment!, latestForModel)) {
        this.invalidTransition(state, manifest.stage, 'canary must chain the exact shadow deployment');
      }
      this.transition(modelKey, state, 'CANARY', 'CANARY', deploymentReference, manifest.createdAt);
    } else if (manifest.stage === 'PRODUCTION') {
      if (state !== 'CANARY' || !latestForModel || !sameImmutableReferenceV1(manifest.previousDeployment!, latestForModel)) {
        this.invalidTransition(state, manifest.stage, 'production must chain the exact canary deployment');
      }
      if (this.currentProductionModelKey && this.currentProductionModelKey !== modelKey) {
        const priorState = this.modelStates.get(this.currentProductionModelKey)!;
        this.transition(this.currentProductionModelKey, priorState, 'RETIRED', 'SUPERSEDED', deploymentReference, manifest.createdAt);
      }
      this.transition(modelKey, state, 'PRODUCTION', 'PROMOTE', deploymentReference, manifest.createdAt);
      this.currentProductionModelKey = modelKey;
      this.everProduction.add(modelKey);
    } else {
      if (!this.currentProductionModelKey || this.currentProductionModelKey === modelKey || !this.everProduction.has(modelKey)) {
        this.invalidTransition(state, manifest.stage, 'rollback target must be a different model that previously held production');
      }
      const failedKey = this.currentProductionModelKey;
      const failedModel = this.models.get(failedKey)!;
      const failedLatest = this.latestDeploymentByModel.get(failedKey);
      if (
        !failedLatest ||
        !sameImmutableReferenceV1(manifest.previousDeployment!, failedLatest) ||
        !sameImmutableReferenceV1(manifest.rollbackFromModel!, failedModel.modelArtifact)
      ) {
        throw new RuntimeModelRegistryError([{
          code: 'DEPLOYMENT_BINDING_MISMATCH', path: 'rollback', message: 'rollback must bind the exact current production deployment and failed model artifact',
        }]);
      }
      const failedState = this.modelStates.get(failedKey)!;
      if (failedState !== 'PRODUCTION') this.invalidTransition(failedState, manifest.stage, 'rollback source must currently be production');
      this.transition(failedKey, failedState, 'ROLLED_BACK', 'ROLLBACK_FROM', deploymentReference, manifest.createdAt);
      this.transition(modelKey, state, 'PRODUCTION', 'ROLLBACK_TO', deploymentReference, manifest.createdAt);
      this.currentProductionModelKey = modelKey;
    }

    this.latestDeploymentByModel.set(modelKey, deploymentReference);
    this.appliedDeployments.add(manifest.manifestDigest.value);
  }

  recordObservation(observation: ModelRuntimeObservationV1): void {
    if (
      !observation ||
      !exactObjectKeys(observation, ['schemaVersion', 'recordedAt', 'modelRegistryEntry', 'runtimeRegistryEntry', 'outcome', 'count']) ||
      observation.schemaVersion !== '1' ||
      !isLearningUtcTimestamp(observation.recordedAt) ||
      !isImmutableReferenceV1(observation.modelRegistryEntry) ||
      !isImmutableReferenceV1(observation.runtimeRegistryEntry) ||
      !['MODEL_LOADED', 'MODEL_LOAD_FAILED', 'INFERENCE_FAILED'].includes(observation.outcome) ||
      !Number.isSafeInteger(observation.count) || observation.count < 1 || observation.count > 1_000_000
    ) {
      throw new RuntimeModelRegistryError([{ code: 'INVALID_OBSERVATION', path: 'observation', message: 'model runtime observation violates the closed privacy-safe aggregate contract' }]);
    }
    const modelKey = immutableReferenceKeyV1(observation.modelRegistryEntry);
    const runtimeKey = immutableReferenceKeyV1(observation.runtimeRegistryEntry);
    if (!this.models.has(modelKey)) throw new RuntimeModelRegistryError([{ code: 'UNKNOWN_MODEL', path: 'modelRegistryEntry', message: 'observation references an unknown model' }]);
    if (!this.runtimes.has(runtimeKey)) throw new RuntimeModelRegistryError([{ code: 'UNKNOWN_RUNTIME', path: 'runtimeRegistryEntry', message: 'observation references an unknown runtime' }]);
    if (this.modelStates.get(modelKey) === 'CANDIDATE') {
      throw new RuntimeModelRegistryError([{ code: 'INVALID_OBSERVATION', path: 'modelRegistryEntry', message: 'candidate models have no runtime distribution and may not emit deployment observations' }]);
    }
    const aggregateKey = `${modelKey}|${runtimeKey}|${observation.outcome}`;
    const prior = this.observations.get(aggregateKey);
    const aggregate: ModelRuntimeObservationAggregateV1 = prior ? {
      ...prior,
      count: prior.count + observation.count,
      firstRecordedAt: Date.parse(prior.firstRecordedAt) <= Date.parse(observation.recordedAt) ? prior.firstRecordedAt : observation.recordedAt,
      lastRecordedAt: Date.parse(prior.lastRecordedAt) >= Date.parse(observation.recordedAt) ? prior.lastRecordedAt : observation.recordedAt,
    } : {
      modelRegistryEntry: cloneImmutableReferenceV1(observation.modelRegistryEntry),
      runtimeRegistryEntry: cloneImmutableReferenceV1(observation.runtimeRegistryEntry),
      outcome: observation.outcome,
      count: observation.count,
      firstRecordedAt: observation.recordedAt,
      lastRecordedAt: observation.recordedAt,
    };
    if (!Number.isSafeInteger(aggregate.count)) {
      throw new RuntimeModelRegistryError([{ code: 'INVALID_OBSERVATION', path: 'count', message: 'aggregate observation count overflowed safe integer range' }]);
    }
    this.observations.set(aggregateKey, aggregate);
  }

  observationSnapshot(): readonly ModelRuntimeObservationAggregateV1[] {
    return [...this.observations.values()]
      .sort((left, right) => {
        const a = `${immutableReferenceKeyV1(left.modelRegistryEntry)}|${immutableReferenceKeyV1(left.runtimeRegistryEntry)}|${left.outcome}`;
        const b = `${immutableReferenceKeyV1(right.modelRegistryEntry)}|${immutableReferenceKeyV1(right.runtimeRegistryEntry)}|${right.outcome}`;
        return a.localeCompare(b);
      })
      .map((entry) => structuredClone(entry));
  }

  private transition(
    modelKey: string,
    fromState: OperationalModelLifecycleState,
    toState: OperationalModelLifecycleState,
    reason: ModelLifecycleEventV1['reason'],
    deploymentManifest: ImmutableReferenceV1,
    occurredAt: string,
  ): void {
    const model = this.models.get(modelKey)!;
    this.modelStates.set(modelKey, toState);
    this.lifecycleEvents.push({
      sequence: this.lifecycleEvents.length,
      occurredAt,
      modelRegistryEntry: modelRegistryEntryReferenceV1(model),
      fromState,
      toState,
      reason,
      deploymentManifest: cloneImmutableReferenceV1(deploymentManifest),
    });
  }

  private invalidTransition(state: OperationalModelLifecycleState, stage: string, detail?: string): never {
    throw new RuntimeModelRegistryError([{
      code: 'INVALID_LIFECYCLE_TRANSITION',
      path: 'stage',
      message: detail ?? `cannot apply ${stage} while model state is ${state}`,
    }]);
  }
}
