import { describe, expect, it, vi } from 'vitest';
import { Dataset } from '../src/data/Dataset.ts';
import type {
  AnalyticalExecutionPort,
  AnalyticalExecutionRequest,
} from '../src/atlas/ports/AnalyticalExecutionPort.ts';
import { loadAggregateSemanticEmbodiment } from '../src/app/dataset/SemanticEmbodimentLoader.ts';
import type { RepresentationDecision } from '../src/moneta/representation/RepresentationDecision.ts';
import type { SemanticEmbodimentEnvelopeV1 } from '../src/moneta/representation/SemanticEmbodimentPayload.ts';

function dataset(): Dataset {
  return new Dataset(
    'a4-loader',
    [
      { name: 'group', type: 'CATEGORICAL' },
      { name: 'value', type: 'NUMERIC' },
    ],
    [{ group: 'a', value: 1 }, { group: 'b', value: 3 }],
  );
}

function decision(): RepresentationDecision {
  return {
    id: 'decision-a4-loader',
    chosenCandidateId: 'AGGREGATE_VOLUME',
    fitnessModelVersion: 'bootstrap-fitness-v1',
    provenance: { fitnessModelVersion: 'bootstrap-fitness-v1' },
  } as unknown as RepresentationDecision;
}

function envelope(fingerprint: string): SemanticEmbodimentEnvelopeV1 {
  return {
    schemaVersion: 1,
    datasetFingerprint: fingerprint,
    candidateId: 'AGGREGATE_VOLUME',
    representationFamily: 'AGGREGATE',
    analyticalMethod: { name: 'categorical-grouped-aggregate', version: 'aggregate-columnar-v1', parameters: {} },
    approximation: { mode: 'EXACT', representedRowCount: 2 },
    informationContract: {
      preserves: ['aggregate-group-magnitude'],
      loses: ['individual-observation-identity', 'exact-metric-values', 'outlier-boundary-visibility'],
    },
    resource: { sourceRowCount: 2, elementCount: 2, maxElementCount: 4096 },
    provenance: { kernelVersion: 'test', algorithmVersion: 'aggregate-columnar-v1' },
    result: {
      status: 'READY',
      payload: {
        kind: 'AGGREGATE_VOLUME',
        data: {
          groupingFields: ['group'],
          measure: { field: 'value', function: 'MEAN' },
          groups: [
            { semanticId: 'aggregate-group:00000', key: 'a', count: 1, aggregateValue: 1 },
            { semanticId: 'aggregate-group:00001', key: 'b', count: 1, aggregateValue: 3 },
          ],
        },
      },
    },
  };
}

function portFor(value: SemanticEmbodimentEnvelopeV1, resident: boolean) {
  const registerDataset = vi.fn(async () => undefined);
  const execute = vi.fn(async (request: AnalyticalExecutionRequest) => ({
    requestId: request.requestId,
    generation: request.generation,
    datasetVersion: request.dataset.version,
    datasetFingerprint: request.dataset.fingerprint,
    value,
  }));
  const port: AnalyticalExecutionPort = {
    isAsync: true,
    supersede: vi.fn(),
    hasRegisteredDataset: vi.fn(() => resident),
    registerDataset,
    execute: execute as unknown as AnalyticalExecutionPort['execute'],
  };
  return { port, execute, registerDataset };
}

describe('Stream A A4 semantic embodiment loader', () => {
  it('uses a resident worker handle without sending rows in the semantic execution request', async () => {
    const data = dataset();
    const fingerprint = data.fingerprint;
    const { port, execute, registerDataset } = portFor(envelope(fingerprint), true);
    const authority = { executionPort: port, generation: 3, datasetVersion: 7, datasetFingerprint: fingerprint };

    const result = await loadAggregateSemanticEmbodiment(
      authority,
      data,
      decision(),
      { color: 'group', size: 'value' },
    );

    expect(result?.candidateId).toBe('AGGREGATE_VOLUME');
    expect(registerDataset).not.toHaveBeenCalled();
    expect(execute).toHaveBeenCalledTimes(1);
    const request = execute.mock.calls[0][0];
    expect(request.operation).toBe('semanticEmbodiment');
    expect(request.datasetPayload).toBeUndefined();
    expect(JSON.stringify(request.params)).not.toContain('"rows"');
    expect(request.params).toMatchObject({
      schemaVersion: 1,
      candidateId: 'AGGREGATE_VOLUME',
      groupingField: 'group',
      measure: { field: 'value', function: 'MEAN' },
    });
  });

  it('registers once when needed, then fences a result that became stale', async () => {
    const data = dataset();
    const fingerprint = data.fingerprint;
    let release!: () => void;
    const wait = new Promise<void>((resolve) => { release = resolve; });
    const { port, execute, registerDataset } = portFor(envelope(fingerprint), false);
    execute.mockImplementation(async (request) => {
      await wait;
      return {
        requestId: request.requestId,
        generation: request.generation,
        datasetVersion: request.dataset.version,
        datasetFingerprint: request.dataset.fingerprint,
        value: envelope(fingerprint),
      };
    });
    const authority = { executionPort: port, generation: 1, datasetVersion: 2, datasetFingerprint: fingerprint };

    const pending = loadAggregateSemanticEmbodiment(
      authority,
      data,
      decision(),
      { color: 'group', size: 'value' },
    );
    await vi.waitFor(() => expect(execute).toHaveBeenCalledTimes(1));
    authority.datasetVersion = 3;
    release();

    expect(await pending).toBeNull();
    expect(registerDataset).toHaveBeenCalledTimes(1);
  });
});
