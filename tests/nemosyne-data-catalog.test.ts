import { describe, expect, it, vi } from 'vitest';
import {
  NemosyneDataCatalogClient,
  NEMOSYNE_DATA_CATALOG_SCHEMA_VERSION,
  NEMOSYNE_DATA_PINNED_REVISION,
} from '../src/data/catalog/NemosyneDataCatalog.ts';

function response(body: string | Uint8Array, url = ''): Response {
  const bytes = typeof body === 'string' ? new TextEncoder().encode(body) : body;
  const owned = Uint8Array.from(bytes);
  const result = new Response(owned.buffer, {
    status: 200,
    headers: { 'content-length': String(owned.byteLength) },
  });
  Object.defineProperty(result, 'url', { value: url, configurable: true });
  return result;
}

function catalog(
  sha256: string,
  bytes = 3,
  path = 'data/test/smoke.csv',
  governanceState: 'candidate' | 'governed' | 'retired' = 'governed',
) {
  return JSON.stringify({
    schemaVersion: NEMOSYNE_DATA_CATALOG_SCHEMA_VERSION,
    corpusVersion: 'test-v2',
    repository: 'TsatsuAmable/nemosyne-data',
    tierRows: { smoke: 1 },
    datasets: [
      {
        id: 'synthetic.test',
        datasetVersion: '0.1.0',
        label: 'Synthetic test',
        kind: 'synthetic',
        description: 'fixture',
        topology: 'POINT_CLOUD',
        governanceState,
        contentDigest: governanceState === 'candidate' ? null : `sha256:${'1'.repeat(64)}`,
        privacy: 'synthetic',
        license: { status: 'declared', name: 'test' },
        provenance: { origin: 'test fixture', transformations: [] },
        intendedUses: ['test'],
        measurementSchema: {
          status: 'declared',
          fields: [
            {
              name: 'x',
              storageType: 'integer',
              measurementScale: 'interval',
              semanticType: 'quantitative',
              nullable: false,
            },
          ],
        },
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
  it('pins corpus access to the governed v0.4.0 commit and schema 2.2', () => {
    expect(() => new NemosyneDataCatalogClient({ revision: 'main' })).toThrow(/immutable.*commit SHA/i);
    const client = new NemosyneDataCatalogClient({ fetchImpl: vi.fn() as unknown as typeof fetch });
    expect(client.revision).toBe('8e6b2dfc74ea1c60283790668cc93030c61423f8');
    expect(client.revision).toBe(NEMOSYNE_DATA_PINNED_REVISION);
    expect(NEMOSYNE_DATA_CATALOG_SCHEMA_VERSION).toBe('2.2');
    expect(client.catalogUrl).toContain(`/${NEMOSYNE_DATA_PINNED_REVISION}/manifests/catalog.json`);
  });

  it('rejects the obsolete schema 1.0 contract rather than silently accepting drift', async () => {
    const old = JSON.parse(catalog('a'.repeat(64))) as Record<string, unknown>;
    old.schemaVersion = '1.0';
    const fetchImpl = vi.fn(async (url: string) => response(JSON.stringify(old), url));
    const client = new NemosyneDataCatalogClient({ fetchImpl: fetchImpl as unknown as typeof fetch });
    await expect(client.loadCatalog()).rejects.toThrow(/Unsupported nemosyne-data catalog schema: 1\.0/);
  });

  it('rejects traversal paths from the remote catalog before artifact fetch', async () => {
    const fetchImpl = vi.fn(async (url: string) => response(catalog('a'.repeat(64), 3, '../escape.csv'), url));
    const client = new NemosyneDataCatalogClient({ fetchImpl: fetchImpl as unknown as typeof fetch });
    await expect(client.loadCatalog()).rejects.toThrow(/unsafe corpus artifact path/i);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('refuses non-governed catalogue entries before artifact fetch', async () => {
    const expectedDigest = 'b'.repeat(64);
    const fetchImpl = vi.fn(async (url: string) => response(catalog(expectedDigest, 3, 'data/test/smoke.csv', 'candidate'), url));
    const client = new NemosyneDataCatalogClient({ fetchImpl: fetchImpl as unknown as typeof fetch });
    await expect(client.loadArtifact('synthetic.test', 'smoke')).rejects.toThrow(/not governed for product loading/i);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('verifies exact bytes and SHA-256 before returning governed artifact provenance', async () => {
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
      schemaVersion: '2.2',
      corpusVersion: 'test-v2',
      datasetId: 'synthetic.test',
      datasetVersion: '0.1.0',
      tier: 'smoke',
      artifactSha256: expectedDigest,
      format: 'csv',
      governanceState: 'governed',
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

  it('rejects malformed measurement schema and duplicate dataset ids', async () => {
    const malformed = JSON.parse(catalog('e'.repeat(64))) as any;
    malformed.datasets[0].measurementSchema.fields[0].nullable = 'no';
    const badSchema = new NemosyneDataCatalogClient({
      fetchImpl: vi.fn(async (url: string) => response(JSON.stringify(malformed), url)) as unknown as typeof fetch,
    });
    await expect(badSchema.loadCatalog()).rejects.toThrow(/measurement nullability/i);

    const duplicate = JSON.parse(catalog('f'.repeat(64))) as any;
    duplicate.datasets.push(structuredClone(duplicate.datasets[0]));
    const duplicateClient = new NemosyneDataCatalogClient({
      fetchImpl: vi.fn(async (url: string) => response(JSON.stringify(duplicate), url)) as unknown as typeof fetch,
    });
    await expect(duplicateClient.loadCatalog()).rejects.toThrow(/Duplicate corpus dataset id/);
  });
});
