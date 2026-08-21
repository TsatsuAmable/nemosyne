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

export interface AnalysisSpec {
  datasetFingerprint: string;
  datasetVersion: number;
  operation: OperationSpec;
  featureSelection?: string[];
  roles?: Record<string, 'color' | 'size' | 'pulse' | 'time' | 'label' | 'filter'>;
  normalization?: 'none' | 'minmax';
  missingness?: 'exclude-non-finite';
  seed?: number | null;
  algorithmVersion: string;
  label?: string;
}

export type EvidenceStatus = 'exploratory' | 'validated' | 'confirmatory';

export interface AnalysisResult {
  resultId: string;
  datasetFingerprint: string;
  datasetVersion: number;
  spec: AnalysisSpec;
  dataset: DatasetJSON;
  metrics?: Facts | null;
  diagnostics?: string[];
  warnings?: string[];
  provenance: Provenance | null;
  implementationVersion: string;
  outputHash: string;
  evidenceStatus: EvidenceStatus;
}

export type RecommendationDecision = 'pending' | 'accepted' | 'rejected' | 'overridden';

export type AnalyticalAction =
  | 'inspect-cluster'
  | 'inspect-boundary'
  | 'explore-region'
  | 'compare-regions'
  | 'investigate-anomaly';

export interface AnalyticalEvidence {
  type: string;
  value: number;
  source: string;
}

export interface VRCommand {
  action: AnalyticalAction;
  targetIds: string[];
  embodiment: string;
  sourceRecommendationId?: string;
  provenance?: Provenance | null;
}

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

export interface Observation {
  id: string;
  timestamp: number;
  author?: string;
  notes: string;
  spatialContext?: {
    position: [number, number, number];
    rotation?: [number, number, number, number];
    fov?: number;
  };
  targetIds?: string[];
  rowIndices?: number[];
  datasetFingerprint: string;
  datasetVersion: number;
  tags?: string[];
}

export interface Finding {
  id: string;
  timestamp: number;
  title: string;
  description: string;
  confidence: 'preliminary' | 'validated' | 'definitive';
  observationIds: string[];
  resultIds: string[];
  datasetFingerprint: string;
  datasetVersion: number;
  author?: string;
}

export interface Annotation {
  id: string;
  timestamp: number;
  text: string;
  position: [number, number, number];
  targetId?: string;
  author?: string;
}

export type ResearchEventKind =
  | 'load'
  | 'analysis'
  | 'structure'
  | 'recommendation'
  | 'embodiment'
  | 'preview'
  | 'undo'
  | 'redo'
  | 'seek'
  | 'reset'
  | 'observation'
  | 'finding'
  | 'annotation';

export interface ResearchEvent {
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
  observationEntity?: Observation;
  findingEntity?: Finding;
  annotationEntity?: Annotation;
  datasetVersion: number;
  datasetFingerprint: string;
  recommendationDecision?: RecommendationDecision;
  observation?: string;
  intervention?: string;
  deviation?: string;
  stateHash: string;
}

export interface ResearchContext {
  studyId?: string;
  researchQuestion?: string;
  hypothesis?: string;
  variablesOfInterest?: string[];
  currentTask?: string;
  observerMode?: boolean;
}

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
  observations?: Observation[];
  findings?: Finding[];
  annotations?: Annotation[];
  researchContext?: ResearchContext;
  investigationGraph?: import('./domain/InvestigationGraph.ts').InvestigationGraphJSON;
  representationDecision?: import('../moneta/representation/RepresentationDecision.ts').RepresentationDecision | null;
  discoveryEpisodes?: import('../investigation/DiscoveryEpisodeStore.ts').DiscoveryEpisodeStoreSnapshot;
}

export type { DatasetSpaceJSON, HistorySnapshot, EncodingMapping, JSONValue };
export type { DiscoveredStructure, StructureEvidence, StructureKind, StructureSet } from './structures.ts';
