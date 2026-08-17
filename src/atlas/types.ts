/**
 * Wave 4 governance types: the authoritative analytical-session contract.
 *
 * `AnalysisSpec` is the typed command issued to {@link AtlasCore} (the sole
 * analytical authority for the operation path). `AnalysisResult` carries the
 * kernel provenance envelope for every analytical transformation. The
 * `ResearchEvent` ledger records the full provenance chain (load / analysis /
 * preview / undo / redo / seek / reset). `AtlasRecommendation` tracks
 * recommender decisions against the ledger.
 *
 * These types are the serialisable boundary persisted by {@link NemosyneSession}
 * (schemaVersion 2). No production code may choose between analytical
 * implementations at runtime — every `AnalysisResult` is produced through the
 * versioned Rust kernel.
 */

import type {
  DatasetJSON,
  EncodingMapping,
  Facts,
  JSONValue,
  OperationSpec,
  Provenance,
} from '../data/types.ts';
import type { DatasetSpaceJSON } from './DatasetSpace.ts';
import type { HistorySnapshot } from '../data/AnalysisHistory.ts';
import type { StructureSet } from './structures.ts';

/**
 * Typed analytical command wrapping a kernel {@link OperationSpec}. Built by
 * `toAnalysisSpec` from a high-level operation name plus the live AtlasCore
 * state (fingerprint, version, kernel version, median thunk).
 */
export interface AnalysisSpec {
  /** Fingerprint of the dataset the spec is built against. */
  datasetFingerprint: string;
  /** AtlasCore dataset version at spec build time. */
  datasetVersion: number;
  /** The kernel operation spec (built by `toKernelSpec`). */
  operation: OperationSpec;
  /** Optional feature subset the analysis targets. */
  featureSelection?: string[];
  /** Optional role assignments for downstream embodiment. */
  roles?: Record<string, 'color' | 'size' | 'pulse' | 'time' | 'label' | 'filter'>;
  /** Normalization mode; defaults to 'none'. */
  normalization?: 'none' | 'minmax';
  /** Missing-value policy; defaults to 'exclude-non-finite'. */
  missingness?: 'exclude-non-finite';
  /** RNG seed for reproducible stochastic ops (clustering, sampling). */
  seed?: number | null;
  /** Kernel version captured at spec build time. */
  algorithmVersion: string;
  /** Human operation name ('filter', 'sort', ...) for history/narrative. */
  label?: string;
}

/** Evidence classification for an analytical result. */
export type EvidenceStatus = 'exploratory' | 'validated' | 'confirmatory';

/**
 * Authoritative result of a single analytical operation. Carries the kernel
 * provenance envelope (`provenance`), the output dataset, and a deterministic
 * `resultId`/`outputHash`. `provenance` is `null` only for mock kernels that
 * emit no envelope — never fabricated.
 */
export interface AnalysisResult {
  /** Deterministic: `${datasetFingerprint}:${datasetVersion}:${operation.op}:${index}`. */
  resultId: string;
  datasetFingerprint: string;
  datasetVersion: number;
  spec: AnalysisSpec;
  /** The output dataset (post-op) as JSON. */
  dataset: DatasetJSON;
  /** Kernel statistics over the output, when computed. */
  metrics?: Facts | null;
  diagnostics?: string[];
  warnings?: string[];
  /** Kernel provenance envelope (from `bridge.kernelProvenance()`). */
  provenance: Provenance | null;
  /** Kernel version that produced the result. */
  implementationVersion: string;
  /** Canonical FNV-1a hash over the result dataset. */
  outputHash: string;
  /** Default 'exploratory'. */
  evidenceStatus: EvidenceStatus;
}

/** Decision recorded against an {@link AtlasRecommendation}. */
export type RecommendationDecision = 'pending' | 'accepted' | 'rejected' | 'overridden';

/**
 * Typed analytical action vocabulary for {@link AtlasRecommendation}. Maps to
 * the structure kinds produced by Atlas 2: clusters → `INSPECT_CLUSTER`,
 * persistence boundaries → `INSPECT_BOUNDARY`, mapper regions → `EXPLORE_REGION`.
 */
