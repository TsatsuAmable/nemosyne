export type SemanticMaterialisationLevel = 'COARSE' | 'REFINED';

export interface SemanticMaterialisationIdentity {
  datasetFingerprint: string;
  datasetGeneration: number | null;
  decisionId: string | null;
  datasetVersion: number | null;
  semanticId: string;
}

export const SEMANTIC_MATERIALISATION_COST_SCHEMA_V1 = 'semantic-materialisation-cost/v1' as const;

/** Presentation-only resource accounting. These values carry no analytical meaning. */
export interface SemanticMaterialisationCostV1 {
  schemaVersion: typeof SEMANTIC_MATERIALISATION_COST_SCHEMA_V1;
  retainedBytes: number;
  semanticElements: number;
  renderBatches: number;
  materialisationWorkUnits: number;
}

export interface SemanticMaterialisationRequest {
  identity: SemanticMaterialisationIdentity;
  level: SemanticMaterialisationLevel;
  cost?: SemanticMaterialisationCostV1;
}

export const SEMANTIC_MATERIALISATION_DESCRIPTOR_SCHEMA_V1 =
  'semantic-materialisation-descriptor/v1' as const;

export interface SemanticMaterialisationDescriptorV1 {
  schemaVersion: typeof SEMANTIC_MATERIALISATION_DESCRIPTOR_SCHEMA_V1;
  identity: SemanticMaterialisationIdentity;
  level: SemanticMaterialisationLevel;
}

export interface SemanticMaterialisationPolicy {
  policyVersion: string;
  maxResident: number;
  maxQueued: number;
  maxMaterialisationsPerTick: number;
  maxRetainedBytes?: number;
  maxSemanticElements?: number;
  maxRenderBatches?: number;
  maxMaterialisationWorkUnits?: number;
}

export interface SemanticMaterialisationSnapshot {
  policyVersion: string;
  resident: number;
  queued: number;
  refused: number;
  materialised: number;
  promoted: number;
  collapsed: number;
  evicted: number;
  reconstructed: number;
  admittedCost: Omit<SemanticMaterialisationCostV1, 'schemaVersion'>;
}

export type SemanticMaterialisationResult<T> =
  { status: 'MATERIALISED'; value: T } | { status: 'REFUSED'; reason: string };

interface Pending<T> {
  request: SemanticMaterialisationRequest;
  materialise: () => T;
  reconstruction: boolean;
}

/**
 * UXR3 presentation-only authority for a bounded semantic working set.
 *
 * It deliberately stores no source rows, Dataset objects, Three.js objects or analytical
 * authority. Callers provide a bounded materialiser and remain responsible for deriving it
 * from durable semantic/analytical authority. Backpressure refuses excess demand rather than
 * silently selecting a different semantic focus.
 */
export class SemanticMaterialisationGovernor<T> {
  private readonly resident = new Map<string, T>();
  private readonly residentCost = new Map<string, SemanticMaterialisationCostV1>();
  private readonly queue: Pending<T>[] = [];
  private refused = 0;
  private materialised = 0;
  private promoted = 0;
  private collapsed = 0;
  private evicted = 0;
  private reconstructed = 0;

  public constructor(private readonly policy: Readonly<SemanticMaterialisationPolicy>) {
    if (!policy.policyVersion)
      throw new Error('Semantic materialisation policyVersion is required');
    for (const value of [policy.maxResident, policy.maxQueued, policy.maxMaterialisationsPerTick, policy.maxRetainedBytes, policy.maxSemanticElements, policy.maxRenderBatches, policy.maxMaterialisationWorkUnits].filter((value): value is number => value !== undefined)) {
      if (!Number.isSafeInteger(value) || value < 0) {
        throw new Error('Semantic materialisation limits must be non-negative integers');
      }
    }
  }

  public request(
    request: SemanticMaterialisationRequest,
    materialise: () => T
  ): { accepted: boolean; reason?: string } {
    return this.enqueue(request, materialise, false);
  }

