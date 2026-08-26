import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import './setup-wasm.ts';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { InlineAnalyticalPort } from '../src/atlas/ports/InlineAnalyticalPort.ts';
import { WorkerAnalyticalPort, type WorkerTransport } from '../src/atlas/ports/WorkerAnalyticalPort.ts';
import type {
  AnalyticalExecutionRequest,
  AnalyticalExecutionResult,
} from '../src/atlas/ports/AnalyticalExecutionPort.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.ts';

function createMockWorkerTransport(): WorkerTransport & {
  postedMessages: unknown[];
  simulateResult: (result: AnalyticalExecutionResult) => void;
  simulateError: (error: Error) => void;
} {
  const postedMessages: unknown[] = [];
  let onmessage: ((ev: MessageEvent) => void) | null = null;
  let onerror: ((ev: ErrorEvent | unknown) => void) | null = null;

  return {
    postedMessages,
    get onmessage() {
      return onmessage;
    },
    set onmessage(fn) {
      onmessage = fn;
    },
    get onerror() {
      return onerror;
    },
    set onerror(fn) {
      onerror = fn;
    },
    postMessage(msg: unknown) {
      postedMessages.push(msg);
    },
    simulateResult(result: AnalyticalExecutionResult) {
      if (onmessage) {
        onmessage(new MessageEvent('message', { data: { type: 'RESULT', result } }));
      }
    },
    simulateError(error: Error) {
      if (onerror) {
        onerror(error);
      }
    },
  };
}

describe('P1-B: Asynchronous Analytical Runtime Contracts', () => {
  it('B1: request carries monotonic requestId and fencing triple', async () => {
    const transport = createMockWorkerTransport();
    const port = new WorkerAnalyticalPort(transport);

    const req: AnalyticalExecutionRequest = {
      requestId: 'areq-1',
      operation: 'tda.persistence',
      dataset: { fingerprint: 'fp_123', version: 1 },
      generation: 1,
      params: { metric: 'euclidean' },
    };

    const promise = port.execute(req);
    expect(transport.postedMessages.length).toBe(1);
    expect(transport.postedMessages[0]).toEqual({ type: 'EXECUTE', request: req });

    transport.simulateResult({
      requestId: 'areq-1',
      generation: 1,
      datasetVersion: 1,
      datasetFingerprint: 'fp_123',
      value: [{ birth: 0.1, death: 0.5, persistence: 0.4 }],
    });

    const res = await promise;
    expect(res.requestId).toBe('areq-1');
    expect(res.value).toBeDefined();
    expect(res.value).toEqual([{ birth: 0.1, death: 0.5, persistence: 0.4 }]);
  });

  it('B2: stale generation discarded mid-flight', async () => {
    const transport = createMockWorkerTransport();
    const port = new WorkerAnalyticalPort(transport);

    const req: AnalyticalExecutionRequest = {
      requestId: 'areq-2',
      operation: 'tda.mapper',
      dataset: { fingerprint: 'fp_123', version: 1 },
      generation: 1,
      params: {},
    };

    const promise = port.execute(req);

    // Invalidate kernel / bump generation
    port.supersede({ generation: 2 });

    transport.simulateResult({
      requestId: 'areq-2',
      generation: 1,
      datasetVersion: 1,
      datasetFingerprint: 'fp_123',
      value: { nodes: [], edges: [] },
    });

    const res = await promise;
    expect(res.value).toBeNull();
  });

  it('B3: stale dataset version discarded', async () => {
    const transport = createMockWorkerTransport();
    const port = new WorkerAnalyticalPort(transport);

    const req: AnalyticalExecutionRequest = {
      requestId: 'areq-3',
      operation: 'tda.betti0',
      dataset: { fingerprint: 'fp_123', version: 1 },
      generation: 1,
      params: {},
    };

    const promise = port.execute(req);

    // Bump dataset version
    port.supersede({ datasetVersion: 2 });

    transport.simulateResult({
      requestId: 'areq-3',
      generation: 1,
      datasetVersion: 1,
      datasetFingerprint: 'fp_123',
      value: [{ epsilon: 0.1, b0: 5 }],
    });

    const res = await promise;
    expect(res.value).toBeNull();
  });

  it('B4: AtlasCore supersedes execution port on dataset lifecycle mutation', () => {
    const kernel = makeKernelMockBridge();
    const atlas = new AtlasCore({ kernel: kernel as any });
    const port = atlas.executionPort!;
    const supersedeSpy = vi.spyOn(port, 'supersede');

    const ds = new Dataset('TestDS', [{ name: 'x', type: ColumnType.NUMERIC }], [{ x: 1 }]);
    atlas.loadDataset(ds);

    expect(supersedeSpy).toHaveBeenCalled();
  });

  it('B5: worker failure fails closed without silent fallback', async () => {
    const transport = createMockWorkerTransport();
    const failureSpy = vi.fn();
    const port = new WorkerAnalyticalPort(transport, failureSpy);

    const req: AnalyticalExecutionRequest = {
      requestId: 'areq-fail',
      operation: 'tda.persistence',
      dataset: { fingerprint: 'fp_fail', version: 1 },
      generation: 1,
      params: {},
    };

    const promise = port.execute(req);
    transport.simulateError(new Error('Worker OOM crash'));

    const res = await promise;
    expect(res.value).toBeNull();
    expect(failureSpy).toHaveBeenCalled();
  });

  it('W1: async TDA parity with real WASM / synchronous bridge', async () => {
    const kernel = makeKernelMockBridge();
    const atlas = new AtlasCore({ kernel: kernel as any });

    const rows = Array.from({ length: 20 }, (_, i) => ({
      id: `id_${i}`,
      val1: i * 2,
      val2: 100 - i * 3,
    }));
    const dataset = new Dataset('ParityDS', [
      { name: 'id', type: ColumnType.CATEGORICAL },
      { name: 'val1', type: ColumnType.NUMERIC },
      { name: 'val2', type: ColumnType.NUMERIC },
    ], rows);

    atlas.loadDataset(dataset);

    const syncIntervals = atlas.computePersistenceIntervalsForCurrent({});
    const asyncIntervals = await atlas.computePersistenceIntervalsAsync({});

    expect(asyncIntervals).toEqual(syncIntervals);
  });

  it('S1: WorkerAnalyticalPort does not import direct computation from RuntimeBridge', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/atlas/ports/WorkerAnalyticalPort.ts'),
      'utf8'
    );

    expect(source).not.toContain('computeMapperGraph');
    expect(source).not.toContain('computePersistenceIntervals');
    expect(source).not.toContain('computeBetti0Curve');
  });

  it('B6: InlineAnalyticalPort executes operations synchronously', async () => {
    const kernel = makeKernelMockBridge();
    const port = new InlineAnalyticalPort(kernel as any);
    expect(port.isAsync).toBe(false);

    const ds = new Dataset('InlineDS', [{ name: 'val', type: ColumnType.NUMERIC }], [{ val: 10 }]);
    const res = await port.execute({
      requestId: 'areq-inline-1',
      operation: 'statistics',
      dataset: { fingerprint: 'fp_inline', version: 1 },
      generation: 1,
      params: {},
      datasetPayload: { type: 'json', data: ds.toJSON() },
    });

    expect(res.requestId).toBe('areq-inline-1');
    expect(res.value).toBeDefined();
  });
});
