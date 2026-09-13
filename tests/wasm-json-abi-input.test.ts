import { describe, expect, it } from 'vitest';
import { encodeJsonAbiInput } from '../src/wasm/runtime/JsonAbiInput.ts';

function decode(bytes: Uint8Array | null): unknown {
  if (!bytes) return null;
  return JSON.parse(new TextDecoder().decode(bytes));
}

describe('WASM JSON ABI input', () => {
  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'fails closed instead of demoting non-finite %s to null',
    (value) => {
      expect(encodeJsonAbiInput({ evidence: { score: value } })).toBeNull();
      expect(encodeJsonAbiInput([1, value, 2])).toBeNull();
    }
  );

  it('catches non-finite values produced by toJSON before the Rust boundary', () => {
    const payload = {
      toJSON: () => ({ score: Number.POSITIVE_INFINITY }),
    };
    expect(encodeJsonAbiInput(payload)).toBeNull();
  });

  it('fails closed on values JSON cannot serialize instead of throwing through the bridge', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(encodeJsonAbiInput(cyclic)).toBeNull();
    expect(encodeJsonAbiInput(1n)).toBeNull();
    expect(encodeJsonAbiInput(undefined)).toBeNull();
  });

  it.each([undefined, () => 1, Symbol('evidence')])(
    'fails closed instead of dropping lossy object value %s',
    (value) => {
      expect(encodeJsonAbiInput({ keep: 1, lossy: value })).toBeNull();
      expect(encodeJsonAbiInput([1, value, 2])).toBeNull();
    }
  );

  it('fails closed on sparse arrays instead of materializing holes as null', () => {
    const sparse = new Array<number>(3);
    sparse[0] = 1;
    sparse[2] = 3;
    expect(encodeJsonAbiInput(sparse)).toBeNull();
  });

  it('preserves ordinary finite JSON payloads exactly', () => {
    const payload = {
      facts: { rows: 3, utility: -0.25, active: true, label: 'finite' },
      evidence: [0, 1.5, null],
    };
    expect(decode(encodeJsonAbiInput(payload))).toEqual(payload);
  });
});
