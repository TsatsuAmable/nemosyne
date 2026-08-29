import { describe, expect, it, vi } from 'vitest';
import {
  DerivedAnalysisScheduler,
  type DerivedAnalysisRequest,
} from '../src/vr/coordinators/DerivedAnalysisScheduler.ts';

function request(version: number, fingerprint = `${version}`.padStart(64, '0')): DerivedAnalysisRequest {
  return { datasetVersion: version, datasetFingerprint: fingerprint, operation: 'sort' };
}

function manualDeferrer() {
  const queue: Array<() => void> = [];
  return {
    defer(callback: () => void) {
      queue.push(callback);
      return callback;
    },
    cancel(handle: unknown) {
      const index = queue.indexOf(handle as () => void);
      if (index >= 0) queue.splice(index, 1);
    },
    flushOne() {
      const callback = queue.shift();
      callback?.();
    },
    get size() {
      return queue.length;
    },
  };
}

describe('RF-061 DerivedAnalysisScheduler', () => {
  it('coalesces repeated automatic requests for one governed dataset identity', async () => {
    const deferrer = manualDeferrer();
    const computes: number[] = [];
    const publishes: number[] = [];
    let currentVersion = 4;

    const scheduler = new DerivedAnalysisScheduler<number>({
      isCurrent: (item) => item.datasetVersion === currentVersion,
      compute: async (item) => {
        computes.push(item.datasetVersion);
        return item.datasetVersion;
      },
      publish: (item) => {
        publishes.push(item.datasetVersion);
      },
      defer: deferrer.defer,
      cancelDeferred: deferrer.cancel,
    });

    scheduler.schedule(request(4));
    scheduler.schedule({ ...request(4), operation: 'filter' });
    expect(deferrer.size).toBe(1);
    deferrer.flushOne();
    await scheduler.whenIdle();

    expect(computes).toEqual([4]);
    expect(publishes).toEqual([4]);
    expect(scheduler.stats()).toMatchObject({ requested: 2, coalesced: 1, completed: 1 });

    currentVersion = 5;
    scheduler.dispose();
  });

  it('suppresses publication from a running request that becomes stale and runs the newest version', async () => {
    const deferrer = manualDeferrer();
    let currentVersion = 1;
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const computes: number[] = [];
    const publishes: number[] = [];

    const scheduler = new DerivedAnalysisScheduler<number>({
      isCurrent: (item) => item.datasetVersion === currentVersion,
      compute: async (item) => {
        computes.push(item.datasetVersion);
        if (item.datasetVersion === 1) await firstGate;
        return item.datasetVersion;
      },
      publish: (item) => {
        publishes.push(item.datasetVersion);
      },
      defer: deferrer.defer,
      cancelDeferred: deferrer.cancel,
    });

    scheduler.schedule(request(1));
    deferrer.flushOne();
    await Promise.resolve();

    currentVersion = 2;
    scheduler.schedule(request(2));
    releaseFirst();
    await Promise.resolve();
    await Promise.resolve();

    expect(deferrer.size).toBe(1);
    deferrer.flushOne();
    await scheduler.whenIdle();

    expect(computes).toEqual([1, 2]);
    expect(publishes).toEqual([2]);
    expect(scheduler.stats()).toMatchObject({ staleAfterCompute: 1, completed: 1 });
  });

  it('replaces an older pending generation with the newest governed version', async () => {
    const deferrer = manualDeferrer();
    const currentVersion = 3;
    const computes: number[] = [];

    const scheduler = new DerivedAnalysisScheduler<number>({
      isCurrent: (item) => item.datasetVersion === currentVersion,
      compute: async (item) => {
        computes.push(item.datasetVersion);
        return item.datasetVersion;
      },
      publish: () => {},
      defer: deferrer.defer,
      cancelDeferred: deferrer.cancel,
    });

    scheduler.schedule(request(2));
    scheduler.schedule(request(3));
    deferrer.flushOne();
    await scheduler.whenIdle();

    expect(computes).toEqual([3]);
    expect(scheduler.stats()).toMatchObject({ supersededPending: 1, completed: 1 });
  });

  it('classifies a governed refusal separately from an execution failure', async () => {
    const deferrer = manualDeferrer();
    const refusal = Object.assign(new Error('resource envelope refused exact work'), {
      code: 'UNSUPPORTED_AT_SCALE',
    });
    const onError = vi.fn();
    const publish = vi.fn();
    const scheduler = new DerivedAnalysisScheduler<number>({
      isCurrent: () => true,
      compute: async () => {
        throw refusal;
      },
      publish,
      isRefusal: (error) => error === refusal,
      onError,
      defer: deferrer.defer,
      cancelDeferred: deferrer.cancel,
    });

    scheduler.schedule(request(1));
    deferrer.flushOne();
    await scheduler.whenIdle();

    expect(publish).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(refusal, request(1));
    expect(scheduler.stats()).toMatchObject({ completed: 0, refused: 1, failed: 0 });
  });

  it('disposal cancels pending work and resolves idle waiters without publication', async () => {
    const deferrer = manualDeferrer();
    let published = false;
    const scheduler = new DerivedAnalysisScheduler<number>({
      isCurrent: () => true,
      compute: async () => 1,
      publish: () => {
        published = true;
      },
      defer: deferrer.defer,
      cancelDeferred: deferrer.cancel,
    });

    scheduler.schedule(request(1));
    const idle = scheduler.whenIdle();
    scheduler.dispose();
    await idle;

    expect(deferrer.size).toBe(0);
    expect(published).toBe(false);
  });
});
