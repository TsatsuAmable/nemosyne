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
  revision: '4c69c13dfc10da8d59d88ae5cae5a4d4dfa5779a',
  corpusVersion: 'fixture-v1',
  datasetId: 'synthetic.remote',
  tier: 'smoke',
  artifactPath: 'data/synthetic/remote/smoke.csv',
  artifactSha256: 'a'.repeat(64),
  rows: 2,
  bytes: bytes.byteLength,
  format: 'csv' as const,
};

const catalog: RemoteDatasetCatalog = {
  schemaVersion: '1.0',
  corpusVersion: 'fixture-v1',
  repository: 'TsatsuAmable/nemosyne-data',
  tierRows: { smoke: 2, xlarge: 250_000 },
  datasets: [
    {
      id: 'synthetic.remote',
      label: 'Remote truth fixture',
      kind: 'synthetic',
      description: 'fixture',
      // Deliberately wrong for the CSV shape: the UI must not treat catalog
      // topology metadata as analytical authority.
      topology: 'HIERARCHY',
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
    const refresh = loader.container.querySelector<HTMLButtonElement>('#nemosyne-corpus-refresh')!;
    refresh.click();
    await settle();

    const datasetSelect = loader.container.querySelector<HTMLSelectElement>('#nemosyne-corpus-dataset')!;
    datasetSelect.value = 'synthetic.remote';
    datasetSelect.dispatchEvent(new Event('change'));

    const tierSelect = loader.container.querySelector<HTMLSelectElement>('#nemosyne-corpus-tier')!;
    const xlarge = Array.from(tierSelect.options).find((option) => option.text.includes('xlarge'))!;
    expect(xlarge.disabled).toBe(true);
    expect(xlarge.text).toContain('unsupported');

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

  it('does not fetch the remote catalogue merely by constructing the loader', () => {
    expect(loadCatalog).not.toHaveBeenCalled();
    expect(loadArtifact).not.toHaveBeenCalled();
  });
});
