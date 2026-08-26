import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import './setup-wasm.ts';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import { AtlasCore, KernelUnavailableError } from '../src/atlas/AtlasCore.ts';
import { InlineAnalyticalPort } from '../src/atlas/ports/InlineAnalyticalPort.ts';
import {
  WorkerAnalyticalPort,
  type WorkerTransport,
} from '../src/atlas/ports/WorkerAnalyticalPort.ts';
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
      onmessage?.(new MessageEvent('message', { data: { type: 'RESULT', result } }));
    },
    simulateError(error: Error) {
      onerror?.(error);
    },
  };
}

describe('P1-B: Asynchronous Analytical Runtime Contracts', () => {
  it('B1: request carries request identity and fencing triple', async () => {
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
    expect(transport.postedMessages).toHaveLength(1);
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
    expect(res.value).toEqual([{ birth: 0.1, death: 0.5, persistence: 0.4 }]);
  });

  it('B2: stale generation is discarded mid-flight', async () => {
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

  it('B3: stale dataset version is discarded', async () => {
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

    const ds = new Dataset(
      'TestDS',
      [{ name: 'x', type: ColumnType.NUMERIC }],
      [{ x: 1 }]
    );
    atlas.loadDataset(ds);

    expect(supersedeSpy).toHaveBeenCalled();
  });

  it('B5: worker transport failure rejects with KernelUnavailableError and triggers failure funnel', async () => {
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
    const rejection = expect(promise).rejects.toBeInstanceOf(KernelUnavailableError);
    transport.simulateError(new Error('Worker OOM crash'));

    await rejection;
    expect(failureSpy).toHaveBeenCalledTimes(1);
  });

  it('B5b: worker-reported analytical errors reject instead of becoming ambiguous null results', async () => {
    const transport = createMockWorkerTransport();
    const failureSpy = vi.fn();
    const port = new WorkerAnalyticalPort(transport, failureSpy);

    const req: AnalyticalExecutionRequest = {
      requestId: 'areq-worker-error',
      operation: 'tda.mapper',
      dataset: { fingerprint: 'fp_missing', version: 1 },
      generation: 1,
      params: {},
    };

    const promise = port.execute(req);
    const rejection = expect(promise).rejects.toBeInstanceOf(KernelUnavailableError);
    transport.simulateResult({
      requestId: req.requestId,
      generation: req.generation,
      datasetVersion: req.dataset.version,
      datasetFingerprint: req.dataset.fingerprint,
      value: null,
      error: 'Worker dataset fp_missing is not registered',
    });

    await rejection;
    expect(failureSpy).toHaveBeenCalledTimes(1);
  });

  it('W1: async Atlas API is parity-compatible on the inline transport', async () => {
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
    expect(atlas.executionPort?.isAsync).toBe(false);

    const syncIntervals = atlas.computePersistenceIntervalsForCurrent({});
    const asyncIntervals = await atlas.computePersistenceIntervalsAsync({});

    expect(asyncIntervals).toEqual(syncIntervals);
  });

  it('S1: WorkerAnalyticalPort is transport-only and does not import analytical compute functions', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/atlas/ports/WorkerAnalyticalPort.ts'),
      'utf8'
    );

    expect(source).not.toContain('computeMapperGraph');
    expect(source).not.toContain('computePersistenceIntervals');
    expect(source).not.toContain('computeBetti0Curve');
  });

  it('S2: worker fails closed when a dataset is not registered in its own WASM instance', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/atlas/ports/analytical.worker.ts'),
      'utf8'
    );

    expect(source).toContain('requireRegisteredHandle');
    expect(source).toContain('the request must include a datasetPayload on first use');
    expect(source).toContain('Worker dataset fingerprint mismatch');
  });

  it('B6: InlineAnalyticalPort executes operations synchronously', async () => {
    const kernel = makeKernelMockBridge();
    const port = new InlineAnalyticalPort(kernel as any);
    expect(port.isAsync).toBe(false);

    const ds = new Dataset(
      'InlineDS',
      [{ name: 'val', type: ColumnType.NUMERIC }],
      [{ val: 10 }]
    );
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

  it('B7: AtlasCore threads runtime generation into async requests and supersession', async () => {
    const transport = createMockWorkerTransport();
    const port = new WorkerAnalyticalPort(transport);
    const kernel = makeKernelMockBridge();
    const atlas = new AtlasCore({ kernel: kernel as any });
    atlas.setExecutionPort(port);
    atlas.setGeneration(42);

    const ds = new Dataset(
      'GenDS',
      [{ name: 'x', type: ColumnType.NUMERIC }],
      [{ x: 1 }, { x: 2 }]
    );
    atlas.loadDataset(ds);

    const promise = atlas.computePersistenceIntervalsAsync({});
    expect(transport.postedMessages.length).toBeGreaterThan(0);
    const lastMsg = transport.postedMessages[transport.postedMessages.length - 1] as {
      type: string;
      request: AnalyticalExecutionRequest;
    };
    expect(lastMsg.type).toBe('EXECUTE');
    expect(lastMsg.request.generation).toBe(42);

    transport.simulateResult({
      requestId: lastMsg.request.requestId,
      generation: 42,
      datasetVersion: atlas.datasetVersion,
      datasetFingerprint: atlas.datasetFingerprint ?? '',
      value: [{ birth: 0, death: 1 }],
    });

    const result = await promise;
    expect(result).toEqual([{ birth: 0, death: 1 }]);
  });

  it('B8: applyAnalysisAsync uses output fingerprint from worker result', async () => {
    const transport = createMockWorkerTransport();
    const port = new WorkerAnalyticalPort(transport);
    const kernel = makeKernelMockBridge();
    const atlas = new AtlasCore({ kernel: kernel as any });
    atlas.setExecutionPort(port);

    const ds = new Dataset(
      'OpDS',
      [{ name: 'val', type: ColumnType.NUMERIC }],
      [{ val: 10 }, { val: 20 }]
    );
    atlas.loadDataset(ds);

    const promise = atlas.applyAnalysisAsync({
      operation: { op: 'filter', predicate: { type: 'comparison', column: 'val', op: 'gt', value: 15 } },
      datasetFingerprint: atlas.datasetFingerprint ?? '',
      datasetVersion: atlas.datasetVersion,
      algorithmVersion: '1.0.0',
    });

    const lastMsg = transport.postedMessages[transport.postedMessages.length - 1] as {
      type: string;
      request: AnalyticalExecutionRequest;
    };
    expect(lastMsg.request.operation).toBe('operation');

    const outDS = new Dataset('FilteredDS', [{ name: 'val', type: ColumnType.NUMERIC }], [{ val: 20 }]);
    transport.simulateResult({
      requestId: lastMsg.request.requestId,
      generation: 1,
      datasetVersion: atlas.datasetVersion,
      datasetFingerprint: atlas.datasetFingerprint ?? '',
      value: {
        dataset: outDS.toJSON(),
        outputFingerprint: 'fp_explicit_output_456',
      },
    });

    const result = await promise;
    expect(result.outputHash).toBe('fp_explicit_output_456');
    expect(result.dataset.rows).toHaveLength(1);
  });
});
