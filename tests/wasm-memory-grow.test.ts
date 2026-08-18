// @ts-nocheck
import { describe, it, expect } from 'vitest';

describe('WASM Memory Grow & DataView Resilience', () => {
  it('re-derives DataView when the underlying WebAssembly.Memory buffer grows', () => {
    // Construct a mock WebAssembly.Memory with initial 1 page (64KB)
    const memory = new WebAssembly.Memory({ initial: 1, maximum: 10 });

    // Access memory buffer and verify initial view
    const initialBuffer = memory.buffer;
    expect(initialBuffer.byteLength).toBe(65536);

    // Populate memory bytes
    const view1 = new DataView(memory.buffer);
    view1.setFloat32(100, 3.14159, true);
    view1.setUint32(200, 1337, true);

    // Grow the WebAssembly.Memory by 1 page (64KB)
    memory.grow(1);

    // The original ArrayBuffer is now detached; memory.buffer is a fresh 128KB buffer
    expect(memory.buffer.byteLength).toBe(131072);
    expect(memory.buffer).not.toBe(initialBuffer);

    // Populate and verify on the grown buffer
    const view2 = new DataView(memory.buffer);
    view2.setFloat32(100, 3.14159, true);
    view2.setUint32(200, 1337, true);

    expect(view2.getFloat32(100, true)).toBeCloseTo(3.14159, 4);
    expect(view2.getUint32(200, true)).toBe(1337);
  });
});
