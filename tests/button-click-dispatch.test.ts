// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { GuidedTour } from '../src/vr/ui/GuidedTour.ts';
import { HandWheelMenu } from '../src/vr/ui/HandWheelMenu.ts';
import { FIRST_DATASET_TOUR } from '../src/data/DefaultTour.ts';

describe('Button Click Dispatching Subsystem (Tour & VR Menu)', () => {
  it('dispatches pointer raycast clicks on GuidedTour window buttons', () => {
    const camera = new THREE.PerspectiveCamera();
    const cameraGroup = new THREE.Group();
    cameraGroup.add(camera);

    const mockEngine: any = {
      camera,
      cameraGroup,
      scene: new THREE.Scene(),
      addUpdatable() {},
      addHudObject() {},
    };

    const tour = new GuidedTour(mockEngine, {
      tour: FIRST_DATASET_TOUR,
    });

    tour.start();
    expect(tour.currentStep?.text).toBeDefined();
    const initialIndex = (tour as any)._stepIndex;

    // Simulate raycast hitting the Tour card mesh
    const raycaster = new THREE.Raycaster();
    const hitUV = new THREE.Vector2(0.85, 0.1); // Bottom right NEXT button area
    vi.spyOn(raycaster, 'intersectObject').mockReturnValue([
      { object: (tour as any)._cardMesh, uv: hitUV } as any,
    ]);

    const consumed = tour.handlePointerClick(raycaster);
    expect(consumed).toBe(true);
    expect((tour as any)._stepIndex).toBe(initialIndex + 1);
  });

  it('dispatches pointer raycast clicks on VR Menu action buttons', () => {
    const camera = new THREE.PerspectiveCamera();
    const cameraGroup = new THREE.Group();

    const mockEngine: any = {
      camera,
      cameraGroup,
      scene: new THREE.Scene(),
      addUpdatable() {},
      addHudObject() {},
    };

    const menu = new HandWheelMenu(mockEngine, null as any);
    const callbackSpy = vi.fn();

    menu.setMenu([
      {
        id: 'panels',
        label: 'Panels',
        items: [{ id: 'test-action', label: 'Test Action', callback: callbackSpy }],
      },
    ]);

    menu.show();
    expect(menu.isVisible()).toBe(true);

    const catMesh = (menu as any)._categoryMeshes[0];
    expect(catMesh).toBeDefined();

    // Raycast hit on Category pill
    const raycaster = new THREE.Raycaster();
    vi.spyOn(raycaster, 'intersectObjects').mockReturnValue([
      { object: catMesh } as any,
    ]);

    const catConsumed = menu.handlePointerClick(raycaster);
    expect(catConsumed).toBe(true);
    expect(menu.selectedCategory).toBe('panels');

    // Raycast hit on Action pill
    const actionMesh = (menu as any)._actionMeshes[0];
    expect(actionMesh).toBeDefined();

    vi.spyOn(raycaster, 'intersectObjects').mockReturnValue([
      { object: actionMesh } as any,
    ]);

    const actionConsumed = menu.handlePointerClick(raycaster);
    expect(actionConsumed).toBe(true);
    expect(callbackSpy).toHaveBeenCalled();
  });

  it('dispatches the GuidedTour < PREV pill (only when not on the first step)', () => {
    const camera = new THREE.PerspectiveCamera();
    const cameraGroup = new THREE.Group();
    cameraGroup.add(camera);

    const mockEngine: any = {
      camera,
      cameraGroup,
      scene: new THREE.Scene(),
      addUpdatable() {},
      addHudObject() {},
    };

    const tour = new GuidedTour(mockEngine, { tour: FIRST_DATASET_TOUR });
    tour.start();
    expect((tour as any)._stepIndex).toBe(0);

    // PREV is not rendered on step 0 — a click in the PREV region must fall
    // through to NEXT (advancing), not go backwards.
    const w = (tour as any)._cardCanvas.width; // 1024
    const h = (tour as any)._cardCanvas.height; // 384
    const prevUV = new THREE.Vector2(720 / w, 1 - 350 / h); // centre of PREV pill
    const raycaster = new THREE.Raycaster();
    vi.spyOn(raycaster, 'intersectObject').mockReturnValue([
      { object: (tour as any)._cardMesh, uv: prevUV } as any,
    ]);

    // On step 0 the PREV pill isn't drawn, so the click advances (NEXT fallback).
    expect(tour.handlePointerClick(raycaster)).toBe(true);
    expect((tour as any)._stepIndex).toBe(1);

    // Now on step 1 the PREV pill is live — the same hit goes back to step 0.
    expect(tour.handlePointerClick(raycaster)).toBe(true);
    expect((tour as any)._stepIndex).toBe(0);
  });
});
