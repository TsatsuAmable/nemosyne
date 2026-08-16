/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { VRMenu } from '../src/vr/ui/VRMenu.ts';

describe('VR Menu Buttons Subsystem', () => {
  it('dispatches pointer raycast clicks on VR Menu buttons', () => {
    const cameraGroup = new THREE.Group();
    const onFilterSpy = vi.fn();
    const onTogglePortalsSpy = vi.fn();

    const vrMenu = new VRMenu(cameraGroup, {
      onFilter: onFilterSpy,
      onTogglePortals: onTogglePortalsSpy,
    });

    vrMenu.show();
    expect(vrMenu.mesh.visible).toBe(true);

    // Find the 'filter' button in VRMenu
    const filterBtn = vrMenu.buttons.find((b) => b.type === 'filter');
    expect(filterBtn).toBeDefined();

    // Calculate UV point on panel mesh corresponding to filterBtn (x, y)
    const uvX = (filterBtn!.x + filterBtn!.w / 2) / vrMenu.width;
    const uvY = 1 - (filterBtn!.y + filterBtn!.h / 2) / vrMenu.height;

    const raycaster = new THREE.Raycaster();
    vi.spyOn(raycaster, 'intersectObject').mockReturnValue([
      { object: vrMenu.mesh, uv: new THREE.Vector2(uvX, uvY) } as any,
    ]);

    // Simulate pointer down event
    const mode = vrMenu.handlePointerDown(raycaster, {} as any);
    expect(mode).toBe('content');
    expect(onFilterSpy).toHaveBeenCalled();
  });

  it('exposes the Compare operation as a user-facing menu action', () => {
    const onCompareSpy = vi.fn();
    const vrMenu = new VRMenu(new THREE.Group(), { onCompare: onCompareSpy });
    const compareBtn = vrMenu.buttons.find((b) => b.type === 'compare');
    expect(compareBtn).toBeDefined();

    const uvX = (compareBtn!.x + compareBtn!.w / 2) / vrMenu.width;
    const uvY = 1 - (compareBtn!.y + compareBtn!.h / 2) / vrMenu.height;
    const raycaster = new THREE.Raycaster();
    vi.spyOn(raycaster, 'intersectObject').mockReturnValue([
      { object: vrMenu.mesh, uv: new THREE.Vector2(uvX, uvY) } as any,
    ]);

    expect(vrMenu.handleContentClick(raycaster)).toBe(true);
    expect(onCompareSpy).toHaveBeenCalledOnce();
  });
});
