export type ApplicationAnalysisOperation =
  | 'filter'
  | 'sort'
  | 'aggregate'
  | 'cluster'
  | 'hierarchical'
  | 'density'
  | 'anomaly'
  | 'timeSlice'
  | 'compare';

/**
 * Canonical world/application intents. These are the commands World may
 * execute directly when no bootstrap dispatcher has been injected.
 */
export type ApplicationIntent =
  | { type: 'dataset.cycle'; step: number }
  | { type: 'analysis.apply'; operation: ApplicationAnalysisOperation }
  | { type: 'analysis.reset' }
  | { type: 'history.undo' }
  | { type: 'history.redo' }
  | { type: 'workspace.toggleStatisticalLens' };

/** Presentation-only commands are resolved at the application composition root. */
export type ApplicationPresentationIntent = { type: 'settings.open' };
export type ApplicationDispatchIntent = ApplicationIntent | ApplicationPresentationIntent;

export interface ApplicationIntentHandlers {
  cycleDataset(step: number): void | Promise<void>;
  applyAnalysis(operation: ApplicationAnalysisOperation): void | Promise<void>;
  resetAnalysis(): void | Promise<void>;
  undoHistory(): void | Promise<void>;
  redoHistory(): void | Promise<void>;
  toggleStatisticalLens(): void | Promise<void>;
  openSettings(): void | Promise<void>;
}

/** Canonical dispatcher type consumed by World, XR input and wheel-menu code. */
export type ApplicationIntentDispatcher = (
  intent: ApplicationIntent,
) => void | Promise<void>;

/** Broader composition-root dispatcher, which can also own presentation chrome. */
export type ApplicationDispatchIntentDispatcher = (
  intent: ApplicationDispatchIntent,
) => void | Promise<void>;

const ANALYSIS_OPERATIONS = new Set<ApplicationAnalysisOperation>([
  'filter',
  'sort',
  'aggregate',
  'cluster',
  'hierarchical',
  'density',
  'anomaly',
  'timeSlice',
  'compare',
]);

export function parseApplicationAnalysisOperation(
  operation: string,
): ApplicationAnalysisOperation | null {
  return ANALYSIS_OPERATIONS.has(operation as ApplicationAnalysisOperation)
    ? (operation as ApplicationAnalysisOperation)
    : null;
}

export function createApplicationIntentDispatcher(
  handlers: ApplicationIntentHandlers,
): ApplicationDispatchIntentDispatcher {
  return (intent) => {
    switch (intent.type) {
      case 'dataset.cycle':
        return handlers.cycleDataset(intent.step);
      case 'analysis.apply':
        return handlers.applyAnalysis(intent.operation);
      case 'analysis.reset':
        return handlers.resetAnalysis();
      case 'history.undo':
        return handlers.undoHistory();
      case 'history.redo':
        return handlers.redoHistory();
      case 'workspace.toggleStatisticalLens':
        return handlers.toggleStatisticalLens();
      case 'settings.open':
        return handlers.openSettings();
      default: {
        const exhaustive: never = intent;
        throw new Error(
          `Unsupported application intent: ${JSON.stringify(exhaustive)}`,
        );
      }
    }
  };
}
