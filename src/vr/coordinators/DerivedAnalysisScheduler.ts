export interface DerivedAnalysisRequest {
  datasetVersion: number;
  datasetFingerprint: string;
  operation: string;
}

export interface DerivedAnalysisSchedulerStats {
  requested: number;
  coalesced: number;
  supersededPending: number;
  staleBeforeCompute: number;
  staleAfterCompute: number;
  completed: number;
  refused: number;
  failed: number;
}

export interface DerivedAnalysisSchedulerOptions<Result> {
  isCurrent: (request: DerivedAnalysisRequest) => boolean;
  compute: (request: DerivedAnalysisRequest) => Promise<Result>;
  publish: (request: DerivedAnalysisRequest, result: Result) => void | Promise<void>;
  defer?: (callback: () => void) => unknown;
  cancelDeferred?: (handle: unknown) => void;
  isRefusal?: (error: unknown, request: DerivedAnalysisRequest) => boolean;
  onError?: (error: unknown, request: DerivedAnalysisRequest) => void;
}

function sameDatasetIdentity(a: DerivedAnalysisRequest, b: DerivedAnalysisRequest): boolean {
  return (
    a.datasetVersion === b.datasetVersion &&
    a.datasetFingerprint === b.datasetFingerprint
  );
}

/**
 * RF-061: coalesces automatic derived-analysis work by governed dataset
 * identity. It deliberately has no knowledge of TDA, Moneta, panels or World;
 * callers provide the authoritative compute and presentation publication steps.
 */
export class DerivedAnalysisScheduler<Result> {
  private readonly options: DerivedAnalysisSchedulerOptions<Result>;
  private pending: DerivedAnalysisRequest | null = null;
  private runningRequest: DerivedAnalysisRequest | null = null;
  private deferredHandle: unknown = null;
  private disposed = false;
  private idleWaiters: Array<() => void> = [];
  private readonly counters: DerivedAnalysisSchedulerStats = {
    requested: 0,
    coalesced: 0,
    supersededPending: 0,
    staleBeforeCompute: 0,
    staleAfterCompute: 0,
    completed: 0,
    refused: 0,
    failed: 0,
  };

  constructor(options: DerivedAnalysisSchedulerOptions<Result>) {
    this.options = options;
  }

  schedule(request: DerivedAnalysisRequest): void {
    if (this.disposed) return;
    this.counters.requested += 1;

    if (this.runningRequest && sameDatasetIdentity(this.runningRequest, request)) {
      this.counters.coalesced += 1;
      return;
    }

    if (this.pending) {
      if (sameDatasetIdentity(this.pending, request)) {
        this.counters.coalesced += 1;
      } else {
        this.counters.supersededPending += 1;
      }
    }
    this.pending = request;

    if (!this.runningRequest && this.deferredHandle === null) {
      this.scheduleDrain();
    }
  }

  async whenIdle(): Promise<void> {
    if (this.isIdle()) return;
    await new Promise<void>((resolve) => this.idleWaiters.push(resolve));
  }

  stats(): DerivedAnalysisSchedulerStats {
    return { ...this.counters };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.pending = null;
    if (this.deferredHandle !== null) {
      this.options.cancelDeferred?.(this.deferredHandle);
      this.deferredHandle = null;
    }
    this.resolveIdleWaitersIfIdle();
  }

  private scheduleDrain(): void {
    const defer = this.options.defer ?? ((callback: () => void) => setTimeout(callback, 0));
    this.deferredHandle = defer(() => {
      this.deferredHandle = null;
      void this.drain();
    });
  }

  private async drain(): Promise<void> {
    if (this.disposed) {
      this.resolveIdleWaitersIfIdle();
      return;
    }

    const request = this.pending;
    this.pending = null;
    if (!request) {
      this.resolveIdleWaitersIfIdle();
      return;
    }

    if (!this.options.isCurrent(request)) {
      this.counters.staleBeforeCompute += 1;
      this.scheduleNextOrResolve();
      return;
    }

    this.runningRequest = request;
    try {
      const result = await this.options.compute(request);
      if (this.disposed || !this.options.isCurrent(request)) {
        this.counters.staleAfterCompute += 1;
      } else {
        await this.options.publish(request, result);
        if (this.disposed || !this.options.isCurrent(request)) {
          this.counters.staleAfterCompute += 1;
        } else {
          this.counters.completed += 1;
        }
      }
    } catch (error) {
      if (this.options.isRefusal?.(error, request)) {
        this.counters.refused += 1;
      } else {
        this.counters.failed += 1;
      }
      this.options.onError?.(error, request);
    } finally {
      this.runningRequest = null;
      this.scheduleNextOrResolve();
    }
  }

  private scheduleNextOrResolve(): void {
    if (!this.disposed && this.pending && this.deferredHandle === null) {
      this.scheduleDrain();
      return;
    }
    this.resolveIdleWaitersIfIdle();
  }

  private isIdle(): boolean {
    return this.pending === null && this.runningRequest === null && this.deferredHandle === null;
  }

  private resolveIdleWaitersIfIdle(): void {
    if (!this.isIdle()) return;
    const waiters = this.idleWaiters.splice(0);
    for (const resolve of waiters) resolve();
  }
}
