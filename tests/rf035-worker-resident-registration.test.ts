import { describe, expect, it, vi } from 'vitest';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { ColumnType, Dataset } from '../src/data/Dataset.ts';
import { WorkerAnalyticalPort, type WorkerTransport } from '../src/atlas/ports/WorkerAnalyticalPort.ts';
import type {
  AnalyticalDatasetRegistration,
  AnalyticalExecutionRequest,
  AnalyticalExecutionResult,
} from '../src/atlas/ports/AnalyticalExecutionPort.ts';
import type { DatasetJSON } from '../src/data/types.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.ts';

function createTransport(): WorkerTransport & {
  postedMessages: unknown[];
  simulateResult(result: AnalyticalExecutionResult): void;
} {
  const postedMessages: unknown[] = [];
  let onmessage: ((event: MessageEvent) => void) | null = null;
  const transport = {
    postedMessages,
    get onmessage() { return onmessage; },
    set onmessage(value) { onmessage = value; },
    onerror: null,
    onmessageerror: null,
    postMessage(message: unknown) {
      postedMessages.push(message);
      const data = message as { type?: string; registration?: AnalyticalDatasetRegistration };
      if (data.type === 'REGISTER' && data.registration) {
        const registration = data.registration;
        onmessage?.(new MessageEvent('message', {
          data: {
            type: 'REGISTERED',
            registrationId: registration.registrationId,
            generation: registration.generation,
            datasetVersion: registration.dataset.version,
            datasetFingerprint: registration.dataset.fingerprint,
          },
        }));
      }
    },
    simulateResult(result: AnalyticalExecutionResult) {
      onmessage?.(new MessageEvent('message', { data: { type: 'RESULT', result } }));
    },
  } satisfies WorkerTransport & {
    postedMessages: unknown[];
    simulateResult(result: AnalyticalExecutionResult): void;
  };
  return transport;
}

function registrations(transport: { postedMessages: unknown[] }): AnalyticalDatasetRegistration[] {
  return transport.postedMessages
    .filter((message) => (message as { type?: string }).type === 'REGISTER')
    .map((message) => (message as { registration: AnalyticalDatasetRegistration }).registration);
}

function executions(transport: { postedMessages: unknown[] }): AnalyticalExecutionRequest[] {
  return transport.postedMessages
    .filter((message) => (message as { type?: string }).type === 'EXECUTE')
    .map((message) => (message as { request: AnalyticalExecutionRequest }).request);
}

