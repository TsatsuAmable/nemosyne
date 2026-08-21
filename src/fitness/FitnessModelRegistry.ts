export const FITNESS_MODEL_ARTIFACT_SCHEMA_VERSION = '1.0.0' as const;
export const FITNESS_MODEL_REGISTRY_SCHEMA_VERSION = '1.0.0' as const;

export interface FitnessModelEvaluationSummary {
  bootstrapMetric: number;
  candidateMetric: number;
  metricName: string;
  holdoutJudgementCount: number;
  holdoutGroupCount: number;
}

export interface FitnessModelArtifact {
  schemaVersion: typeof FITNESS_MODEL_ARTIFACT_SCHEMA_VERSION;
  modelId: string;
  modelVersion: string;
  modelKind: 'pairwise-linear' | 'ranking-linear' | 'external';
  createdAt: number;
  trainingDatasetHash: string;
  curationPolicyHash: string;
  featureSchemaVersion: string;
  parameters: Readonly<Record<string, number | string | boolean | readonly number[]>>;
  evaluation: FitnessModelEvaluationSummary;
  parentModelHash?: string;
  notes?: string;
}

export interface RegisteredFitnessModel {
  artifact: FitnessModelArtifact;
  artifactHash: string;
}

export interface FitnessModelActivation {
  sequence: number;
  activatedAt: number;
  artifactHash: string | null;
  reason: 'INITIAL' | 'PROMOTE' | 'ROLLBACK' | 'DISABLE';
  previousArtifactHash: string | null;
}

export interface FitnessModelRegistrySnapshot {
  schemaVersion: typeof FITNESS_MODEL_REGISTRY_SCHEMA_VERSION;
  artifacts: readonly RegisteredFitnessModel[];
  activations: readonly FitnessModelActivation[];
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `fnv1a-${hash.toString(16).padStart(8, '0')}`;
}

export function hashFitnessModelArtifact(artifact: FitnessModelArtifact): string {
  return fnv1a(JSON.stringify(canonicalize(artifact)));
}

function nonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

export function assertFitnessModelArtifact(artifact: FitnessModelArtifact): FitnessModelArtifact {
  if (artifact.schemaVersion !== FITNESS_MODEL_ARTIFACT_SCHEMA_VERSION) {
    throw new TypeError(`Unsupported FitnessModelArtifact schema version: ${artifact.schemaVersion}`);
  }
  for (const [name, value] of [
    ['modelId', artifact.modelId],
    ['modelVersion', artifact.modelVersion],
    ['trainingDatasetHash', artifact.trainingDatasetHash],
    ['curationPolicyHash', artifact.curationPolicyHash],
    ['featureSchemaVersion', artifact.featureSchemaVersion],
    ['metricName', artifact.evaluation.metricName],
  ] as const) {
    if (!nonEmpty(value)) throw new TypeError(`${name} must be non-empty`);
  }
  if (!Number.isFinite(artifact.createdAt) || artifact.createdAt < 0) {
    throw new TypeError('createdAt must be finite and non-negative');
  }
  if (!Number.isFinite(artifact.evaluation.bootstrapMetric) || !Number.isFinite(artifact.evaluation.candidateMetric)) {
    throw new TypeError('evaluation metrics must be finite');
  }
  if (!Number.isSafeInteger(artifact.evaluation.holdoutJudgementCount) || artifact.evaluation.holdoutJudgementCount < 1) {
    throw new TypeError('holdoutJudgementCount must be a positive safe integer');
  }
  if (!Number.isSafeInteger(artifact.evaluation.holdoutGroupCount) || artifact.evaluation.holdoutGroupCount < 1) {
    throw new TypeError('holdoutGroupCount must be a positive safe integer');
  }
  return artifact;
}

/**
 * Immutable registry for evaluated fitness-model artifacts.
 *
 * Registration never activates a model. Promotion/rollback is an explicit,
 * append-only operation so historical investigations can remain pinned to an
 * exact artifact hash while current policy can be reverted safely.
 */
export class FitnessModelRegistry {
  private readonly artifacts = new Map<string, RegisteredFitnessModel>();
  private readonly activations: FitnessModelActivation[] = [];
  private activeHash: string | null = null;

