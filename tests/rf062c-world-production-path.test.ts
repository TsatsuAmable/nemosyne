// @ts-nocheck
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { World } from '../src/vr/World.ts';
import { getSampleDataset } from '../src/data/SampleDatasets.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.ts';

describe('RF-062C production World path', () => {
  let world: World | null = null;

  afterEach(async () => {
    if (world) {
      await world.dispose();
      world.loader?.container?.remove?.();
      world = null;
    }
    for (const canvas of Array.from(document.querySelectorAll('canvas'))) {
      canvas.remove();
    }
    vi.restoreAllMocks();
  });

  it('routes a real dataset load through LoadDatasetUseCase and RepresentationSurface exactly once', () => {
    world = new World();
    const bridge = makeKernelMockBridge();
    world.atlas.setKernel(bridge, 0x3c07);
    world._wasmRuntime = bridge;
    world._wasmUnavailable = false;

    const execute = vi.spyOn(world.loadDatasetUseCase, 'execute');
    const replace = vi.spyOn(world.representationSurface, 'replace');
    const sample = getSampleDataset('sales-table');

    world.loadDataset({
      name: sample.label,
      topology: sample.topology,
      dataset: sample.dataset,
      maxDepth: sample.depth,
      encodings: sample.encodings,
    });

    expect(execute).toHaveBeenCalledOnce();
    expect(replace).toHaveBeenCalledOnce();
    expect(world.dracoNode).toBe(world.representationSurface.currentNode);
    expect(world.diagnostic).toBe(world.representationSurface.diagnostic);
    expect(world.currentEntry?.dataset).toBe(sample.dataset);
    expect(world.atlas.dataset).not.toBe(sample.dataset);
  });

  it('delegates representation teardown to the surface owner', async () => {
    world = new World();
    const bridge = makeKernelMockBridge();
    world.atlas.setKernel(bridge, 0x3c07);
    world._wasmRuntime = bridge;
    world._wasmUnavailable = false;

    const sample = getSampleDataset('sales-table');
    world.loadDataset({
      name: sample.label,
      topology: sample.topology,
      dataset: sample.dataset,
      maxDepth: sample.depth,
      encodings: sample.encodings,
    });

    const disposeSurface = vi.spyOn(world.representationSurface, 'dispose');
    await world.dispose();

    expect(disposeSurface).toHaveBeenCalledOnce();
    expect(world.dracoNode).toBeNull();
    expect(world.diagnostic).toBeNull();
    world = null;
  });
});