  public reconstruct(
    descriptor: unknown,
    request: SemanticMaterialisationRequest,
    materialise: () => T
  ): { accepted: boolean; reason?: string } {
    const identityError = this.validateIdentity(request.identity);
    if (identityError) return this.refuse(identityError);
    if (!semanticMaterialisationDescriptorMatches(descriptor, request)) {
      return this.refuse('SEMANTIC_RECONSTRUCTION_DESCRIPTOR_MISMATCH');
    }
    return this.enqueue(request, materialise, true);
  }

  private enqueue(
    request: SemanticMaterialisationRequest,
    materialise: () => T,
    reconstruction: boolean
  ): { accepted: boolean; reason?: string } {
    const identityError = this.validateIdentity(request.identity);
    if (identityError) return this.refuse(identityError);
    const costError = this.validateCost(request.cost);
    if (costError) return this.refuse(costError);
    const key = semanticMaterialisationKey(request.identity, request.level);
    if (
      this.resident.has(key) ||
      this.queue.some(
        (entry) => semanticMaterialisationKey(entry.request.identity, entry.request.level) === key
      )
    ) {
      return { accepted: true };
    }
    if (this.queue.length >= this.policy.maxQueued)
      return this.refuse('SEMANTIC_BACKPRESSURE_QUEUE_FULL');
    const isReplacement = this.hasOppositeLevel(request);
    const oppositeKey = semanticMaterialisationKey(request.identity, oppositeMaterialisationLevel(request.level));
    const replacedCost = isReplacement ? this.residentCost.get(oppositeKey) : undefined;
    if (!this.costFits(request.cost, replacedCost)) return this.refuse('SEMANTIC_PRESENTATION_COST_BOUND_REACHED');
    if (
      this.resident.size >= this.policy.maxResident &&
      this.queue.length === 0 &&
      !isReplacement
    ) {
      return this.refuse('SEMANTIC_RESIDENCY_BOUND_REACHED');
    }
    this.queue.push({ request: cloneRequest(request), materialise, reconstruction });
    return { accepted: true };
  }

  public tick(): SemanticMaterialisationResult<T>[] {
    const results: SemanticMaterialisationResult<T>[] = [];
    let budget = this.policy.maxMaterialisationsPerTick;
    while (budget > 0 && this.queue.length > 0) {
      let pendingIndex = 0;
      if (this.resident.size >= this.policy.maxResident) {
        pendingIndex = this.queue.findIndex((candidate) =>
          this.hasOppositeLevel(candidate.request)
        );
        if (pendingIndex < 0) break;
      }
      const [pending] = this.queue.splice(pendingIndex, 1);
      const oppositeLevel = oppositeMaterialisationLevel(pending.request.level);
      const oppositeKey = semanticMaterialisationKey(pending.request.identity, oppositeLevel);
      const isReplacement = this.resident.has(oppositeKey);
      try {
        const value = pending.materialise();
        if (isReplacement) {
          this.resident.delete(oppositeKey);
          this.residentCost.delete(oppositeKey);
          if (pending.request.level === 'REFINED') this.promoted += 1;
          else this.collapsed += 1;
        }
        const residentKey = semanticMaterialisationKey(pending.request.identity, pending.request.level);
        this.resident.set(residentKey, value);
        if (pending.request.cost) this.residentCost.set(residentKey, pending.request.cost);
        this.materialised += 1;
        if (pending.reconstruction) this.reconstructed += 1;
        results.push({ status: 'MATERIALISED', value });
      } catch (error) {
        this.refused += 1;
        results.push({
          status: 'REFUSED',
          reason: error instanceof Error ? error.message : String(error),
        });
      }
      budget -= 1;
    }
    return results;
  }

