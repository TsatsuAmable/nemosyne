// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { xrDatasetLibraryBridge } from '../src/data/catalog/XRDatasetLibraryBridge.ts';
import { VRMenu } from '../src/vr/ui/VRMenu.ts';

let detach: (() => void) | null = null;

afterEach(() => {
  detach?.();
  detach = null;
});

describe('PT5B XR dataset library', () => {
  it('fails closed when the governed loader is not attached', async () => {
    await expect(xrDatasetLibraryBridge.listDatasets()).rejects.toThrow(/not ready/i);
    await expect(xrDatasetLibraryBridge.openDataset('example', 'smoke')).rejects.toThrow(/not ready/i);
  });

  it('lets the in-headset data surface browse and open through the shared governed loader', async () => {
    const openDataset = vi.fn(async () => undefined);
    detach = xrDatasetLibraryBridge.attach({
      listDatasets: async () => [
        {
          id: 'public.example',
          label: 'Public Example',
          version: '1.2.0',
          description: 'A governed public dataset',
          tiers: [{ id: 'smoke', label: 'Quick preview', rows: 250 }],
        },
      ],
      openDataset,
    });

    const menu = new VRMenu(new THREE.Group(), {});
    await menu.refreshDatasetLibrary();

    expect(menu.libraryStatus).toMatch(/1 approved dataset/i);
    expect(menu.buttons.some((button) => button.type === 'libraryDataset')).toBe(true);

    await menu.openLibraryDataset('public.example', 'smoke');
    expect(openDataset).toHaveBeenCalledWith('public.example', 'smoke');
    expect(menu.libraryStatus).toBe('Opened Public Example');
  });

  it('surfaces loader refusal in human-readable XR status instead of pretending the dataset opened', async () => {
    detach = xrDatasetLibraryBridge.attach({
      listDatasets: async () => [],
      openDataset: async () => {
        throw new Error('Dataset is not approved for product loading');
      },
    });

    const menu = new VRMenu(new THREE.Group(), {});
    await menu.openLibraryDataset('retired.example', 'smoke');
    expect(menu.libraryStatus).toMatch(/could not open dataset/i);
    expect(menu.libraryStatus).toMatch(/not approved/i);
  });
});
