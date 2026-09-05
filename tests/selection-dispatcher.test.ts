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
        rayValid: true,
      })
    );
  });

  it('reports hadCallback:false and rayValid for empty-space selections without a callback', () => {
    const registry = new InteractableRegistry();
    const dispatcher = new SelectionDispatcher(registry);
    const onDispatch = vi.fn();
    dispatcher.onDispatch = onDispatch;

    // Degenerate direction (tracking loss): finite origin but no direction.
    dispatcher.triggerSelect({
      getRay: () => {
        const ray = new THREE.Ray();
        ray.origin.set(0, 1.6, 0);
        ray.direction.set(0, 0, 0);
        return ray;
      },
    });

    expect(onDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        hudConsumed: false,
        sceneMesh: null,
        hadCallback: false,
        rayValid: false,
      })
    );

    onDispatch.mockClear();
    dispatcher.triggerSelect({
      getRay: () => {
        const ray = new THREE.Ray();
        ray.origin.set(0, 1.6, 0);
        ray.direction.set(0, 0, -1);
        return ray;
      },
    });

    expect(onDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        hadCallback: false,
        rayValid: true,
      })
    );
  });
});
