// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { VRMenu } from '../src/vr/ui/VRMenu.ts';

function makeRaycasterForButton(menu, btn) {
  const u = (btn.x + btn.w / 2) / menu.canvas.width;
  const v = 1 - (btn.y + btn.h / 2) / menu.canvas.height;
  return makeRaycasterForUV(menu, u, v);
}

function makeRaycasterForUV(menu, u, v) {
  const geom = menu.mesh.geometry;
  const posAttr = geom.attributes.position;
  const topLeft = new THREE.Vector3().fromBufferAttribute(posAttr, 0);
  const topRight = new THREE.Vector3().fromBufferAttribute(posAttr, 1);
  const bottomLeft = new THREE.Vector3().fromBufferAttribute(posAttr, 2);
  const bottomRight = new THREE.Vector3().fromBufferAttribute(posAttr, 3);

  const localPoint = new THREE.Vector3()
    .addScaledVector(bottomLeft, (1 - u) * (1 - v))
    .addScaledVector(bottomRight, u * (1 - v))
    .addScaledVector(topLeft, (1 - u) * v)
    .addScaledVector(topRight, u * v);

  menu.mesh.updateMatrixWorld(true);
  const worldPoint = localPoint.applyMatrix4(menu.mesh.matrixWorld);
  const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(
    menu.mesh.getWorldQuaternion(new THREE.Quaternion())
  );
  const origin = worldPoint.clone().add(normal.multiplyScalar(0.1));
  const direction = worldPoint.clone().sub(origin).normalize();
  return new THREE.Raycaster(origin, direction);
}

describe('VRMenu', () => {
  let menu;
  let originalPerformanceNow;
  let now = 0;

  beforeEach(() => {
    originalPerformanceNow = performance.now.bind(performance);
    performance.now = () => now;
  });

  afterEach(() => {
    performance.now = originalPerformanceNow;
  });

  it('toggles Farcaster portals and notifies the callback', () => {
    const toggleSpy = vi.fn();
    menu = new VRMenu(new THREE.Group(), { onTogglePortals: toggleSpy });

    const toggleBtn = menu.buttons.find((b) => b.type === 'toggle');
    const raycaster = makeRaycasterForButton(menu, toggleBtn);

    expect(menu.portalsEnabled).toBe(true);
    const consumed = menu.handleContentClick(raycaster);

    expect(consumed).toBe(true);
    expect(menu.portalsEnabled).toBe(false);
    expect(toggleSpy).toHaveBeenCalledWith(false);
  });

  it('loads a dataset when a dataset button is hit', () => {
    const loadSpy = vi.fn();
    menu = new VRMenu(new THREE.Group(), { onLoadDataset: loadSpy });

    const datasetBtn = menu.buttons.find((b) => b.type === 'dataset');
    const raycaster = makeRaycasterForButton(menu, datasetBtn);

    const consumed = menu.handleContentClick(raycaster);

    expect(consumed).toBe(true);
    expect(loadSpy).toHaveBeenCalledOnce();
    const entry = loadSpy.mock.calls[0][0];
    expect(entry.name).toBe(datasetBtn.entry.label);
    expect(entry.topology).toBe(datasetBtn.entry.topology);
  });

  it('respects the click cooldown', () => {
    const toggleSpy = vi.fn();
    menu = new VRMenu(new THREE.Group(), { onTogglePortals: toggleSpy });

    const toggleBtn = menu.buttons.find((b) => b.type === 'toggle');
    const raycaster = makeRaycasterForButton(menu, toggleBtn);

    menu.handleContentClick(raycaster);
    menu.handleContentClick(raycaster);

    expect(toggleSpy).toHaveBeenCalledTimes(1);

    now += 400;
    menu.handleContentClick(raycaster);

    expect(toggleSpy).toHaveBeenCalledTimes(2);
  });

  it('calls connect and disconnect stream callbacks', () => {
    const connectSpy = vi.fn();
    const disconnectSpy = vi.fn();
    menu = new VRMenu(new THREE.Group(), {
      onConnectStream: connectSpy,
      onDisconnectStream: disconnectSpy,
    });

    const connectBtn = menu.buttons.find((b) => b.type === 'connectStream');
    const disconnectBtn = menu.buttons.find((b) => b.type === 'disconnectStream');

    menu.handleContentClick(makeRaycasterForButton(menu, connectBtn));
    expect(connectSpy).toHaveBeenCalledOnce();

    now += 400;
    menu.handleContentClick(makeRaycasterForButton(menu, disconnectBtn));
    expect(disconnectSpy).toHaveBeenCalledOnce();
  });

  it('reflects live connection status in the UI', () => {
    menu = new VRMenu(new THREE.Group(), {});
    expect(menu.liveConnected).toBe(false);

    menu.setLiveConnected(true);
    expect(menu.liveConnected).toBe(true);

    // Re-rendering should not throw.
    expect(() => menu.render()).not.toThrow();
  });

  it('can be told the external portal state and re-renders', () => {
    menu = new VRMenu(new THREE.Group(), {});
    expect(menu.portalsEnabled).toBe(true);

    menu.setPortalsEnabled(false);
    expect(menu.portalsEnabled).toBe(false);

    // Re-rendering should not throw and the toggle button text should update.
    expect(() => menu.render()).not.toThrow();
  });

  it('syncs external portal toggles back into the UI button state', () => {
    const toggleSpy = vi.fn();
    menu = new VRMenu(new THREE.Group(), { onTogglePortals: toggleSpy });

    // Simulate an external source (e.g. hand wheel) turning portals off.
    menu.setPortalsEnabled(false);
    expect(menu.portalsEnabled).toBe(false);

    // The next in-panel click should turn them back on.
    const toggleBtn = menu.buttons.find((b) => b.type === 'toggle');
    const raycaster = makeRaycasterForButton(menu, toggleBtn);
    menu.handleContentClick(raycaster);

    expect(menu.portalsEnabled).toBe(true);
    expect(toggleSpy).toHaveBeenCalledWith(true);
  });

  it('selects an open live data source', () => {
    const sourceSpy = vi.fn();
    menu = new VRMenu(new THREE.Group(), { onSelectLiveSource: sourceSpy });

    const sourceBtn = menu.buttons.find((b) => b.type === 'liveSource');
    expect(sourceBtn).toBeTruthy();

    const consumed = menu.handleContentClick(makeRaycasterForButton(menu, sourceBtn));
    expect(consumed).toBe(true);
    expect(sourceSpy).toHaveBeenCalledWith(sourceBtn.source.key);
  });
});
