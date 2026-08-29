import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import './setup-wasm.ts';
import { Dataset } from '../src/data/Dataset.ts';
import type {
  AnalyticalDatasetRegistration,
  AnalyticalExecutionRequest,
  AnalyticalExecutionResult,
} from '../src/atlas/ports/AnalyticalExecutionPort.ts';
import { VRTopologyTranslator } from '../src/moneta/VRTopologyTranslator.ts';
import type { SemanticEmbodimentEnvelopeV1 } from '../src/moneta/representation/SemanticEmbodimentPayload.ts';
import type { MonetaDataInput, SolverResult } from '../src/moneta/types.ts';
import { disposeObject } from '../src/utils/Dispose.ts';

interface TestWorkerScope {
  onmessage: ((event: MessageEvent) => void | Promise<void>) | null;
  postMessage: ReturnType<typeof vi.fn>;
}

function message(data: unknown): MessageEvent {
  return new MessageEvent('message', { data });
}

describe('Stream M M3 real Worker-handler + WASM distribution path', () => {
  it('registers once, executes the Rust builder, and renders without source rows', async () => {
    const originalSelf = globalThis.self;
    const workerScope: TestWorkerScope = { onmessage: null, postMessage: vi.fn() };
    vi.stubGlobal('self', workerScope);

    try {
      await import('../src/atlas/ports/analytical.worker.ts');
      const handler = workerScope.onmessage;
      if (!handler) throw new Error('analytical Worker did not install its message handler');

      const data = new Dataset(
        'm3-worker-wasm',
        [{ name: 'value', type: 'NUMERIC' }],
        [{ value: 0 }, { value: 1 }, { value: 1 }, { value: 2 }, { value: 4 }]
      );
      const registration: AnalyticalDatasetRegistration = {
        registrationId: 'm3-register-1',
        dataset: { fingerprint: data.fingerprint, version: 1 },
        generation: 1,
        payload: { type: 'json', data: data.toJSON(), name: data.name },
      };
      await handler(message({ type: 'REGISTER', registration }));
      expect(workerScope.postMessage).toHaveBeenLastCalledWith(
        expect.objectContaining({
          type: 'REGISTERED',
          registrationId: registration.registrationId,
          datasetFingerprint: data.fingerprint,
        })
      );

      workerScope.postMessage.mockClear();
      const request: AnalyticalExecutionRequest = {
        requestId: 'm3-distribution-1',
        operation: 'semanticEmbodiment',
        dataset: { fingerprint: data.fingerprint, version: 1 },
        generation: 1,
        params: {
          schemaVersion: 1,
          candidateId: 'DISTRIBUTION_FIELD',
          measureField: 'value',
          histogramBinCount: 2,
          ecdfKnotCount: 3,
          quantileProbabilities: [0, 0.5, 1],
          decisionId: 'decision-m3-worker-wasm',
        },
      };
      await handler(message({ type: 'EXECUTE', request }));

      expect(workerScope.postMessage).toHaveBeenCalledTimes(1);
      const posted = workerScope.postMessage.mock.calls[0][0] as {
        type: string;
        result: AnalyticalExecutionResult<SemanticEmbodimentEnvelopeV1>;
      };
      expect(posted.type).toBe('RESULT');
      expect(posted.result.error).toBeUndefined();
      expect(posted.result.datasetFingerprint).toBe(data.fingerprint);
      const envelope = posted.result.value;
      expect(envelope?.candidateId).toBe('DISTRIBUTION_FIELD');
      expect(envelope?.provenance.decisionId).toBe('decision-m3-worker-wasm');
      expect(envelope?.result.status).toBe('READY');

      const guardedDataset = { edges: [] } as unknown as Dataset;
      Object.defineProperty(guardedDataset, 'rows', {
        get() {
          throw new Error('M3_WORKER_WASM_RAW_ROW_FALLBACK');
        },
      });
      const input = { dataset: guardedDataset, semanticEmbodiment: envelope } as MonetaDataInput & {
        semanticEmbodiment: SemanticEmbodimentEnvelopeV1 | null;
      };
      Object.defineProperty(input, 'rows', {
        get() {
          throw new Error('M3_WORKER_WASM_RAW_ROW_FALLBACK');
        },
      });
      const solverResult = {
        facts: { numericColumns: 1, hasTimeSeries: false },
        spec: {
          layout: 'GRID_3D',
          geometry: 'DISTRIBUTION_FIELD',
          behavior: 'STATIC',
          interaction: 'INSPECT_CELL',
        },
        cost: 0,
      } as unknown as SolverResult;
      const artifact = VRTopologyTranslator.synthesizeArtifact(solverResult, input);
      try {
        expect(artifact.group.userData.semanticEmbodimentStatus).toBe('READY');
        expect(artifact.nodeMeshes).toHaveLength(envelope?.resource.elementCount ?? -1);
        expect(
          artifact.nodeMeshes.every((mesh) => mesh.userData.datasetFingerprint === data.fingerprint)
        ).toBe(true);
        expect(artifact.nodeMeshes[0]).toBeInstanceOf(THREE.Mesh);
      } finally {
        disposeObject(artifact.group);
      }

      await handler(message({ type: 'SUPERSEDE', fence: { generation: 2 } }));
    } finally {
      vi.stubGlobal('self', originalSelf);
    }
  });
});