  public release(
    identity: SemanticMaterialisationIdentity,
    level?: SemanticMaterialisationLevel
  ): void {
    const prefix = semanticIdentityKey(identity);
    for (const key of [...this.resident.keys()]) {
      if (
        key.startsWith(`${prefix}|level:`) &&
        (level === undefined || key.endsWith(`level:${level}`))
      )
        this.resident.delete(key);
        this.residentCost.delete(key);
    }
    for (let i = this.queue.length - 1; i >= 0; i -= 1) {
      const queued = this.queue[i];
      if (
        semanticIdentityKey(queued.request.identity) === prefix &&
        (level === undefined || queued.request.level === level)
      )
        this.queue.splice(i, 1);
    }
  }

  public evict(
    identity: SemanticMaterialisationIdentity,
    level: SemanticMaterialisationLevel
  ): SemanticMaterialisationDescriptorV1 | null {
    const key = semanticMaterialisationKey(identity, level);
    if (!this.resident.delete(key)) {
      this.release(identity, level);
      return null;
    }
    this.residentCost.delete(key);
    this.release(identity, level);
    this.evicted += 1;
    return {
      schemaVersion: SEMANTIC_MATERIALISATION_DESCRIPTOR_SCHEMA_V1,
      identity: { ...identity },
      level,
    };
  }

  public get(
    identity: SemanticMaterialisationIdentity,
    level: SemanticMaterialisationLevel
  ): T | undefined {
    return this.resident.get(semanticMaterialisationKey(identity, level));
  }

  public snapshot(): SemanticMaterialisationSnapshot {
    return {
      policyVersion: this.policy.policyVersion,
      resident: this.resident.size,
      queued: this.queue.length,
      refused: this.refused,
      materialised: this.materialised,
      promoted: this.promoted,
      collapsed: this.collapsed,
      evicted: this.evicted,
      reconstructed: this.reconstructed,
      admittedCost: this.totalCost(),
    };
  }

  private validateCost(cost: SemanticMaterialisationCostV1 | undefined): string | null {
    const budgeted = this.policy.maxRetainedBytes !== undefined || this.policy.maxSemanticElements !== undefined || this.policy.maxRenderBatches !== undefined || this.policy.maxMaterialisationWorkUnits !== undefined;
    if (!cost) return budgeted ? 'SEMANTIC_PRESENTATION_COST_REQUIRED' : null;
    if (cost.schemaVersion !== SEMANTIC_MATERIALISATION_COST_SCHEMA_V1) return 'SEMANTIC_PRESENTATION_COST_INVALID';
    for (const value of [cost.retainedBytes, cost.semanticElements, cost.renderBatches, cost.materialisationWorkUnits]) {
      if (!Number.isSafeInteger(value) || value < 0) return 'SEMANTIC_PRESENTATION_COST_INVALID';
    }
    return null;
  }

  private totalCost(excluding?: SemanticMaterialisationCostV1): Omit<SemanticMaterialisationCostV1, 'schemaVersion'> {
    const total = { retainedBytes: 0, semanticElements: 0, renderBatches: 0, materialisationWorkUnits: 0 };
    for (const cost of this.residentCost.values()) {
      if (excluding && cost === excluding) continue;
      for (const key of Object.keys(total) as (keyof typeof total)[]) total[key] += cost[key];
    }
    return total;
  }

  private costFits(cost?: SemanticMaterialisationCostV1, replaced?: SemanticMaterialisationCostV1): boolean {
    if (!cost) return true;
    const total = this.totalCost(replaced);
    const checks: Array<[number, number | undefined]> = [
      [total.retainedBytes + cost.retainedBytes, this.policy.maxRetainedBytes],
      [total.semanticElements + cost.semanticElements, this.policy.maxSemanticElements],
      [total.renderBatches + cost.renderBatches, this.policy.maxRenderBatches],
      [total.materialisationWorkUnits + cost.materialisationWorkUnits, this.policy.maxMaterialisationWorkUnits],
    ];
    return checks.every(([value, limit]) => limit === undefined || (Number.isSafeInteger(value) && value <= limit));
  }

  private hasOppositeLevel(request: SemanticMaterialisationRequest): boolean {
    return this.resident.has(
      semanticMaterialisationKey(request.identity, oppositeMaterialisationLevel(request.level))
    );
  }

