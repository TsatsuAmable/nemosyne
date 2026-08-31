import type { AtlasCore } from '../../atlas/AtlasCore.ts';
import type { Dataset } from '../../data/Dataset.ts';
import { getDefaultEncodings } from '../../data/SampleDatasets.ts';
import type { TopologyType } from '../../data/types.ts';
import type { MonetaDataInput } from '../../moneta/types.ts';
import type { SemanticEmbodimentEnvelopeV1 } from '../../moneta/representation/SemanticEmbodimentPayload.ts';
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
  loadRelationshipGraphSemanticEmbodiment,
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
  semanticEmbodiment?: SemanticEmbodimentEnvelopeV1 | null;
  semanticEmbodimentPromise?: Promise<SemanticEmbodimentEnvelopeV1 | null>;
};

export interface LoadDatasetUseCaseOptions {
  preserveAnalyticalState?: boolean;
  requirements?: RepresentationRequirements;
  /** Session restore embodies the already-authoritative persisted decision. */
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

function numericOverviewDimensions(
  dataset: Dataset,
  encodings: Record<string, string | undefined>
): string[] {
  const candidates = [
    encodings.x,
    encodings.y,
    encodings.size,
    encodings.pulse,
    ...dataset.numericColumns.map((column) => column.name),
  ];
  const seen = new Set<string>();
  const dimensions: string[] = [];
  for (const candidate of candidates) {
    if (!candidate || seen.has(candidate)) continue;
    const column = dataset.getColumn(candidate);
    if (column?.type !== 'NUMERIC') continue;
    seen.add(candidate);
    dimensions.push(candidate);
    if (dimensions.length === 2) break;
  }
  return dimensions;
}

function disclosureContract() {
  return {
    enabled: true,
    levels: [
      { level: 0, distanceThreshold: 8, reveals: ['dataset-structure'] },
      { level: 1, distanceThreshold: 4, reveals: ['semantic-region', 'semantic-group'] },
      { level: 2, distanceThreshold: 1.5, reveals: ['observations-on-request'] },
    ],
  } as const;
}

/**
 * Fresh datasets start from the strongest source-authoritative dataset object
 * available without inventing analytical structure. Explicit source graphs get
 * graph intent. Other datasets begin with distribution/density overview over
 * explicit numeric measures. Exact observations remain a drill-down task.
 */
function createDatasetFirstRequirements(
  dataset: Dataset,
  topology: TopologyType,
  encodings: Record<string, string | undefined>
): RepresentationRequirements {
  if (topology === 'GRAPH' && (dataset.edges?.length ?? 0) > 0) {
    const graphRequirements = createDefaultRequirements('relationship-discovery');
    return {
      ...graphRequirements,
      preservationGoals: [
        { information: 'relational-edge-connectivity', priority: 'CRITICAL' },
        { information: 'individual-observation-identity', priority: 'DESIRED' },
      ],
      progressiveDisclosure: disclosureContract(),
    };
  }

  const requirements = createDefaultRequirements(
    'overview',
    numericOverviewDimensions(dataset, encodings)
  );
  return {
    ...requirements,
    progressiveDisclosure: disclosureContract(),
  };
}

function explicitClusterField(
  dataset: Dataset,
  requirements: RepresentationRequirements
): string {
  return (
    requirements.primaryDimensions?.find(
      (field) => dataset.getColumn(field)?.type === 'CATEGORICAL'
    ) ?? ''
  );
}

function explicitClusterMeasures(
  dataset: Dataset,
  requirements: RepresentationRequirements
): string[] {
  return (
    requirements.primaryDimensions?.filter(
      (field) => dataset.getColumn(field)?.type === 'NUMERIC'
    ).slice(0, 3) ?? []
  );
}

/**
 * Owns the logical dataset → Moneta decision transition.
 * Atlas remains the dataset/evidence/statistical authority. This use case only
 * sequences authoritative operations and returns a presentation-neutral result.
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
    if (!preserveAnalyticalState) {
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

    const activeRequirements = preserveAnalyticalState
      ? (requirements ?? createDefaultRequirements('individual-inspection'))
      : authoritativeRepresentation
        ? (requirements ?? createDefaultRequirements('individual-inspection'))
        : createDatasetFirstRequirements(
            embodiedDataset,
            topology,
            encodings as Record<string, string | undefined>
          );

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
        outcome = diagnoseInvestigatorOutcome(signature, activeRequirements, representationDecision);
      }
    } else if (this.atlas.isReady()) {
      try {
        representationDecision = this.atlas.arbitrateRepresentation(activeRequirements, dataInput);
        const signature = this.atlas.computeDatasetSignature(dataInput);
        outcome = diagnoseInvestigatorOutcome(signature, activeRequirements, representationDecision);
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
      dataInput.semanticEmbodimentPromise = loadClusterSemanticEmbodiment(
        this.atlas,
        embodiedDataset,
        representationDecision,
        explicitClusterField(embodiedDataset, activeRequirements),
        explicitClusterMeasures(embodiedDataset, activeRequirements)
      );
    } else if (representationDecision?.chosenCandidateId === 'RELATIONSHIP_GRAPH') {
      dataInput.semanticEmbodimentPromise = loadRelationshipGraphSemanticEmbodiment(
        this.atlas,
        embodiedDataset,
        representationDecision
      );
    }

    if (!preserveAnalyticalState) {
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
