// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import * as THREE from 'three';
import { NarrativeStrip } from '../src/vr/ui/NarrativeStrip.ts';
import { AnalysisHistory } from '../src/data/AnalysisHistory.ts';
import { Dataset } from '../src/data/Dataset.ts';

function makeDataset(rows: Array<Record<string, unknown>>): Dataset {
  return new Dataset('test', [{ name: 'id', type: 'NUMERIC' }], rows);
}

describe('NarrativeStrip', () => {
  let strip: NarrativeStrip;
  let cameraGroup: THREE.Group;
  let onSeek: Mock;

  beforeEach(() => {
    cameraGroup = new THREE.Group();
    onSeek = vi.fn();
    strip = new NarrativeStrip(cameraGroup, { onSeek });
  });

  afterEach(() => {
    if (strip?.mesh?.parent) strip.mesh.parent.remove(strip.mesh);
    strip = null as unknown as NarrativeStrip;
  });

  it('renders empty-state text when history is empty', () => {
    strip.render();
    expect(strip._chipBounds.length).toBe(0);
  });

  it('computes chip bounds from history frames', () => {
    const history = new AnalysisHistory();
    const before = makeDataset([{ id: 1 }]);
    const after = makeDataset([{ id: 2 }]);
    history.push('filter', before, after, { threshold: 0.5 });
    history.push('sort', after, after, { key: 'value' });

    strip.setHistory(history);
    expect(strip._chipBounds.length).toBe(2);
    expect(strip._chipBounds[0].w).toBeGreaterThan(0);
  });

  it('highlights the current frame chip', () => {
    const history = new AnalysisHistory();
    const before = makeDataset([{ id: 1 }]);
    const after = makeDataset([{ id: 2 }]);
    history.push('filter', before, after, {});
    history.push('sort', after, after, {});
    history.undo();

    strip.setHistory(history);
    expect(strip._chipBounds.length).toBe(2);
    // currentIndex should be 0 after undo.
    expect(history.currentIndex).toBe(0);
  });

  it('calls onSeek with chip index when a chip is clicked', () => {
    const history = new AnalysisHistory();
    const before = makeDataset([{ id: 1 }]);
    const after = makeDataset([{ id: 2 }]);
    history.push('filter', before, after, {});

    strip.setHistory(history);
    strip.show();
    strip.mesh.updateMatrixWorld();

    const b = strip._chipBounds[0];
    const u = (b.x + b.w / 2) / strip.width;
    const v = 1 - (b.y + b.h / 2) / strip.height;

    const hitPoint = new THREE.Vector3(
      (u - 0.5) * strip.worldSize[0],
      (v - 0.5) * strip.worldSize[1],
      0
    );
    hitPoint.applyMatrix4(strip.mesh.matrixWorld);

    const raycaster = new THREE.Raycaster();
    raycaster.ray.origin.copy(hitPoint);
    raycaster.ray.origin.z += 0.1;
    raycaster.ray.direction.set(0, 0, -1);

    expect(strip.handleContentClick(raycaster)).toBe(true);
    expect(onSeek).toHaveBeenCalledWith(0);
  });
});

describe('AnalysisHistory.seek', () => {
  it('jumps directly to a target frame', () => {
    const history = new AnalysisHistory();
    const ds = makeDataset([{ id: 1 }]);
    history.push('filter', ds, ds, {});
    history.push('sort', ds, ds, {});
    history.push('cluster', ds, ds, {});

    expect(history.currentIndex).toBe(2);
    const frame = history.seek(0);
    expect(history.currentIndex).toBe(0);
    expect(frame?.operation).toBe('filter');
  });

  it('clamps seek index to valid range', () => {
    const history = new AnalysisHistory();
    const ds = makeDataset([{ id: 1 }]);
    history.push('filter', ds, ds, {});

    expect(history.seek(-5)?.operation).toBe('filter');
    expect(history.currentIndex).toBe(0);
    expect(history.seek(99)?.operation).toBe('filter');
    expect(history.currentIndex).toBe(0);
  });
});
