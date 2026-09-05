import { describe, expect, it } from 'vitest';
import { SystemGestureDetector } from '../src/vr/input/SystemGestureDetector.ts';
import type { PointerRegistry } from '../src/vr/input/PointerRegistry.ts';

const registry = {} as PointerRegistry;

describe('SystemGestureDetector reach-zone threshold validation', () => {
  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rejects non-finite reachZoneY=%s',
    (reachZoneY) => {
      expect(() => new SystemGestureDetector(registry, { reachZoneY })).toThrow(
        'reachZoneY must be a finite number'
      );
    }
  );
});
