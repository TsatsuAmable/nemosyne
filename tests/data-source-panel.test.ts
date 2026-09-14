// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { DataSourcePanel } from '../src/vr/ui/DataSourcePanel.ts';
import { SpatialPanel } from '../src/vr/ui-system/SpatialPanel.ts';
import { OPEN_DATA_SOURCES } from '../src/data/connectors/OpenDataSources.ts';
import { xrDatasetLibraryBridge } from '../src/data/catalog/XRDatasetLibraryBridge.ts';
import { allSampleDatasets } from '../src/data/SampleDatasets.ts';

describe('DataSourcePanel', () => {
  let detach: (() => void) | null = null;

  beforeEach(() => {
    detach = null;
  });

  afterEach(() => {
    detach?.();
  });

  it('uses SpatialPanel/UIKit and forwards curated live-source selection by key', () => {
    const onSelectLiveSource = vi.fn();
    const panel = new DataSourcePanel(new THREE.Group(), { onSelectLiveSource });
    expect(panel).toBeInstanceOf(SpatialPanel);

    const source = OPEN_DATA_SOURCES[0];
    expect(panel.selectLiveSource(source.key)).toBe(true);
    expect(onSelectLiveSource).toHaveBeenCalledWith(source.key);
    expect(panel.selectLiveSource('not-a-source')).toBe(false);
    panel.dispose();
  });

  it('loads built-in samples through the existing dataset callback with default encodings', () => {
    const onLoadDataset = vi.fn();
    const panel = new DataSourcePanel(new THREE.Group(), { onLoadDataset });
    const sample = allSampleDatasets[0];

    panel.loadSample(sample);

    expect(onLoadDataset).toHaveBeenCalledTimes(1);
    expect(onLoadDataset.mock.calls[0][0]).toMatchObject({
      name: sample.label,
      topology: sample.topology,
      dataset: sample.dataset,
    });
    panel.dispose();
  });

  it('projects live-connection state without owning the connector', () => {
    const panel = new DataSourcePanel(new THREE.Group(), {});
    expect(panel.liveConnected).toBe(false);
    panel.setLiveConnected(true);
    expect(panel.liveConnected).toBe(true);
    panel.dispose();
  });

  it('refreshes and opens only through the governed XR dataset-library bridge', async () => {
    const openDataset = vi.fn(async () => undefined);
    detach = xrDatasetLibraryBridge.attach({
      listDatasets: vi.fn(async () => [
        {
          id: 'public.example',
          label: 'Public Example',
          version: '1',
          description: 'fixture',
          tiers: [{ id: 'smoke', label: 'Smoke', rows: 10 }],
        },
      ]),
      openDataset,
    });
    const panel = new DataSourcePanel(new THREE.Group(), {});

    await panel.refreshDatasetLibrary();
    expect(panel.libraryStatus).toMatch(/1 approved dataset/i);
    expect(panel.libraryEntries).toHaveLength(1);

    await panel.openLibraryDataset('public.example', 'smoke');
    expect(openDataset).toHaveBeenCalledWith('public.example', 'smoke');
    expect(panel.libraryStatus).toBe('Opened Public Example');
    panel.dispose();
  });

  it('surfaces library rejection without bypassing provider governance', async () => {
    detach = xrDatasetLibraryBridge.attach({
      listDatasets: vi.fn(async () => []),
      openDataset: vi.fn(async () => {
        throw new Error('Dataset is not approved');
      }),
    });
    const panel = new DataSourcePanel(new THREE.Group(), {});

    await panel.openLibraryDataset('retired.example', 'smoke');

    expect(panel.libraryStatus).toMatch(/could not open dataset/i);
    expect(panel.libraryStatus).toMatch(/not approved/i);
    panel.dispose();
  });
});
