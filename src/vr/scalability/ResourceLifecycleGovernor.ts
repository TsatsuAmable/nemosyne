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

export interface ResourceLifecycleTransition {
  identity: ResourceIdentity;
  from: ResourceResidency;
  to: ResourceResidency;
  revision: number;
  outcome: 'SUCCEEDED' | 'FAILED';
  reason?: string;
}

export interface ResourceLifecycleSnapshot {
  policyVersion: string;
  declaredWorkingSetSize: number;
  counts: Record<ResourceResidency, number>;
  queuedCleanupCount: number;
  transitions: readonly ResourceLifecycleTransition[];
  cumulative: {
    cooled: number;
    evicted: number;
    reconstructed: number;
    failed: number;
  };
}

type AnyLifecycleAdapter = ResourceLifecycleAdapter<unknown, unknown>;

interface ResourceRecord {
  readonly identity: ResourceIdentity;
  readonly adapter: AnyLifecycleAdapter;
  runtime: unknown | null;
  descriptor: unknown | null;
  residency: Exclude<ResourceResidency, 'EVICTED'>;
  desired: DesiredResidency | null;
  revision: number;
  inFlightRevision?: number;
  lastTouchedEpoch: number;
  coldSinceEpoch?: number;
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
    encodeIdentityField('family', identity.family),
    encodeIdentityField('datasetFingerprint', identity.datasetFingerprint),
    encodeIdentityField('datasetGeneration', identity.datasetGeneration),
    encodeIdentityField('datasetVersion', identity.datasetVersion),
    encodeIdentityField('decisionId', identity.decisionId),
    encodeIdentityField('semanticId', identity.semanticId),
  ].join('|');
}

function encodeIdentityField(name: string, value: string | number | null): string {
  const taggedValue =
    value === null ? 'null' : `${typeof value}:${encodeURIComponent(String(value))}`;
  return `${name}:${taggedValue}`;
}

export class ResourceLifecycleGovernor {
  private readonly records = new Map<string, ResourceRecord>();
  private readonly policy: Readonly<ResourceLifecyclePolicy>;
  private readonly transitions: ResourceLifecycleTransition[] = [];
  private readonly cumulative = {
    cooled: 0,
    evicted: 0,
    reconstructed: 0,
    failed: 0,
  };
  private declaredWorkingSetSize = 0;
  private epoch = 0;
  private disposed = false;
  private disposePromise: Promise<void> | null = null;

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
    if (this.disposed) {
      throw new Error('Resource lifecycle governor is disposed');
    }
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
      descriptor: null,
      residency: 'WARM',
      desired: null,
      revision: 0,
      lastTouchedEpoch: this.nextEpoch(),
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

    for (const key of desiredByKey.keys()) {
      const record = this.records.get(key);
      if (!record) {
        return this.refusal(`Working set resource identity is not registered: ${key}`);
      }
      if (record.residency === 'COLD') {
        return this.refusal(
          `Working set resource identity requires reconstruction that is not implemented: ${key}`
        );
      }
    }

    const detachments: ResourceRecord[] = [];
    for (const [key, record] of this.records) {
      if (record.residency === 'ACTIVE' && desiredByKey.get(key) !== 'ACTIVE') {
        detachments.push(record);
      }
    }

    try {
      // Production adapters must make detach idempotent and no-throw; the governor can preserve
      // its own state on failure but cannot roll back arbitrary external adapter side effects.
      for (const record of detachments) record.adapter.detach(record.runtime);
    } catch (error) {
      return this.refusal(error instanceof Error ? error.message : String(error));
    }

