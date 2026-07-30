import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { InteractionCoach } from '../src/vr/ui/InteractionCoach.js';
import { getGestureMeta, gesturesForAction } from '../src/utils/GestureMapping.js';

describe('InteractionCoach', () => {
  let coach;
  let cameraGroup;

  beforeEach(() => {
    cameraGroup = new THREE.Group();
    coach = new InteractionCoach(cameraGroup, { maxEntries: 4 });
  });

  it('renders empty-state text before any interaction', () => {
    coach.render();
    const ctx = coach.mesh.material.map?.image?.getContext?.('2d');
    expect(coach.entries.length).toBe(0);
  });

  it('logs an interaction with gesture and controller metadata', () => {
    coach.log({
      action: 'Filter',
      gesture: 'pinchTogether',
      controller: 'Hold both triggers and move controllers toward each other.',
      result: '12 rows',
    });

    expect(coach.entries.length).toBe(1);
    expect(coach.entries[0].action).toBe('Filter');
    expect(coach.entries[0].gesture).toContain('Pinch Together');
    expect(coach.entries[0].controller).toContain('triggers');
  });

  it('drops oldest entries when max is exceeded', () => {
    for (let i = 0; i < 6; i++) {
      coach.log({ action: `Action ${i}` });
    }

    expect(coach.entries.length).toBe(4);
    expect(coach.entries[0].action).toBe('Action 5');
    expect(coach.entries[3].action).toBe('Action 2');
  });

  it('falls back to wheel-menu text when no gesture or controller is given', () => {
    coach.log({ action: 'Save session', result: 'manual' });
    expect(coach.entries[0].gesture).toBeNull();
    expect(coach.entries[0].controller).toBeNull();
  });
});

describe('GestureMapping', () => {
  it('returns metadata for every gesture in the recognizer vocabulary', () => {
    const names = [
      'pinchTogether', 'pinchApart', 'swipeRight', 'swipeLeft',
      'sliceUp', 'sliceDown', 'scoopUp', 'scoopDown', 'pushForward',
      'rotateCW', 'rotateCCW', 'okSign', 'bothPinched',
    ];
    for (const name of names) {
      const meta = getGestureMeta(name);
      expect(meta).toBeTruthy();
      expect(meta.label).toBeTruthy();
      expect(meta.hand).toBeTruthy();
      expect(meta.controller).toBeTruthy();
      expect(meta.action).toBeTruthy();
    }
  });

  it('looks up gestures by action label', () => {
    const undoGestures = gesturesForAction('Undo');
    expect(undoGestures).toContain('rotateCCW');

    const filterGestures = gesturesForAction('Filter');
    expect(filterGestures).toContain('pinchTogether');
  });
});
