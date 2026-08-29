import { Dataset } from '../data/Dataset.ts';
import type { World } from '../vr/World.ts';
import type { DerivedAnalysisSchedulerStats } from '../vr/coordinators/DerivedAnalysisScheduler.ts';

export interface BrowserEnvelopeStageSample {
  name: string;
  startOffsetMs: number;
  durationMs: number;
}

export interface BrowserEnvelopeCapture {
  schemaVersion: 1;
  startedAt: number;
  stages: BrowserEnvelopeStageSample[];
}

export interface BrowserEnvelopeDiagnosticHook {
  readonly schemaVersion: 1;
  startCapture(): void;
  stopCapture(): BrowserEnvelopeCapture;
  waitForDerivedIdle(): Promise<void>;
  derivedStats(): DerivedAnalysisSchedulerStats;
}

declare global {
  interface Window {
    __NEMOSYNE_BROWSER_ENVELOPE__?: BrowserEnvelopeDiagnosticHook;
  }
}

type Callable = (...args: unknown[]) => unknown;
type MutableTarget = Record<string, unknown>;
type StageName = string | ((args: readonly unknown[]) => string | null);

function roundMs(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * Q3D/Q3E instrumentation is read-only and synthetic-evidence-only. It wraps
 * existing production methods to time their real execution; it does not change
 * analytical inputs, outputs, authority, ordering, or persistence semantics.
 */
export function installBrowserEnvelopeDiagnosticHook(world: World): () => void {
  let captureStartedAt: number | null = null;
  let stages: BrowserEnvelopeStageSample[] = [];
  const restore: Array<() => void> = [];

  const patch = (target: object, key: string, stageName: StageName): void => {
    const mutable = target as unknown as MutableTarget;
    const original = mutable[key];
    if (typeof original !== 'function') return;

    const originalCallable = original as Callable;
    const wrapped = function (this: unknown, ...args: unknown[]): unknown {
      const label = typeof stageName === 'function' ? stageName(args) : stageName;
      const captureStart = captureStartedAt;
      if (!label || captureStart === null) {
        return originalCallable.apply(this, args);
      }

      const startedAt = performance.now();
      const finish = () => {
        stages.push({
          name: label,
          startOffsetMs: roundMs(startedAt - captureStart),
          durationMs: roundMs(performance.now() - startedAt),
        });
      };

      try {
        const result = originalCallable.apply(this, args);
        if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
          return Promise.resolve(result).finally(finish);
        }
        finish();
        return result;
      } catch (error) {
        finish();
        throw error;
      }
    };

    mutable[key] = wrapped;
    restore.push(() => {
      if (mutable[key] === wrapped) mutable[key] = original;
    });
  };

  patch(world.dataOperationController, 'applyAsync', 'controller.applyAsync');
  patch(world.dataOperationController, 'applyVisual', 'controller.applyVisual');

  patch(world.atlas, 'applyAnalysisAsync', 'atlas.applyAnalysisAsync');
  patch(world.atlas as unknown as object, '_registerCurrentDatasetInWorker', 'atlas.registerCurrentDatasetInWorker');
  patch(world.atlas as unknown as object, '_materializeWorkerRowView', 'atlas.materializeWorkerRowView');
  patch(world.atlas as unknown as object, '_canUseWorkerRowView', 'atlas.canUseWorkerRowView');
  patch(world.atlas as unknown as object, '_connectResultNode', 'atlas.connectResultNode');
  patch(world.atlas as unknown as object, '_kernelFingerprintDirect', 'atlas.kernelFingerprintDirect');
  patch(world.atlas as unknown as object, '_kernelFingerprint', 'atlas.kernelFingerprint');
  patch(world.atlas as unknown as object, '_ensureHandle', 'atlas.ensureHandle');
  patch(world.atlas, 'generateRecommendation', 'atlas.generateRecommendation');

  const port = world.atlas.executionPort;
  if (port) {
    patch(port, 'execute', (args) => {
      const request = args[0] as { operation?: unknown } | undefined;
      const operation = typeof request?.operation === 'string' ? request.operation : null;
      if (operation === 'operation') return 'workerPort.execute.operation';
      if (operation?.startsWith('tda.')) return `workerPort.execute.${operation}`;
      return null;
    });
    patch(port, 'registerDataset', 'workerPort.registerDataset');
    patch(port, 'supersede', 'workerPort.supersede');
  }

  patch(
    world.atlas.aggregate.analytical as unknown as object,
    'commitKernelResult',
    'analytical.commitKernelResult'
  );

  const ledger = world.atlas.evidenceLedger as unknown as object;
  patch(ledger, 'refreshBorrowedDatasetVersion', 'ledger.refreshBorrowedDatasetVersion');
  patch(ledger, 'addResult', 'ledger.addResult');
  patch(ledger, 'appendEvent', 'ledger.appendEvent');
  patch(ledger, 'getAnalysisHistory', 'ledger.getAnalysisHistory');
  patch(ledger, 'recordStructure', 'ledger.recordStructure');

  // RF-061/Q3E: the synchronous operation event must only schedule derived
  // guidance. Capture both the schedule call and the later settlement so the
  // measurement cannot hide work merely by making it asynchronous.
  patch(world.derivedAnalysisPipeline, 'schedule', 'derived.schedule');
  patch(world.derivedAnalysisPipeline, 'whenIdle', 'derived.whenIdle');
  patch(world.rendererLifecycle, 'tdaCompute', 'derived.tdaCompute');
  patch(world.rendererLifecycle, 'tdaApply', 'derived.tdaApply');

  patch(world as unknown as object, '_updateDashboardDatasets', 'world.updateDashboardDatasets');
  patch(world as unknown as object, '_updateOperationLog', 'world.updateOperationLog');
  patch(world as unknown as object, '_updateNarrativeStrip', 'world.updateNarrativeStrip');
  patch(world as unknown as object, '_logInteraction', 'world.logInteraction');
  patch(world as unknown as object, '_requestAutoSave', 'world.requestAutoSave');
  patch(world.telemetryCollector as unknown as object, 'recordOperation', 'telemetry.recordOperation');

  patch(world.engine.input, 'invalidateSpatialAcceleration', 'input.invalidateSpatialAcceleration');
  patch(world.eventBus, 'emit', (args) => {
    const topic = String(args[0] ?? 'unknown');
    if (topic === 'operation:applied') return 'event.operation:applied';
    if (topic === 'session:autosave-request') return 'event.session:autosave-request';
    return null;
  });

  patch(Dataset.prototype, 'clone', 'dataset.clone');
  patch(Dataset.prototype, 'toJSON', 'dataset.toJSON');

  const hook: BrowserEnvelopeDiagnosticHook = {
    schemaVersion: 1,
    startCapture: () => {
      stages = [];
      captureStartedAt = performance.now();
    },
    stopCapture: () => {
      if (captureStartedAt === null) {
        throw new Error('Q3D browser envelope capture was not started.');
      }
      const result: BrowserEnvelopeCapture = {
        schemaVersion: 1,
        startedAt: captureStartedAt,
        stages: [...stages],
      };
      captureStartedAt = null;
      return result;
    },
    waitForDerivedIdle: () => world.derivedAnalysisPipeline.whenIdle(),
    derivedStats: () => world.derivedAnalysisPipeline.stats(),
  };

  window.__NEMOSYNE_BROWSER_ENVELOPE__ = hook;
  return () => {
    captureStartedAt = null;
    for (let i = restore.length - 1; i >= 0; i--) restore[i]();
    if (window.__NEMOSYNE_BROWSER_ENVELOPE__ === hook) {
      delete window.__NEMOSYNE_BROWSER_ENVELOPE__;
    }
  };
}
