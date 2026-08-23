import { describe, expect, it } from 'vitest';
import { Dataset } from '../src/data/Dataset.ts';

describe('Dataset nested prototype-pollution hardening', () => {
  it('preserves clean row identity, including clean nested values', () => {
    const nested = { label: 'safe' };
    const row = { id: 1, nested };
    const dataset = new Dataset('safe', [{ name: 'id', type: 'NUMERIC' }], [row]);

    expect(dataset.rows[0]).toBe(row);
    expect(dataset.rows[0].nested).toBe(nested);
  });

  it('strips dangerous keys nested inside objects and arrays', () => {
    const row = JSON.parse(
      '{"id":1,"meta":{"safe":2,"__proto__":{"isAdmin":true}},"items":[{"constructor":{"prototype":{"polluted":true}},"keep":3}]}'
    );
    const dataset = new Dataset('nested-attack', [{ name: 'id', type: 'NUMERIC' }], [row]);
    const sanitized = dataset.rows[0] as any;

    expect(sanitized).not.toBe(row);
    expect(sanitized.meta.safe).toBe(2);
    expect(Object.prototype.hasOwnProperty.call(sanitized.meta, '__proto__')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(sanitized.items[0], 'constructor')).toBe(false);
    expect(sanitized.items[0].keep).toBe(3);
    expect(({} as any).isAdmin).toBeUndefined();
    expect(({} as any).polluted).toBeUndefined();
  });

  it('sanitizes nested attacks on updateRows and fromJSON', () => {
    const nestedAttack = JSON.parse('{"v":1,"payload":[{"prototype":{"owned":true}}]}');
    const dataset = new Dataset('stream', [{ name: 'v', type: 'NUMERIC' }], [{ v: 0 }]);
    dataset.updateRows([nestedAttack]);
    const restored = Dataset.fromJSON({
      name: 'restored',
      columns: [{ name: 'v', type: 'NUMERIC' }],
      rows: [nestedAttack],
    });

    for (const row of [dataset.rows[1], restored.rows[0]] as any[]) {
      expect(Object.prototype.hasOwnProperty.call(row.payload[0], 'prototype')).toBe(false);
      expect(({} as any).owned).toBeUndefined();
    }
  });
});
