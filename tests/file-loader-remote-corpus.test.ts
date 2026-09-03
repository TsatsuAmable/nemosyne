// @ts-nocheck
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import type {
  LoadedRemoteDatasetArtifact,
  RemoteDatasetCatalog,
} from '../src/data/catalog/NemosyneDataCatalog.ts';
import { FileLoaderUI } from '../src/ui/FileLoader.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.ts';

const bytes = new TextEncoder().encode('value,category\n10,A\n20,B');
const provenance = {
  repository: 'TsatsuAmable/nemosyne-data',
  revision: '8e6b2dfc74ea1c60283790668cc93030c61423f8',
  schemaVersion: '2.2' as const,
  corpusVersion: 'fixture-v2',
  datasetId: 'synthetic.remote',
  datasetVersion: '1.0.0',
  tier: 'smoke',
  artifactPath: 'data/synthetic/remote/smoke.csv',
  artifactSha256: 'a'.repeat(64),
  rows: 2,
  bytes: bytes.byteLength,
  format: 'csv' as const,
  governanceState: 'governed' as const,
};

const catalog: RemoteDatasetCatalog = {
  schemaVersion: '2.2',
  corpusVersion: 'fixture-v2',
  repository: 'TsatsuAmable/nemosyne-data',
  tierRows: { smoke: 2, xlarge: 250_000 },
  datasets: [
    {
      id: 'synthetic.remote',
      datasetVersion: '1.0.0',
      label: 'Remote truth fixture',
      kind: 'synthetic',
      description: 'fixture',
      // Deliberately wrong for the CSV shape: the UI must not treat catalogue
      // topology metadata as analytical authority.
      topology: 'HIERARCHY',
      governanceState: 'governed',
      contentDigest: `sha256:${'c'.repeat(64)}`,
      privacy: 'synthetic',
      license: { status: 'declared', name: 'test' },
      provenance: { origin: 'test', transformations: [] },
      intendedUses: ['test'],
      measurementSchema: {
        status: 'declared',
        fields: [
          {
            name: 'value',
            storageType: 'integer',
            measurementScale: 'ratio',
            semanticType: 'quantitative',
            nullable: false,
          },
          {
            name: 'category',
            storageType: 'string',
            measurementScale: 'nominal',
            semanticType: 'categorical',
            nullable: false,
          },
        ],
      },
      plannedTiers: ['smoke', 'xlarge'],
      artifacts: [
        {
          tier: 'smoke',
          role: 'primary',
          format: 'csv',
          path: provenance.artifactPath,
          rows: 2,
          bytes: bytes.byteLength,
          sha256: provenance.artifactSha256,
          compression: 'none',
        },
        {
          tier: 'xlarge',
          role: 'primary',
          format: 'csv',
          path: 'data/synthetic/remote/xlarge.csv',
          rows: 250_000,
          bytes: 10,
          sha256: 'b'.repeat(64),
          compression: 'none',
        },
      ],
    },
  ],
};

function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function selectSmokeTier(loader: FileLoaderUI): Promise<void> {
  loader.container.querySelector<HTMLButtonElement>('#nemosyne-corpus-refresh')!.click();
  await settle();
  const datasetSelect = loader.container.querySelector<HTMLSelectElement>('#nemosyne-corpus-dataset')!;
  datasetSelect.value = 'synthetic.remote';
  datasetSelect.dispatchEvent(new Event('change'));
  const tierSelect = loader.container.querySelector<HTMLSelectElement>('#nemosyne-corpus-tier')!;
  tierSelect.value = 'smoke';
  tierSelect.dispatchEvent(new Event('change'));
}

