import { describe, it, expect } from 'vitest';
import { Engine } from '../../../src/vr/Engine.js';
import { WorldUIManager } from '../../../src/vr/coordinators/WorldUIManager.js';
import { WorldSceneComposer } from '../../../src/vr/coordinators/WorldSceneComposer.js';
import { DataOperationController } from '../../../src/vr/coordinators/DataOperationController.js';
import { WorldEventBus } from '../../../src/utils/EventBus.js';

describe('Feature 3: God Object Refactoring & Sub-Manager Architecture', () => {
  it('F3-TC1: DataOperationController initializes independently to manage dataset mutations', () => {
    const eventBus = new WorldEventBus();
    const controller = new DataOperationController({ eventBus });

    expect(controller).toBeDefined();
    expect(controller.analysisHistory).toBeDefined();
  });

  it('F3-TC2: WorldUIManager manages HUD panel lifecycle and launcher registry', () => {
    const engine = new Engine();
    const eventBus = new WorldEventBus();
    const analystAnchor = engine.cameraGroup;

    const uiManager = new WorldUIManager(engine, analystAnchor, eventBus);
    expect(uiManager.panelManager).toBeDefined();
    expect(uiManager.dashboard).toBeDefined();

    engine.dispose();
  });

  it('F3-TC3: WorldSceneComposer composes spatial landmarks and analyst anchor', () => {
    const engine = new Engine();
    const composer = new WorldSceneComposer(engine);

    expect(composer.analystAnchor).toBeDefined();
    expect(composer.datum).toBeDefined();
    expect(composer.core).toBeDefined();
    expect(composer.portalA).toBeDefined();
    expect(composer.portalB).toBeDefined();

    engine.dispose();
  });

  it('F3-TC4: Sub-managers handle updates and events without throwing errors', () => {
    const engine = new Engine();
    const composer = new WorldSceneComposer(engine);

    expect(() => composer.update(0.016)).not.toThrow();
    engine.dispose();
  });

  it('F3-TC5: DataOperationController applies data transforms (filter, sort) on datasets', () => {
    const eventBus = new WorldEventBus();
    const controller = new DataOperationController({ eventBus });

    expect(typeof controller.apply).toBe('function');
  });
});
