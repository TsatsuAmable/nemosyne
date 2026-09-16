export type ResourceResidency = 'ACTIVE' | 'WARM' | 'COLD' | 'EVICTED';
export type DesiredResidency = 'ACTIVE' | 'WARM';
export type WorkingSetPriority = 'FOCUS' | 'CONTEXT' | 'SPECULATIVE';

export interface ResourceIdentity {
  family: string;
  datasetFingerprint: string | null;
  datasetGeneration: number | null;
  datasetVersion: number | null;
  decisionId: string | null;
  semanticId: string;
}

export interface WorkingSetDeclaration {
  identity: ResourceIdentity;
  desired: DesiredResidency;
  priority: WorkingSetPriority;
}

export interface ResourceLifecyclePolicy {
  policyVersion: string;
  maxDeclarations: number;
  maxActiveResources: number;
  maxWarmResources: number;
  maxColdDescriptors: number;
  maxCleanupOperationsPerTick: number;
  maxTransitionEvents: number;
}

export type LifecycleStepResult<D> = { status: 'PENDING' } | { status: 'COMPLETE'; descriptor: D };

export interface ResourceLifecycleAdapter<R, D> {
  family: string;
  validateDescriptor(value: unknown): value is D;
  detach(runtime: R): void;
  coolStep(runtime: R): LifecycleStepResult<D> | Promise<LifecycleStepResult<D>>;
  forceDispose(runtime: R): void | Promise<void>;
  reconstruct?(descriptor: D): R | Promise<R>;
}

export interface ResourceRegistration<R, D> {
  identity: ResourceIdentity;
  runtime: R;
  adapter: ResourceLifecycleAdapter<R, D>;
  estimatedCost?: number | null;
}

export interface WorkingSetValidationResult {
  accepted: boolean;
  reason?: string;
}

export interface ResourceLifecycleSnapshot {
  policyVersion: string;
  declaredWorkingSetSize: number;
  counts: Record<ResourceResidency, number>;
}

type AnyLifecycleAdapter = ResourceLifecycleAdapter<unknown, unknown>;

interface ResourceRecord {
  readonly identity: ResourceIdentity;
  readonly runtime: unknown;
  readonly adapter: AnyLifecycleAdapter;
  residency: Exclude<ResourceResidency, 'EVICTED'>;
}

const POLICY_LIMITS = [
  'maxDeclarations',
  'maxActiveResources',
  'maxWarmResources',
  'maxColdDescriptors',
  'maxCleanupOperationsPerTick',
  'maxTransitionEvents',
] as const satisfies readonly (keyof ResourceLifecyclePolicy)[];

export function resourceIdentityKey(identity: ResourceIdentity): string {
  return [
    identity.family,
    identity.datasetFingerprint ?? '',
    identity.datasetGeneration ?? '',
    identity.datasetVersion ?? '',
    identity.decisionId ?? '',
    identity.semanticId,
  ]
    .map((part) => encodeURIComponent(String(part)))
    .join('|');
}

export class ResourceLifecycleGovernor {
  private readonly records = new Map<string, ResourceRecord>();
  private readonly policy: Readonly<ResourceLifecyclePolicy>;
  private declaredWorkingSetSize = 0;

  public constructor(policy: Readonly<ResourceLifecyclePolicy>) {
    if (policy.policyVersion.length === 0) {
      throw new Error('Resource lifecycle policyVersion must not be empty');
    }
    for (const limit of POLICY_LIMITS) {
      const value = policy[limit];
      if (!Number.isSafeInteger(value) || value < 0) {
        throw new Error(`Resource lifecycle policy ${limit} must be a non-negative integer`);
      }
    }
    this.policy = { ...policy };
  }

  public register<R, D>(registration: ResourceRegistration<R, D>): void {
    if (registration.adapter.family !== registration.identity.family) {
      throw new Error('Resource lifecycle adapter family must match the resource identity family');
    }

    const key = resourceIdentityKey(registration.identity);
    if (this.records.has(key)) {
      throw new Error(`Resource lifecycle identity is already registered: ${key}`);
    }

    this.records.set(key, {
      identity: { ...registration.identity },
      runtime: registration.runtime,
      adapter: registration.adapter as AnyLifecycleAdapter,
      residency: 'WARM',
    });
  }

  public validateWorkingSet(
    declarations: readonly WorkingSetDeclaration[]
  ): WorkingSetValidationResult {
    if (declarations.length > this.policy.maxDeclarations) {
      return this.refusal(
        `Working set has ${declarations.length} declarations; maximum is ${this.policy.maxDeclarations}`
      );
    }

    const keys = new Set<string>();
    let activeCount = 0;
    let warmCount = 0;

    for (const declaration of declarations) {
      const key = resourceIdentityKey(declaration.identity);
      if (keys.has(key)) {
        return this.refusal(`Working set contains duplicate resource identity: ${key}`);
      }
      keys.add(key);

      if (declaration.desired === 'ACTIVE') {
        activeCount += 1;
      } else {
        warmCount += 1;
      }
    }

    if (activeCount > this.policy.maxActiveResources) {
      return this.refusal(
        `Working set has ${activeCount} ACTIVE declarations; maximum is ${this.policy.maxActiveResources}`
      );
    }
    if (warmCount > this.policy.maxWarmResources) {
      return this.refusal(
        `Working set has ${warmCount} WARM declarations; maximum is ${this.policy.maxWarmResources}`
      );
    }

    return { accepted: true };
  }

  public reconcile(declarations: readonly WorkingSetDeclaration[]): WorkingSetValidationResult {
    const validation = this.validateWorkingSet(declarations);
    if (!validation.accepted) return validation;

    const desiredByKey = new Map(
      declarations.map((declaration) => [
        resourceIdentityKey(declaration.identity),
        declaration.desired,
      ])
    );

    for (const [key, record] of this.records) {
      const desired = desiredByKey.get(key);
      if (desired === 'ACTIVE') {
        record.residency = 'ACTIVE';
        continue;
      }

      if (record.residency === 'ACTIVE') {
        record.adapter.detach(record.runtime);
        record.residency = 'WARM';
      }
    }

    this.declaredWorkingSetSize = declarations.length;
    return { accepted: true };
  }

  public getSnapshot(): ResourceLifecycleSnapshot {
    const counts: Record<ResourceResidency, number> = {
      ACTIVE: 0,
      WARM: 0,
      COLD: 0,
      EVICTED: 0,
    };
    for (const record of this.records.values()) counts[record.residency] += 1;

    return {
      policyVersion: this.policy.policyVersion,
      declaredWorkingSetSize: this.declaredWorkingSetSize,
      counts,
    };
  }

  private refusal(reason: string): WorkingSetValidationResult {
    return { accepted: false, reason };
  }
}
