import { describe, expect, it } from 'vitest';
import {
  canonicalJsonStringify,
  canonicalSha256Hex,
  sha256Hex,
  sha256Uint31,
  sha256UnitInterval,
} from '../src/security/CryptoHash.ts';

describe('shared cryptographic hashing', () => {
  it('matches the standard SHA-256 abc vector', () => {
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('canonicalizes object key order before content addressing', () => {
    const a = { z: 1, nested: { b: true, a: 'x' } };
    const b = { nested: { a: 'x', b: true }, z: 1 };
    expect(canonicalJsonStringify(a)).toBe(canonicalJsonStringify(b));
    expect(canonicalSha256Hex(a)).toBe(canonicalSha256Hex(b));
    expect(canonicalSha256Hex(a)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('fails closed on non-finite and cyclical canonical content', () => {
    expect(() => canonicalJsonStringify({ value: Number.NaN })).toThrow(/non-finite/i);
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    expect(() => canonicalJsonStringify(cycle)).toThrow(/cyclical/i);
  });

  it('maps partition keys deterministically into the unit interval', () => {
    const first = sha256UnitInterval('seed\0dataset::researcher');
    expect(first).toBe(sha256UnitInterval('seed\0dataset::researcher'));
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(1);
    expect(sha256UnitInterval('other')).not.toBe(first);
  });

  it('derives deterministic non-negative 31-bit wire identifiers', () => {
    const value = sha256Uint31('peer-example');
    expect(value).toBe(sha256Uint31('peer-example'));
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(0x7fffffff);
  });
});
