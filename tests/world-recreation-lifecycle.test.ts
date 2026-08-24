import { afterEach, describe, expect, it, vi } from 'vitest';
import { World } from '../src/vr/World.ts';

describe('World recreation lifecycle', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns DOM and engine registries to baseline across repeated recreation', async () => {
    const initialChildren = document.body.children.length;

    for (let cycle = 0; cycle < 3; cycle += 1) {
      const world = new World();
      await world.start();
      expect(document.querySelectorAll('#nemosyne-loader')).toHaveLength(1);
      expect(document.querySelectorAll('#nemosyne-vr-button')).toHaveLength(1);
      expect(world.bootState).toBe('READY');
      expect(world.atlas.facts()).not.toBeNull();
      expect(world.atlas.aggregate.analytical.currentHandle).toBeGreaterThan(0);
      expect(world.engine.input.panels.length).toBeGreaterThan(0);
      expect(world.engine.updatables.size).toBeGreaterThan(0);

      const first = world.dispose();
      const second = world.dispose();

      expect(first).toBe(second);
      await first;
      expect(world.bootState).toBe('DISPOSED');
      expect(world.engine.input.panels).toEqual([]);
      expect(world.engine.input.hudObjects).toEqual([]);
      expect(world.engine.updatables.size).toBe(0);
      expect(document.querySelectorAll('#nemosyne-loader')).toHaveLength(0);
      expect(document.querySelectorAll('#nemosyne-vr-button')).toHaveLength(0);
      expect(document.body.children.length).toBe(initialChildren);
    }
  });
});
