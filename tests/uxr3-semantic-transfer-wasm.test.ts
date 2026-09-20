import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as bridge from '../src/wasm/RuntimeBridge.ts';
import * as state from '../src/wasm/runtime/RuntimeState.ts';
import * as semantic from '../src/wasm/runtime/SemanticEmbodimentBridge.ts';
import { createSourceRelationshipGraphAuthority } from '../src/moneta/representation/RelationshipGraphAuthority.ts';

const call = (name: string, ...args: number[]) => Number(bridge.call(name, ...args)) >>> 0;
const aggregate = { schemaVersion: 1 as const, candidateId: 'AGGREGATE_VOLUME' as const,
  groupingField: 'group', measure: { field: 'x', function: 'MEAN' as const }, decisionId: 'r1-semantic' };
const distribution = { schemaVersion: 1 as const, candidateId: 'DISTRIBUTION_FIELD' as const,
  measureField: 'x', histogramBinCount: 2, ecdfKnotCount: 3, quantileProbabilities: [0, 0.5, 1], decisionId: 'r1-semantic' };
const density = { schemaVersion: 1 as const, candidateId: 'DENSITY_FIELD' as const,
  measureFieldX: 'x', measureFieldY: 'y', binsX: 2, binsY: 2, decisionId: 'r1-semantic' };
const cluster = { schemaVersion: 1 as const, candidateId: 'CLUSTER_REGIONS' as const,
  partitionField: 'group', coordinateFields: ['x', 'y'], decisionId: 'r1-semantic' };
const graph = { schemaVersion: 1 as const, candidateId: 'RELATIONSHIP_GRAPH' as const,
  graphAuthority: createSourceRelationshipGraphAuthority('DIRECTED'), decisionId: 'r1-semantic' };
