// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import * as THREE from 'three';
import { NarrativeStrip } from '../src/vr/ui/NarrativeStrip.ts';
import { SpatialPanel } from '../src/vr/ui-system/SpatialPanel.ts';
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
    strip?.dispose();
  });

  it('uses SpatialPanel/UIKit and renders empty history without seeking', () => {
    expect(strip).toBeInstanceOf(SpatialPanel);
    expect(strip.history).toBeNull();
    expect(strip.seekTo(0)).toBe(false);
    expect(onSeek).not.toHaveBeenCalled();
  });

  it('binds supplied history without taking ownership of AnalysisHistory state', () => {
    const history = new AnalysisHistory();
    const before = makeDataset([{ id: 1 }]);
    const after = makeDataset([{ id: 2 }]);
    history.push('filter', before, after, { threshold: 0.5 });
    history.push('sort', after, after, { key: 'value' });

    strip.setHistory(history);

    expect(strip.history).toBe(history);
    expect(history.currentIndex).toBe(1);
  });

  it('forwards an explicit valid seek request without mutating history itself', () => {
    const history = new AnalysisHistory();
    const ds = makeDataset([{ id: 1 }]);
    history.push('filter', ds, ds, {});
    history.push('sort', ds, ds, {});
    strip.setHistory(history);

    expect(strip.seekTo(0)).toBe(true);
    expect(onSeek).toHaveBeenCalledWith(0);
    expect(history.currentIndex).toBe(1);
  });

  it('rejects invalid seek indices', () => {
    const history = new AnalysisHistory();
    const ds = makeDataset([{ id: 1 }]);
    history.push('filter', ds, ds, {});
    strip.setHistory(history);

    expect(strip.seekTo(-1)).toBe(false);
    expect(strip.seekTo(3)).toBe(false);
    expect(strip.seekTo(0.5)).toBe(false);
    expect(onSeek).not.toHaveBeenCalled();
  });

  it('preserves accessibility mutation on the UIKit path', () => {
    expect(() =>
      strip.applyAccessibility({
        textScale: 1.25,
        highContrast: true,
        colorblindMode: 'none',
        reducedMotion: false,
      })
    ).not.toThrow();
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
