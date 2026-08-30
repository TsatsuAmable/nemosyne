/**
 * NemosyneSession — the authoritative logical session.
 *
 * Wave 4: snapshot authority moves here from WorldSessionController. The
 * schemaVersion-2 JSON persists the AtlasCore state plus presentation state.
 */

import type { EncodingMapping } from '../data/types.ts';
import {
  CANONICAL_DATASET_IDENTITY_ALGORITHM,
  canonicalDatasetIdentityHex,
} from '../data/DatasetIdentity.ts';
import { AtlasCore } from '../atlas/AtlasCore.ts';
import type { AnalysisSpec, AtlasCoreState, ResearchContext } from '../atlas/types.ts';
import {
  INVESTIGATION_DIGEST_ALGORITHM,
  NoFeasibleRepresentationStore,
  type NoFeasibleRepresentationRecord,
  type NoFeasibleRepresentationStoreSnapshot,
} from '../investigation/index.ts';
import {
  NEMOSYNE_PACKAGE_FORMAT_VERSION,
  NemosynePackageManager,
  type NemosynePackageManifest,
} from './NemosynePackage.ts';
import { strToU8 } from 'fflate';

export interface PresentationState {
  camera: { position: [number, number, number]; rotationY: number };
  settings: Record<string, unknown>;
  tour: { stepIndex: number; finished: boolean };
  theme: string;
  panelPositions: Array<unknown>;
  entry: { name: string; topology?: string; encodings?: EncodingMapping; maxDepth?: number };
  /**
   * RF-025: durable focus/context snapshot for the Memory Palace. Camera pose
   * is intentionally excluded (presentation state, not investigation state);
   * only the semantic level + focused structure identity are portable.
   */
  focus?: { currentLevel: string; focusedStructureId: string | null };
}

export interface PortablePackageEnvironment {
  userAgent?: string | null;
  platform?: string | null;
  webxrSupported?: boolean | null;
}

export interface NemosyneSessionJSON extends AtlasCoreState {
  schemaVersion: 2;
  savedAt: number;
  entry: PresentationState['entry'];
  analysisSpecs: AnalysisSpec[];
  presentation: PresentationState;
  nilOutcomes?: NoFeasibleRepresentationStoreSnapshot;
}

export class NemosyneSession {
  private _atlas: AtlasCore;
  private _sessionId: string;
  private _presentation: PresentationState;
  private _researchContext: ResearchContext;
  private _nilOutcomes = new NoFeasibleRepresentationStore();

  constructor({ atlas, sessionId }: { atlas: AtlasCore; sessionId?: string }) {
    this._atlas = atlas;
    this._sessionId = sessionId ?? atlas.sessionId;
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

  get atlas(): AtlasCore { return this._atlas; }
  get sessionId(): string { return this._sessionId; }
  get presentation(): PresentationState { return this._presentation; }
  get researchContext(): ResearchContext { return this._researchContext; }
  get nilOutcomes(): readonly NoFeasibleRepresentationRecord[] { return this._nilOutcomes.all(); }

  setResearchContext(ctx: Partial<ResearchContext>): void {
    this._researchContext = { ...this._researchContext, ...ctx };
  }

  recordNoFeasibleRepresentation(record: NoFeasibleRepresentationRecord): void {
    this._nilOutcomes.record(record);
  }

  recordObservation(observation: string): void { this._atlas.recordObservation(observation); }
  recordIntervention(intervention: string): void { this._atlas.recordIntervention(intervention); }

  setPresentation(partial: Partial<PresentationState>): void {
    if (partial.camera) this._presentation.camera = partial.camera as PresentationState['camera'];
    if (partial.settings) this._presentation.settings = partial.settings;
    if (partial.tour) this._presentation.tour = partial.tour as PresentationState['tour'];
    if (partial.theme) this._presentation.theme = partial.theme;
    if (partial.panelPositions) this._presentation.panelPositions = partial.panelPositions;
    if (partial.entry) this._presentation.entry = partial.entry as PresentationState['entry'];
    if (partial.focus) this._presentation.focus = partial.focus;
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
      observations: core.observations,
      findings: core.findings,
      annotations: core.annotations,
      investigationGraph: core.investigationGraph,
      representationDecision: core.representationDecision,
      discoveryEpisodes: core.discoveryEpisodes,
      nilOutcomes: this._nilOutcomes.toJSON(),
      researchContext: this._researchContext,
      presentation: this._presentation,
    };
  }

