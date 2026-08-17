/**
 * NemosyneSession — the authoritative logical session.
 *
 * Wave 4: snapshot authority moves here from WorldSessionController. The
 * schemaVersion-2 JSON persists the AtlasCore state (dataset, DatasetSpace,
 * provenance ledger, analysis results chain, recommendation decisions) plus
 * the memory-palace presentation state (camera/settings/tour/theme/panels/
 * entry). Saved-session compatibility BREAKS: schemaVersion 1 is rejected.
 */

import type { DatasetJSON, EncodingMapping } from '../data/types.ts';
import type { DatasetSpaceJSON } from '../atlas/DatasetSpace.ts';
import type { HistorySnapshot } from '../data/AnalysisHistory.ts';
import { AtlasCore } from '../atlas/AtlasCore.ts';
import type {
  AnalysisResult,
  AnalysisSpec,
  AtlasCoreState,
  AtlasRecommendation,
  ResearchContext,
  ResearchEvent,
} from '../atlas/types.ts';

/** Memory-palace presentation state (camera/settings/tour/theme/panels/entry). */
export interface PresentationState {
  camera: { position: [number, number, number]; rotationY: number };
  settings: Record<string, unknown>;
  tour: { stepIndex: number; finished: boolean };
  theme: string;
  panelPositions: Array<unknown>;
  entry: { name: string; topology?: string; encodings?: EncodingMapping; maxDepth?: number };
}

/** Authoritative session JSON (schemaVersion 2). */
export interface NemosyneSessionJSON extends AtlasCoreState {
  schemaVersion: 2;
  savedAt: number;
  entry: PresentationState['entry'];
  /** Derived from `analysisResults.map(r => r.spec)`. */
  analysisSpecs: AnalysisSpec[];
  presentation: PresentationState;
}

function now(): number {
  return (typeof performance !== 'undefined' && performance.now) ? performance.now()
    : (typeof Date !== 'undefined' && Date.now) ? Date.now()
    : 0;
}

export class NemosyneSession {
  private _atlas: AtlasCore;
  private _sessionId: string;
  private _presentation: PresentationState;
  private _researchContext: ResearchContext;

  constructor({ atlas, sessionId }: { atlas: AtlasCore; sessionId?: string }) {
    this._atlas = atlas;
    this._sessionId = sessionId ?? `session-${now()}`;
    this._presentation = {
      camera: { position: [0, 0, 0], rotationY: 0 },
      settings: {},
      tour: { stepIndex: 0, finished: true },
      theme: 'neonMidnight',
      panelPositions: [],
      entry: { name: 'dataset' },
    };
    this._researchContext = {};
  }

  get atlas(): AtlasCore {
    return this._atlas;
  }

  get sessionId(): string {
    return this._sessionId;
  }

  get presentation(): PresentationState {
    return this._presentation;
  }

  get researchContext(): ResearchContext {
    return this._researchContext;
  }

  setResearchContext(ctx: Partial<ResearchContext>): void {
    this._researchContext = { ...this._researchContext, ...ctx };
  }

  recordObservation(observation: string): void {
    this._atlas.recordObservation(observation);
  }

  recordIntervention(intervention: string): void {
    this._atlas.recordIntervention(intervention);
  }

  setPresentation(partial: Partial<PresentationState>): void {
    if (partial.camera) this._presentation.camera = partial.camera as PresentationState['camera'];
    if (partial.settings) this._presentation.settings = partial.settings;
    if (partial.tour) this._presentation.tour = partial.tour as PresentationState['tour'];
    if (partial.theme) this._presentation.theme = partial.theme;
    if (partial.panelPositions) this._presentation.panelPositions = partial.panelPositions;
    if (partial.entry) this._presentation.entry = partial.entry as PresentationState['entry'];
  }

  serialize(): NemosyneSessionJSON {
    const core = this._atlas.toState();
    return {
      schemaVersion: 2,
      savedAt: (typeof Date !== 'undefined' && Date.now) ? Date.now() : 0,
      datasetVersion: core.datasetVersion,
      datasetFingerprint: core.datasetFingerprint,
      originalDataset: core.originalDataset,
      currentDataset: core.currentDataset,
      entry: this._presentation.entry,
      datasetSpace: core.datasetSpace,
      analysisHistory: core.analysisHistory,
      analysisSpecs: core.analysisResults.map((r) => r.spec),
      analysisResults: core.analysisResults,
      eventLedger: core.eventLedger,
      activeRecommendation: core.activeRecommendation,
      decisionHistory: core.decisionHistory,
      structures: core.structures,
      researchContext: this._researchContext,
      presentation: this._presentation,
    };
  }

  /** Restore atlas state + presentation in place on the shared atlas. */
  loadFromJSON(json: NemosyneSessionJSON): void {
    this._atlas.restoreState(json);
    this._presentation = {
      camera: json.presentation?.camera ?? { position: [0, 0, 0], rotationY: 0 },
      settings: json.presentation?.settings ?? {},
      tour: json.presentation?.tour ?? { stepIndex: 0, finished: true },
      theme: json.presentation?.theme ?? 'neonMidnight',
      panelPositions: json.presentation?.panelPositions ?? [],
      entry: json.entry ?? json.presentation?.entry ?? { name: 'dataset' },
    };
    this._researchContext = json.researchContext ?? {};
  }

  /**
   * Reconstruct a NemosyneSession from a serialized JSON, restoring the passed
   * atlas in place. The returned session wraps the same atlas instance.
   */
  static deserialize(json: NemosyneSessionJSON, atlas: AtlasCore): NemosyneSession {
    atlas.restoreState(json);
    const session = new NemosyneSession({ atlas });
    session._presentation = {
      camera: json.presentation?.camera ?? { position: [0, 0, 0], rotationY: 0 },
      settings: json.presentation?.settings ?? {},
      tour: json.presentation?.tour ?? { stepIndex: 0, finished: true },
      theme: json.presentation?.theme ?? 'neonMidnight',
      panelPositions: json.presentation?.panelPositions ?? [],
      entry: json.entry ?? json.presentation?.entry ?? { name: 'dataset' },
    };
    session._researchContext = json.researchContext ?? {};
    return session;
  }
}
