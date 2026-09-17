export type SemanticMaterialisationLevel = 'COARSE' | 'REFINED';

export interface SemanticMaterialisationIdentity {
  datasetFingerprint: string;
  datasetGeneration: number | null;
  decisionId: string | null;
  semanticId: string;
}

export interface SemanticMaterialisationRequest {
  identity: SemanticMaterialisationIdentity;
  level: SemanticMaterialisationLevel;
}

export interface SemanticMaterialisationPolicy {
  policyVersion: string;
  maxResident: number;
  maxQueued: number;
  maxMaterialisationsPerTick: number;
}

export interface SemanticMaterialisationSnapshot {
  policyVersion: string;
  resident: number;
  queued: number;
  refused: number;
  materialised: number;
}

export type SemanticMaterialisationResult<T> =
  | { status: 'MATERIALISED'; value: T }
  | { status: 'REFUSED'; reason: string };

interface Pending<T> {
  request: SemanticMaterialisationRequest;
  materialise: () => T;
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
  private readonly queue: Pending<T>[] = [];
  private refused = 0;
  private materialised = 0;

  public constructor(private readonly policy: Readonly<SemanticMaterialisationPolicy>) {
    if (!policy.policyVersion) throw new Error('Semantic materialisation policyVersion is required');
    for (const value of [policy.maxResident, policy.maxQueued, policy.maxMaterialisationsPerTick]) {
      if (!Number.isSafeInteger(value) || value < 0) {
        throw new Error('Semantic materialisation limits must be non-negative integers');
      }
    }
  }

  public request(request: SemanticMaterialisationRequest, materialise: () => T): { accepted: boolean; reason?: string } {
    const identityError = this.validateIdentity(request.identity);
    if (identityError) return this.refuse(identityError);
    const key = semanticMaterialisationKey(request.identity, request.level);
    if (this.resident.has(key) || this.queue.some((entry) => semanticMaterialisationKey(entry.request.identity, entry.request.level) === key)) {
      return { accepted: true };
    }
    if (this.queue.length >= this.policy.maxQueued) return this.refuse('SEMANTIC_BACKPRESSURE_QUEUE_FULL');
    if (this.resident.size >= this.policy.maxResident && this.queue.length === 0) {
      return this.refuse('SEMANTIC_RESIDENCY_BOUND_REACHED');
    }
    this.queue.push({ request: cloneRequest(request), materialise });
    return { accepted: true };
  }

  public tick(): SemanticMaterialisationResult<T>[] {
    const results: SemanticMaterialisationResult<T>[] = [];
    let budget = this.policy.maxMaterialisationsPerTick;
    while (budget > 0 && this.queue.length > 0) {
      if (this.resident.size >= this.policy.maxResident) break;
      const pending = this.queue.shift()!;
      try {
        const value = pending.materialise();
        this.resident.set(semanticMaterialisationKey(pending.request.identity, pending.request.level), value);
        this.materialised += 1;
        results.push({ status: 'MATERIALISED', value });
      } catch (error) {
        this.refused += 1;
        results.push({ status: 'REFUSED', reason: error instanceof Error ? error.message : String(error) });
      }
      budget -= 1;
    }
    return results;
  }

  public release(identity: SemanticMaterialisationIdentity, level?: SemanticMaterialisationLevel): void {
    const prefix = semanticIdentityKey(identity);
    for (const key of [...this.resident.keys()]) {
      if (key.startsWith(`${prefix}|level:`) && (level === undefined || key.endsWith(`level:${level}`))) this.resident.delete(key);
    }
    for (let i = this.queue.length - 1; i >= 0; i -= 1) {
      const queued = this.queue[i];
      if (semanticIdentityKey(queued.request.identity) === prefix && (level === undefined || queued.request.level === level)) this.queue.splice(i, 1);
    }
  }

  public get(identity: SemanticMaterialisationIdentity, level: SemanticMaterialisationLevel): T | undefined {
    return this.resident.get(semanticMaterialisationKey(identity, level));
  }

  public snapshot(): SemanticMaterialisationSnapshot {
    return {
      policyVersion: this.policy.policyVersion,
      resident: this.resident.size,
      queued: this.queue.length,
      refused: this.refused,
      materialised: this.materialised,
    };
  }

  private validateIdentity(identity: SemanticMaterialisationIdentity): string | null {
    if (!identity.datasetFingerprint.trim()) return 'SEMANTIC_DATASET_IDENTITY_REQUIRED';
    if (!identity.semanticId.trim()) return 'SEMANTIC_IDENTITY_REQUIRED';
    return null;
  }

  private refuse(reason: string): { accepted: false; reason: string } {
    this.refused += 1;
    return { accepted: false, reason };
  }
}

export function semanticIdentityKey(identity: SemanticMaterialisationIdentity): string {
  return [identity.datasetFingerprint, identity.datasetGeneration ?? 'null', identity.decisionId ?? 'null', identity.semanticId]
    .map((value) => encodeURIComponent(String(value)))
    .join('|');
}

export function semanticMaterialisationKey(identity: SemanticMaterialisationIdentity, level: SemanticMaterialisationLevel): string {
  return `${semanticIdentityKey(identity)}|level:${level}`;
}

function cloneRequest(request: SemanticMaterialisationRequest): SemanticMaterialisationRequest {
  return { identity: { ...request.identity }, level: request.level };
}

export const SEMANTIC_MATERIALISATION_POLICY_V1: SemanticMaterialisationPolicy = {
  policyVersion: 'semantic-materialisation/v1',
  maxResident: 64,
  maxQueued: 32,
  maxMaterialisationsPerTick: 4,
};