describe('FileLoaderUI remote nemosyne-data corpus', () => {
  let loader: FileLoaderUI;
  let onLoad: ReturnType<typeof vi.fn>;
  let loadCatalog: ReturnType<typeof vi.fn>;
  let loadArtifact: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onLoad = vi.fn();
    loadCatalog = vi.fn(async () => catalog);
    loadArtifact = vi.fn(async (): Promise<LoadedRemoteDatasetArtifact> => ({
      dataset: catalog.datasets[0],
      artifact: catalog.datasets[0].artifacts[0],
      bytes,
      provenance,
    }));
    loader = new FileLoaderUI({
      onLoad,
      atlas: new AtlasCore({ kernel: makeKernelMockBridge() }),
      remoteCatalog: { loadCatalog, loadArtifact } as never,
    });
  });

  afterEach(() => loader.dispose());

  it('loads verified remote bytes through Atlas/Rust semantics and carries provenance', async () => {
    loader.container.querySelector<HTMLButtonElement>('#nemosyne-corpus-refresh')!.click();
    await settle();

    const datasetSelect = loader.container.querySelector<HTMLSelectElement>('#nemosyne-corpus-dataset')!;
    datasetSelect.value = 'synthetic.remote';
    datasetSelect.dispatchEvent(new Event('change'));

    const tierSelect = loader.container.querySelector<HTMLSelectElement>('#nemosyne-corpus-tier')!;
    const xlarge = Array.from(tierSelect.options).find((option) => option.text.includes('Xlarge'))!;
    expect(xlarge.disabled).toBe(true);
    expect(xlarge.text).toContain('unavailable here');

    tierSelect.value = 'smoke';
    tierSelect.dispatchEvent(new Event('change'));
    loader.container.querySelector<HTMLButtonElement>('#nemosyne-corpus-open')!.click();
    await settle();

    expect(loadArtifact).toHaveBeenCalledWith('synthetic.remote', 'smoke', expect.any(AbortSignal));
    expect(onLoad).toHaveBeenCalledTimes(1);
    const event = onLoad.mock.calls[0][0];
    expect(event.name).toBe('Remote truth fixture');
    expect(event.dataset.rowCount).toBe(2);
    expect(event.topology).toBe('TABULAR');
    expect(event.topology).not.toBe(catalog.datasets[0].topology);
    expect(event.remoteProvenance).toEqual(provenance);
  });

  it('lists only governed datasets for headset browsing', async () => {
    const retired = {
      ...catalog.datasets[0],
      id: 'synthetic.retired',
      label: 'Retired fixture',
      governanceState: 'retired' as const,
    };
    loadCatalog.mockResolvedValueOnce({ ...catalog, datasets: [catalog.datasets[0], retired] });

    const listed = await loader.listXRDatasets();
    expect(listed.map((entry) => entry.id)).toEqual(['synthetic.remote']);
    expect(listed[0].tiers[0].label).toBe('Quick preview');
  });

  it('refuses catalogue/Rust row-count drift before publishing the dataset', async () => {
    loadArtifact.mockResolvedValueOnce({
      dataset: catalog.datasets[0],
      artifact: catalog.datasets[0].artifacts[0],
      bytes,
      provenance: { ...provenance, rows: 3 },
    });

    await expect(loader.openRemoteDataset('synthetic.remote', 'smoke')).rejects.toThrow(/row count changed/i);
    expect(onLoad).not.toHaveBeenCalled();
    expect(loader.statusEl.textContent).toMatch(/could not open dataset/i);
  });

  it('contains desktop click refusals while preserving the public rejection for XR', async () => {
    loadArtifact.mockRejectedValue(new Error('network refused fixture'));
    await selectSmokeTier(loader);

    await expect(loader.openRemoteDataset('synthetic.remote', 'smoke')).rejects.toThrow(/network refused fixture/);
    expect(loader.statusEl.textContent).toMatch(/could not open dataset/i);

    await selectSmokeTier(loader);
    await expect(loader._handleRemoteArtifact()).resolves.toBeUndefined();
    expect(loader.statusEl.textContent).toMatch(/could not open dataset/i);
  });

  it('does not fetch the remote catalogue merely by constructing the loader', () => {
    expect(loadCatalog).not.toHaveBeenCalled();
    expect(loadArtifact).not.toHaveBeenCalled();
  });
});
