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

  it('reports hadCallback:false and strict rayValid for empty-space selections without a callback', () => {
    const registry = new InteractableRegistry();
    const dispatcher = new SelectionDispatcher(registry);
    const onDispatch = vi.fn();
    dispatcher.onDispatch = onDispatch;

    const invalidRays = [
      new THREE.Ray(new THREE.Vector3(0, 1.6, 0), new THREE.Vector3(0, 0, 0)),
      new THREE.Ray(new THREE.Vector3(0, Number.NaN, 0), new THREE.Vector3(0, 0, -1)),
      new THREE.Ray(
        new THREE.Vector3(0, 1.6, 0),
        new THREE.Vector3(Number.POSITIVE_INFINITY, 0, -1)
      ),
    ];

    for (const invalidRay of invalidRays) {
      onDispatch.mockClear();
      dispatcher.triggerSelect({ getRay: () => invalidRay });
      expect(onDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          hudConsumed: false,
          sceneMesh: null,
          hadCallback: false,
          rayValid: false,
        })
      );
    }

    onDispatch.mockClear();
    dispatcher.triggerSelect({
      getRay: () =>
        new THREE.Ray(new THREE.Vector3(0, 1.6, 0), new THREE.Vector3(0, 0, -1)),
    });

    expect(onDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        hadCallback: false,
        rayValid: true,
      })
    );
  });

  it('does not claim a callback ran when HUD consumption prevents selection callbacks', () => {
    const registry = new InteractableRegistry();
    vi.spyOn(registry, 'dispatchHudClick').mockReturnValue(true);
    const selectCallback = vi.fn();
    const dispatcher = new SelectionDispatcher(registry, { onSelectCallback: selectCallback });
    const onDispatch = vi.fn();
    dispatcher.onDispatch = onDispatch;

    dispatcher.triggerSelect({ getRay: () => new THREE.Ray() });

    expect(selectCallback).not.toHaveBeenCalled();
    expect(onDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ hudConsumed: true, hadCallback: false })
    );
  });

  it('exposes one pre-callback boundary before the truthful outcome hook', () => {
    const registry = new InteractableRegistry();
    const order: string[] = [];
    const dispatcher = new SelectionDispatcher(registry, {
      onSelectCallback: () => order.push('callback'),
    });
    dispatcher.onDispatchStart = () => order.push('start');
    dispatcher.onDispatch = (info) => {
      order.push(`outcome:${info.hadCallback}`);
    };

    dispatcher.triggerSelect({ getRay: () => new THREE.Ray() });

    expect(order).toEqual(['start', 'callback', 'outcome:true']);
  });

  it('does not emit a successful dispatch record when the callback throws', () => {
    const registry = new InteractableRegistry();
    const dispatcher = new SelectionDispatcher(registry, {
      onSelectCallback: () => {
        throw new Error('selection failed');
      },
    });
    const onDispatchStart = vi.fn();
    const onDispatch = vi.fn();
    dispatcher.onDispatchStart = onDispatchStart;
    dispatcher.onDispatch = onDispatch;

    expect(() => dispatcher.triggerSelect({ getRay: () => new THREE.Ray() })).toThrow(
      'selection failed'
    );
    expect(onDispatchStart).toHaveBeenCalledTimes(1);
    expect(onDispatch).not.toHaveBeenCalled();
  });
});
