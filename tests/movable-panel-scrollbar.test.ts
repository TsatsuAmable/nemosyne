import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { MovablePanel } from '../src/vr/ui/MovablePanel.ts';

/* eslint-disable @typescript-eslint/no-explicit-any */
const fakePointer: any = { getRay: (r: THREE.Ray) => r };

describe('MovablePanel Scrollbar Subsystem', () => {
  it('initializes default scrollbar properties', () => {
    const group = new THREE.Group();
    const panel = new MovablePanel(group, {
      title: 'TEST PANEL',
      width: 800,
      height: 600,
    });

    expect(panel.scrollOffset).toBe(0);
    expect(panel.totalContentHeight).toBe(0);
    expect(panel.scrollbarWidth).toBe(32);
  });

  it('clamps scrollOffset when scroll() is invoked', () => {
    const group = new THREE.Group();
    const panel = new MovablePanel(group, {
      title: 'SCROLLABLE PANEL',
      width: 800,
      height: 400,
    });
    panel.totalContentHeight = 1000; // 1000px content vs ~350px container

    panel.scroll(150);
    expect(panel.scrollOffset).toBe(150);

    panel.scroll(2000); // Exceeds maxScroll (~650px)
    const containerH = panel.height - panel.titleBarHeight - 4;
    const maxScroll = panel.totalContentHeight - containerH;
    expect(panel.scrollOffset).toBe(maxScroll);

    panel.scroll(-5000); // Negative scroll clamps to 0
    expect(panel.scrollOffset).toBe(0);
  });

  /** Build a raycaster whose first hit lands at canvas-space (cx, cy). */
  function raycastAt(panel: MovablePanel, cx: number, cy: number) {
    const u = cx / panel.width;
    const v = 1 - cy / panel.height;
    const raycaster = new THREE.Raycaster();
    vi.spyOn(raycaster, 'intersectObject').mockReturnValue([
      { object: panel.mesh, uv: new THREE.Vector2(u, v), point: new THREE.Vector3(), distance: 0 } as any,
    ]);
    return raycaster;
  }

  function makeScrollablePanel() {
    const group = new THREE.Group();
    const panel = new MovablePanel(group, {
      title: 'SCROLLABLE PANEL',
      width: 800,
      height: 400,
    });
    panel.totalContentHeight = 1000; // containerH = 400-44-4 = 352; maxScroll = 648
    panel.show();
    return panel;
  }

  it('clicking the ▲ up-arrow button scrolls up by 70px', () => {
    const panel = makeScrollablePanel();
    panel.scroll(200); // start partway down
    expect(panel.scrollOffset).toBe(200);

    const sbX = panel.width - panel.scrollbarWidth - 6; // 762
    // Up arrow sits at the top of the track: cy in [48, 80].
    const raycaster = raycastAt(panel, sbX + 16, 64);

    const result = panel.handlePointerDown(raycaster, fakePointer);
    expect(result).toBe('scroll');
    expect(panel.scrollOffset).toBe(130); // 200 - 70
  });

  it('clicking the ▼ down-arrow button scrolls down by 70px', () => {
    const panel = makeScrollablePanel();
    expect(panel.scrollOffset).toBe(0);

    const sbX = panel.width - panel.scrollbarWidth - 6;
    // Down arrow sits at the bottom of the track: cy in [368, 400].
    const raycaster = raycastAt(panel, sbX + 16, 384);

    const result = panel.handlePointerDown(raycaster, fakePointer);
    expect(result).toBe('scroll');
    expect(panel.scrollOffset).toBe(70); // 0 + 70
  });

  it('clicking the thumb area jumps scrollOffset proportionally', () => {
    const panel = makeScrollablePanel();
    const containerH = panel.height - panel.titleBarHeight - 4; // 352
    const maxScroll = panel.totalContentHeight - containerH; // 648

    const sbX = panel.width - panel.scrollbarWidth - 6;
    // Thumb area: cy in [80, 368]; click the vertical middle (224).
    // ratio = (224 - 80) / (352 - 64) = 0.5 -> scrollOffset = 324.
    const raycaster = raycastAt(panel, sbX + 16, 224);

    const result = panel.handlePointerDown(raycaster, fakePointer);
    expect(result).toBe('scroll');
    expect(panel.scrollOffset).toBeCloseTo(0.5 * maxScroll, 5);
  });

  it('returns null when the panel is hidden', () => {
    const panel = makeScrollablePanel();
    panel.hide();
    const raycaster = new THREE.Raycaster();
    expect(panel.handlePointerDown(raycaster, fakePointer)).toBe(null);
  });
});
