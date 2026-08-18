// @ts-nocheck
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { WorldEventBus, WorldTopics } from '../src/utils/EventBus.ts';
import { UXFrustrationAnalyzer } from '../src/utils/UXFrustrationAnalyzer.ts';
import {
  AdaptiveAssistController,
  type AdaptiveAssistControllerOptions,
} from '../src/vr/coordinators/AdaptiveAssistController.ts';

function makeController() {
  const updatables: unknown[] = [];
  const previousDispatch = vi.fn();
  const engine = {
    addUpdatable: (updatable: unknown) => updatables.push(updatable),
    removeUpdatable: (updatable: unknown) => {
      const index = updatables.indexOf(updatable);
      if (index >= 0) updatables.splice(index, 1);
    },
    input: {
      addPanel: vi.fn(),
      removePanel: vi.fn(),
      dispatcher: { onDispatch: previousDispatch },
      pointers: {
        getBestPointerRay: () =>
          new THREE.Ray(new THREE.Vector3(0, 1.5, 0), new THREE.Vector3(0, 0, -1)),
      },
    },
  };
  const eventBus = new WorldEventBus();
  const analyzer = new UXFrustrationAnalyzer();
  const options: AdaptiveAssistControllerOptions = {
    engine,
    eventBus,
    analystAnchor: new THREE.Group(),
    scene: new THREE.Scene(),
    analyzer,
    isAssistEnabled: () => true,
  };
  const controller = new AdaptiveAssistController(options);
  return { controller, analyzer, engine, eventBus, previousDispatch, updatables };
}

describe('AdaptiveAssistController', () => {
  it('records gesture confidence and misfires for the assist surfaces', () => {
    const { controller, analyzer, eventBus } = makeController();

    eventBus.emit(WorldTopics.GESTURE_RECOGNIZED, {
      name: 'pinchTogether',
      ctx: { confidence: 0.42, isMisfire: true },
    });

    const patterns = analyzer.analyzeFriction();
    expect(patterns.some((pattern) => pattern.type === 'GESTURE_MISFIRE')).toBe(false);
    expect((controller.confidenceHUD as unknown as { _confidenceMap: Map<string, { confidence: number }> })._confidenceMap.get('pinchTogether')?.confidence).toBe(0.42);
    expect(controller.jitHints.activeHintGroup).toBeTruthy();
    controller.dispose();
  });

  it('shows a diegetic hint after repeated selection misses and preserves prior taps', () => {
    const { controller, engine, previousDispatch } = makeController();
    const dispatch = engine.input.dispatcher.onDispatch!;
    const miss = { hudConsumed: false, sceneMesh: null, hadCallback: false, pointer: null };

    dispatch(miss);
    dispatch(miss);

    expect(previousDispatch).toHaveBeenCalledTimes(2);
    expect(controller.jitHints.activeHintGroup).toBeTruthy();
    controller.dispose();
    expect(engine.input.dispatcher.onDispatch).toBe(previousDispatch);
    expect(engine.input.removePanel).toHaveBeenCalledWith(controller.confidenceHUD);
  });

  it('does not retain adaptive analyzer events when consent is disabled', () => {
    const setup = makeController();
    setup.controller.dispose();
    const disabledController = new AdaptiveAssistController({
      engine: setup.engine,
      eventBus: setup.eventBus,
      analystAnchor: new THREE.Group(),
      scene: new THREE.Scene(),
      analyzer: setup.analyzer,
      isAssistEnabled: () => false,
    });

    disabledController.recordPanelToggle('launcher', true);
    disabledController.recordPanelToggle('launcher', true);
    disabledController.recordPanelToggle('launcher', true);

    expect(setup.analyzer.analyzeFriction()).toHaveLength(0);
    disabledController.dispose();
  });

  it('disposes JIT sprite material and texture resources', () => {
    const { controller } = makeController();
    controller.jitHints.showHint('pinchTogether', new THREE.Vector3(), 'PINCH');
    const sprite = controller.jitHints.activeHintGroup?.children.find(
      (child) => child instanceof THREE.Sprite
    ) as THREE.Sprite;
    expect(sprite).toBeDefined();
    const materialDispose = vi.spyOn(sprite.material, 'dispose');
    const textureDispose = vi.spyOn(sprite.material.map!, 'dispose');

    controller.jitHints.clearHint();

    expect(materialDispose).toHaveBeenCalledOnce();
    expect(textureDispose).toHaveBeenCalledOnce();
    controller.dispose();
  });

  it('applies user-mode policy and removes its update hook on dispose', () => {
    const { controller, eventBus, updatables, engine } = makeController();

    eventBus.emit('userMode:applied', { mode: 'expert' });
    expect(controller.jitHints.enabled).toBe(false);
    expect(updatables).toHaveLength(1);

    controller.dispose();
    expect(updatables).toHaveLength(0);
    expect(engine.input.addPanel).toHaveBeenCalledWith(controller.confidenceHUD);
  });
});
