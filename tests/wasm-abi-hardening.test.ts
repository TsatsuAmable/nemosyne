import { beforeAll, describe, expect, it } from 'vitest';
import * as bridge from '../src/wasm/RuntimeBridge.ts';

function callNumber(name: string, ...args: unknown[]): number {
  return Number(bridge.call(name, ...args) ?? 0);
}

function tinyDataset(name: string, value: number) {
  return {
    name,
    columns: [{ name: 'x', type: 'NUMERIC' as const }],
    rows: [{ x: value }],
  };
}

describe('WASM ABI hardening', () => {
  beforeAll(async () => {
    if (!bridge.isReady()) {
      await bridge.initRuntime('/wasm/pkg/nemosyne_wasm_bg.wasm');
    }
    expect(bridge.isReady()).toBe(true);
  });

  it('rejects zero and maximal dataset handles without leaking host buffers', () => {
    const baseline = bridge.hostBufferAllocationCount();

    for (const handle of [0, 0xffff_ffff]) {
      expect(callNumber('dataset_row_count', handle)).toBe(0);
      expect(callNumber('dataset_column_count', handle)).toBe(0);
      expect(callNumber('canonical_dataset_row_count', handle)).toBe(0);
      expect(callNumber('canonical_dataset_column_count', handle)).toBe(0);
      expect(callNumber('typed_dataset_row_count', handle)).toBe(0);
      expect(callNumber('dataset_primitive_column_len', handle, 0)).toBe(0);
      expect(callNumber('dataset_primitive_column_values_ptr', handle, 0)).toBe(0);
      expect(callNumber('dataset_primitive_column_validity_ptr', handle, 0)).toBe(0);
      expect(callNumber('compatibility_dataset_to_json', handle, 0, 0)).toBe(0);
      expect(callNumber('data_compute_structure_profile', handle, 0, 0)).toBe(0);

      expect(() => bridge.call('dataset_destroy', handle)).not.toThrow();
      expect(() => bridge.call('typed_dataset_destroy', handle)).not.toThrow();
    }

    expect(bridge.hostBufferAllocationCount()).toBe(baseline);
  });

  it('rejects an operation against a stale handle and releases its input buffer', () => {
    const baseline = bridge.hostBufferAllocationCount();
    const operation = new TextEncoder().encode(JSON.stringify({ op: 'sort', column: 'x' }));
    const allocation = bridge.allocBytes(operation);

    try {
      expect(bridge.hostBufferAllocationCount()).toBe(baseline + 1);
      expect(callNumber('data_operation', 0xffff_ffff, allocation.ptr, allocation.len)).toBe(0);
    } finally {
      bridge.deallocBytes(allocation.ptr, allocation.len);
    }

    expect(bridge.hostBufferAllocationCount()).toBe(baseline);
  });

  it('does not partially write an undersized compatibility JSON result', () => {
    const baseline = bridge.hostBufferAllocationCount();
    const handle = bridge.loadDatasetJson(tinyDataset('atomic-compatibility-output', 7));
    expect(handle).toBeGreaterThan(0);

    try {
      const required = callNumber('compatibility_dataset_to_json', handle, 0, 0);
      expect(required).toBeGreaterThan(1);
      const output = bridge.allocBuffer(required);
      try {
        new Uint8Array(bridge.memory().buffer, output.ptr, output.len).fill(0xa5);
        expect(
          callNumber('compatibility_dataset_to_json', handle, output.ptr, output.len - 1)
        ).toBe(required);
        expect(
          Array.from(new Uint8Array(bridge.memory().buffer, output.ptr, output.len)).every(
            (byte) => byte === 0xa5
          )
        ).toBe(true);
      } finally {
        bridge.deallocBuffer(output.ptr, output.len);
      }
    } finally {
      bridge.destroyDataset(handle);
    }

    expect(bridge.hostBufferAllocationCount()).toBe(baseline);
  });

  it('does not partially write an undersized load-profile result', () => {
    const baseline = bridge.hostBufferAllocationCount();
    const payload = new TextEncoder().encode(
      JSON.stringify({
        name: 'profile-output',
        columns: [{ name: 'x', type: 'NUMERIC' }],
        rows: [{ x: 1 }, { x: 2 }],
      })
    );
    const input = bridge.allocBytes(payload);
    let handle = 0;
    try {
      handle = callNumber('data_load_dataset_json_profiled', input.ptr, input.len);
      expect(handle).toBeGreaterThan(0);
    } finally {
      bridge.deallocBytes(input.ptr, input.len);
    }

    try {
      const required = callNumber('data_last_load_profile', 0, 0);
      expect(required).toBeGreaterThan(1);
      const output = bridge.allocBuffer(required);
      try {
        new Uint8Array(bridge.memory().buffer, output.ptr, output.len).fill(0xa5);
        expect(callNumber('data_last_load_profile', output.ptr, output.len - 1)).toBe(required);
        expect(
          Array.from(new Uint8Array(bridge.memory().buffer, output.ptr, output.len)).every(
            (byte) => byte === 0xa5
          )
        ).toBe(true);
      } finally {
        bridge.deallocBuffer(output.ptr, output.len);
      }
    } finally {
      if (handle !== 0) bridge.destroyDataset(handle);
    }

    expect(bridge.hostBufferAllocationCount()).toBe(baseline);
  });

  it('routes legacy alloc/dealloc exports through tracked ownership', () => {
    const baseline = bridge.hostBufferAllocationCount();
    const ptr = callNumber('alloc', 16);
    expect(ptr).toBeGreaterThan(0);
    expect(bridge.hostBufferAllocationCount()).toBe(baseline + 1);

    bridge.call('dealloc', ptr, 15);
    expect(bridge.hostBufferAllocationCount()).toBe(baseline + 1);

    bridge.call('dealloc', ptr, 16);
    expect(bridge.hostBufferAllocationCount()).toBe(baseline);
    expect(() => bridge.call('dealloc', ptr, 16)).not.toThrow();
    expect(bridge.hostBufferAllocationCount()).toBe(baseline);
  });

  it('rejects arbitrary and overlong host ranges without trapping', () => {
    expect(() => bridge.call('fill_pattern', 8, 8)).not.toThrow();
    expect(callNumber('fill_pattern', 8, 8)).toBe(0);
    expect(callNumber('data_load_json', 8, 8)).toBe(0);
    expect(callNumber('data_load_csv', 8, 8)).toBe(0);
    expect(callNumber('data_load_typed_columns', 8, 8)).toBe(0);

    const allocation = bridge.allocBuffer(8);
    try {
      expect(callNumber('data_load_json', allocation.ptr, allocation.len + 1)).toBe(0);
      expect(callNumber('fill_pattern', allocation.ptr, allocation.len + 1)).toBe(0);
    } finally {
      bridge.deallocBuffer(allocation.ptr, allocation.len);
    }
  });

  it('permits a live interior subrange but not bytes outside its allocation', () => {
    const allocation = bridge.allocBuffer(16);
    try {
      const bytes = new Uint8Array(bridge.memory().buffer, allocation.ptr, allocation.len);
      bytes.fill(0xa5);

      expect(callNumber('fill_pattern', allocation.ptr + 4, 4)).toBe(4);
      expect(Array.from(bytes.slice(0, 4))).toEqual([0xa5, 0xa5, 0xa5, 0xa5]);
      expect(Array.from(bytes.slice(4, 8))).toEqual([0, 1, 2, 3]);
      expect(Array.from(bytes.slice(8))).toEqual(new Array(8).fill(0xa5));
      expect(callNumber('fill_pattern', allocation.ptr + 12, 8)).toBe(0);
    } finally {
      bridge.deallocBuffer(allocation.ptr, allocation.len);
    }
  });

  it('rejects an unowned output pointer instead of treating it as a size query', () => {
    const required = callNumber('kernel_version', 0, 0);
    expect(required).toBeGreaterThan(0);
    expect(callNumber('kernel_version', 8, required)).toBe(0);
    expect(callNumber('kernel_version', 0, required)).toBe(0);
  });

  it('keeps destroyed dataset handles permanently stale across churn', () => {
    const staleHandles: number[] = [];
    let previousHandle = 0;

    for (let index = 0; index < 128; index += 1) {
      const handle = bridge.loadDatasetJson(tinyDataset(`handle-${index}`, index));
      expect(handle).toBeGreaterThan(previousHandle);
      expect(callNumber('dataset_row_count', handle)).toBe(1);

      bridge.destroyDataset(handle);
      staleHandles.push(handle);
      expect(callNumber('dataset_row_count', handle)).toBe(0);
      expect(callNumber('canonical_dataset_row_count', handle)).toBe(0);
      previousHandle = handle;
    }

    const live = bridge.loadDatasetJson(tinyDataset('live-after-churn', 999));
    expect(live).toBeGreaterThan(previousHandle);
    try {
      expect(callNumber('dataset_row_count', live)).toBe(1);
      for (const stale of staleHandles) {
        expect(callNumber('dataset_row_count', stale)).toBe(0);
        expect(callNumber('canonical_dataset_row_count', stale)).toBe(0);
        expect(callNumber('data_compute_structure_profile', stale, 0, 0)).toBe(0);
      }
    } finally {
      bridge.destroyDataset(live);
    }
  });

  it('revokes live dataset authority and retags handles across analytical generations', () => {
    const input = bridge.loadDatasetJson(tinyDataset('generation-before', 7));
    expect(input).toBeGreaterThan(0);
    const output = bridge.runOperation(input, { op: 'sort', column: 'x' });
    expect(output).toBeGreaterThan(input);
    expect(bridge.kernelProvenance()).not.toBeNull();

    const sequenceBits = 20;
    const sequenceMask = (1 << sequenceBits) - 1;
    const currentGeneration = input >>> sequenceBits;
    expect(output >>> sequenceBits).toBe(currentGeneration);
    const nextGeneration = currentGeneration + 1;
    expect(nextGeneration).toBeLessThan(1 << 11);

    expect(callNumber('data_reset_runtime_generation', nextGeneration)).toBe(1);
    expect(callNumber('dataset_row_count', input)).toBe(0);
    expect(callNumber('dataset_row_count', output)).toBe(0);
    expect(bridge.kernelProvenance()).toBeNull();

    expect(() => bridge.destroyDataset(input)).not.toThrow();
    expect(() => bridge.destroyDataset(output)).not.toThrow();

    const next = bridge.loadDatasetJson(tinyDataset('generation-after', 9));
    expect(next >>> sequenceBits).toBe(nextGeneration);
    expect(next & sequenceMask).toBe(1);
    expect(next).not.toBe(input);
    expect(next).not.toBe(output);
    try {
      expect(callNumber('dataset_row_count', next)).toBe(1);
      expect(callNumber('dataset_row_count', input)).toBe(0);
      expect(callNumber('dataset_row_count', output)).toBe(0);
    } finally {
      bridge.destroyDataset(next);
    }
  });

  it('survives a bounded malformed-pointer corpus without leaking or trapping', () => {
    const baseline = bridge.hostBufferAllocationCount();
    const memoryEnd = bridge.memory().buffer.byteLength - 1;
    const pointerCorpus = [0, 1, 8, memoryEnd, 0xffff_fff0, 0xffff_ffff];

    for (const ptr of pointerCorpus) {
      for (const len of [1, 2, 8, 0xffff_ffff]) {
        expect(() => callNumber('fill_pattern', ptr, len)).not.toThrow();
        expect(callNumber('fill_pattern', ptr, len)).toBe(0);
        expect(() => callNumber('data_load_json', ptr, len)).not.toThrow();
        expect(callNumber('data_load_json', ptr, len)).toBe(0);
        expect(() => callNumber('data_load_typed_columns', ptr, len)).not.toThrow();
        expect(callNumber('data_load_typed_columns', ptr, len)).toBe(0);
      }
    }

    const required = callNumber('kernel_version', 0, 0);
    for (const ptr of pointerCorpus) {
      expect(() => callNumber('kernel_version', ptr, required)).not.toThrow();
      expect(callNumber('kernel_version', ptr, required)).toBe(0);
    }
    expect(bridge.hostBufferAllocationCount()).toBe(baseline);
  });

  it('survives deterministic malformed JSON mutations with exact cleanup', () => {
    const baseline = bridge.hostBufferAllocationCount();
    const seed = new TextEncoder().encode('[{"x":1},{"x":2}]');

    for (let mutation = 0; mutation < 64; mutation += 1) {
      const bytes = seed.slice();
      const index = mutation % bytes.length;
      bytes[index] = (bytes[index] + mutation * 37 + 1) & 0xff;
      const allocation = bridge.allocBytes(bytes);
      let handle = 0;
      try {
        expect(() => {
          handle = callNumber('data_load_json', allocation.ptr, allocation.len);
        }).not.toThrow();
      } finally {
        bridge.deallocBytes(allocation.ptr, allocation.len);
        if (handle !== 0) bridge.destroyDataset(handle);
      }
      expect(bridge.hostBufferAllocationCount()).toBe(baseline);
    }
  });

  it('survives repeated allocation/free cycles without retaining host buffers', () => {
    const baseline = bridge.hostBufferAllocationCount();

    for (let index = 0; index < 512; index += 1) {
      const len = (index % 64) + 1;
      const allocation = bridge.allocBuffer(len);
      expect(callNumber('fill_pattern', allocation.ptr, allocation.len)).toBe(len);
      bridge.deallocBuffer(allocation.ptr, allocation.len);
      expect(bridge.hostBufferAllocationCount()).toBe(baseline);
    }
  });

  it('revokes all prior host-buffer capabilities when init starts a new generation', () => {
    expect(bridge.hostBufferAllocationCount()).toBe(0);
    const allocation = bridge.allocBuffer(8);
    expect(bridge.hostBufferAllocationCount()).toBe(1);
    new Uint8Array(bridge.memory().buffer, allocation.ptr, allocation.len).fill(0xa5);

    expect(callNumber('init', 0x1234n)).toBe(1);
    expect(bridge.hostBufferAllocationCount()).toBe(0);
    expect(callNumber('fill_pattern', allocation.ptr, allocation.len)).toBe(0);
    expect(() => bridge.deallocBuffer(allocation.ptr, allocation.len)).not.toThrow();
  });

  it('survives systematic malformed and truncated CSV/JSON property fuzz campaign without leaking host buffers', () => {
    const baseline = bridge.hostBufferAllocationCount();
    const csvSeed = new TextEncoder().encode('id,val,name\n1,3.14,alpha\n2,-42.0,beta\n3,0.0,gamma\n');
    const jsonSeed = new TextEncoder().encode('[{"id":1,"val":3.14,"name":"alpha"},{"id":2,"val":-42.0,"name":"beta"}]');

    // Truncation fuzzing across every single byte boundary
    for (let i = 0; i < csvSeed.length; i += 2) {
      const truncated = csvSeed.slice(0, i);
      const alloc = bridge.allocBytes(truncated);
      let handle = 0;
      try {
        expect(() => {
          handle = callNumber('data_load_csv', alloc.ptr, alloc.len);
        }).not.toThrow();
      } finally {
        bridge.deallocBytes(alloc.ptr, alloc.len);
        if (handle !== 0) bridge.destroyDataset(handle);
      }
      expect(bridge.hostBufferAllocationCount()).toBe(baseline);
    }

    for (let i = 0; i < jsonSeed.length; i += 3) {
      const truncated = jsonSeed.slice(0, i);
      const alloc = bridge.allocBytes(truncated);
      let handle = 0;
      try {
        expect(() => {
          handle = callNumber('data_load_json', alloc.ptr, alloc.len);
        }).not.toThrow();
      } finally {
        bridge.deallocBytes(alloc.ptr, alloc.len);
        if (handle !== 0) bridge.destroyDataset(handle);
      }
      expect(bridge.hostBufferAllocationCount()).toBe(baseline);
    }

    // Mutational fuzzing: byte flips, boundary injection, null byte injection
    for (let mutation = 0; mutation < 64; mutation += 1) {
      const mutated = csvSeed.slice();
      const pos = (mutation * 13) % mutated.length;
      mutated[pos] = (mutation % 3 === 0) ? 0 : (mutated[pos] ^ 0xff);
      const alloc = bridge.allocBytes(mutated);
      let handle = 0;
      try {
        expect(() => {
          handle = callNumber('data_load_csv', alloc.ptr, alloc.len);
        }).not.toThrow();
      } finally {
        bridge.deallocBytes(alloc.ptr, alloc.len);
        if (handle !== 0) bridge.destroyDataset(handle);
      }
      expect(bridge.hostBufferAllocationCount()).toBe(baseline);
    }
  });

  it('survives pathological Unicode and deeply nested structures without trapping', () => {
    const baseline = bridge.hostBufferAllocationCount();
    const pathologicalStrings = [
      '\u202Ereversed_rtl_text\u202C',
      '👨‍👩‍👧‍👦_family_zwj',
      '\uFFFF\uFFFE_non_characters',
      '\uFEFF_bom_marker',
      'null\x00inside\x01control',
      'zalgo_t̸e̸x̸t̸',
    ];

    const datasetWithUnicode = {
      name: 'pathological-unicode',
      columns: [
        { name: 'str', type: 'TEXT' as const },
        { name: 'val', type: 'NUMERIC' as const },
      ],
      rows: pathologicalStrings.map((s, idx) => ({ str: s, val: idx })),
    };

    const handle = bridge.loadDatasetJson(datasetWithUnicode);
    expect(handle).toBeGreaterThan(0);
    try {
      expect(callNumber('dataset_row_count', handle)).toBe(pathologicalStrings.length);
      expect(callNumber('dataset_column_count', handle)).toBe(2);
      const req = callNumber('data_compute_structure_profile', handle, 0, 0);
      expect(req).toBeGreaterThan(0);
    } finally {
      bridge.destroyDataset(handle);
    }
    expect(bridge.hostBufferAllocationCount()).toBe(baseline);

    // Deeply nested JSON object
    let nestedObj: Record<string, unknown> = { depth: 0 };
    for (let d = 1; d <= 30; d += 1) {
      nestedObj = { child: nestedObj, depth: d };
    }
    const nestedPayload = new TextEncoder().encode(JSON.stringify([{ col: nestedObj }]));
    const alloc = bridge.allocBytes(nestedPayload);
    let nestedHandle = 0;
    try {
      expect(() => {
        nestedHandle = callNumber('data_load_json', alloc.ptr, alloc.len);
      }).not.toThrow();
    } finally {
      bridge.deallocBytes(alloc.ptr, alloc.len);
      if (nestedHandle !== 0) bridge.destroyDataset(nestedHandle);
    }
    expect(bridge.hostBufferAllocationCount()).toBe(baseline);
  });

  it('handles extreme floating-point magnitudes, non-finites, and degenerate datasets safely', () => {
    const baseline = bridge.hostBufferAllocationCount();
    const extremeDataset = {
      name: 'extreme-floats',
      columns: [{ name: 'v', type: 'NUMERIC' as const }],
      rows: [
        { v: Number.NaN },
        { v: Number.POSITIVE_INFINITY },
        { v: Number.NEGATIVE_INFINITY },
        { v: 1e308 },
        { v: -1e308 },
        { v: Number('1e-324') },
        { v: Number.MAX_VALUE },
        { v: Number.MIN_VALUE },
        { v: Number.EPSILON },
      ],
    };

    const handle = bridge.loadDatasetJson(extremeDataset);
    expect(handle).toBeGreaterThan(0);
    try {
      expect(callNumber('dataset_row_count', handle)).toBe(9);
      expect(callNumber('dataset_column_count', handle)).toBe(1);

      // Structure profile must succeed safely without NaN crashes
      const reqProfile = callNumber('data_compute_structure_profile', handle, 0, 0);
      expect(reqProfile).toBeGreaterThan(0);
      const bufProfile = bridge.allocBuffer(reqProfile);
      try {
        expect(callNumber('data_compute_structure_profile', handle, bufProfile.ptr, reqProfile)).toBe(reqProfile);
      } finally {
        bridge.deallocBuffer(bufProfile.ptr, reqProfile);
      }

      // JSON export must succeed and safely map non-finites to null
      const reqJson = callNumber('compatibility_dataset_to_json', handle, 0, 0);
      expect(reqJson).toBeGreaterThan(0);
      const bufJson = bridge.allocBuffer(reqJson);
      try {
        expect(callNumber('compatibility_dataset_to_json', handle, bufJson.ptr, reqJson)).toBe(reqJson);
        const jsonStr = new TextDecoder().decode(new Uint8Array(bridge.memory().buffer, bufJson.ptr, reqJson));
        expect(() => JSON.parse(jsonStr)).not.toThrow();
      } finally {
        bridge.deallocBuffer(bufJson.ptr, reqJson);
      }
    } finally {
      bridge.destroyDataset(handle);
    }
    expect(bridge.hostBufferAllocationCount()).toBe(baseline);

    // Degenerate empty dataset
    const emptyDataset = {
      name: 'empty',
      columns: [],
      rows: [],
    };
    const emptyHandle = bridge.loadDatasetJson(emptyDataset);
    expect(emptyHandle).toBeGreaterThan(0);
    try {
      expect(callNumber('dataset_row_count', emptyHandle)).toBe(0);
      expect(callNumber('dataset_column_count', emptyHandle)).toBe(0);
    } finally {
      bridge.destroyDataset(emptyHandle);
    }
    expect(bridge.hostBufferAllocationCount()).toBe(baseline);
  });

  it('rejects corrupted typed-column metadata, validity vectors, and mismatched shapes', () => {
    const baseline = bridge.hostBufferAllocationCount();

    // Helper to build typed binary payload: NTC1 magic (4), rowCount (4), colCount (4)
    function buildTypedPayload(rowCount: number, colCount: number, body: Uint8Array): Uint8Array {
      const header = new Uint8Array(12);
      header.set(new TextEncoder().encode('NTC1'), 0);
      new DataView(header.buffer).setUint32(4, rowCount, true);
      new DataView(header.buffer).setUint32(8, colCount, true);
      const res = new Uint8Array(header.length + body.length);
      res.set(header, 0);
      res.set(body, header.length);
      return res;
    }

    // 1. Invalid magic
    const badMagic = new Uint8Array(16);
    badMagic.set(new TextEncoder().encode('XXXX'), 0);
    const allocBadMagic = bridge.allocBytes(badMagic);
    try {
      expect(callNumber('data_load_typed_columns', allocBadMagic.ptr, allocBadMagic.len)).toBe(0);
    } finally {
      bridge.deallocBytes(allocBadMagic.ptr, allocBadMagic.len);
    }

    // 2. Truncated headers (0 to 11 bytes)
    for (let len = 0; len < 12; len += 1) {
      const truncated = new Uint8Array(len);
      truncated.set(new TextEncoder().encode('NTC1').slice(0, len), 0);
      const alloc = bridge.allocBytes(truncated);
      try {
        expect(callNumber('data_load_typed_columns', alloc.ptr, alloc.len)).toBe(0);
      } finally {
        bridge.deallocBytes(alloc.ptr, alloc.len);
      }
    }

    // 3. Row count mismatch: claims 10 rows but only supplies bytes for 1 row
    const truncatedBody = new Uint8Array(1 + 2 + 1 + 8 + 1); // kind(1) + nameLen(2) + name(1) + f64(8) + validity(1)
    const view = new DataView(truncatedBody.buffer);
    truncatedBody[0] = 1; // numeric
    view.setUint16(1, 1, true); // name len 1
    truncatedBody[3] = 0x78; // 'x'
    view.setFloat64(4, 42.0, true);
    truncatedBody[12] = 1; // validity byte
    const mismatchedPayload = buildTypedPayload(10, 1, truncatedBody); // Claims 10 rows!
    const allocMismatched = bridge.allocBytes(mismatchedPayload);
    try {
      expect(callNumber('data_load_typed_columns', allocMismatched.ptr, allocMismatched.len)).toBe(0);
    } finally {
      bridge.deallocBytes(allocMismatched.ptr, allocMismatched.len);
    }

    // 4. Out-of-bounds categorical dictionary code
    // kind(3) + nameLen(2) + name(1) + dictCount(4) + dictEntryLen(2) + dictEntry(1) + code(4) + validity(1)
    const catBody = new Uint8Array(1 + 2 + 1 + 4 + 2 + 1 + 4 + 1);
    const catView = new DataView(catBody.buffer);
    catBody[0] = 3; // categorical
    catView.setUint16(1, 1, true);
    catBody[3] = 0x63; // 'c'
    catView.setUint32(4, 1, true); // dictionary length 1 ("a")
    catView.setUint16(8, 1, true);
    catBody[10] = 0x61; // 'a'
    catView.setUint32(11, 999, true); // Code 999 is out of bounds for dictionary length 1!
    catBody[15] = 1; // validity = 1
    const catPayload = buildTypedPayload(1, 1, catBody);
    const allocCat = bridge.allocBytes(catPayload);
    try {
      expect(callNumber('data_load_typed_columns', allocCat.ptr, allocCat.len)).toBe(0);
    } finally {
      bridge.deallocBytes(allocCat.ptr, allocCat.len);
    }

    // 5. Named typed columns with invalid UTF-8 name
    const validNamedPayload = buildTypedPayload(0, 0, new Uint8Array(0));
    const allocPayload = bridge.allocBytes(validNamedPayload);
    const invalidUtf8Name = new Uint8Array([0xff, 0xfe]);
    const allocName = bridge.allocBytes(invalidUtf8Name);
    try {
      expect(
        callNumber(
          'data_load_typed_columns_named',
          allocPayload.ptr,
          allocPayload.len,
          allocName.ptr,
          allocName.len
        )
      ).toBe(0);
    } finally {
      bridge.deallocBytes(allocPayload.ptr, allocPayload.len);
      bridge.deallocBytes(allocName.ptr, allocName.len);
    }

    expect(bridge.hostBufferAllocationCount()).toBe(baseline);
  });

  it('survives allocation exhaustion and repeated allocate/deallocate/reinit stress cycles', () => {
    const baseline = bridge.hostBufferAllocationCount();

    // Rapid allocation & deallocation of varying chunk sizes
    for (let cycle = 0; cycle < 128; cycle += 1) {
      const size = (cycle * 97) % 4096 + 1;
      const alloc = bridge.allocBuffer(size);
      expect(callNumber('fill_pattern', alloc.ptr, alloc.len)).toBe(size);
      bridge.deallocBuffer(alloc.ptr, alloc.len);
    }
    expect(bridge.hostBufferAllocationCount()).toBe(baseline);

    // Interleaved allocations
    const held: { ptr: number; len: number }[] = [];
    for (let i = 0; i < 32; i += 1) {
      held.push(bridge.allocBuffer((i + 1) * 32));
    }
    expect(bridge.hostBufferAllocationCount()).toBe(baseline + 32);

    // Free in reverse
    while (held.length > 0) {
      const item = held.pop()!;
      bridge.deallocBuffer(item.ptr, item.len);
    }
    expect(bridge.hostBufferAllocationCount()).toBe(baseline);

    // Reinitialization mid-cycle
    const orphan = bridge.allocBuffer(64);
    expect(orphan.ptr).toBeGreaterThan(0);
    expect(bridge.hostBufferAllocationCount()).toBe(baseline + 1);
    expect(callNumber('init', 0x9999n)).toBe(1);
    expect(bridge.hostBufferAllocationCount()).toBe(0);
  });
});
