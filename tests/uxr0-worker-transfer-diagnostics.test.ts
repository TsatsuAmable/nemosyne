import { describe, expect, it } from 'vitest';
import {
  WorkerAnalyticalPort,
  type WorkerTransport,
} from '../src/atlas/ports/WorkerAnalyticalPort.ts';
import type {
  AnalyticalDatasetRegistration,
  AnalyticalExecutionRequest,
  AnalyticalExecutionResult,
  AnalyticalWorkerDiagnostic,
} from '../src/atlas/ports/AnalyticalExecutionPort.ts';

function diagnostic(id: string, phase: 'registration' | 'execution'): AnalyticalWorkerDiagnostic {
  return {
    schemaVersion: 1,
    phase,
    id,
    timingMs: { total: 1 },
    wasmBytes: { before: 0, afterKernel: 0, afterMaterialize: 0 },
    hostBufferAllocations: { before: 0, after: 0 },
  };
}

function transportHarness(): WorkerTransport & {
  posted: unknown[];
  emit(data: unknown): void;
} {
  let onmessage: ((event: MessageEvent) => void) | null = null;
  const posted: unknown[] = [];
  return {
    posted,
    get onmessage() {
      return onmessage;
    },
    set onmessage(value) {
      onmessage = value;
    },
    onerror: null,
    onmessageerror: null,
    postMessage(message: unknown) {
      posted.push(message);
    },
    emit(data: unknown) {
      onmessage?.(new MessageEvent('message', { data }));
    },
  };
}

describe('UXR0 Worker transfer diagnostics', () => {
  it('records exact binary registration bytes while labelling total payload volume as an estimate', async () => {
    const transport = transportHarness();
    const port = new WorkerAnalyticalPort(transport);
    const registration: AnalyticalDatasetRegistration = {
      registrationId: 'reg-uxr0',
      generation: 1,
      dataset: { fingerprint: 'fp-uxr0', version: 1 },
      payload: { type: 'typed', data: new Uint8Array(64), name: 'typed-fixture' },
    };

    const promise = port.registerDataset(registration);
    transport.emit({
      type: 'REGISTERED',
      registrationId: registration.registrationId,
      generation: 1,
      datasetVersion: 1,
      datasetFingerprint: 'fp-uxr0',
      diagnostic: diagnostic(registration.registrationId, 'registration'),
    });
    await promise;

    const sample = port.drainDiagnostics()[0];
    expect(sample.transportBytes?.measurementBasis).toBe(
      'utf8-json-estimate+exact-binary-byte-length'
    );
    expect(sample.transportBytes?.exactBinaryOutboundBytes).toBe(64);
    expect(sample.transportBytes?.outboundPayloadBytesEstimate).toBeGreaterThanOrEqual(64);
    expect(sample.transportBytes?.inboundPayloadBytesEstimate).toBeGreaterThan(0);
  });

  it('measures execution request/response payloads only when a Worker diagnostic is emitted', async () => {
    const transport = transportHarness();
    const port = new WorkerAnalyticalPort(transport);
    const request: AnalyticalExecutionRequest = {
      requestId: 'exec-uxr0',
      operation: 'statistics',
      generation: 1,
      dataset: { fingerprint: 'fp-uxr0', version: 1 },
      params: { field: 'value' },
    };
    const promise = port.execute(request);
    const result: AnalyticalExecutionResult = {
      requestId: request.requestId,
      generation: 1,
      datasetVersion: 1,
      datasetFingerprint: 'fp-uxr0',
      value: { mean: 42, count: 100 },
    };
    transport.emit({
      type: 'RESULT',
      result,
      diagnostic: diagnostic(request.requestId, 'execution'),
    });
    await promise;

    const sample = port.drainDiagnostics()[0];
    expect(sample.transportBytes?.exactBinaryOutboundBytes).toBe(0);
    expect(sample.transportBytes?.outboundPayloadBytesEstimate).toBeGreaterThan(0);
    expect(sample.transportBytes?.inboundPayloadBytesEstimate).toBeGreaterThan(0);
  });
});