    for (const [key, record] of this.records) {
      const desired = desiredByKey.get(key);
      const previousResidency = record.residency;
      const previousDesired = record.desired;
      let nextResidency = previousResidency;

      if (desired === 'ACTIVE' && previousResidency === 'WARM') {
        nextResidency = 'ACTIVE';
      } else if (previousResidency === 'ACTIVE' && desired !== 'ACTIVE') {
        nextResidency = 'WARM';
      }

      const nextDesired = desired ?? null;
      const authorityChanged = previousDesired !== nextDesired;
      const residencyChanged = previousResidency !== nextResidency;
      if (authorityChanged || residencyChanged) {
        record.revision += 1;
        record.desired = nextDesired;
        record.residency = nextResidency;
        record.lastTouchedEpoch = this.nextEpoch();
      } else if (nextDesired !== null) {
        record.lastTouchedEpoch = this.nextEpoch();
      }

      if (residencyChanged) {
        this.recordTransition({
          identity: record.identity,
          from: previousResidency,
          to: nextResidency,
          revision: record.revision,
          outcome: 'SUCCEEDED',
        });
      }
    }

    this.declaredWorkingSetSize = declarations.length;
    return { accepted: true };
  }

  public tick(): void {
    if (this.disposed) return;

    const candidates = this.getQueuedWarmRecords();
    const operations = candidates.slice(0, this.policy.maxCleanupOperationsPerTick);
    for (const [key, record] of operations) this.startCoolStep(key, record);
  }

  public dispose(): Promise<void> {
    if (this.disposePromise) return this.disposePromise;

    this.disposed = true;
    const disposalTargets: { adapter: AnyLifecycleAdapter; runtime: unknown }[] = [];
    for (const record of this.records.values()) {
      if (record.runtime !== null) {
        disposalTargets.push({ adapter: record.adapter, runtime: record.runtime });
      }
      record.runtime = null;
      record.descriptor = null;
      record.inFlightRevision = undefined;
    }
    this.records.clear();
    this.declaredWorkingSetSize = 0;

    const disposals: Promise<void>[] = [];
    for (const { adapter, runtime } of disposalTargets) {
      try {
        disposals.push(Promise.resolve(adapter.forceDispose(runtime)));
      } catch (error) {
        disposals.push(Promise.reject(error));
      }
    }
    disposalTargets.length = 0;

    this.disposePromise = Promise.allSettled(disposals).then((results) => {
      const rejection = results.find(
        (result): result is PromiseRejectedResult => result.status === 'rejected'
      );
      if (rejection) {
        throw rejection.reason instanceof Error
          ? rejection.reason
          : new Error(String(rejection.reason));
      }
    });
    return this.disposePromise;
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
      queuedCleanupCount: this.getQueuedWarmRecords().length,
      transitions: this.transitions.map((transition) => ({
        ...transition,
        identity: { ...transition.identity },
      })),
      cumulative: { ...this.cumulative },
    };
  }

  private getQueuedWarmRecords(): [string, ResourceRecord][] {
    const warmRecords = [...this.records.entries()].filter(
      ([, record]) => record.residency === 'WARM'
    );
    const scheduledCurrentCleanup = warmRecords.filter(
      ([, record]) => record.desired === null && record.inFlightRevision === record.revision
    ).length;
    const excessWarm = Math.max(
      0,
      warmRecords.length - this.policy.maxWarmResources - scheduledCurrentCleanup
    );

    return warmRecords
      .filter(([, record]) => record.desired === null && record.inFlightRevision === undefined)
      .sort(([, left], [, right]) => left.lastTouchedEpoch - right.lastTouchedEpoch)
      .slice(0, excessWarm);
  }

  private startCoolStep(key: string, record: ResourceRecord): void {
    if (record.runtime === null) {
      this.recordCleanupFailure(record, 'WARM resource has no live runtime to cool');
      return;
    }

    const capturedRevision = record.revision;
    record.inFlightRevision = capturedRevision;

    let result: LifecycleStepResult<unknown> | Promise<LifecycleStepResult<unknown>>;
    try {
      result = record.adapter.coolStep(record.runtime);
    } catch (error) {
      this.completeCoolFailure(key, capturedRevision, error);
      return;
    }

    if (this.isPromiseLike(result)) {
      Promise.resolve(result).then(
        (completion) => this.completeCoolStep(key, capturedRevision, completion),
        (error) => this.completeCoolFailure(key, capturedRevision, error)
      );
      return;
    }

    this.completeCoolStep(key, capturedRevision, result);
  }

  private completeCoolStep(
    key: string,
    capturedRevision: number,
    result: LifecycleStepResult<unknown>
  ): void {
    const current = this.records.get(key);
    if (!current) return;
    if (current.inFlightRevision === capturedRevision) current.inFlightRevision = undefined;
    if (!this.canApplyCoolCompletion(current, capturedRevision)) return;
    if (result.status === 'PENDING') return;

    let descriptorIsValid = false;
    try {
      descriptorIsValid = current.adapter.validateDescriptor(result.descriptor);
    } catch (error) {
      this.recordCleanupFailure(
        current,
        `Cold descriptor validation threw: ${error instanceof Error ? error.message : String(error)}`
      );
      return;
    }
    if (!descriptorIsValid) {
      this.recordCleanupFailure(current, 'Cold descriptor validation failed');
      return;
    }

    current.runtime = null;
    current.descriptor = result.descriptor;
    current.residency = 'COLD';
    current.revision += 1;
    current.coldSinceEpoch = this.nextEpoch();
    current.lastTouchedEpoch = current.coldSinceEpoch;
    this.cumulative.cooled += 1;
    this.recordTransition({
      identity: current.identity,
      from: 'WARM',
      to: 'COLD',
      revision: current.revision,
      outcome: 'SUCCEEDED',
    });
    this.enforceColdDescriptorLimit();
  }

  private completeCoolFailure(key: string, capturedRevision: number, error: unknown): void {
    const current = this.records.get(key);
    if (!current) return;
    if (current.inFlightRevision === capturedRevision) current.inFlightRevision = undefined;
    if (!this.canApplyCoolCompletion(current, capturedRevision)) return;
    this.recordCleanupFailure(current, error instanceof Error ? error.message : String(error));
  }

  private canApplyCoolCompletion(record: ResourceRecord, capturedRevision: number): boolean {
    return (
      record.revision === capturedRevision && record.residency === 'WARM' && record.desired === null
    );
  }

  private recordCleanupFailure(record: ResourceRecord, reason: string): void {
    this.cumulative.failed += 1;
    this.recordTransition({
      identity: record.identity,
      from: 'WARM',
      to: 'WARM',
      revision: record.revision,
      outcome: 'FAILED',
      reason,
    });
  }

  private enforceColdDescriptorLimit(): void {
    const coldRecords = [...this.records.entries()]
      .filter(([, record]) => record.residency === 'COLD' && record.desired === null)
      .sort(
        ([, left], [, right]) =>
          (left.coldSinceEpoch ?? Number.MAX_SAFE_INTEGER) -
          (right.coldSinceEpoch ?? Number.MAX_SAFE_INTEGER)
      );
    const excessCold = Math.max(0, coldRecords.length - this.policy.maxColdDescriptors);

    for (const [key, record] of coldRecords.slice(0, excessCold)) {
      record.revision += 1;
      this.cumulative.evicted += 1;
      this.recordTransition({
        identity: record.identity,
        from: 'COLD',
        to: 'EVICTED',
        revision: record.revision,
        outcome: 'SUCCEEDED',
      });
      this.records.delete(key);
    }
  }

  private recordTransition(transition: ResourceLifecycleTransition): void {
    if (this.policy.maxTransitionEvents === 0) return;
    this.transitions.push({ ...transition, identity: { ...transition.identity } });
    if (this.transitions.length > this.policy.maxTransitionEvents) {
      this.transitions.splice(0, this.transitions.length - this.policy.maxTransitionEvents);
    }
  }

  private isPromiseLike<T>(value: T | Promise<T>): value is Promise<T> {
    return (
      typeof value === 'object' &&
      value !== null &&
      'then' in value &&
      typeof value.then === 'function'
    );
  }

  private nextEpoch(): number {
    this.epoch += 1;
    return this.epoch;
  }

  private refusal(reason: string): WorkingSetValidationResult {
    return { accepted: false, reason };
  }
}
