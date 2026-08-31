import type { AtlasCore } from '../../atlas/AtlasCore.ts';
import type { Dataset } from '../../data/Dataset.ts';
import { getDefaultEncodings } from '../../data/SampleDatasets.ts';
import type { TopologyType } from '../../data/types.ts';
import type { MonetaDataInput } from '../../moneta/types.ts';
import type { ProductionSemanticEmbodimentEnvelopeV1 } from '../../moneta/representation/ClusterEmbodimentPayload.ts';
import {
  diagnoseInvestigatorOutcome,
  type InvestigatorActionableOutcome,
} from '../../moneta/representation/ActionableNil.ts';
import { NoFeasibleRepresentationError } from '../../moneta/representation/NoFeasibleRepresentationError.ts';
import type { RepresentationDecision } from '../../moneta/representation/RepresentationDecision.ts';
import {
  createDefaultRequirements,
  type RepresentationRequirements,
} from '../../moneta/representation/RepresentationRequirements.ts';
import { WorldTopics } from '../../utils/EventBus.ts';
import type { DatasetLoadEntry } from '../../vr/coordinators/types.ts';
import {
  loadAggregateSemanticEmbodiment,
  loadClusterSemanticEmbodiment,
  loadDensitySemanticEmbodiment,
  loadDistributionSemanticEmbodiment,
} from './SemanticEmbodimentLoader.ts';

export type DatasetLoadAuthority = Pick<
  AtlasCore,
  | 'setOriginalDataset'
  | 'setCurrentDataset'
  | 'dataset'
  | 'isReady'
  | 'inferEncodings'
  | 'arbitrateRepresentation'
  | 'computeDatasetSignature'
  | 'executionPort'
  | 'generation'
  | 'datasetVersion'
  | 'datasetFingerprint'
> &
  Partial<Pick<AtlasCore, 'eventBus'>>;

type SemanticMonetaDataInput = MonetaDataInput & {
  semanticEmbodiment?: ProductionSemanticEmbodimentEnvelopeV1 | null;
  semanticEmbodimentPromise?: Promise<ProductionSemanticEmbodimentEnvelopeV1 | null>;
  semanticEmbodimentCandidateId?: 'CLUSTER_REGIONS';
};

export interface LoadDatasetUseCaseOptions {
  preserveAnalyticalState?: boolean;
  requirements?: RepresentationRequirements;
  /**
   * Session restore embodies the already-authoritative persisted decision
   * without committing a fresh Moneta arbitration result.
   */
  authoritativeRepresentation?: { decision: RepresentationDecision | null };
}

export interface LoadDatasetResult {
  entry: DatasetLoadEntry;
  embodiedDataset: Dataset;
  dataInput: MonetaDataInput;
  requirements: RepresentationRequirements;
  representationDecision: RepresentationDecision | null;
  outcome: InvestigatorActionableOutcome | null;
}

/**
 * Owns the logical dataset → Moneta decision transition.
 *
 * Atlas remains the dataset/evidence/statistical authority. This use case only
 * sequences authoritative operations and returns a presentation-neutral result;
 * it does not construct Three.js resources, panels, dashboards, or analytical
 * fallbacks.
 */
export class LoadDatasetUseCase {
  constructor(private readonly atlas: DatasetLoadAuthority) {}

