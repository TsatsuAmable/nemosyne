// @ts-nocheck
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { Toggle } from '../../src/vr/ui-system/components/Toggle.ts';
import { Slider } from '../../src/vr/ui-system/components/Slider.ts';
import { SegmentedControl } from '../../src/vr/ui-system/components/SegmentedControl.ts';

type Dispatchable = { dispatchEvent: (e: { type: string; uv?: THREE.Vector2 }) => void };

describe('Toggle', () => {
  it('flips value and fires onChange on click', () => {
    const onChange = vi.fn();
    const t = new Toggle({ value: false, onChange });
    expect(t.value).toBe(false);

    t.dispatchEvent({ type: 'click' });
    expect(t.value).toBe(true);
    expect(onChange).toHaveBeenCalledWith(true);

    t.dispatchEvent({ type: 'click' });
    expect(t.value).toBe(false);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('does not fire onChange when disabled', () => {
    const onChange = vi.fn();
    const t = new Toggle({ value: false, disabled: true, onChange });
    t.dispatchEvent({ type: 'click' });
    expect(t.value).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('programmatic value set updates visuals without firing onChange', () => {
    const onChange = vi.fn();
    const t = new Toggle({ value: false, onChange });
    t.value = true;
    expect(t.value).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('Slider', () => {
  const trackOf = (s: Slider): Dispatchable =>
    (s as unknown as { _trackBg: Dispatchable })._trackBg;

  it('updates value proportionally during a drag using pointer uv', () => {
    const onChange = vi.fn();
    const s = new Slider({ value: 0, min: 0, max: 100, onChange });
    const track = trackOf(s);

    track.dispatchEvent({ type: 'pointerdown', uv: new THREE.Vector2(0.5, 0.5) });
    expect(s.value).toBeCloseTo(50, 5);

    track.dispatchEvent({ type: 'pointermove', uv: new THREE.Vector2(1, 0.5) });
    expect(s.value).toBe(100);

    track.dispatchEvent({ type: 'pointermove', uv: new THREE.Vector2(0.25, 0.5) });
    expect(s.value).toBe(25);

    track.dispatchEvent({ type: 'pointerup' });
    expect(onChange).toHaveBeenCalled();
  });

  it('enforces min/max bounds', () => {
    const s = new Slider({ value: 50, min: 0, max: 100 });
    const track = trackOf(s);

    track.dispatchEvent({ type: 'pointerdown', uv: new THREE.Vector2(2, 0.5) });
    expect(s.value).toBe(100);
    track.dispatchEvent({ type: 'pointerup' });

    track.dispatchEvent({ type: 'pointerdown', uv: new THREE.Vector2(-1, 0.5) });
    expect(s.value).toBe(0);
    track.dispatchEvent({ type: 'pointerup' });
  });

  it('snaps to the configured step', () => {
    const s = new Slider({ value: 0, min: 0, max: 100, step: 25 });
    const track = trackOf(s);

    track.dispatchEvent({ type: 'pointerdown', uv: new THREE.Vector2(0.5, 0.5) });
    expect(s.value).toBe(50);

    // 0.6 * 100 = 60, rounds to nearest 25 = 50
    track.dispatchEvent({ type: 'pointermove', uv: new THREE.Vector2(0.6, 0.5) });
    expect(s.value).toBe(50);

    // 0.7 * 100 = 70, rounds to nearest 25 = 75
    track.dispatchEvent({ type: 'pointermove', uv: new THREE.Vector2(0.7, 0.5) });
    expect(s.value).toBe(75);

    track.dispatchEvent({ type: 'pointerup' });
  });

  it('programmatic value set is silent', () => {
    const onChange = vi.fn();
    const s = new Slider({ value: 0, min: 0, max: 100, onChange });
    s.value = 50;
    expect(s.value).toBe(50);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('increment / decrement respect step and bounds', () => {
    const s = new Slider({ value: 40, min: 0, max: 100, step: 25 });
    s.increment();
    expect(s.value).toBe(50);
    s.decrement();
    s.decrement();
    expect(s.value).toBe(0);
    s.decrement();
    expect(s.value).toBe(0);
  });
});

describe('SegmentedControl', () => {
  const segmentOf = (c: SegmentedControl, option: string): Dispatchable =>
    (c as unknown as { _segments: Map<string, Dispatchable> })._segments.get(option);

  it('selects a segment and fires onChange', () => {
    const onChange = vi.fn();
    const c = new SegmentedControl({ options: ['a', 'b', 'c'], value: 'a', onChange });

    segmentOf(c, 'b').dispatchEvent({ type: 'click' });
    expect(c.value).toBe('b');
    expect(onChange).toHaveBeenCalledWith('b');

    segmentOf(c, 'c').dispatchEvent({ type: 'click' });
    expect(c.value).toBe('c');
    expect(onChange).toHaveBeenCalledWith('c');
  });

  it('does not fire onChange when re-selecting the active segment', () => {
    const onChange = vi.fn();
    const c = new SegmentedControl({ options: ['a', 'b'], value: 'a', onChange });
    segmentOf(c, 'a').dispatchEvent({ type: 'click' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('programmatic value set is silent', () => {
    const onChange = vi.fn();
    const c = new SegmentedControl({ options: ['a', 'b'], value: 'a', onChange });
    c.value = 'b';
    expect(c.value).toBe('b');
    expect(onChange).not.toHaveBeenCalled();
  });
});