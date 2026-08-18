// @ts-nocheck
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { InteractableRegistry } from '../src/vr/input/InteractableRegistry.ts';
import { SelectionDispatcher } from '../src/vr/input/SelectionDispatcher.ts';

describe('SelectionDispatcher', () => {
  it('reports an empty-space selection without confusing the callback with a hit', () => {
    const registry = new InteractableRegistry();
    const dispatcher = new SelectionDispatcher(registry, {
      onSelectCallback: () => {},
    });
    const onDispatch = vi.fn();
    dispatcher.onDispatch = onDispatch;

    dispatcher.triggerSelect({
      getRay: () => new THREE.Ray(),
    });

    expect(onDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        hudConsumed: false,
        sceneMesh: null,
        hadCallback: true,
      })
    );
  });
});
