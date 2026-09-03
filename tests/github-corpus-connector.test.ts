import { describe, expect, it, vi } from 'vitest';
import type { AnalyticalKernelPort } from '../src/atlas/adapters/AnalyticalKernelPort.ts';
import {
  GitHubCorpusConnector,
  type CorpusCatalog,
} from '../src/data/connectors/GitHubCorpusConnector.ts';
import { NEMOSYNE_DATA_PINNED_REVISION } from '../src/data/catalog/NemosyneDataCatalog.ts';

const CSV = new TextEncoder().encode('id,x\n1,2\n');
const CSV_SHA = 'bd478b7a29bb9458e5409ec846358dee6e300a0ec98509dafc6e3b1f06555963';

function catalog(overrides: Partial<CorpusCatalog> = {}): CorpusCatalog {
  return {
    schemaVersion: '2.2',
    corpusVersion: 'test-v2',
    repository: 'TsatsuAmable/nemosyne-data',
    datasets: [
      {
        id: 'synthetic.test',
        datasetVersion: '0.1.0',
        label: 'Test corpus',
        kind: 'synthetic',
        description: 'test',
        topology: 'POINT_CLOUD',
        governanceState: 'governed',
        contentDigest: `sha256:${'1'.repeat(64)}`,
        privacy: 'synthetic',
        license: { status: 'declared', name: 'test' },
        provenance: { origin: 'test', transformations: [] },
        intendedUses: ['test'],
        measurementSchema: {
          status: 'declared',
          fields: [
            {
              name: 'x', storageType: 'integer', measurementScale: 'interval',
              semanticType: 'quantitative', nullable: false,
            },
          ],
        },
        plannedTiers: ['smoke'],
        artifacts: [
          {
            tier: 'smoke',
            role: 'primary',
            format: 'csv',
            path: 'data/synthetic/test.csv',
            rows: 1,
            bytes: CSV.byteLength,
            sha256: CSV_SHA,
            compression: 'none',
          },
        ],
      },
    ],
    ...overrides,
  };
}

function response(body: BodyInit, init: ResponseInit = {}, url = ''): Response {
  const res = new Response(body, init);
  if (url) Object.defineProperty(res, 'url', { value: url });
  return res;
}

function fetchFor(doc: CorpusCatalog, artifact = CSV): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/manifests/catalog.json')) {
      return response(JSON.stringify(doc), { status: 200 }, url);
    }
    return response(artifact, { status: 200 }, url);
  }) as unknown as typeof fetch;
}

