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
  AnalyticalDatasetRegistration,
  AnalyticalExecutionRequest,
  AnalyticalExecutionResult,
} from '../src/atlas/ports/AnalyticalExecutionPort.ts';
import { NemosyneSession } from '../src/session/NemosyneSession.ts';
import { InvestigationReplayRunner } from '../src/session/InvestigationReplayRunner.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.ts';

function createMockWorkerTransport(): WorkerTransport & {
  postedMessages: unknown[];
  terminated: boolean;
  simulateResult: (result: AnalyticalExecutionResult) => void;
  simulateError: (error: Error) => void;
  simulateMessageError: () => void;
} {
  const postedMessages: unknown[] = [];
  let onmessage: ((ev: MessageEvent) => void) | null = null;
  let onerror: ((ev: ErrorEvent | unknown) => void) | null = null;
  let onmessageerror: ((ev: MessageEvent | unknown) => void) | null = null;
  const transport = {
    postedMessages,
    terminated: false as boolean,
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
    get onmessageerror() {
      return onmessageerror;
    },
    set onmessageerror(fn) {
      onmessageerror = fn;
    },
    postMessage(msg: unknown) {
      postedMessages.push(msg);
      const data = msg as { type?: string; registration?: AnalyticalDatasetRegistration };
      // Registration acknowledgement is synchronous in this mock so callers can
      // exercise Atlas's explicit register-then-execute contract deterministically.
      if (data.type === 'REGISTER' && data.registration) {
        const registration = data.registration;
        onmessage?.(
          new MessageEvent('message', {
            data: {
              type: 'REGISTERED',
              registrationId: registration.registrationId,
              generation: registration.generation,
              datasetVersion: registration.dataset.version,
              datasetFingerprint: registration.dataset.fingerprint,
            },
          })
        );
      }
    },
    terminate() {
      transport.terminated = true;
    },
    simulateResult(result: AnalyticalExecutionResult) {
      onmessage?.(new MessageEvent('message', { data: { type: 'RESULT', result } }));
    },
    simulateError(error: Error) {
      onerror?.(error);
    },
    simulateMessageError() {
      onmessageerror?.(new MessageEvent('messageerror'));
    },
  } satisfies WorkerTransport & {
    postedMessages: unknown[];
    terminated: boolean;
    simulateResult: (result: AnalyticalExecutionResult) => void;
    simulateError: (error: Error) => void;
    simulateMessageError: () => void;
  };
  return transport;
}

function executeMessages(transport: { postedMessages: unknown[] }): AnalyticalExecutionRequest[] {
  return transport.postedMessages
    .filter((message) => (message as { type?: string }).type === 'EXECUTE')
    .map((message) => (message as { request: AnalyticalExecutionRequest }).request);
}

