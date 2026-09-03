// @ts-nocheck
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { World } from '../src/vr/World.ts';
import { getSampleDataset } from '../src/data/SampleDatasets.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.ts';

function wireKernel(w) {
  const bridge = makeKernelMockBridge();
  w.atlas?.setKernel?.(bridge, 0x3c07);
}

describe('Stream B-U1 selection context coherence (real-wasm lane)', () => {
  let world;
  const resizeListeners: Array<(...args: unknown[]) => void> = [];
  let addListenerSpy;

  beforeEach(() => {
    globalThis.navigator.xr = {
      isSessionSupported: vi.fn().mockResolvedValue(true),
      requestSession: vi.fn().mockResolvedValue({
        addEventListener: vi.fn(),
        updateRenderState: vi.fn().mockResolvedValue(undefined),
        renderState: {},
        inputSources: [],
      }),
    };
    const originalAdd = window.addEventListener;
    addListenerSpy = vi
      .spyOn(window, 'addEventListener')
      .mockImplementation((type, listener, options) => {
        if (type === 'resize') resizeListeners.push(listener);
        return originalAdd.call(window, type, listener, options);
      });
  });

  afterEach(async () => {
    addListenerSpy?.mockRestore();
    if (world) {
      await world.dispose();
      if (world.loader?.container?.parentNode) {
        world.loader.container.parentNode.removeChild(world.loader.container);
      }
      world = null;
    }
    const button = document.getElementById('nemosyne-vr-button');
    if (button?.parentNode) button.parentNode.removeChild(button);
    for (const canvas of Array.from(document.querySelectorAll('canvas'))) {
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }
    for (const listener of resizeListeners.splice(0)) {
      window.removeEventListener('resize', listener);
    }
    vi.restoreAllMocks();
  });

  it('hides the contextual task surface on dataset load and on Compare', async () => {
    world = new World(); wireKernel(world);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    mesh.userData.row = { id: 'X', value: 99 };

    world._showDataCard(mesh);
    expect(world.uiManager.contextualTaskSurface.visible).toBe(true);

    const sales = getSampleDataset('sales-table');
    await world.loadDataset({
      name: sales.label,
      ...sales,
      maxDepth: sales.depth,
      encodings: {},
    });
    expect(world.uiManager.contextualTaskSurface.visible).toBe(false);

    world._showDataCard(mesh);
    expect(world.uiManager.contextualTaskSurface.visible).toBe(true);

    world._dispatchAnalysis('compare');
    expect(world.uiManager.contextualTaskSurface.visible).toBe(false);
  });
});
