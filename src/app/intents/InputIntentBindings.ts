import {
  parseApplicationAnalysisOperation,
  type ApplicationIntentDispatcher,
} from './ApplicationIntent.ts';

/**
 * Consumer-shaped subset of the input coordinator callback surface.
 *
 * This deliberately lives beside the application intent consumer instead of
 * importing World or a broad coordinator host type. The production
 * WorldInputCoordinator callback object satisfies it structurally.
 */
export interface SemanticInputCallbacks {
  onApplyOperation?: (operation: string) => void;
  onCycleDataset?: (step: number) => void;
  onResetData?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onToggleStatisticalLens?: () => void;
}

export interface InputIntentBindingOptions {
  onUnsupportedOperation?: (operation: string) => void;
  onDispatchError?: (error: unknown) => void;
}

export function bindInputCallbacksToApplicationIntents(
  callbacks: SemanticInputCallbacks,
  dispatchIntent: ApplicationIntentDispatcher,
  options: InputIntentBindingOptions = {},
): void {
  const dispatch = (intent: Parameters<ApplicationIntentDispatcher>[0]) => {
    try {
      Promise.resolve(dispatchIntent(intent)).catch((error: unknown) => {
        options.onDispatchError?.(error);
      });
    } catch (error) {
      options.onDispatchError?.(error);
    }
  };

  callbacks.onApplyOperation = (operation) => {
    const parsed = parseApplicationAnalysisOperation(operation);
    if (!parsed) {
      options.onUnsupportedOperation?.(operation);
      return;
    }
    dispatch({ type: 'analysis.apply', operation: parsed });
  };
  callbacks.onCycleDataset = (step) => dispatch({ type: 'dataset.cycle', step });
  callbacks.onResetData = () => dispatch({ type: 'analysis.reset' });
  callbacks.onUndo = () => dispatch({ type: 'history.undo' });
  callbacks.onRedo = () => dispatch({ type: 'history.redo' });
  callbacks.onToggleStatisticalLens = () =>
    dispatch({ type: 'workspace.toggleStatisticalLens' });
}