function registerMessages(transport: { postedMessages: unknown[] }): AnalyticalDatasetRegistration[] {
  return transport.postedMessages
    .filter((message) => (message as { type?: string }).type === 'REGISTER')
    .map((message) => (message as { registration: AnalyticalDatasetRegistration }).registration);
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

  it('B5: worker transport failure is terminal, rejects and triggers failure funnel', async () => {
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
    expect(transport.terminated).toBe(true);
    await expect(port.execute({ ...req, requestId: 'after-failure' })).rejects.toBeInstanceOf(
      KernelUnavailableError
    );
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

  it('B5c: malformed worker messages terminate the port', async () => {
    const transport = createMockWorkerTransport();
    const failureSpy = vi.fn();
    const port = new WorkerAnalyticalPort(transport, failureSpy);
    transport.simulateMessageError();
    expect(transport.terminated).toBe(true);
    expect(failureSpy).toHaveBeenCalledTimes(1);
    await expect(
      port.execute({
        requestId: 'after-messageerror',
        operation: 'statistics',
        dataset: { fingerprint: 'fp', version: 1 },
        generation: 1,
        params: {},
      })
    ).rejects.toBeInstanceOf(KernelUnavailableError);
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
    expect(source).toContain('is not registered');
    expect(source).toContain('Worker dataset fingerprint mismatch');
  });

  it('S3: production async Atlas requests do not ship foreign handles or repeat dataset payloads', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/atlas/AtlasCore.ts'), 'utf8');
    const asyncSection = source.slice(
      source.indexOf('async computePersistenceIntervalsAsync'),
      source.indexOf('computeSpectralFacts(')
    );
    expect(asyncSection).not.toContain('handle,');
    expect(asyncSection).not.toContain('datasetPayload:');
    expect(asyncSection).toContain('_registerCurrentDatasetInWorker');
    expect(source).not.toContain('supersede({ generation: 1');
    expect(source).not.toContain('fnv1aHex(JSON.stringify(json.rows))');
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
    // The registering caller posts EXECUTE only after the async worker
    // registration resolves. The mock transport acknowledges REGISTERED
    // synchronously inside postMessage, but the two-layer await chain
    // (`await registerDataset` inside `_registerCurrentDatasetInWorker`,
    // then the outer `await` in the async op) needs two microtask ticks
    // before EXECUTE is posted.
    await Promise.resolve();
    await Promise.resolve();
    const lastMsg = transport.postedMessages[transport.postedMessages.length - 1] as {
      type: string;
      request: AnalyticalExecutionRequest;
    };
    expect(lastMsg.type).toBe('EXECUTE');
    expect(lastMsg.request.generation).toBe(42);
    expect(lastMsg.request.handle).toBeUndefined();
    expect(lastMsg.request.datasetPayload).toBeUndefined();

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

  it('B8: applyAnalysisAsync requires and persists authoritative output fingerprint', async () => {
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
    const inputFingerprint = atlas.datasetFingerprint ?? '';

    const promise = atlas.applyAnalysisAsync({
      operation: { op: 'filter', predicate: { type: 'comparison', column: 'val', op: 'gt', value: 15 } },
      datasetFingerprint: inputFingerprint,
      datasetVersion: atlas.datasetVersion,
      algorithmVersion: '1.0.0',
    });
    // Two microtask ticks — see B7 for the registration await-chain rationale.
    await Promise.resolve();
    await Promise.resolve();

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
      datasetFingerprint: inputFingerprint,
      value: {
        dataset: outDS.toJSON(),
        outputFingerprint: 'fp_explicit_output_456',
      },
    });

    const result = await promise;
    expect(result.outputHash).toBe('fp_explicit_output_456');
    expect(result.datasetFingerprint).toBe('fp_explicit_output_456');
    expect(result.dataset.rows).toHaveLength(1);
    expect(atlas.ledger.at(-1)?.datasetFingerprint).toBe('fp_explicit_output_456');
  });

  it('B8b: async mutation fails closed when worker omits authoritative output identity', async () => {
    const transport = createMockWorkerTransport();
    const port = new WorkerAnalyticalPort(transport);
    const kernel = makeKernelMockBridge();
    const atlas = new AtlasCore({ kernel: kernel as any });
    atlas.setExecutionPort(port);
    const ds = new Dataset('NoFpDS', [{ name: 'val', type: ColumnType.NUMERIC }], [{ val: 1 }]);
    atlas.loadDataset(ds);
    const inputFingerprint = atlas.datasetFingerprint ?? '';

    const promise = atlas.applyAnalysisAsync({
      operation: { op: 'filter', predicate: { type: 'comparison', column: 'val', op: 'gt', value: 0 } },
      datasetFingerprint: inputFingerprint,
      datasetVersion: atlas.datasetVersion,
      algorithmVersion: '1.0.0',
    });
    // Two microtask ticks — see B7 for the registration await-chain rationale.
    await Promise.resolve();
    await Promise.resolve();
    const request = executeMessages(transport).at(-1)!;
    transport.simulateResult({
      requestId: request.requestId,
      generation: request.generation,
      datasetVersion: request.dataset.version,
      datasetFingerprint: request.dataset.fingerprint,
      value: { dataset: ds.toJSON() },
    });
    await expect(promise).rejects.toBeInstanceOf(KernelUnavailableError);
  });

  it('B10: three concurrent TDA calls register one row-backed dataset and execute without payload copies', async () => {
    const transport = createMockWorkerTransport();
    const port = new WorkerAnalyticalPort(transport);
    const kernel = makeKernelMockBridge();
    const atlas = new AtlasCore({ kernel: kernel as any });
    atlas.setExecutionPort(port);
    atlas.loadDataset(
      new Dataset(
        'ConcurrentTDA',
        [{ name: 'x', type: ColumnType.NUMERIC }],
        [{ x: 1 }, { x: 2 }]
      )
    );

    const p = atlas.computePersistenceIntervalsAsync({ featureColumns: ['x'] });
    const m = atlas.computeMapperGraphAsync({ featureColumns: ['x'] });
    const b = atlas.computeBetti0CurveAsync({ featureColumns: ['x'], steps: 2 });
    await Promise.resolve();
    await Promise.resolve();

    expect(registerMessages(transport)).toHaveLength(1);
    const requests = executeMessages(transport);
    expect(requests).toHaveLength(3);
    expect(requests.every((request) => request.handle === undefined)).toBe(true);
    expect(requests.every((request) => request.datasetPayload === undefined)).toBe(true);

    for (const request of requests) {
      const value =
        request.operation === 'tda.persistence'
          ? [{ birth: 0, death: 1 }]
          : request.operation === 'tda.mapper'
            ? { nodes: [], edges: [] }
            : [{ radius: 0, betti0: 2 }];
      transport.simulateResult({
        requestId: request.requestId,
        generation: request.generation,
        datasetVersion: request.dataset.version,
        datasetFingerprint: request.dataset.fingerprint,
        value,
      });
    }

    await expect(p).resolves.toEqual([{ birth: 0, death: 1 }]);
    await expect(m).resolves.toEqual({ nodes: [], edges: [] });
    await expect(b).resolves.toEqual([{ radius: 0, betti0: 2 }]);
  });

  it('B11: typed/columnar-only dataset is registered as typed on the first worker TDA request', async () => {
    const transport = createMockWorkerTransport();
    const port = new WorkerAnalyticalPort(transport);
    const kernel = makeKernelMockBridge();
    const atlas = new AtlasCore({ kernel: kernel as any });
    const typedPayload = new Uint8Array([78, 84, 67, 49, 0, 0, 0, 0]);
    atlas.loadTypedDataset(typedPayload, 'typed-worker');
    atlas.setExecutionPort(port);
    const fingerprint = atlas.datasetFingerprint ?? '';

    const promise = atlas.computePersistenceIntervalsAsync({ featureColumns: ['x'] });
    // Two microtask ticks — see B7 for the registration await-chain rationale.
    await Promise.resolve();
    await Promise.resolve();

    const registrations = registerMessages(transport);
    expect(registrations).toHaveLength(1);
    expect(registrations[0].dataset.fingerprint).toBe(fingerprint);
    expect(registrations[0].payload.type).toBe('typed');
    expect(Array.from(registrations[0].payload.data as Uint8Array)).toEqual(Array.from(typedPayload));

    const request = executeMessages(transport).at(-1)!;
    expect(request.handle).toBeUndefined();
    expect(request.datasetPayload).toBeUndefined();
    transport.simulateResult({
      requestId: request.requestId,
      generation: request.generation,
      datasetVersion: request.dataset.version,
      datasetFingerprint: request.dataset.fingerprint,
      value: [{ birth: 0, death: 1 }],
    });
    await expect(promise).resolves.toEqual([{ birth: 0, death: 1 }]);
  });

  it('B9: package exported after async analysis replays cleanly and verifies digest', async () => {
    const bridge = makeKernelMockBridge();
    const transport = createMockWorkerTransport();
    const port = new WorkerAnalyticalPort(transport);
    const atlas = new AtlasCore({ kernel: bridge });
    atlas.setExecutionPort(port);

    const ds = new Dataset(
      'ReplayDS',
      [{ name: 'val', type: ColumnType.NUMERIC }],
      [{ val: 10 }, { val: 20 }, { val: 30 }]
    );
    atlas.loadDataset(ds);
    const inputFingerprint = atlas.datasetFingerprint ?? '';

    const promise = atlas.applyAnalysisAsync({
      operation: { op: 'filter', predicate: { type: 'comparison', column: 'val', op: 'gt', value: 15 } },
      datasetFingerprint: inputFingerprint,
      datasetVersion: atlas.datasetVersion,
      algorithmVersion: '1.0.0',
    });
    // Two microtask ticks — see B7 for the registration await-chain rationale.
    await Promise.resolve();
    await Promise.resolve();

    const lastMsg = transport.postedMessages[transport.postedMessages.length - 1] as {
      type: string;
      request: AnalyticalExecutionRequest;
    };

    const outHandle = bridge.runOperation(1, {
      op: 'filter',
      predicate: { type: 'comparison', column: 'val', op: 'gt', value: 15 },
    } as never);
    const outDSJson = bridge.getDatasetJson(outHandle);
    const outFingerprint = bridge.datasetFingerprint(outHandle) ?? 'fp_filtered_123';
    const outProvenance = bridge.kernelProvenance ? bridge.kernelProvenance() : null;
    transport.simulateResult({
      requestId: lastMsg.request.requestId,
      generation: lastMsg.request.generation,
      datasetVersion: atlas.datasetVersion,
      datasetFingerprint: inputFingerprint,
      value: {
        dataset: outDSJson,
        outputFingerprint: outFingerprint,
      },
      provenance: outProvenance,
    });

    await promise;

    const session = new NemosyneSession({ atlas });
    const pkgBytes = await session.exportPortablePackage();
    const runner = new InvestigationReplayRunner(bridge);
    const replayResult = await runner.replayArchive(pkgBytes);

    expect(replayResult.discrepancies).toEqual([]);
    expect(replayResult.success).toBe(true);
    expect(replayResult.eventsMatched).toBe(2);
  });
});