  async exportPortablePackage(
    environment: PortablePackageEnvironment = {},
    kernelVersionOverride?: string
  ): Promise<Uint8Array> {
    const core = this._atlas.toState();
    if (!core.originalDataset) {
      throw new Error('Cannot export portable investigation without an original dataset');
    }

    const originalDataset = this._atlas.originalDataset;
    const originalDatasetFingerprint = canonicalDatasetIdentityHex(core.originalDataset);
    const representationDecision = core.representationDecision;
    const discoveryEpisodes = core.discoveryEpisodes;
    const nilOutcomes = this._nilOutcomes.toJSON();
    const nilProvenance = nilOutcomes.outcomes[0]?.provenance;
    const fitnessModelVersion =
      representationDecision?.fitnessModelVersion ??
      representationDecision?.provenance.fitnessModelVersion;
    const kernelVersion = kernelVersionOverride ?? this._atlas.kernelVersion() ?? 'unknown';
    const investigationDigest = await this._atlas.aggregate.computeDigest(kernelVersion, {
      nilOutcomes: nilOutcomes.outcomes,
      researchContext: this._researchContext,
    });

    const manifest: NemosynePackageManifest = {
      formatVersion: NEMOSYNE_PACKAGE_FORMAT_VERSION,
      sessionId: this._sessionId,
      datasetFingerprint: originalDatasetFingerprint,
      datasetIdentityAlgorithm: CANONICAL_DATASET_IDENTITY_ALGORITHM,
      analyticalDatasetFingerprint:
        representationDecision?.datasetFingerprint ??
        nilProvenance?.datasetFingerprint ??
        core.datasetFingerprint ??
        originalDatasetFingerprint,
      datasetName: originalDataset.name,
      kernelVersion,
      analyticalKernelVersion:
        representationDecision?.kernelVersion ?? nilProvenance?.kernelVersion,
      createdAt: typeof Date !== 'undefined' && Date.now ? Date.now() : 0,
      commandCount: core.eventLedger.length,
      discoveryCount: discoveryEpisodes?.episodes.length ?? 0,
      nilOutcomeCount: nilOutcomes.outcomes.length,
      investigationDigest,
      investigationDigestAlgorithm: INVESTIGATION_DIGEST_ALGORITHM,
      researchContext: this._researchContext,
      representationModel:
        representationDecision && fitnessModelVersion
          ? {
              fitnessModelVersion,
              fitnessModelArtifactHash:
                representationDecision.fitnessModelArtifactHash ??
                representationDecision.provenance.fitnessModelArtifactHash ??
                null,
            }
          : undefined,
      evidenceSummary: {
        observationsCount: core.observations?.length ?? 0,
        findingsCount: core.findings?.length ?? 0,
        annotationsCount: core.annotations?.length ?? 0,
      },
      environment,
    };

    return NemosynePackageManager.pack({
      manifest,
      datasetBytes: strToU8(JSON.stringify(core.originalDataset)),
      commandLogBytes: strToU8(JSON.stringify(core.eventLedger)),
      representationDecisionBytes: representationDecision
        ? strToU8(JSON.stringify(representationDecision))
        : undefined,
      discoveryEpisodesBytes:
        discoveryEpisodes && discoveryEpisodes.episodes.length > 0
          ? strToU8(JSON.stringify(discoveryEpisodes))
          : undefined,
      nilOutcomesBytes:
        nilOutcomes.outcomes.length > 0 ? strToU8(JSON.stringify(nilOutcomes)) : undefined,
    });
  }

  /** Export a persisted snapshot in isolation from the mutable live Atlas/session. */
  static async exportPortableSnapshot(
    json: NemosyneSessionJSON,
    environment: PortablePackageEnvironment = {}
  ): Promise<Uint8Array> {
    const atlas = new AtlasCore({ kernel: null });
    const session = NemosyneSession.deserialize(json, atlas);
    const lastImplementationVersion = [...json.analysisResults]
      .reverse()
      .find((result) => typeof result.implementationVersion === 'string')
      ?.implementationVersion;
    const archivedKernelVersion =
      json.representationDecision?.kernelVersion ?? lastImplementationVersion ?? 'unknown';
    return session.exportPortablePackage(environment, archivedKernelVersion);
  }

  loadFromJSON(json: NemosyneSessionJSON): void {
    this._atlas.restoreState(json);
    this._nilOutcomes.reset();
    if (json.nilOutcomes) this._nilOutcomes.restore(json.nilOutcomes);
    this._presentation = {
      camera: json.presentation?.camera ?? { position: [0, 0, 0], rotationY: 0 },
      settings: json.presentation?.settings ?? {},
      tour: json.presentation?.tour ?? { stepIndex: 0, finished: true },
      theme: json.presentation?.theme ?? 'neonMidnight',
      panelPositions: json.presentation?.panelPositions ?? [],
      entry: json.entry ?? json.presentation?.entry ?? { name: 'dataset' },
      focus: json.presentation?.focus,
    };
    this._researchContext = json.researchContext ?? {};
  }

  static deserialize(json: NemosyneSessionJSON, atlas: AtlasCore): NemosyneSession {
    atlas.restoreState(json);
    const session = new NemosyneSession({ atlas });
    if (json.nilOutcomes) session._nilOutcomes.restore(json.nilOutcomes);
    session._presentation = {
      camera: json.presentation?.camera ?? { position: [0, 0, 0], rotationY: 0 },
      settings: json.presentation?.settings ?? {},
      tour: json.presentation?.tour ?? { stepIndex: 0, finished: true },
      theme: json.presentation?.theme ?? 'neonMidnight',
      panelPositions: json.presentation?.panelPositions ?? [],
      entry: json.entry ?? json.presentation?.entry ?? { name: 'dataset' },
      focus: json.presentation?.focus,
    };
    session._researchContext = json.researchContext ?? {};
    return session;
  }
}
