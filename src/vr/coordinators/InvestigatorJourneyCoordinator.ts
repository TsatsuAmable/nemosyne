import { WorldEventBus, WorldTopics } from '../../utils/EventBus.ts';

export type JourneyPhase =
  | 'LOAD'
  | 'ORIENT'
  | 'EXPLORE_ASK'
  | 'MANIPULATE_REPRESENTATION'
  | 'INSPECT_STRUCTURE'
  | 'TEST_FALSIFY'
  | 'COMPARE'
  | 'CAPTURE_FINDING'
  | 'NAVIGATE_MEMORY_PALACE'
  | 'SHARE_REPLAY';

export const JOURNEY_PHASES: readonly JourneyPhase[] = [
  'LOAD',
  'ORIENT',
  'EXPLORE_ASK',
  'MANIPULATE_REPRESENTATION',
  'INSPECT_STRUCTURE',
  'TEST_FALSIFY',
  'COMPARE',
  'CAPTURE_FINDING',
  'NAVIGATE_MEMORY_PALACE',
  'SHARE_REPLAY',
] as const;

export interface JourneyStep {
  phase: JourneyPhase;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface JourneyState {
  currentPhase: JourneyPhase;
  activeDatasetName?: string;
  activeHandle?: number;
  activeRepresentationId?: string;
  activeLensMode?: 'off' | 'statistical' | 'anomaly';
  findingsCount: number;
  branchCount: number;
}

export class InvestigatorJourneyCoordinator {
  private _state: JourneyState = {
    currentPhase: 'LOAD',
    findingsCount: 0,
    branchCount: 1,
    activeLensMode: 'off',
  };
  private readonly _history: JourneyStep[] = [];
  private readonly _eventBus?: WorldEventBus;

  constructor(eventBus?: WorldEventBus) {
    this._eventBus = eventBus;
    this.recordStep('LOAD');
  }

  get currentPhase(): JourneyPhase {
    return this._state.currentPhase;
  }

  get state(): Readonly<JourneyState> {
    return { ...this._state };
  }

  get history(): readonly JourneyStep[] {
    return [...this._history];
  }

  canTransitionTo(nextPhase: JourneyPhase): boolean {
    if (!JOURNEY_PHASES.includes(nextPhase)) return false;
    // Any valid phase in the 10-phase journey can be reached if prerequisites (e.g. data loaded) are met
    if (this._history.length === 0 && nextPhase !== 'LOAD') return false;
    return true;
  }

  transitionTo(nextPhase: JourneyPhase, metadata?: Record<string, unknown>): boolean {
    if (!this.canTransitionTo(nextPhase)) return false;
    this._state.currentPhase = nextPhase;
    this.recordStep(nextPhase, metadata);

    if (metadata?.datasetName) this._state.activeDatasetName = String(metadata.datasetName);
    if (typeof metadata?.handle === 'number') this._state.activeHandle = metadata.handle;
    if (metadata?.representationId) this._state.activeRepresentationId = String(metadata.representationId);
    if (metadata?.lensMode) this._state.activeLensMode = metadata.lensMode as 'off' | 'statistical' | 'anomaly';
    if (typeof metadata?.findingsCount === 'number') this._state.findingsCount = metadata.findingsCount;
    if (typeof metadata?.branchCount === 'number') this._state.branchCount = metadata.branchCount;

    if (this._eventBus) {
      this._eventBus.emit(WorldTopics.JOURNEY_PHASE_CHANGED, {
        journeyPhase: nextPhase,
        metadata,
      });
    }

    return true;
  }

  private recordStep(phase: JourneyPhase, metadata?: Record<string, unknown>): void {
    this._history.push({
      phase,
      timestamp: Date.now(),
      metadata,
    });
  }

  reset(): void {
    this._state = {
      currentPhase: 'LOAD',
      findingsCount: 0,
      branchCount: 1,
      activeLensMode: 'off',
    };
    this._history.length = 0;
    this.recordStep('LOAD');
  }
}
