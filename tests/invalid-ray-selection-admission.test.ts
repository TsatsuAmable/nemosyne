import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { InteractableRegistry } from '../src/vr/input/InteractableRegistry.ts';
import { PointerEventMachine } from '../src/vr/input/PointerEventMachine.ts';
import { SelectionDispatcher } from '../src/vr/input/SelectionDispatcher.ts';
import type { PanelLike, PanelManagerLike, PointerLike } from '../src/vr/coordinators/types.ts';

function invalidPointer(): PointerLike {
  return {
    getRay: (target: THREE.Ray) =>
      target.set(new THREE.Vector3(0, 1.6, 0), new THREE.Vector3(0, 0, 0)),
  } as PointerLike;
}

describe('invalid pointer-ray admission', () => {
  it('SelectionDispatcher reports tracking loss but refuses all selection side effects', () => {
    const registry = new InteractableRegistry();
    const hud = vi.spyOn(registry, 'dispatchHudClick');
    const sceneSelect = vi.fn();
    const staleMesh = new THREE.Object3D();
    registry.hovered = { mesh: staleMesh, data: { id: 1 }, onSelect: sceneSelect };

    const globalSelect = vi.fn();
    const dispatcher = new SelectionDispatcher(registry, { onSelectCallback: globalSelect });
    const playSelect = vi.spyOn(dispatcher.feedback, 'playSelect');
    const flashPointer = vi.spyOn(dispatcher.feedback, 'flashPointer');
    const playHaptic = vi.spyOn(dispatcher.feedback, 'playHaptic');
    const onDispatch = vi.fn();
    dispatcher.onDispatch = onDispatch;

    dispatcher.lockTargetForPinch(1000);
    dispatcher.triggerSelect(invalidPointer());

    expect(hud).not.toHaveBeenCalled();
    expect(sceneSelect).not.toHaveBeenCalled();
    expect(globalSelect).not.toHaveBeenCalled();
    expect(playSelect).not.toHaveBeenCalled();
    expect(flashPointer).not.toHaveBeenCalled();
    expect(playHaptic).not.toHaveBeenCalled();
    expect(onDispatch).toHaveBeenCalledOnce();
    expect(onDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        hudConsumed: false,
        sceneMesh: null,
        hadCallback: false,
        rayValid: false,
      })
    );
  });

  it('PointerEventMachine refuses launcher, panel, HUD and scene dispatch for an invalid press', () => {
    const registry = new InteractableRegistry();
    const panelDown = vi.fn(() => 'down');
    registry.panels = [{ handlePointerDown: panelDown } as PanelLike];
    const hud = vi.spyOn(registry, 'dispatchHudClick');

    const launcherHit = vi.fn();
    const panelManager = {
      isLauncherVisible: vi.fn(() => true),
      handleLauncherHit: launcherHit,
    } as unknown as PanelManagerLike;
    const sceneDispatch = vi.fn();
    const machine = new PointerEventMachine(registry, {
      panelManager,
      onTriggerSelect: sceneDispatch,
    });

    expect(machine.press(invalidPointer())).toBe(false);
    expect(launcherHit).not.toHaveBeenCalled();
    expect(panelDown).not.toHaveBeenCalled();
    expect(hud).not.toHaveBeenCalled();
    expect(sceneDispatch).not.toHaveBeenCalled();
    expect(machine.state).toBe('idle');
    expect(machine.downPointer).toBeNull();
  });

  it('invalid drag/release rays do not reach a captured panel but release still clears capture state', () => {
    const registry = new InteractableRegistry();
    const move = vi.fn();
    const up = vi.fn();
    const capturedPanel = {
      handlePointerMove: move,
      handlePointerUp: up,
    } as PanelLike;
    const pointer = invalidPointer();
    const machine = new PointerEventMachine(registry);
    machine.state = 'drag';
    machine.downPointer = pointer;
    machine.capturedPanel = capturedPanel;
    machine.capturedMode = 'drag';

    machine.move(pointer);
    machine.release(pointer);

    expect(move).not.toHaveBeenCalled();
    expect(up).not.toHaveBeenCalled();
    expect(machine.state).toBe('idle');
    expect(machine.downPointer).toBeNull();
    expect(machine.capturedPanel).toBeNull();
  });
});