const operations = [
  { id: 5, name: 'aggregate', request: aggregate, run: (h: number) => semantic.buildAggregateSemanticEmbodimentV1(h, aggregate) },
  { id: 6, name: 'distribution', request: distribution, run: (h: number) => semantic.buildDistributionSemanticEmbodimentV1(h, distribution) },
  { id: 7, name: 'density', request: density, run: (h: number) => semantic.buildDensitySemanticEmbodimentV1(h, density) },
  { id: 8, name: 'cluster', request: cluster, run: (h: number) => semantic.buildClusterSemanticEmbodimentV1(h, cluster) },
  { id: 9, name: 'graph', request: graph, run: (h: number) => semantic.buildGraphSemanticEmbodimentV1(h, graph) },
];
function fixture() {
  return bridge.loadDatasetJson({ name: 'semantic α', columns: [
    { name: 'group', type: 'CATEGORICAL' }, { name: 'x', type: 'NUMERIC' }, { name: 'y', type: 'NUMERIC' },
  ], rows: [{ group: 'a', x: 0, y: 0 }, { group: 'a', x: 2, y: 2 }, { group: 'b', x: 4, y: 4 }],
  rowIds: ['α', 'β', 'γ'], edges: [{ source: 'α', target: 'β' }] });
}
function legacy(name: string, handle: number, request: unknown) {
  const input = bridge.allocBytes(new TextEncoder().encode(JSON.stringify(request)));
  try {
    const size = call(name, handle, input.ptr, input.len, 0, 0);
    expect(size).toBeGreaterThan(0);
    const output = bridge.allocBuffer(size);
    try {
      expect(call(name, handle, input.ptr, input.len, output.ptr, output.len)).toBe(size);
      return JSON.parse(bridge.readString(output.ptr, size));
    } finally { bridge.deallocBuffer(output.ptr, output.len); }
  } finally { bridge.deallocBytes(input.ptr, input.len); }
}
function detailRequest(handle: number) {
  const envelope = semantic.buildClusterSemanticEmbodimentV1(handle, cluster);
  if (envelope?.result.status !== 'READY') throw new Error('Expected ready cluster');
  const region = envelope.result.payload.data.regions.find(r => r.sourcePartitionValue === 'a');
  if (!region) throw new Error('Missing region a');
  return { schemaVersion: 1 as const, target: { datasetFingerprint: envelope.datasetFingerprint,
    decisionId: 'r1-semantic', representationFamily: 'CLUSTER' as const, semanticObjectId: region.semanticId },
  limit: 2, offset: 0, investigationContext: 'Inspect source group a' };
}
describe('R1 semantic production transfer', () => {
  beforeAll(async () => { if (!bridge.isReady()) await bridge.initRuntime('/wasm/pkg/nemosyne_wasm_bg.wasm'); });
  it.each(operations)('$name builds once with identical meaning and provenance', ({ id, name, request, run }) => {
    const handle = fixture();
    try {
      const before = call('prepared_computation_count', id);
      const result = run(handle);
      expect(result?.result.status).toBe('READY');
      expect(call('prepared_computation_count', id) - before).toBe(1);
      expect(result?.datasetFingerprint).toBe(bridge.datasetFingerprint(handle));
      expect(result?.provenance.decisionId).toBe('r1-semantic');
      expect(result).toEqual(legacy(`moneta_build_${name}_embodiment_v1`, handle, request));
      expect(call('prepared_result_count')).toBe(0);
      expect(call('prepared_result_bytes')).toBe(0);
    } finally { bridge.destroyDataset(handle); }
  });
  it('queries detail once, preserves membership and ignores forged caller authority', () => {
    const handle = fixture();
    try {
      const request = detailRequest(handle);
      const before = call('prepared_computation_count', 10);
      const result = semantic.querySemanticDetailV1(handle, request, { ...cluster, partitionField: 'x' }, 7);
      expect(result?.result).toMatchObject({ status: 'READY', observationIds: ['α', 'β'], totalMemberCount: 2 });
      expect(call('prepared_computation_count', 10) - before).toBe(1);
      expect(result).toEqual(legacy('moneta_query_semantic_detail_v1', handle,
        { request, embodimentRequest: cluster, generation: 7 }));
      expect(call('prepared_result_count')).toBe(0);
    } finally { bridge.destroyDataset(handle); }
  });
  it('preserves stale-dataset detail refusal instead of returning null', () => {
    const handle = fixture();
    const request = detailRequest(handle);
    bridge.destroyDataset(handle);
    const result = semantic.querySemanticDetailV1(handle, request, cluster, 8);
    expect(result?.result).toMatchObject({ status: 'REFUSED', refusal: { code: 'STALE_GENERATION' } });
    expect(result).toEqual(legacy('moneta_query_semantic_detail_v1', handle,
      { request, embodimentRequest: cluster, generation: 8 }));
    expect(call('prepared_result_count')).toBe(0);
  });
  it('preserves structured scientific refusal', () => {
    const handle = fixture();
    try {
      const invalid = { ...aggregate, groupingField: 'absent' };
      const before = call('prepared_computation_count', 5);
      const result = semantic.buildAggregateSemanticEmbodimentV1(handle, invalid);
      expect(result?.result).toMatchObject({ status: 'REFUSED', refusal: { code: 'INVALID_PARAMETERS' } });
      expect(call('prepared_computation_count', 5) - before).toBe(1);
      expect(result).toEqual(legacy('moneta_build_aggregate_embodiment_v1', handle, invalid));
      expect(call('prepared_result_count')).toBe(0);
    } finally { bridge.destroyDataset(handle); }
  });
  it.each(operations)('$name bounds admission, read retries and dataset-owned lifetime', ({ id, name, request, run }) => {
    const handle = fixture();
    const input = bridge.allocBytes(new TextEncoder().encode(JSON.stringify(request)));
    const prepare = () => call(`moneta_prepare_${name}_embodiment_v1`, handle, input.ptr, input.len);
    try {
      const before = call('prepared_computation_count', id);
      const tokens = Array.from({ length: 4 }, prepare);
      expect(tokens.every(t => t !== 0 && t !== 0xffffffff)).toBe(true);
      expect(call('prepared_computation_count', id) - before).toBe(4);
      expect(prepare()).toBe(0xffffffff);
      const buffers = bridge.hostBufferAllocationCount();
      expect(() => run(handle)).toThrow(/resource limit/);
      expect(bridge.hostBufferAllocationCount()).toBe(buffers);
      expect(run(0)).toBeNull();
      expect(call('prepared_computation_count', id) - before).toBe(4);
      const size = call('prepared_result_read', tokens[0], 0, 0);
      expect(size).toBeGreaterThan(0);
      expect(call('prepared_result_read', tokens[0], 0, 0)).toBe(size);
      expect(call('prepared_computation_count', id) - before).toBe(4);
      bridge.destroyDataset(handle);
      expect(call('prepared_result_count')).toBe(0);
      expect(call('prepared_result_bytes')).toBe(0);
      expect(call('prepared_result_read', tokens[0], 0, 0)).toBe(0);
    } finally { bridge.deallocBytes(input.ptr, input.len); bridge.destroyDataset(handle); }
  });
  it.each(operations)('$name rejects malformed input without computing or retaining results', ({ id, name }) => {
    const handle = fixture();
    const input = bridge.allocBytes(new TextEncoder().encode('{'));
    try {
      const before = call('prepared_computation_count', id);
      expect(call(`moneta_prepare_${name}_embodiment_v1`, handle, input.ptr, input.len)).toBe(0);
      expect(call(`moneta_prepare_${name}_embodiment_v1`, handle, 0, 12)).toBe(0);
      expect(call('prepared_computation_count', id)).toBe(before);
      expect(call('prepared_result_count')).toBe(0);
    } finally { bridge.deallocBytes(input.ptr, input.len); bridge.destroyDataset(handle); }
  });
  it('bounds stale detail responses and releases them on runtime reset', () => {
    const handle = fixture();
    const request = detailRequest(handle);
    bridge.destroyDataset(handle);
    const input = bridge.allocBytes(new TextEncoder().encode(JSON.stringify({ request, embodimentRequest: cluster, generation: 8 })));
    const malformed = bridge.allocBytes(new TextEncoder().encode('{'));
    try {
      const before = call('prepared_computation_count', 10);
      expect(call('moneta_prepare_semantic_detail_v1', handle, malformed.ptr, malformed.len)).toBe(0);
      expect(call('prepared_computation_count', 10)).toBe(before);
      const tokens = Array.from({ length: 4 }, () => call('moneta_prepare_semantic_detail_v1', handle, input.ptr, input.len));
      expect(tokens.every(t => t !== 0 && t !== 0xffffffff)).toBe(true);
      expect(call('prepared_computation_count', 10) - before).toBe(4);
      expect(() => semantic.querySemanticDetailV1(handle, request, cluster, 8)).toThrow(/resource limit/);
      expect(call('prepared_computation_count', 10) - before).toBe(4);
      expect(call('data_reset_runtime_generation', bridge.getRuntimeGeneration() + 1)).toBe(1);
      expect(call('prepared_result_count')).toBe(0);
      expect(call('prepared_result_bytes')).toBe(0);
      expect(call('prepared_result_read', tokens[0], 0, 0)).toBe(0);
    } finally { bridge.deallocBytes(input.ptr, input.len); bridge.deallocBytes(malformed.ptr, malformed.len); }
  });
  it.each([...operations, { id: 10, name: 'detail', run: (h: number) =>
    semantic.querySemanticDetailV1(h, detailRequest(h), cluster, 9) }])(
    '$name releases real WASM results and input buffers after host failures', ({ name, run }) => {
      const handle = fixture();
      const request = detailRequest(handle);
      const compute = name === 'detail' ? () => semantic.querySemanticDetailV1(handle, request, cluster, 9) : () => run(handle);
      const owner = state.getRawRuntimeExports();
      const baseline = bridge.hostBufferAllocationCount();
      try {
        for (const failure of ['allocation', 'read', 'json']) {
          const spy = vi.spyOn(state, 'getRawRuntimeExports').mockReturnValue({
            ...owner, memory: owner.memory,
            host_buffer_alloc: failure === 'allocation' ? () => 0 : owner.host_buffer_alloc,
            prepared_result_read: (token, ptr, len) => {
              if (failure === 'read' && ptr) return 0;
              const result = owner.prepared_result_read(token, ptr, len);
              if (failure === 'json' && ptr) new Uint8Array(owner.memory.buffer, ptr, len).fill(32);
              return result;
            },
          });
          try {
            if (failure === 'read') expect(compute()).toBeNull();
            else expect(compute).toThrow();
          } finally { spy.mockRestore(); }
          expect(call('prepared_result_count')).toBe(0);
          expect(call('prepared_result_bytes')).toBe(0);
          expect(bridge.hostBufferAllocationCount()).toBe(baseline);
        }
      } finally { bridge.destroyDataset(handle); }
    },
  );
});
