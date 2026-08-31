import { describe, expect, it, vi } from 'vitest';
import {
  NemosyneDataCatalogClient,
  NEMOSYNE_DATA_PINNED_REVISION,
} from '../src/data/catalog/NemosyneDataCatalog.ts';

function response(body: string | Uint8Array, url = ''): Response {
  const bytes = typeof body === 'string' ? new TextEncoder().encode(body) : body;
  const result = new Response(bytes, {
    status: 200,
    headers: { 'content-length': String(bytes.byteLength) },
  });
  Object.defineProperty(result, 'url', { value: url, configurable: true });
  return result;
}

function catalog(sha256: string, bytes = 3, path = 'data/test/smoke.csv') {
  return JSON.stringify({
    schemaVersion: '1.0',
    corpusVersion: 'test-v1',
    repository: 'TsatsuAmable/nemosyne-data',
    tierRows: { smoke: 1 },
    datasets: [
      {
        id: 'synthetic.test',
        label: 'Synthetic test',
        kind: 'synthetic',
        description: 'fixture',
        topology: 'POINT_CLOUD',
        plannedTiers: ['smoke'],
        artifacts: [
          {
            tier: 'smoke',
            role: 'primary',
            format: 'csv',
            path,
            rows: 1,
            bytes,
            sha256,
            compression: 'none',
          },
        ],
      },
    ],
  });
}

describe('NemosyneDataCatalogClient', () => {
  it('pins corpus access to an immutable commit SHA', () => {
    expect(() => new NemosyneDataCatalogClient({ revision: 'main' })).toThrow(/immutable.*commit SHA/i);
    const client = new NemosyneDataCatalogClient({ fetchImpl: vi.fn() as unknown as typeof fetch });
    expect(client.revision).toBe(NEMOSYNE_DATA_PINNED_REVISION);
    expect(client.catalogUrl).toContain(`/${NEMOSYNE_DATA_PINNED_REVISION}/manifests/catalog.json`);
  });

  it('rejects traversal paths from the remote catalog before artifact fetch', async () => {
    const fetchImpl = vi.fn(async (url: string) => response(catalog('a'.repeat(64), 3, '../escape.csv'), url));
    const client = new NemosyneDataCatalogClient({ fetchImpl: fetchImpl as unknown as typeof fetch });
    await expect(client.loadCatalog()).rejects.toThrow(/unsafe corpus artifact path/i);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('verifies exact bytes and SHA-256 before returning an artifact', async () => {
    const artifactBytes = new TextEncoder().encode('x\n1');
    const expectedDigest = 'b'.repeat(64);
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.endsWith('/manifests/catalog.json')) return response(catalog(expectedDigest, artifactBytes.byteLength), url);
      return response(artifactBytes, url);
    });
    const digestImpl = vi.fn(async () => expectedDigest);
    const client = new NemosyneDataCatalogClient({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      digestImpl,
    });

    const loaded = await client.loadArtifact('synthetic.test', 'smoke');

    expect(Array.from(loaded.bytes)).toEqual(Array.from(artifactBytes));
    expect(digestImpl).toHaveBeenCalledTimes(1);
    expect(loaded.provenance).toMatchObject({
      repository: 'TsatsuAmable/nemosyne-data',
      revision: NEMOSYNE_DATA_PINNED_REVISION,
      corpusVersion: 'test-v1',
      datasetId: 'synthetic.test',
      tier: 'smoke',
      artifactSha256: expectedDigest,
      format: 'csv',
    });
  });

  it('fails closed on content-length, byte-length, and digest mismatches', async () => {
    const expectedDigest = 'c'.repeat(64);
    const wrongDigest = 'd'.repeat(64);

    const oversized = new NemosyneDataCatalogClient({
      maxArtifactBytes: 2,
      fetchImpl: vi.fn(async (url: string) => response(catalog(expectedDigest, 3), url)) as unknown as typeof fetch,
      digestImpl: async () => expectedDigest,
    });
    await expect(oversized.loadArtifact('synthetic.test', 'smoke')).rejects.toThrow(/byte limit/i);

    const wrongLengthFetch = vi.fn(async (url: string) => {
      if (url.endsWith('/manifests/catalog.json')) return response(catalog(expectedDigest, 4), url);
      return response(new TextEncoder().encode('x\n1'), url);
    });
    const wrongLength = new NemosyneDataCatalogClient({
      fetchImpl: wrongLengthFetch as unknown as typeof fetch,
      digestImpl: async () => expectedDigest,
    });
    await expect(wrongLength.loadArtifact('synthetic.test', 'smoke')).rejects.toThrow(/byte-length mismatch/i);

    const wrongHashFetch = vi.fn(async (url: string) => {
      if (url.endsWith('/manifests/catalog.json')) return response(catalog(expectedDigest, 3), url);
      return response(new TextEncoder().encode('x\n1'), url);
    });
    const wrongHash = new NemosyneDataCatalogClient({
      fetchImpl: wrongHashFetch as unknown as typeof fetch,
      digestImpl: async () => wrongDigest,
    });
    await expect(wrongHash.loadArtifact('synthetic.test', 'smoke')).rejects.toThrow(/SHA-256 mismatch/i);
  });
});
