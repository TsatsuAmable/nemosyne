import { describe, expect, it, vi } from 'vitest';
import './setup-wasm.ts';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import {
  UnsupportedAtScaleError,
  type TdaResourcePreflight,
} from '../src/wasm/RuntimeBridge.ts';
import type { Provenance } from '../src/data/types.ts';
import {
  WorkerAnalyticalPort,
  type WorkerTransport,
} from '../src/atlas/ports/WorkerAnalyticalPort.ts';
import type {
  AnalyticalDatasetRegistration,
  AnalyticalExecutionResult,
} from '../src/atlas/ports/AnalyticalExecutionPort.ts';
import { NemosyneSession } from '../src/session/NemosyneSession.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.ts';

function refusalPreflight(operation: string): TdaResourcePreflight {
  return {
    sourceRows: 9_000,
    eligibleRows: 9_000,
    excludedRows: 0,
    dimensions: 7,
    missingDataPolicy: 'exclude-non-finite',
    eligibilityMode: 'complete_case_selected_features',
    estimate: {
      operation,
      rows: 9_000,
      dimensions: 7,
      complexity: 'exponential',
      estimatedWorkUnits: 62_000_000,
      estimatedTransientBytes: 128_000_000,
      decision: 'unsupported_at_scale',
      reasonCode: 'HIGH_DIMENSIONAL_EXACT_FALLBACK_OVER_BUDGET',
    },
    refusal: 'HIGH_DIMENSIONAL_EXACT_FALLBACK_OVER_BUDGET',
  };
}

function refusalProvenance(operation: string, inputFingerprint: string): Provenance {
  return {
    kernel: 'nemosyne-wasm',
    kernelVersion: 'mock-kernel',
    operation,
    parameters: { featureColumns: ['x0', 'x1', 'x2', 'x3', 'x4', 'x5', 'x6'] },
    inputFingerprint,
    outputFingerprint: '',
    timestamp: 1_700_000_000_000,
    outcome: 'refused',
  };
}

function smallDataset(): Dataset {
  return new Dataset(
    'RefusalDS',
    [
      { name: 'x', type: ColumnType.NUMERIC },
      { name: 'y', type: ColumnType.NUMERIC },
    ],
    [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 3 },
    ]
  );
}