export type AnalyticalAction =
  | 'inspect-cluster'
  | 'inspect-boundary'
  | 'explore-region'
  | 'compare-regions'
  | 'investigate-anomaly';

/**
 * Structured evidence item linking a recommendation to a specific
 * {@link DiscoveredStructure} and its measurable evidence value.
 */
export interface AnalyticalEvidence {
  type: string;
  value: number;
  source: string;
}

/**
 * Semantic VR embodiment command carrying analytical target IDs and
 * provenance. Atlas 4: commands operate on analytical IDs (structure IDs)
 * rather than mutating Three.js state directly. The executor resolves
 * targetIds to rowIndices via {@link DiscoveredStructure} and applies
 * embodiment actions through a single scoped artefact applier.
 */
export interface VRCommand {
  action: AnalyticalAction;
  targetIds: string[];
  embodiment: string;
  sourceRecommendationId?: string;
  provenance?: Provenance | null;
}

/**
 * Recommender output tracked by AtlasCore. Decisions are recorded against the
 * ledger so accepted/rejected/overridden recommendations remain auditable.
 */
export interface AtlasRecommendation {
  targetIds: string[];
  action: AnalyticalAction;
  rationale: string;
  evidence: string;
  evidenceItems?: AnalyticalEvidence[];
  confidence: number;
  limitations?: string;
  suggestedEmbodiment?: string;
  provenance?: Provenance | null;
  decision: RecommendationDecision;
}

/** Kind of a {@link ResearchEvent}. */
export type ResearchEventKind = 'load' | 'analysis' | 'structure' | 'recommendation' | 'embodiment' | 'preview' | 'undo' | 'redo' | 'seek' | 'reset';

/**
 * Ledger entry recording one state transition of the analytical session. Every
 * analytical result embeds its `AnalysisResult`; cursor moves (undo/redo/seek)
 * record the index. `stateHash` is the DatasetSpace fingerprint of the
 * post-state.
 */
export interface ResearchEvent {
  /** Deterministic monotonic id. */
  eventId: string;
  sessionId?: string;
  actor?: string;
  role?: string;
  timestamp: number;
  kind: ResearchEventKind;
  command: AnalysisSpec | { op: ResearchEventKind; index?: number };
  result?: AnalysisResult;
  structureSet?: StructureSet;
  embodimentCommand?: VRCommand;
  datasetVersion: number;
  datasetFingerprint: string;
  recommendationDecision?: RecommendationDecision;
  observation?: string;
  intervention?: string;
  deviation?: string;
  /** DatasetSpace fingerprint of the post-state. */
  stateHash: string;
}

/**
 * Research context for the analytical session. Atlas 5: extends session
 * persistence with study-level metadata that travels with the ledger.
 */
export interface ResearchContext {
  studyId?: string;
  researchQuestion?: string;
  hypothesis?: string;
  variablesOfInterest?: string[];
  currentTask?: string;
  observerMode?: boolean;
}

/**
 * Snapshot of AtlasCore for serialization. Persisted by
 * {@link NemosyneSession} as part of the schemaVersion-2 session JSON. Field
 * names match the persisted JSON shape (analysisHistory / analysisResults /
 * eventLedger) so `NemosyneSessionJSON extends AtlasCoreState`.
 */
export interface AtlasCoreState {
  datasetVersion: number;
  datasetFingerprint: string | null;
  originalDataset: DatasetJSON | null;
  currentDataset: DatasetJSON | null;
  datasetSpace: DatasetSpaceJSON | null;
  analysisResults: AnalysisResult[];
  eventLedger: ResearchEvent[];
  analysisHistory: HistorySnapshot;
  activeRecommendation: AtlasRecommendation | null;
  decisionHistory: AtlasRecommendation[];
  structures: StructureSet[];
  researchContext?: ResearchContext;
}

/** Re-exported for downstream consumers (NemosyneSession). */
export type { DatasetSpaceJSON, HistorySnapshot, EncodingMapping, JSONValue };
export type { DiscoveredStructure, StructureEvidence, StructureKind, StructureSet } from './structures.ts';
