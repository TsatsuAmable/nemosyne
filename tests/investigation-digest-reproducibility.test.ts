import { describe, it, expect } from 'vitest';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { Dataset } from '../src/data/Dataset.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.ts';
import { canonicalJsonStringify, CapabilityError } from '../src/investigation/InvestigationDigest.ts';

describe('Canonical Investigation Cryptographic Digest Engine', () => {
  it('produces deterministic canonical JSON stringification regardless of object key order', () => {
    const objA = { z: 1, a: 2, m: { nestedB: true, nestedA: 'hello' } };
    const objB = { a: 2, m: { nestedA: 'hello', nestedB: true }, z: 1 };

    const strA = canonicalJsonStringify(objA);
    const strB = canonicalJsonStringify(objB);

    expect(strA).toBe(strB);
    expect(strA).toBe('{"a":2,"m":{"nestedA":"hello","nestedB":true},"z":1}');
  });

  it('handles array undefined and negative zero correctly without emitting invalid JSON', () => {
    const arr = [1, undefined, -0];
    const str = canonicalJsonStringify(arr);
    expect(str).toBe('[1,null,0]');
    expect(JSON.parse(str)).toEqual([1, null, 0]);
  });

  it('rejects unsupported types like BigInt or cyclical references', () => {
    expect(() => canonicalJsonStringify({ val: BigInt(123) })).toThrow();

    const cyclic: Record<string, unknown> = { a: 1 };
    cyclic.self = cyclic;
    expect(() => canonicalJsonStringify(cyclic)).toThrow('cyclical');
  });

  it('supports instanceof CapabilityError checks', () => {
    const err = new CapabilityError('Provider missing');
    expect(err).toBeInstanceOf(CapabilityError);
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('CAPABILITY_UNAVAILABLE');
  });

  it('computes identical 64-character SHA-256 digests for bit-for-bit identical investigations', async () => {
    const bridge1 = makeKernelMockBridge();
    const atlas1 = new AtlasCore({ kernel: bridge1, sessionId: 'session-digest-1' });

    const bridge2 = makeKernelMockBridge();
    const atlas2 = new AtlasCore({ kernel: bridge2, sessionId: 'session-digest-1' });

    const rawData = {
      name: 'TimeSeries',
      columns: [{ name: 'val', type: 'number' as const }],
      rows: [{ val: 10 }, { val: 20 }, { val: 30 }],
    };

    atlas1.loadDataset(Dataset.fromJSON(rawData));
    atlas2.loadDataset(Dataset.fromJSON(rawData));

    // Execute identical operations
    atlas1.applyAnalysis({
      datasetFingerprint: atlas1.datasetFingerprint!,
      datasetVersion: 0,
      operation: { op: 'filter', column: 'val', min: 15 },
      algorithmVersion: '0.2.0',
    });
    atlas2.applyAnalysis({
      datasetFingerprint: atlas2.datasetFingerprint!,
      datasetVersion: 0,
      operation: { op: 'filter', column: 'val', min: 15 },
      algorithmVersion: '0.2.0',
    });

    const digest1 = await atlas1.computeDigest();
    const digest2 = await atlas2.computeDigest();

    expect(digest1.length).toBe(64);
    expect(digest2.length).toBe(64);
    expect(digest1).toBe(digest2);
  });

  it('generates completely distinct digests when even a single evidence note or operation differs', async () => {
    const bridge = makeKernelMockBridge();
    const atlas = new AtlasCore({ kernel: bridge, sessionId: 'session-digest-diff' });
    atlas.loadDataset(
      Dataset.fromJSON({
        name: 'Dataset',
        columns: [{ name: 'x', type: 'number' as const }],
        rows: [{ x: 5 }, { x: 15 }],
      })
    );

    const baselineDigest = await atlas.computeDigest();

    atlas.recordObservation('Noticing an unusual clustering pattern in quadrant 1');
    const withObsDigest = await atlas.computeDigest();

    expect(withObsDigest).not.toBe(baselineDigest);
  });
});
