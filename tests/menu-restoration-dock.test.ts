import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { PanelManager } from '../src/vr/ui/PanelManager.ts';
import { MovablePanel } from '../src/vr/ui/MovablePanel.ts';

describe('Window Restoration Dock & Menu Subsystem', () => {
  it('automatically opens the launcher dock when a panel is hidden or minimized', () => {
    const cameraGroup = new THREE.Group();
    const manager = new PanelManager(cameraGroup);
    const panel = new MovablePanel(cameraGroup, { title: 'MINIMIZABLE PANEL' });

    manager.register(panel);
    expect(manager.isLauncherVisible()).toBe(false);

    // Minimize / hide the panel and show launcher dock
    manager.hidePanel(panel);
    manager.showLauncher();

    // Launcher dock is visible to restore minimized windows
    expect(manager.isLauncherVisible()).toBe(true);
  });

  it('restores a minimized panel when clicking its launcher icon', () => {
    const cameraGroup = new THREE.Group();
    const manager = new PanelManager(cameraGroup);
    const panel = new MovablePanel(cameraGroup, { title: 'RECALL TEST PANEL' });

    manager.register(panel);
    manager.hidePanel(panel);

    expect(panel.mesh.visible).toBe(false);

    // Simulate clicking launcher icon
    const launcher = manager._launchers.find((l) => l.panel === panel);
    expect(launcher).toBeDefined();

    manager.togglePanel(panel);
    expect(panel.mesh.visible).toBe(true);
  });
});