describe('RF-030: durable kernel-inline refusal provenance', () => {
  it('sync: a kernel refusal is durably recorded and rethrown, not treated as a kernel failure', () => {
    const kernel = makeKernelMockBridge() as Record<string, unknown>;
    const onKernelFailure = vi.fn();
    const atlas = new AtlasCore({
      kernel: kernel as never,
      onKernelFailure,
    });
    atlas.loadDataset(smallDataset());
    const inputFingerprint = atlas.datasetFingerprint ?? '';
    const historyBefore = atlas.analysisHistory.length;

    // Make the kernel refuse the mapper graph at the ABI boundary, exactly as
    // the Rust `data_compute_mapper_graph` refusal branch does.
    kernel.computeMapperGraph = () => {
      throw new UnsupportedAtScaleError(
        refusalPreflight('compute_mapper_graph'),
        refusalProvenance('compute_mapper_graph', inputFingerprint)
      );
    };

    expect(() => atlas.computeMapperGraphForCurrent({})).toThrow(UnsupportedAtScaleError);

    // The refusal is durable in the ledger.
    const refusals = atlas.evidenceLedger.refusalEvents();
    expect(refusals).toHaveLength(1);
    expect(refusals[0].operation).toBe('compute_mapper_graph');
    expect(refusals[0].provenance.outcome).toBe('refused');
    expect(refusals[0].provenance.outputFingerprint).toBe('');
    expect(refusals[0].provenance.kernel).toBe('nemosyne-wasm');
    expect(refusals[0].preflight.estimate.reasonCode).toBe(
      'HIGH_DIMENSIONAL_EXACT_FALLBACK_OVER_BUDGET'
    );
    expect(refusals[0].datasetFingerprint).toBe(inputFingerprint);

    // A refusal is NOT a kernel failure: the failure funnel must not fire and
    // the kernel must remain available.
    expect(onKernelFailure).not.toHaveBeenCalled();
    expect(atlas.isReady()).toBe(true);

    // A refusal is non-mutating: it must NOT create an AnalysisHistory frame.
    expect(atlas.analysisHistory.length).toBe(historyBefore);
    expect(atlas.evidenceLedger.ledger.at(-1)?.kind).toBe('refusal');
  });

  it('sync: a refusal without provenance is rethrown but not recorded', () => {
    const kernel = makeKernelMockBridge() as Record<string, unknown>;
    const atlas = new AtlasCore({ kernel: kernel as never });
    atlas.loadDataset(smallDataset());

    kernel.computeMapperGraph = () => {
      // A raw/legacy refusal with no side-channel provenance — recordRefusalFromError
      // is defensive and must skip recording rather than throw.
      throw new UnsupportedAtScaleError(refusalPreflight('compute_mapper_graph'), null);
    };

    expect(() => atlas.computeMapperGraphForCurrent({})).toThrow(UnsupportedAtScaleError);
    expect(atlas.evidenceLedger.refusalEvents()).toHaveLength(0);
  });

  it('async: a worker refusal result rejects with the typed error and is durably recorded', async () => {
    const kernel = makeKernelMockBridge();
    const atlas = new AtlasCore({ kernel: kernel as never });
    atlas.loadDataset(smallDataset());
    const inputFingerprint = atlas.datasetFingerprint ?? '';

    const transport = createRefusalMockTransport();
    const port = new WorkerAnalyticalPort(
      transport,
      undefined,
      (err) => atlas.recordRefusalFromError(err)
    );
    atlas.setExecutionPort(port);

    const promise = atlas.computeMapperGraphAsync({ featureColumns: ['x', 'y'] });
    // Observe the semantic boundary (EXECUTE dispatched) rather than coupling
    // this test to the number of microtasks used by the registration/evidence path.
    await vi.waitFor(() => {
      expect(transport.lastExecuteRequest()).toBeDefined();
    });

    const result = transport.lastExecuteRequest();
    expect(result).toBeDefined();
    expect(result!.operation).toBe('tda.mapper');

    transport.simulateResult({
      requestId: result!.requestId,
      generation: result!.generation,
      datasetVersion: result!.dataset.version,
      datasetFingerprint: result!.dataset.fingerprint,
      value: null,
      refusal: {
        preflight: refusalPreflight('compute_mapper_graph'),
        provenance: refusalProvenance('compute_mapper_graph', inputFingerprint),
      },
    });

    await expect(promise).rejects.toBeInstanceOf(UnsupportedAtScaleError);

    const refusals = atlas.evidenceLedger.refusalEvents();
    expect(refusals).toHaveLength(1);
    expect(refusals[0].operation).toBe('compute_mapper_graph');
    expect(refusals[0].provenance.outcome).toBe('refused');
    expect(refusals[0].datasetFingerprint).toBe(inputFingerprint);
  });

  it('session round-trip: refusal events persist across serialize/deserialize (schemaVersion 2)', () => {
    const kernel = makeKernelMockBridge() as Record<string, unknown>;
    const atlas = new AtlasCore({ kernel: kernel as never });
    atlas.loadDataset(smallDataset());
    const inputFingerprint = atlas.datasetFingerprint ?? '';

    kernel.computeMapperGraph = () => {
      throw new UnsupportedAtScaleError(
        refusalPreflight('compute_mapper_graph'),
        refusalProvenance('compute_mapper_graph', inputFingerprint)
      );
    };
    expect(() => atlas.computeMapperGraphForCurrent({})).toThrow(UnsupportedAtScaleError);
    expect(atlas.evidenceLedger.refusalEvents()).toHaveLength(1);

    const session = new NemosyneSession({ atlas });
    const json = session.serialize();
    expect(json.eventLedger.some((event) => event.kind === 'refusal')).toBe(true);

    const restoredAtlas = new AtlasCore({ kernel: makeKernelMockBridge() as never });
    NemosyneSession.deserialize(json, restoredAtlas);

    const restored = restoredAtlas.evidenceLedger.refusalEvents();
    expect(restored).toHaveLength(1);
    expect(restored[0].operation).toBe('compute_mapper_graph');
    expect(restored[0].provenance.outcome).toBe('refused');
    expect(restored[0].preflight.estimate.reasonCode).toBe(
      'HIGH_DIMENSIONAL_EXACT_FALLBACK_OVER_BUDGET'
    );
  });
});

// ---------------------------------------------------------------------------
// Minimal mock worker transport: acknowledges REGISTER synchronously, captures
// the last EXECUTE request, and lets the test inject a simulated RESULT.
// ---------------------------------------------------------------------------

function createRefusalMockTransport(): WorkerTransport & {
  simulateResult: (result: AnalyticalExecutionResult) => void;
  lastExecuteRequest: () =>
    | {
        requestId: string;
        operation: string;
        generation: number;
        dataset: { fingerprint: string; version: number };
      }
    | undefined;
} {
  let onmessage: ((ev: MessageEvent) => void) | null = null;
  let onerror: ((ev: ErrorEvent | unknown) => void) | null = null;
  let onmessageerror: ((ev: MessageEvent | unknown) => void) | null = null;
  let lastRequest:
    | {
        requestId: string;
        operation: string;
        generation: number;
        dataset: { fingerprint: string; version: number };
      }
    | undefined;

  const transport = {
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
      const data = msg as { type?: string; registration?: AnalyticalDatasetRegistration; request?: unknown };
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
      if (data.type === 'EXECUTE') {
        const req = data.request as {
          requestId: string;
          operation: string;
          generation: number;
          dataset: { fingerprint: string; version: number };
        };
        lastRequest = req;
      }
    },
    terminate() {
      /* no-op */
    },
    simulateResult(result: AnalyticalExecutionResult) {
      onmessage?.(new MessageEvent('message', { data: { type: 'RESULT', result } }));
    },
    lastExecuteRequest() {
      return lastRequest;
    },
  } satisfies WorkerTransport & {
    simulateResult: (result: AnalyticalExecutionResult) => void;
    lastExecuteRequest: () =>
      | {
          requestId: string;
          operation: string;
          generation: number;
          dataset: { fingerprint: string; version: number };
        }
      | undefined;
  };
  return transport;
}