async function flushRegistration(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function mutationSpec(fingerprint: string, version: number, threshold: number) {
  return {
    operation: {
      op: 'filter' as const,
      predicate: {
        type: 'comparison' as const,
        column: 'val',
        op: 'gt' as const,
        value: threshold,
      },
    },
    datasetFingerprint: fingerprint,
    datasetVersion: version,
    algorithmVersion: '1.0.0',
  };
}

function outputDataset(name: string, values: number[]): DatasetJSON {
  return {
    name,
    columns: [{ name: 'val', type: ColumnType.NUMERIC }],
    rows: values.map((val) => ({ val })),
  };
}

describe('RF-035A worker-resident registration', () => {
  it('chains resident mutations without rebuilding O(N) registration JSON, then rematerializes once after generation loss', async () => {
    const transport = createTransport();
    const port = new WorkerAnalyticalPort(transport);
    const atlas = new AtlasCore({ kernel: makeKernelMockBridge() as any });
    atlas.setExecutionPort(port);
    atlas.loadDataset(new Dataset(
      'ResidentInput',
      [{ name: 'val', type: ColumnType.NUMERIC }],
      [{ val: 10 }, { val: 20 }, { val: 30 }],
    ));

    const inputFingerprint = atlas.datasetFingerprint ?? '';
    const toJson = vi.spyOn(Dataset.prototype, 'toJSON');

    const first = atlas.applyAnalysisAsync(
      mutationSpec(inputFingerprint, atlas.datasetVersion, 10),
    );
    await flushRegistration();
    expect(registrations(transport)).toHaveLength(1);
    const firstRequest = executions(transport).at(-1)!;
    transport.simulateResult({
      requestId: firstRequest.requestId,
      generation: firstRequest.generation,
      datasetVersion: firstRequest.dataset.version,
      datasetFingerprint: firstRequest.dataset.fingerprint,
      value: {
        dataset: outputDataset('ResidentOutput1', [20, 30]),
        outputFingerprint: 'rf035-output-1',
      },
    });
    const firstResult = await first;

    expect(firstResult.datasetFingerprint).toBe('rf035-output-1');
    expect(firstResult.dataset.rows).toEqual([{ val: 20 }, { val: 30 }]);
    // The Worker adopted the Rust output handle before resolving RESULT. Atlas
    // must not immediately copy every row again merely to prepare a REGISTER
    // payload that this same Worker generation will never need.
    expect(toJson).not.toHaveBeenCalled();

    const second = atlas.applyAnalysisAsync(
      mutationSpec('rf035-output-1', atlas.datasetVersion, 20),
    );
    await flushRegistration();
    expect(registrations(transport)).toHaveLength(1);
    const secondRequest = executions(transport).at(-1)!;
    expect(secondRequest.dataset.fingerprint).toBe('rf035-output-1');
    transport.simulateResult({
      requestId: secondRequest.requestId,
      generation: secondRequest.generation,
      datasetVersion: secondRequest.dataset.version,
      datasetFingerprint: secondRequest.dataset.fingerprint,
      value: {
        dataset: outputDataset('ResidentOutput2', [30]),
        outputFingerprint: 'rf035-output-2',
      },
    });
    const secondResult = await second;

    expect(secondResult.datasetFingerprint).toBe('rf035-output-2');
    expect(secondResult.dataset.rows).toEqual([{ val: 30 }]);
    expect(registrations(transport)).toHaveLength(1);
    expect(toJson).not.toHaveBeenCalled();

    // A new Worker/runtime generation cannot inherit the old capability. Once
    // residency is revoked, Atlas must lazily rebuild canonical registration
    // material from its still-present main-thread Dataset exactly once.
    atlas.setGeneration(2);
    port.supersede({
      generation: 2,
      datasetVersion: atlas.datasetVersion,
      datasetFingerprint: 'rf035-output-2',
    });

    const afterRecovery = atlas.computePersistenceIntervalsAsync({ featureColumns: ['val'] });
    await flushRegistration();
    expect(registrations(transport)).toHaveLength(2);
    expect(registrations(transport).at(-1)?.generation).toBe(2);
    expect(registrations(transport).at(-1)?.dataset.fingerprint).toBe('rf035-output-2');
    expect(toJson).toHaveBeenCalledTimes(1);

    const recoveryRequest = executions(transport).at(-1)!;
    transport.simulateResult({
      requestId: recoveryRequest.requestId,
      generation: recoveryRequest.generation,
      datasetVersion: recoveryRequest.dataset.version,
      datasetFingerprint: recoveryRequest.dataset.fingerprint,
      value: [{ birth: 0, death: 1 }],
    });
    await expect(afterRecovery).resolves.toEqual([{ birth: 0, death: 1 }]);

    toJson.mockRestore();
  });

  it('revokes a previous fingerprint when Atlas replaces the current dataset', async () => {
    const transport = createTransport();
    const port = new WorkerAnalyticalPort(transport);
    const atlas = new AtlasCore({ kernel: makeKernelMockBridge() as any });
    atlas.setExecutionPort(port);
    atlas.loadDataset(new Dataset(
      'FirstDataset',
      [{ name: 'val', type: ColumnType.NUMERIC }],
      [{ val: 1 }, { val: 2 }],
    ));

    const firstFingerprint = atlas.datasetFingerprint ?? '';
    const first = atlas.computePersistenceIntervalsAsync({ featureColumns: ['val'] });
    await flushRegistration();
    expect(registrations(transport)).toHaveLength(1);
    expect(port.hasRegisteredDataset(1, firstFingerprint)).toBe(true);
    const firstRequest = executions(transport).at(-1)!;
    transport.simulateResult({
      requestId: firstRequest.requestId,
      generation: firstRequest.generation,
      datasetVersion: firstRequest.dataset.version,
      datasetFingerprint: firstRequest.dataset.fingerprint,
      value: [{ birth: 0, death: 1 }],
    });
    await expect(first).resolves.toEqual([{ birth: 0, death: 1 }]);

    atlas.setCurrentDataset(new Dataset(
      'ReplacementDataset',
      [{ name: 'val', type: ColumnType.NUMERIC }],
      [{ val: 100 }, { val: 200 }],
    ));
    const replacementFingerprint = atlas.datasetFingerprint ?? '';

    expect(replacementFingerprint).not.toBe(firstFingerprint);
    expect(port.hasRegisteredDataset(1, firstFingerprint)).toBe(false);
    expect(port.hasRegisteredDataset(1, replacementFingerprint)).toBe(false);

    const replacement = atlas.computePersistenceIntervalsAsync({ featureColumns: ['val'] });
    await flushRegistration();
    expect(registrations(transport)).toHaveLength(2);
    expect(registrations(transport).at(-1)?.dataset.fingerprint).toBe(replacementFingerprint);
    const replacementRequest = executions(transport).at(-1)!;
    transport.simulateResult({
      requestId: replacementRequest.requestId,
      generation: replacementRequest.generation,
      datasetVersion: replacementRequest.dataset.version,
      datasetFingerprint: replacementRequest.dataset.fingerprint,
      value: [{ birth: 0, death: 2 }],
    });
    await expect(replacement).resolves.toEqual([{ birth: 0, death: 2 }]);
  });
});
