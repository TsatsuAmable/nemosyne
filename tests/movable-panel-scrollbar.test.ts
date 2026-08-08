import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { MovablePanel } from '../src/vr/ui/MovablePanel.ts';

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
});