  private validateIdentity(identity: SemanticMaterialisationIdentity): string | null {
    if (!identity.datasetFingerprint.trim()) return 'SEMANTIC_DATASET_IDENTITY_REQUIRED';
    if (
      !(
        identity.datasetGeneration === null ||
        (Number.isSafeInteger(identity.datasetGeneration) && identity.datasetGeneration >= 0)
      ) ||
      !(
        identity.datasetVersion === null ||
        (Number.isSafeInteger(identity.datasetVersion) && identity.datasetVersion >= 0)
      )
    ) {
      return 'SEMANTIC_DATASET_VERSION_IDENTITY_INVALID';
    }
    if (!identity.semanticId.trim()) return 'SEMANTIC_IDENTITY_REQUIRED';
    return null;
  }

  private refuse(reason: string): { accepted: false; reason: string } {
    this.refused += 1;
    return { accepted: false, reason };
  }
}

export function semanticIdentityKey(identity: SemanticMaterialisationIdentity): string {
  return [
    identity.datasetFingerprint,
    identity.datasetGeneration,
    identity.datasetVersion,
    identity.decisionId,
    identity.semanticId,
  ]
    .map(encodeSemanticIdentityField)
    .join('|');
}

function encodeSemanticIdentityField(value: string | number | null): string {
  return value === null ? 'null' : `${typeof value}:${encodeURIComponent(String(value))}`;
}

export function semanticMaterialisationKey(
  identity: SemanticMaterialisationIdentity,
  level: SemanticMaterialisationLevel
): string {
  return `${semanticIdentityKey(identity)}|level:${level}`;
}

function oppositeMaterialisationLevel(
  level: SemanticMaterialisationLevel
): SemanticMaterialisationLevel {
  return level === 'COARSE' ? 'REFINED' : 'COARSE';
}

export function semanticMaterialisationDescriptorMatches(
  descriptor: unknown,
  request: SemanticMaterialisationRequest
): descriptor is SemanticMaterialisationDescriptorV1 {
  if (typeof descriptor !== 'object' || descriptor === null) return false;
  const candidate = descriptor as Partial<SemanticMaterialisationDescriptorV1>;
  const candidateIdentity = candidate.identity;
  if (
    typeof candidateIdentity !== 'object' ||
    candidateIdentity === null ||
    typeof candidateIdentity.datasetFingerprint !== 'string' ||
    !(
      candidateIdentity.datasetGeneration === null ||
      Number.isSafeInteger(candidateIdentity.datasetGeneration)
    ) ||
    !(candidateIdentity.decisionId === null || typeof candidateIdentity.decisionId === 'string') ||
    !(
      candidateIdentity.datasetVersion === null ||
      Number.isSafeInteger(candidateIdentity.datasetVersion)
    ) ||
    typeof candidateIdentity.semanticId !== 'string'
  ) {
    return false;
  }
  return (
    candidate.schemaVersion === SEMANTIC_MATERIALISATION_DESCRIPTOR_SCHEMA_V1 &&
    candidate.level === request.level &&
    candidateIdentity.datasetFingerprint === request.identity.datasetFingerprint &&
    candidateIdentity.datasetGeneration === request.identity.datasetGeneration &&
    candidateIdentity.decisionId === request.identity.decisionId &&
    candidateIdentity.datasetVersion === request.identity.datasetVersion &&
    candidateIdentity.semanticId === request.identity.semanticId
  );
}

function cloneRequest(request: SemanticMaterialisationRequest): SemanticMaterialisationRequest {
  return { identity: { ...request.identity }, level: request.level, cost: request.cost ? { ...request.cost } : undefined };
}

export const SEMANTIC_MATERIALISATION_POLICY_V1: SemanticMaterialisationPolicy = {
  policyVersion: 'semantic-materialisation/v1',
  maxResident: 64,
  maxQueued: 32,
  maxMaterialisationsPerTick: 4,
};
