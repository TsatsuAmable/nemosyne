// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { GuidedTour } from '../src/vr/ui/GuidedTour.js';
import { FIRST_DATASET_TOUR } from '../src/data/DefaultTour.js';

describe('GuidedTour', () => {
  let engine;
  let tour;

  beforeEach(() => {
    engine = {
      cameraGroup: new THREE.Group(),
      input: { feedback: { playTone: vi.fn() } },
    };
    tour = new GuidedTour(engine, { tour: FIRST_DATASET_TOUR });
  });

  afterEach(() => {
    tour.dispose();
  });

  it('starts at the first step and shows the card', () => {
    expect(tour.start()).toBe(true);
    expect(tour.isActive).toBe(true);
    expect(tour.currentStep).toBe(FIRST_DATASET_TOUR.steps[0]);
    expect(tour._cardGroup.visible).toBe(true);
  });

  it('returns false when no tour is loaded', () => {
    const empty = new GuidedTour(engine);
    expect(empty.start()).toBe(false);
  });

  it('advances through steps with next()', () => {
    tour.start();
    expect(tour.currentStep.target).toBe('datum-plane');
    tour.next();
    expect(tour.currentStep.target).toBe('draco-palace');
  });

  it('goes back with previous()', () => {
    tour.start();
    tour.next();
    tour.previous();
    expect(tour.currentStep.target).toBe('datum-plane');
  });

  it('completes and stops on the last step', () => {
    const onComplete = vi.fn();
    tour.onComplete = onComplete;
    tour.start();
    for (let i = 0; i < FIRST_DATASET_TOUR.steps.length - 1; i++) {
      tour.next();
    }
    expect(tour.isFinished).toBe(false);
    tour.next();
    expect(tour.isFinished).toBe(true);
    expect(tour.isActive).toBe(false);
    expect(onComplete).toHaveBeenCalled();
  });

  it('can be skipped', () => {
    const onComplete = vi.fn();
    tour.onComplete = onComplete;
    tour.start();
    tour.skip();
    expect(tour.isFinished).toBe(true);
    expect(tour.isActive).toBe(false);
    expect(onComplete).toHaveBeenCalled();
  });

  it('can be restarted after completion', () => {
    tour.start();
    tour.skip();
    expect(tour.restart()).toBe(true);
    expect(tour.isActive).toBe(true);
    expect(tour.isFinished).toBe(false);
    expect(tour.currentStep).toBe(FIRST_DATASET_TOUR.steps[0]);
  });

  it('auto-advances when the step condition is met', () => {
    tour = new GuidedTour(engine, {
      tour: {
        id: 'test',
        steps: [
          { target: 'A', text: 'step A' },
          { target: 'B', text: 'step B' },
        ],
      },
      checkCondition: () => true,
    });
    tour.start();
    tour.update(0.016, 0);
    expect(tour.currentStep.target).toBe('B');
  });

  it('positions the highlight ring on a resolved target', () => {
    const targetPos = new THREE.Vector3(2, 1.5, -4);
    tour = new GuidedTour(engine, {
      tour: {
        id: 'test',
        steps: [{ target: 'widget', text: 'Find the widget' }],
      },
      resolveTarget: () => ({ position: targetPos }),
    });
    tour.start();
    tour.update(0.016, 0);
    expect(tour._highlightMesh.visible).toBe(true);
    expect(tour._highlightMesh.position.x).toBeCloseTo(targetPos.x, 3);
  });

  it('skips the tour immediately in expert mode', () => {
    const onComplete = vi.fn();
    tour = new GuidedTour(engine, {
      tour: FIRST_DATASET_TOUR,
      userMode: 'expert',
      onComplete,
    });
    expect(tour.start()).toBe(false);
    expect(tour.isFinished).toBe(true);
    expect(tour.isActive).toBe(false);
    expect(onComplete).toHaveBeenCalled();
  });
});
