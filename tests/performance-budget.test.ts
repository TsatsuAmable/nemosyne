// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PerformanceBudget, DEFAULT_BUDGETS } from '../src/utils/PerformanceBudget.ts';
import { World } from '../src/vr/World.ts';

describe('PerformanceBudget', () => {
  let budget: PerformanceBudget;

  beforeEach(() => {
    budget = new PerformanceBudget();
  });

  it('uses default budgets', () => {
    expect(budget.getBudgets()).toMatchObject(DEFAULT_BUDGETS);
  });

  it('flags a frame-time violation', () => {
    const violations = budget.check({ frameMs: 30, dropped: false, rendererInfo: { render: {} } });
    expect(violations).toHaveLength(1);
    expect(violations[0].id).toBe('frameMs');
  });

  it('flags dropped frames over a 10-second window', () => {
    const now = 1000;
    for (let i = 0; i < 6; i++) {
      (budget as unknown as { _recordDrop(dropped: boolean, now: number): void })._recordDrop(true, now + i * 1000);
    }
    const violations = budget.check({ frameMs: 10, dropped: false, rendererInfo: { render: {} } });
    expect(violations.some((v) => v.id === 'droppedFramesPer10s')).toBe(true);
  });

  it('flags excessive draw calls', () => {
    const violations = budget.check({
      frameMs: 10,
      dropped: false,
      rendererInfo: { render: { calls: 600 } },
    });
    expect(violations.some((v) => v.id === 'drawCalls')).toBe(true);
  });

  it('flags excessive triangles and points', () => {
    const violations = budget.check({
      frameMs: 10,
      dropped: false,
      rendererInfo: { render: { calls: 10, triangles: 300_000, points: 150_000 } },
    });
    expect(violations.some((v) => v.id === 'triangles')).toBe(true);
    expect(violations.some((v) => v.id === 'points')).toBe(true);
  });

  it('flags too many interactables, updatables, or panels', () => {
    const violations = budget.check({
      frameMs: 10,
      dropped: false,
      rendererInfo: { render: {} },
      interactableCount: 600,
      updatableCount: 250,
      panelCount: 25,
    });
    expect(violations.some((v) => v.id === 'interactables')).toBe(true);
    expect(violations.some((v) => v.id === 'updatables')).toBe(true);
    expect(violations.some((v) => v.id === 'panels')).toBe(true);
  });

  it('returns no violations when within budget', () => {
    const violations = budget.check({
      frameMs: 10,
      dropped: false,
      rendererInfo: { render: { calls: 10, triangles: 100, points: 10 } },
      interactableCount: 10,
      updatableCount: 10,
      panelCount: 2,
    });
    expect(violations).toHaveLength(0);
  });

  it('throttles repeated identical warnings', () => {
    budget.check({ frameMs: 30, dropped: false, rendererInfo: { render: {} } });
    budget.check({ frameMs: 30, dropped: false, rendererInfo: { render: {} } });
    expect(budget.getViolations()).toHaveLength(1);
  });

  it('allows runtime budget updates', () => {
    budget.setBudgets({ frameMs: 8 });
    const violations = budget.check({ frameMs: 10, dropped: false, rendererInfo: { render: {} } });
    expect(violations).toHaveLength(1);
  });
});

describe('World performance integration', () => {
  let world: World | null = null;

  beforeEach(() => {
    (globalThis.navigator as unknown as Record<string, unknown>).xr = {
      isSessionSupported: vi.fn().mockResolvedValue(true),
      requestSession: vi.fn().mockResolvedValue({
        addEventListener: vi.fn(),
        updateRenderState: vi.fn().mockResolvedValue(undefined),
        renderState: {},
        inputSources: [],
      }),
    };
    world = new World();
  });

  afterEach(() => {
    world?.engine?.dispose?.();
    world = null;
    vi.restoreAllMocks();
    const button = document.getElementById('nemosyne-vr-button');
    if (button?.parentNode) button.parentNode.removeChild(button);
    for (const canvas of Array.from(document.querySelectorAll('canvas'))) {
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }
  });

  it('creates a performance budget and panel', () => {
    expect(world!.engine.performanceBudget).toBeInstanceOf(PerformanceBudget);
    expect(world!.uiManager.performancePanel).toBeTruthy();
    expect(world!.uiManager.panelManager.panels).toContain(world!.uiManager.performancePanel);
  });

  it('adds a Performance action to the hand wheel menu', () => {
    const categories = (world!.uiManager.handWheelMenu as any)._categories as Array<{ id: string; items: Array<{ id: string }> }>;
    const systemCategory = categories.find((c) => c.id === 'SYSTEM');
    expect(systemCategory?.items.find((i) => i.id === 'perf')).toBeTruthy();
  });

  it('toggles strict budget from settings', () => {
    world!.uiManager.settingsPanel.setSetting('strictBudget', true);
    expect((world!.engine.performanceBudget as PerformanceBudget).budgets.frameMs).toBe(13.33);
  });

  it('logs performance violations from engine tick', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    (world!.engine.performanceBudget as PerformanceBudget).setBudgets({
      frameMs: 5,
      drawCalls: 5,
      triangles: 5,
      points: 5,
    });

    // Stub renderer.info so we do not need a real WebGL context.
    const originalInfo = world!.engine.renderer.info;
    (world!.engine.renderer as unknown as Record<string, unknown>).info = {
      render: { calls: 10, triangles: 10, points: 10 },
      memory: { textures: 0, geometries: 0 },
    };
    const originalRender = world!.engine.renderer.render;
    world!.engine.renderer.render = vi.fn();

    // Force budget check by setting lastBudgetCheck to more than 1000ms ago
    (world!.engine as any)._lastBudgetCheck = performance.now() - 1005;

    world!.engine._tick();

    world!.engine.renderer.render = originalRender;
    (world!.engine.renderer as unknown as Record<string, unknown>).info = originalInfo;

    expect(warnSpy).toHaveBeenCalled();
    const calls = warnSpy.mock.calls.map((c) => c[0]);
    expect(calls.some((msg: string) => typeof msg === 'string' && msg.includes('[PerformanceBudget]'))).toBe(true);
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
