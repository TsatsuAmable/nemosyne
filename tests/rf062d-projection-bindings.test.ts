// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { World } from '../src/vr/World.ts';
import { WorldEventBus, WorldTopics } from '../src/utils/EventBus.ts';
import { bindOperationStateProjection } from '../src/vr/presentation/bindings/bindOperationStateProjection.ts';
import { bindDerivedAnalysisProjection } from '../src/vr/presentation/bindings/bindDerivedAnalysisProjection.ts';
import { bindOperationUiProjection } from '../src/vr/presentation/bindings/bindOperationUiProjection.ts';
import { combineBindingDisposers } from '../src/vr/presentation/bindings/BindingDisposer.ts';
import { ColumnType, Dataset } from '../src/data/Dataset.ts';

describe('RF-062D projection bindings', () => {
  let world: World | null = null;

  afterEach(async () => {
    if (world) {
      await world.dispose();
      world.loader?.container?.remove?.();
      world = null;
    }
    for (const canvas of Array.from(document.querySelectorAll('canvas'))) canvas.remove();
    vi.restoreAllMocks();
  });

  it('preserves state -> derived analysis -> UI ordering for operation and history outcomes', () => {
    const eventBus = new WorldEventBus();
    const calls: string[] = [];
    const dataset = new Dataset(
      'projection-test',
      [{ name: 'value', type: ColumnType.NUMERIC }],
      [{ value: 1 }]
    );

    const disposeState = bindOperationStateProjection({
      eventBus,
      invalidateSpatialAcceleration: () => calls.push('invalidate'),
      getTransformedDataset: () => dataset,
      restoreDataset: () => calls.push('restore'),
      updateDashboardDatasets: () => calls.push('dashboard'),
    });
    const disposeDerived = bindDerivedAnalysisProjection({
      eventBus,
      schedule: () => calls.push('derived'),
      recomputeTda: () => calls.push('tda'),
    });
    const disposeUi = bindOperationUiProjection({
      eventBus,
      updateOperationLog: () => calls.push('operation-log'),
      updateNarrative: () => calls.push('narrative'),
      logConsole: () => calls.push('console'),
      recordInteraction: () => calls.push('interaction'),
    });

    eventBus.emit(WorldTopics.OPERATION_APPLIED, { operation: 'compare', rowCount: 1 });
    expect(calls).toEqual([
      'invalidate',
      'restore',
      'dashboard',
      'derived',
      'operation-log',
      'narrative',
      'console',
      'interaction',
    ]);

    calls.length = 0;
    eventBus.emit(WorldTopics.HISTORY_SEEK, { index: 0, operation: 'sort', dataset });
    expect(calls).toEqual(['restore', 'tda', 'narrative']);

    disposeUi();
    disposeDerived();
    disposeState();
  });

  it('disposes each projection idempotently without removing another owner\'s listener', () => {
    const eventBus = new WorldEventBus();
    const external = vi.fn();
    const dashboard = vi.fn();
    const disposeExternal = eventBus.on(WorldTopics.OPERATION_APPLIED, external);
    const disposeProjection = bindOperationStateProjection({
      eventBus,
      invalidateSpatialAcceleration: vi.fn(),
      getTransformedDataset: () => null,
      restoreDataset: vi.fn(),
      updateDashboardDatasets: dashboard,
    });

    eventBus.emit(WorldTopics.OPERATION_APPLIED, { operation: 'sort' });
    disposeProjection();
    disposeProjection();
    eventBus.emit(WorldTopics.OPERATION_APPLIED, { operation: 'sort' });

    expect(dashboard).toHaveBeenCalledOnce();
    expect(external).toHaveBeenCalledTimes(2);
    disposeExternal();
  });

  it('attempts every owned disposer and reports aggregated teardown failures', () => {
    const first = vi.fn(() => {
      throw new Error('first failed');
    });
    const second = vi.fn();
    const dispose = combineBindingDisposers([first, second]);

    expect(dispose).toThrow(AggregateError);
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
    expect(dispose).not.toThrow();
  });

  it('uses the bindings on the production World event path and releases them during teardown', async () => {
    world = new World();
    const eventBus = world.eventBus as WorldEventBus;
    const invalidate = vi.spyOn(world.engine.input, 'invalidateSpatialAcceleration');
    const schedule = vi.spyOn(world.derivedAnalysisPipeline, 'schedule');
    const operationLog = vi.spyOn(world, '_updateOperationLog');
    const narrative = vi.spyOn(world, '_updateNarrativeStrip');
    const autosave = vi.spyOn(world, '_requestAutoSave');
    const initialOperationListeners = eventBus.listenerCount(WorldTopics.OPERATION_APPLIED);

    expect(initialOperationListeners).toBeGreaterThanOrEqual(5);
    eventBus.emit(WorldTopics.OPERATION_APPLIED, { operation: 'sort', rowCount: 3 });

    expect(invalidate).toHaveBeenCalledOnce();
    expect(schedule).toHaveBeenCalledWith('sort');
    expect(operationLog).toHaveBeenCalledOnce();
    expect(narrative).toHaveBeenCalledOnce();
    expect(autosave).toHaveBeenCalledOnce();

    await world.dispose();
    expect(eventBus.listenerCount(WorldTopics.OPERATION_APPLIED)).toBe(0);
    world = null;
  });
});
