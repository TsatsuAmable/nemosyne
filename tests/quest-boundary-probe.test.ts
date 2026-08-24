import { describe, expect, it, vi } from 'vitest';
import { WorldTopics } from '../src/utils/EventBus.ts';
import {
  QuestBoundaryProbe,
  hasCompleteQuest10mBoundaryEvidence,
  type QuestBoundaryRuntime,
  type QuestBoundarySummary,
} from '../src/vr/scalability/QuestBoundaryProbe.ts';

function makeRuntime(): QuestBoundaryRuntime {
  const wasmMemory = new WebAssembly.Memory({ initial: 16 });
  let nextPointer = 1024;
  let inputPointer = 0;
  let inputLength = 0;
  const primitivePointers: Array<{ values: number; validity: number; length: number }> = [];
  const alloc = (length: number) => {
    const pointer = Math.ceil(nextPointer / 8) * 8;
    nextPointer = pointer + length;
    return pointer;
  };
  const write = (pointer: number, value: string) => {
    const bytes = new TextEncoder().encode(value);
    new Uint8Array(wasmMemory.buffer, pointer, bytes.length).set(bytes);
    return bytes.length;
  };
  return {
    isReady: () => true,
    memory: () => wasmMemory,
    call(name, ...args) {
      const numbers = args.map(Number);
      switch (name) {
        case 'host_buffer_alloc':
          inputPointer = alloc(numbers[0]);
          inputLength = numbers[0];
          return inputPointer;
        case 'host_buffer_dealloc':
          return undefined;
        case 'data_load_typed_columns': {
          const source = new DataView(wasmMemory.buffer, numbers[0], numbers[1]);
          const rows = source.getUint32(4, true);
          for (let column = 0; column < 3; column += 1) {
            const values = alloc(rows * 8);
            const validity = alloc(rows);
            const valueView = new Float64Array(wasmMemory.buffer, values, rows);
            const validityView = new Uint8Array(wasmMemory.buffer, validity, rows);
            for (let row = 0; row < rows; row += 1) {
              valueView[row] = (column + 1) * (row + 1);
              validityView[row] = 1;
            }
            primitivePointers.push({ values, validity, length: rows });
          }
          return inputPointer > 0 && inputLength > 0 ? 7 : 0;
        }
        case 'data_typed_dataset_fingerprint': {
          const fingerprint = 'a'.repeat(64);
          return numbers[1] === 0 ? fingerprint.length : write(numbers[1], fingerprint);
        }
        case 'data_compute_structure_profile': {
          const profile = JSON.stringify({ rowCount: primitivePointers[0]?.length ?? 0 });
          return numbers[1] === 0
            ? new TextEncoder().encode(profile).length
            : write(numbers[1], profile);
        }
        case 'compatibility_row_materialisation_count':
          return 0;
        case 'typed_primitive_column_len':
          return primitivePointers[numbers[1]].length;
        case 'typed_primitive_values_ptr':
          return primitivePointers[numbers[1]].values;
        case 'typed_primitive_validity_ptr':
          return primitivePointers[numbers[1]].validity;
        case 'typed_dataset_destroy':
          return undefined;
        default:
          throw new Error(`Unexpected runtime call: ${name}`);
      }
    },
  };
}

function makeEngine(active: boolean) {
  const session = active
    ? {
        visibilityState: 'visible',
        frameRate: 72,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }
    : null;
  return {
    renderer: {
      xr: { getSession: () => session },
      getContext: () => null,
    },
  };
}

