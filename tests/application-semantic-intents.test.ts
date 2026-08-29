import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createApplicationIntentDispatcher,
  parseApplicationAnalysisOperation,
  type ApplicationIntent,
} from '../src/app/intents/ApplicationIntent.ts';
import { bindInputCallbacksToApplicationIntents } from '../src/app/intents/InputIntentBindings.ts';
import { mountAnalystJourneyControls } from '../src/app/AnalystJourneyControls.ts';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('RF-062B application intent boundary', () => {
  it('dispatches each semantic intent to exactly one owning handler', async () => {
    const handlers = {
      cycleDataset: vi.fn(),
      applyAnalysis: vi.fn(),
      resetAnalysis: vi.fn(),
      undoHistory: vi.fn(),
      redoHistory: vi.fn(),
      toggleStatisticalLens: vi.fn(),
    };
    const dispatch = createApplicationIntentDispatcher(handlers);

    await dispatch({ type: 'dataset.cycle', step: 1 });
    await dispatch({ type: 'analysis.apply', operation: 'filter' });
    await dispatch({ type: 'analysis.reset' });
    await dispatch({ type: 'history.undo' });
    await dispatch({ type: 'history.redo' });
    await dispatch({ type: 'workspace.toggleStatisticalLens' });

    expect(handlers.cycleDataset).toHaveBeenCalledOnce();
    expect(handlers.cycleDataset).toHaveBeenCalledWith(1);
    expect(handlers.applyAnalysis).toHaveBeenCalledOnce();
    expect(handlers.applyAnalysis).toHaveBeenCalledWith('filter');
    expect(handlers.resetAnalysis).toHaveBeenCalledOnce();
    expect(handlers.undoHistory).toHaveBeenCalledOnce();
    expect(handlers.redoHistory).toHaveBeenCalledOnce();
    expect(handlers.toggleStatisticalLens).toHaveBeenCalledOnce();
  });

  it('fails closed when an untyped runtime caller supplies an unknown intent', () => {
    const dispatch = createApplicationIntentDispatcher({
      cycleDataset: vi.fn(),
      applyAnalysis: vi.fn(),
      resetAnalysis: vi.fn(),
      undoHistory: vi.fn(),
      redoHistory: vi.fn(),
      toggleStatisticalLens: vi.fn(),
    });

    expect(() =>
      dispatch({ type: 'unknown.intent' } as unknown as ApplicationIntent),
    ).toThrow(/Unsupported application intent/);
  });

  it('maps the production input callback vocabulary onto the same semantic intents', () => {
    const callbacks: {
      onApplyOperation?: (operation: string) => void;
      onCycleDataset?: (step: number) => void;
      onResetData?: () => void;
      onUndo?: () => void;
      onRedo?: () => void;
      onToggleStatisticalLens?: () => void;
    } = {};
    const dispatched: ApplicationIntent[] = [];
    const unsupported = vi.fn();

    bindInputCallbacksToApplicationIntents(
      callbacks,
      (intent) => {
        dispatched.push(intent);
      },
      { onUnsupportedOperation: unsupported },
    );

    callbacks.onCycleDataset?.(-1);
    callbacks.onApplyOperation?.('sort');
    callbacks.onResetData?.();
    callbacks.onUndo?.();
    callbacks.onRedo?.();
    callbacks.onToggleStatisticalLens?.();
    callbacks.onApplyOperation?.('not-an-operation');

    expect(dispatched).toEqual([
      { type: 'dataset.cycle', step: -1 },
      { type: 'analysis.apply', operation: 'sort' },
      { type: 'analysis.reset' },
      { type: 'history.undo' },
      { type: 'history.redo' },
      { type: 'workspace.toggleStatisticalLens' },
    ]);
    expect(unsupported).toHaveBeenCalledOnce();
    expect(unsupported).toHaveBeenCalledWith('not-an-operation');
    expect(parseApplicationAnalysisOperation('anomaly')).toBe('anomaly');
    expect(parseApplicationAnalysisOperation('bogus')).toBeNull();
  });

  it('surfaces synchronous input dispatch failures through the binding hook', () => {
    const callbacks: { onUndo?: () => void } = {};
    const failure = new Error('handler failed');
    const onDispatchError = vi.fn();

    bindInputCallbacksToApplicationIntents(
      callbacks,
      () => {
        throw failure;
      },
      { onDispatchError },
    );

    callbacks.onUndo?.();
    expect(onDispatchError).toHaveBeenCalledOnce();
    expect(onDispatchError).toHaveBeenCalledWith(failure);
  });

  it('routes representative desktop UI actions through semantic intents', async () => {
    const dispatched: ApplicationIntent[] = [];
    const handle = mountAnalystJourneyControls({
      dispatchIntent: (intent) => {
        dispatched.push(intent);
      },
      currentDatasetName: () => 'fixture',
      assessRepresentation: () => ({
        kind: 'decision',
        decisionId: 'decision-1',
        family: 'point-cloud',
        layout: 'GRID_3D',
        utilityScore: 0.75,
      }),
      analysisResultCount: () => 1,
      markMoment: () => 'observation-1',
      replayPortableInvestigation: async () => ({
        success: true,
        discrepancies: [],
        eventsMatched: 0,
      }),
      exportPortableInvestigation: async () => new Uint8Array(),
    });

    const click = async (id: string) => {
      const element = document.getElementById(id) as HTMLButtonElement | null;
      expect(element).not.toBeNull();
      element!.click();
      await Promise.resolve();
      await Promise.resolve();
    };

    await click('analyst-load-sample');
    await click('analyst-run-analysis');
    await click('analyst-undo-analysis');
    await click('analyst-toggle-statistical-lens');

    expect(dispatched).toEqual([
      { type: 'dataset.cycle', step: 1 },
      { type: 'analysis.apply', operation: 'anomaly' },
      { type: 'history.undo' },
      { type: 'workspace.toggleStatisticalLens' },
    ]);

    handle.dispose();
  });
});