  get activeArtifactHash(): string | null {
    return this.activeHash;
  }

  get active(): RegisteredFitnessModel | null {
    if (!this.activeHash) return null;
    const value = this.artifacts.get(this.activeHash);
    return value ? structuredClone(value) : null;
  }

  register(artifact: FitnessModelArtifact): RegisteredFitnessModel {
    assertFitnessModelArtifact(artifact);
    const artifactHash = hashFitnessModelArtifact(artifact);
    const existing = this.artifacts.get(artifactHash);
    if (existing) return structuredClone(existing);
    const versionCollision = [...this.artifacts.values()].find(
      (entry) => entry.artifact.modelId === artifact.modelId && entry.artifact.modelVersion === artifact.modelVersion,
    );
    if (versionCollision) {
      throw new Error(`Model version already registered with different content: ${artifact.modelId}@${artifact.modelVersion}`);
    }
    const registered = { artifact: structuredClone(artifact), artifactHash };
    this.artifacts.set(artifactHash, registered);
    return structuredClone(registered);
  }

  promote(artifactHash: string, activatedAt: number): void {
    if (!this.artifacts.has(artifactHash)) throw new Error(`Unknown fitness model artifact: ${artifactHash}`);
    this.recordActivation(artifactHash, activatedAt, this.activations.length === 0 ? 'INITIAL' : 'PROMOTE');
  }

  rollback(artifactHash: string, activatedAt: number): void {
    if (!this.artifacts.has(artifactHash)) throw new Error(`Unknown rollback target: ${artifactHash}`);
    this.recordActivation(artifactHash, activatedAt, 'ROLLBACK');
  }

  disable(activatedAt: number): void {
    this.recordActivation(null, activatedAt, 'DISABLE');
  }

  history(): readonly FitnessModelActivation[] {
    return structuredClone(this.activations);
  }

  toJSON(): FitnessModelRegistrySnapshot {
    return {
      schemaVersion: FITNESS_MODEL_REGISTRY_SCHEMA_VERSION,
      artifacts: [...this.artifacts.values()].map((entry) => structuredClone(entry)),
      activations: this.history(),
    };
  }

  restore(snapshot: FitnessModelRegistrySnapshot): void {
    if (snapshot.schemaVersion !== FITNESS_MODEL_REGISTRY_SCHEMA_VERSION) {
      throw new Error(`Unsupported FitnessModelRegistry schema version: ${snapshot.schemaVersion}`);
    }
    const staged = new FitnessModelRegistry();
    for (const entry of snapshot.artifacts) {
      const registered = staged.register(entry.artifact);
      if (registered.artifactHash !== entry.artifactHash) {
        throw new Error(`Fitness model artifact hash mismatch: ${entry.artifactHash}`);
      }
    }
    for (const activation of snapshot.activations) {
      if (activation.sequence !== staged.activations.length) throw new Error('Non-contiguous fitness model activation history');
      if (activation.artifactHash !== null && !staged.artifacts.has(activation.artifactHash)) {
        throw new Error(`Activation references unknown artifact: ${activation.artifactHash}`);
      }
      if (activation.previousArtifactHash !== staged.activeHash) {
        throw new Error('Fitness model activation history has inconsistent previousArtifactHash');
      }
      staged.recordActivation(activation.artifactHash, activation.activatedAt, activation.reason);
    }

    this.artifacts.clear();
    for (const [hash, entry] of staged.artifacts) this.artifacts.set(hash, structuredClone(entry));
    this.activations.splice(0, this.activations.length, ...staged.history());
    this.activeHash = staged.activeHash;
  }

  private recordActivation(
    artifactHash: string | null,
    activatedAt: number,
    reason: FitnessModelActivation['reason'],
  ): void {
    if (!Number.isFinite(activatedAt) || activatedAt < 0) throw new TypeError('activatedAt must be finite and non-negative');
    const previousArtifactHash = this.activeHash;
    this.activations.push({
      sequence: this.activations.length,
      activatedAt,
      artifactHash,
      reason,
      previousArtifactHash,
    });
    this.activeHash = artifactHash;
  }
}