describe('GitHubCorpusConnector', () => {
  it('discovers the immutable governed catalogue without a GitHub token', async () => {
    const fetchImpl = fetchFor(catalog());
    const connector = new GitHubCorpusConnector({ fetchImpl });
    const doc = await connector.fetchCatalog();
    expect(doc.corpusVersion).toBe('test-v2');
    expect(connector.ref).toBe(NEMOSYNE_DATA_PINNED_REVISION);
    expect(connector.catalogUrl()).toBe(
      `https://raw.githubusercontent.com/TsatsuAmable/nemosyne-data/${NEMOSYNE_DATA_PINNED_REVISION}/manifests/catalog.json`,
    );
  });

  it('rejects traversal paths and arbitrary artifact hosts', () => {
    const connector = new GitHubCorpusConnector();
    expect(() => connector.resolveArtifactUrl({
      tier: 'smoke', role: 'primary', format: 'csv', path: '../secret', sha256: CSV_SHA,
    })).toThrow(/Unsafe corpus path/);
    expect(() => connector.resolveArtifactUrl({
      tier: 'smoke', role: 'primary', format: 'csv', url: 'https://example.com/test.csv', sha256: CSV_SHA,
    })).toThrow(/Disallowed corpus host/);
  });

  it('fails closed when catalog repository identity is wrong', async () => {
    const fetchImpl = fetchFor(catalog({ repository: 'someone/else' }));
    const connector = new GitHubCorpusConnector({ fetchImpl });
    await expect(connector.fetchCatalog()).rejects.toThrow(/repository mismatch/);
  });

  it('fails closed on the obsolete catalogue schema', async () => {
    const doc = catalog() as unknown as { schemaVersion: string };
    doc.schemaVersion = '1.0';
    const connector = new GitHubCorpusConnector({ fetchImpl: fetchFor(doc as CorpusCatalog) });
    await expect(connector.fetchCatalog()).rejects.toThrow(/Unsupported corpus catalog schema: 1\.0/);
  });

  it('refuses candidate datasets before selecting or downloading an artifact', async () => {
    const doc = catalog();
    doc.datasets[0].governanceState = 'candidate';
    doc.datasets[0].contentDigest = null;
    const fetchImpl = fetchFor(doc);
    const connector = new GitHubCorpusConnector({ fetchImpl });
    const loaded = await connector.fetchCatalog();
    expect(() => connector.selectArtifact(loaded, 'synthetic.test', 'smoke')).toThrow(/not governed/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('fails closed on malformed numeric artifact metadata', async () => {
    const doc = catalog();
    doc.datasets[0].artifacts[0].rows = -1;
    const connector = new GitHubCorpusConnector({ fetchImpl: fetchFor(doc) });
    await expect(connector.fetchCatalog()).rejects.toThrow(/Artifact rows.*non-negative safe integer/);

    const docWithInvalidBytes = catalog();
    docWithInvalidBytes.datasets[0].artifacts[0].bytes = Number.NaN;
    const connectorWithInvalidBytes = new GitHubCorpusConnector({
      fetchImpl: fetchFor(docWithInvalidBytes),
    });
    await expect(connectorWithInvalidBytes.fetchCatalog()).rejects.toThrow(
      /Artifact bytes.*non-negative safe integer/,
    );
  });

  it('fails closed on SHA-256 drift', async () => {
    const doc = catalog();
    doc.datasets[0].artifacts[0].sha256 = '0'.repeat(64);
    const connector = new GitHubCorpusConnector({ fetchImpl: fetchFor(doc) });
    const loaded = await connector.fetchCatalog();
    const selection = connector.selectArtifact(loaded, 'synthetic.test', 'smoke');
    await expect(connector.fetchArtifactBytes(selection)).rejects.toThrow(/SHA-256 mismatch/);
  });

  it('rejects catalog-declared artifacts above the configured byte ceiling before downloading', async () => {
    const doc = catalog();
    doc.datasets[0].artifacts[0].bytes = 10;
    const fetchImpl = fetchFor(doc);
    const connector = new GitHubCorpusConnector({ fetchImpl, maxArtifactBytes: 8 });
    const loaded = await connector.fetchCatalog();
    const selection = connector.selectArtifact(loaded, 'synthetic.test', 'smoke');
    await expect(connector.fetchArtifactBytes(selection)).rejects.toThrow(/exceeds byte limit/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('cancels a streaming artifact as soon as observed bytes exceed the ceiling', async () => {
    const doc = catalog();
    delete doc.datasets[0].artifacts[0].bytes;
    const cancel = vi.fn();
    let artifactRequested = false;
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/manifests/catalog.json')) {
        return response(JSON.stringify(doc), { status: 200 }, url);
      }
      artifactRequested = true;
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3, 4]));
          controller.enqueue(new Uint8Array([5, 6, 7, 8, 9]));
        },
        cancel(reason) {
          cancel(reason);
        },
      });
      return response(stream, { status: 200 }, url);
    }) as unknown as typeof fetch;

    const connector = new GitHubCorpusConnector({ fetchImpl, maxArtifactBytes: 8 });
    const loaded = await connector.fetchCatalog();
    const selection = connector.selectArtifact(loaded, 'synthetic.test', 'smoke');
    await expect(connector.fetchArtifactBytes(selection)).rejects.toThrow(/exceeds byte limit/);
    expect(artifactRequested).toBe(true);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('hands verified CSV bytes directly to the Rust/WASM kernel loader', async () => {
    const loadCsv = vi.fn((_bytes: Uint8Array) => 42);
    const kernel = { loadCsv } as unknown as AnalyticalKernelPort;
    const connector = new GitHubCorpusConnector({ fetchImpl: fetchFor(catalog()) });
    await expect(connector.loadIntoKernel(kernel, { datasetId: 'synthetic.test', tier: 'smoke' })).resolves.toBe(42);
    expect(loadCsv).toHaveBeenCalledTimes(1);
    expect(Array.from(loadCsv.mock.calls[0][0])).toEqual(Array.from(CSV));
  });

  it('fails closed when the kernel rejects a verified corpus artifact', async () => {
    const kernel = { loadCsv: vi.fn(() => 0) } as unknown as AnalyticalKernelPort;
    const connector = new GitHubCorpusConnector({ fetchImpl: fetchFor(catalog()) });
    await expect(
      connector.loadIntoKernel(kernel, { datasetId: 'synthetic.test', tier: 'smoke' }),
    ).rejects.toThrow(/Kernel rejected corpus artifact synthetic\.test\/smoke\/primary/);
  });

  it('fails closed when an accepted handle has no authoritative fingerprint', async () => {
    const destroyDataset = vi.fn();
    const kernel = {
      loadCsv: vi.fn(() => 42),
      datasetFingerprint: vi.fn(() => null),
      destroyDataset,
    } as unknown as AnalyticalKernelPort;
    const connector = new GitHubCorpusConnector({ fetchImpl: fetchFor(catalog()) });
    await expect(
      connector.loadIntoKernel(kernel, { datasetId: 'synthetic.test', tier: 'smoke' }),
    ).rejects.toThrow(/produced no dataset fingerprint/);
    expect(destroyDataset).toHaveBeenCalledWith(42);
  });

  it('routes NTC1 artifacts only through typed-column ingest and fails closed if unsupported', async () => {
    const doc = catalog();
    doc.datasets[0].artifacts[0].format = 'ntc1';
    const connector = new GitHubCorpusConnector({ fetchImpl: fetchFor(doc) });
    const kernel = { loadCsv: vi.fn(), loadJson: vi.fn() } as unknown as AnalyticalKernelPort;
    await expect(connector.loadIntoKernel(kernel, { datasetId: 'synthetic.test', tier: 'smoke' }))
      .rejects.toThrow(/does not support NTC1/);
  });

  it('surfaces planned-but-not-materialized tiers explicitly', () => {
    const doc = catalog();
    doc.datasets[0].plannedTiers = ['smoke', 'medium'];
    const connector = new GitHubCorpusConnector();
    expect(() => connector.selectArtifact(doc, 'synthetic.test', 'medium')).toThrow(/planned but not materialized/);
  });
});