describe('Quest 10M Rust boundary probe', () => {
  it('uses the typed Rust path and emits audit-gated aggregate evidence', () => {
    const events: Array<{ topic: string; payload?: unknown }> = [];
    const probe = new QuestBoundaryProbe(
      makeEngine(true),
      { emit: (topic, payload) => events.push({ topic, payload }) },
      {
        runtime: makeRuntime(),
        scenario: { rows: 8, primitiveColumns: 3, categoricalCardinality: 2, buildChunkRows: 2 },
      }
    );

    expect(probe.run()).toBe(true);
    for (let tick = 0; tick < 100 && probe.phase !== 'COMPLETE'; tick += 1) probe.update();

    expect(probe.phase).toBe('COMPLETE');
    const summary = events.find((event) => event.topic === WorldTopics.QUEST_BOUNDARY_COMPLETE)
      ?.payload as QuestBoundarySummary;
    expect(summary.outcome.status).toBe('completed');
    expect(summary.evidence.structureProfileRowCount).toBe(8);
    expect(summary.evidence.rowMaterialisations).toBe(0);
    expect(summary.evidence.checksumParity).toBe(true);
    expect(summary.collection.datasetRowsIncluded).toBe(false);
    expect(summary.qualification.evidencePathAvailableAt10m).toBe(false);
    expect(summary.qualification.deviceQualifiedAt10m).toBe(false);
    expect(summary.qualification.promotionBlockedByAudits).toBe(true);
    expect(summary.qualification.status).toBe('MEASUREMENT_INCOMPLETE');
  });

  it('recognizes only complete, row-free evidence from the exact 10M scenario', () => {
    expect(hasCompleteQuest10mBoundaryEvidence(10_000_000, 'completed', 10_000_000, 0, true)).toBe(
      true
    );
    expect(hasCompleteQuest10mBoundaryEvidence(1_000_000, 'completed', 1_000_000, 0, true)).toBe(
      false
    );
    expect(hasCompleteQuest10mBoundaryEvidence(10_000_000, 'failed', 10_000_000, 0, true)).toBe(
      false
    );
  });

  it('fails closed when no immersive XR session is active', () => {
    const events: Array<{ topic: string; payload?: unknown }> = [];
    const probe = new QuestBoundaryProbe(
      makeEngine(false),
      { emit: (topic, payload) => events.push({ topic, payload }) },
      { runtime: makeRuntime() }
    );

    expect(probe.run()).toBe(false);
    const summary = events.find((event) => event.topic === WorldTopics.QUEST_BOUNDARY_COMPLETE)
      ?.payload as QuestBoundarySummary;
    expect(summary.outcome.status).toBe('failed');
    expect(summary.xrActive).toBe(false);
    expect(summary.qualification.evidencePathAvailableAt10m).toBe(false);
    expect(summary.qualification.deviceQualifiedAt10m).toBe(false);
  });

  it('dispose immediately releases an allocated host buffer and visibility listener exactly once', () => {
    const runtime = makeRuntime();
    const runtimeCall = vi.spyOn(runtime, 'call');
    const session = {
      visibilityState: 'visible',
      frameRate: 72,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    const events: Array<{ topic: string; payload?: unknown }> = [];
    const probe = new QuestBoundaryProbe(
      {
        renderer: {
          xr: { getSession: () => session },
          getContext: () => null,
        },
      },
      { emit: (topic, payload) => events.push({ topic, payload }) },
      {
        runtime,
        scenario: { rows: 2, primitiveColumns: 1, categoricalCardinality: 1, buildChunkRows: 2 },
      }
    );

    expect(probe.run()).toBe(true);
    probe.update();
    probe.update();
    probe.update();
    probe.update();
    expect(probe.phase).toBe('INGESTING');

    probe.dispose();
    probe.dispose();

    expect(probe.phase).toBe('COMPLETE');
    expect(runtimeCall.mock.calls.filter(([name]) => name === 'host_buffer_dealloc')).toHaveLength(
      1
    );
    expect(
      runtimeCall.mock.calls.filter(([name]) => name === 'typed_dataset_destroy')
    ).toHaveLength(0);
    expect(session.removeEventListener).toHaveBeenCalledTimes(1);
    expect(session.removeEventListener).toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function)
    );
    const summaries = events.filter((event) => event.topic === WorldTopics.QUEST_BOUNDARY_COMPLETE);
    expect(summaries).toHaveLength(1);
    expect((summaries[0].payload as QuestBoundarySummary).outcome.status).toBe('aborted');
    expect(probe.run()).toBe(false);
  });

  it('dispose immediately destroys an ingested dataset handle exactly once', () => {
    const runtime = makeRuntime();
    const runtimeCall = vi.spyOn(runtime, 'call');
    const session = {
      visibilityState: 'visible',
      frameRate: 72,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    const probe = new QuestBoundaryProbe(
      {
        renderer: {
          xr: { getSession: () => session },
          getContext: () => null,
        },
      },
      { emit: vi.fn() },
      {
        runtime,
        scenario: { rows: 2, primitiveColumns: 1, categoricalCardinality: 1, buildChunkRows: 2 },
      }
    );

    expect(probe.run()).toBe(true);
    probe.update();
    probe.update();
    probe.update();
    probe.update();
    probe.update();
    expect(probe.phase).toBe('FINGERPRINTING');
    runtimeCall.mockClear();

    probe.dispose();
    probe.dispose();

    expect(runtimeCall.mock.calls.filter(([name]) => name === 'typed_dataset_destroy')).toEqual([
      ['typed_dataset_destroy', 7],
    ]);
    expect(runtimeCall.mock.calls.filter(([name]) => name === 'host_buffer_dealloc')).toHaveLength(
      0
    );
    expect(session.removeEventListener).toHaveBeenCalledTimes(1);
  });
});