  execute(
    entry: DatasetLoadEntry,
    {
      preserveAnalyticalState = false,
      requirements,
      authoritativeRepresentation,
    }: LoadDatasetUseCaseOptions = {}
  ): LoadDatasetResult {
    // A fresh dataset should first be understood as a dataset, not as a request
    // to inspect every observation. Individual inspection remains available as
    // an explicit/preserved analytical intent, but it is no longer the hidden
    // default that biases initial representation arbitration toward point-like
    // identity-preserving candidates.
    const activeRequirements = preserveAnalyticalState
      ? (requirements ?? createDefaultRequirements('individual-inspection'))
      : createDefaultRequirements('overview');

    if (!preserveAnalyticalState) {
      // Preserve the existing production semantics exactly: Atlas first loads
      // a cloned baseline, then receives a second clone as the mutable current
      // dataset. `setOriginalDataset` is the authoritative load/ledger/version
      // transition; `setCurrentDataset` only establishes the working copy.
      const originalDataset = entry.dataset.clone();
      this.atlas.setOriginalDataset(originalDataset);
      this.atlas.setCurrentDataset(originalDataset.clone());
    }

    const embodiedDataset = this.atlas.dataset;
    const topology = entry.topology as TopologyType;
    const kernelEncodings = this.atlas.inferEncodings(topology) ?? undefined;
    const encodings =
      entry.encodings ??
      kernelEncodings ??
      getDefaultEncodings({ dataset: embodiedDataset, topology });
    const dataInput: SemanticMonetaDataInput = {
      topology,
      dataset: embodiedDataset,
      maxDepth: entry.maxDepth,
      encodings,
    };

    let representationDecision: RepresentationDecision | null = null;
    let outcome: InvestigatorActionableOutcome | null = null;

    if (authoritativeRepresentation) {
      representationDecision = authoritativeRepresentation.decision;
      if (representationDecision) {
        const signature = this.atlas.computeDatasetSignature(dataInput);
        outcome = diagnoseInvestigatorOutcome(
          signature,
          activeRequirements,
          representationDecision
        );
      }
    } else if (this.atlas.isReady()) {
      try {
        representationDecision = this.atlas.arbitrateRepresentation(activeRequirements, dataInput);
        const signature = this.atlas.computeDatasetSignature(dataInput);
        outcome = diagnoseInvestigatorOutcome(
          signature,
          activeRequirements,
          representationDecision
        );
      } catch (error) {
        if (!(error instanceof NoFeasibleRepresentationError)) throw error;
        const signature = this.atlas.computeDatasetSignature(dataInput);
        outcome = diagnoseInvestigatorOutcome(signature, activeRequirements, error);
      }
    }

    if (representationDecision?.chosenCandidateId === 'AGGREGATE_VOLUME') {
      dataInput.semanticEmbodimentPromise = loadAggregateSemanticEmbodiment(
        this.atlas,
        embodiedDataset,
        representationDecision,
        encodings
      );
    } else if (representationDecision?.chosenCandidateId === 'DISTRIBUTION_FIELD') {
      dataInput.semanticEmbodimentPromise = loadDistributionSemanticEmbodiment(
        this.atlas,
        embodiedDataset,
        representationDecision,
        activeRequirements.primaryDimensions?.[0] ?? ''
      );
    } else if (representationDecision?.chosenCandidateId === 'DENSITY_FIELD') {
      dataInput.semanticEmbodimentPromise = loadDensitySemanticEmbodiment(
        this.atlas,
        embodiedDataset,
        representationDecision,
        activeRequirements.primaryDimensions?.[0] ?? '',
        activeRequirements.primaryDimensions?.[1] ?? ''
      );
    } else if (representationDecision?.chosenCandidateId === 'CLUSTER_REGIONS') {
      dataInput.semanticEmbodimentCandidateId = 'CLUSTER_REGIONS';
      dataInput.semanticEmbodimentPromise = loadClusterSemanticEmbodiment(
        this.atlas,
        embodiedDataset,
        representationDecision,
        activeRequirements.clusterAuthority?.kind === 'SOURCE_PARTITION'
          ? activeRequirements.clusterAuthority.field
          : '',
        activeRequirements.primaryDimensions ?? []
      );
    }

    if (!preserveAnalyticalState) {
      // Cross-cutting UI consumers observe the authoritative logical dataset
      // transition through the existing event bus rather than polling or
      // maintaining a second dataset identity.
      this.atlas.eventBus?.emit(WorldTopics.DATASET_LOADED, {
        key: entry.key ?? null,
        name: entry.name ?? null,
        label: entry.label ?? null,
        datasetName: embodiedDataset.name,
        datasetVersion: this.atlas.datasetVersion,
        datasetFingerprint: this.atlas.datasetFingerprint,
      });
    }

    return {
      entry,
      embodiedDataset,
      dataInput,
      requirements: activeRequirements,
      representationDecision,
      outcome,
    };
  }
}