import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { buildClusterSemanticRegions } from '../src/moneta/embodiment/ClusterSemanticEmbodiment.ts';
import { buildDensitySemanticField } from '../src/moneta/embodiment/DensitySemanticEmbodiment.ts';
import { ScalableTopologyEmbodiment } from '../src/moneta/embodiment/ScalableTopologyEmbodiment.ts';
import { TopologyLayoutEmbodiment } from '../src/moneta/embodiment/TopologyLayoutEmbodiment.ts';
import { VRTopologyTranslator } from '../src/moneta/VRTopologyTranslator.ts';
import type {
  ClusterEmbodimentEnvelopeV1,
  ProductionSemanticEmbodimentEnvelopeV1,
} from '../src/moneta/representation/ClusterEmbodimentPayload.ts';
import {
  MONETA_REPRESENTATION_CANDIDATES,
  type SemanticRepresentationId,
} from '../src/moneta/representation/RepresentationCandidate.ts';
import { FAMILY_TO_CANDIDATE_IDS } from '../src/moneta/representation/RepresentationFamily.ts';
import type { SemanticEmbodimentEnvelopeV1 } from '../src/moneta/representation/SemanticEmbodimentPayload.ts';
import type {
  MonetaDataInput,
  MonetaFacts,
  SolverResult,
  VRGeometry,
  VRLayout,
} from '../src/moneta/types.ts';
import { disposeObject } from '../src/utils/Dispose.ts';

type EmbodimentClassification =
  | 'OBSERVATION_LEVEL'
  | 'DATASET_LEVEL_VALID'
  | 'DATASET_LEVEL_ROW_DERIVED'
  | 'SEMANTICALLY_OVERCLAIMED'
  | 'NOT_PRODUCTION_REACHABLE';

interface InventoryEntry {
  classification: EmbodimentClassification;
  productionReachable: boolean;
  layout: VRLayout;
  geometry: VRGeometry;
}

const INVENTORY: Record<SemanticRepresentationId, InventoryEntry> = {
  POINT_SET: { classification: 'OBSERVATION_LEVEL', productionReachable: true, layout: 'GRID_3D', geometry: 'CUBE_MATRIX' },
  DENSITY_FIELD: { classification: 'DATASET_LEVEL_VALID', productionReachable: true, layout: 'GRID_3D', geometry: 'DENSITY_FIELD' },
  DISTRIBUTION_FIELD: { classification: 'DATASET_LEVEL_VALID', productionReachable: true, layout: 'GRID_3D', geometry: 'DISTRIBUTION_FIELD' },
  CLUSTER_REGIONS: { classification: 'DATASET_LEVEL_VALID', productionReachable: true, layout: 'GRID_3D', geometry: 'CLUSTER_VOLUME' },
  AGGREGATE_VOLUME: { classification: 'DATASET_LEVEL_VALID', productionReachable: true, layout: 'GRID_3D', geometry: 'AGGREGATE_BARS' },
  TEMPORAL_TRAJECTORY: { classification: 'DATASET_LEVEL_ROW_DERIVED', productionReachable: true, layout: 'TIME_RIBBON', geometry: 'BEAM' },
  HIERARCHICAL_SPACE: { classification: 'DATASET_LEVEL_ROW_DERIVED', productionReachable: true, layout: 'RADIAL_ORBITAL', geometry: 'CONICAL_TREE' },
  RELATIONSHIP_GRAPH: { classification: 'DATASET_LEVEL_ROW_DERIVED', productionReachable: true, layout: 'FORCE_DIRECTED_3D', geometry: 'ICOSA_NODE' },
  MATRIX_FIELD: { classification: 'OBSERVATION_LEVEL', productionReachable: true, layout: 'GRID_3D', geometry: 'CUBE_MATRIX' },
  MANIFOLD_EMBEDDING: { classification: 'SEMANTICALLY_OVERCLAIMED', productionReachable: true, layout: 'FORCE_DIRECTED_3D', geometry: 'ICOSA_NODE' },
  SPATIAL_REGION: { classification: 'OBSERVATION_LEVEL', productionReachable: true, layout: 'GEO_SURFACE', geometry: 'GEO_COLUMN' },
  MULTISCALE_FIELD: { classification: 'SEMANTICALLY_OVERCLAIMED', productionReachable: true, layout: 'SPECTRAL_VOLUME', geometry: 'SPECTRAL_BAR' },
};

const RAW_ROW_SENTINEL = 'A2_RAW_ROWS_ACCESSED';

function aggregateEnvelope(): SemanticEmbodimentEnvelopeV1 {
  return {
    schemaVersion: 1,
    datasetFingerprint: 'a'.repeat(64),
    candidateId: 'AGGREGATE_VOLUME',
    representationFamily: 'AGGREGATE',
    analyticalMethod: { name: 'categorical-grouped-aggregate', version: 'aggregate-columnar-v1', parameters: {} },
    approximation: { mode: 'EXACT', representedRowCount: 6 },
    informationContract: {
      preserves: ['aggregate-group-magnitude'],
      loses: ['individual-observation-identity', 'exact-metric-values', 'outlier-boundary-visibility'],
    },
    resource: { sourceRowCount: 6, elementCount: 3, maxElementCount: 4096 },
    provenance: { kernelVersion: 'test', algorithmVersion: 'aggregate-columnar-v1' },
    result: {
      status: 'READY',
      payload: {
        kind: 'AGGREGATE_VOLUME',
        data: {
          groupingFields: ['group'],
          measure: { field: 'value', function: 'MEAN' },
          groups: [
            { semanticId: 'aggregate-group:00000', key: 'a', count: 2, aggregateValue: 1 },
            { semanticId: 'aggregate-group:00001', key: 'b', count: 2, aggregateValue: 2 },
            { semanticId: 'aggregate-group:00002', key: 'c', count: 2, aggregateValue: 3 },
          ],
        },
      },
    },
  };
}

function distributionEnvelope(): SemanticEmbodimentEnvelopeV1 {
  return {
    schemaVersion: 1,
    datasetFingerprint: 'b'.repeat(64),
    candidateId: 'DISTRIBUTION_FIELD',
    representationFamily: 'DISTRIBUTION',
    analyticalMethod: { name: 'univariate-empirical-distribution', version: 'empirical-distribution-columnar-v1', parameters: {} },
    approximation: { mode: 'BINNED', representedRowCount: 6 },
    informationContract: {
      preserves: ['empirical-distribution-shape'],
      loses: ['individual-observation-identity', 'exact-metric-values', 'population-density-distribution', 'outlier-boundary-visibility'],
    },
    resource: { sourceRowCount: 6, elementCount: 9, maxElementCount: 544 },
    provenance: { kernelVersion: 'test', algorithmVersion: 'empirical-distribution-columnar-v1', decisionId: 'decision-a2-distribution' },
    result: {
      status: 'READY',
      payload: {
        kind: 'EMPIRICAL_DISTRIBUTION',
        data: {
          measureField: 'value',
          domain: { min: 0, max: 6 },
          counts: { sourceCount: 6, validCount: 6, excludedCount: 0 },
          histogram: [
            { semanticId: 'distribution-bin:000', lowerBound: 0, upperBound: 2, count: 2, upperInclusive: false },
            { semanticId: 'distribution-bin:001', lowerBound: 2, upperBound: 4, count: 2, upperInclusive: false },
            { semanticId: 'distribution-bin:002', lowerBound: 4, upperBound: 6, count: 2, upperInclusive: true },
          ],
          ecdf: [
            { semanticId: 'distribution-ecdf:000', value: 0, cumulativeCount: 1, cumulativeProbability: 1 / 6 },
            { semanticId: 'distribution-ecdf:001', value: 3, cumulativeCount: 3, cumulativeProbability: 0.5 },
            { semanticId: 'distribution-ecdf:002', value: 6, cumulativeCount: 6, cumulativeProbability: 1 },
          ],
          quantiles: [
            { semanticId: 'distribution-quantile:000', probability: 0, value: 0 },
            { semanticId: 'distribution-quantile:001', probability: 0.5, value: 3 },
            { semanticId: 'distribution-quantile:002', probability: 1, value: 6 },
          ],
        },
      },
    },
  };
}

function densityEnvelope(): SemanticEmbodimentEnvelopeV1 {
  return {
    schemaVersion: 1,
    datasetFingerprint: 'd'.repeat(64),
    candidateId: 'DENSITY_FIELD',
    representationFamily: 'DENSITY',
    analyticalMethod: {
      name: 'bivariate-binned-density',
      version: 'binned-density-contract-v1',
      parameters: {
        binning: 'equal-width',
        interval: 'left-closed-right-open-final-closed',
        excludedPolicy: 'canonical-invalid-exclude-and-count',
        constantDomain: 'assign-final-bin-per-degenerate-axis',
      },
    },
    approximation: { mode: 'BINNED', representedRowCount: 6 },
    informationContract: {
      preserves: ['empirical-bivariate-bin-mass'],
      loses: ['individual-observation-identity', 'exact-metric-values', 'population-density-distribution', 'empirical-distribution-shape', 'outlier-boundary-visibility'],
    },
    resource: { sourceRowCount: 6, elementCount: 4, maxElementCount: 400 },
    provenance: { kernelVersion: 'test', algorithmVersion: 'bivariate-binned-density-columnar-v1', decisionId: 'decision-a2-density' },
    result: {
      status: 'READY',
      payload: {
        kind: 'BINNED_DENSITY',
        data: {
          measureFieldX: 'x',
          measureFieldY: 'y',
          domainX: { min: 0, max: 2 },
          domainY: { min: 0, max: 2 },
          counts: { sourceCount: 6, validCount: 6, excludedCount: 0 },
          binsX: 2,
          binsY: 2,
          grid: [
            { semanticId: 'density-cell:0:0', xIndex: 0, yIndex: 0, xLowerBound: 0, xUpperBound: 1, yLowerBound: 0, yUpperBound: 1, count: 2, xUpperInclusive: false, yUpperInclusive: false },
            { semanticId: 'density-cell:1:0', xIndex: 1, yIndex: 0, xLowerBound: 1, xUpperBound: 2, yLowerBound: 0, yUpperBound: 1, count: 1, xUpperInclusive: true, yUpperInclusive: false },
            { semanticId: 'density-cell:0:1', xIndex: 0, yIndex: 1, xLowerBound: 0, xUpperBound: 1, yLowerBound: 1, yUpperBound: 2, count: 1, xUpperInclusive: false, yUpperInclusive: true },
            { semanticId: 'density-cell:1:1', xIndex: 1, yIndex: 1, xLowerBound: 1, xUpperBound: 2, yLowerBound: 1, yUpperBound: 2, count: 2, xUpperInclusive: true, yUpperInclusive: true },
          ],
        },
      },
    },
  };
}

function clusterEnvelope(): ClusterEmbodimentEnvelopeV1 {
  return {
    schemaVersion: 1,
    datasetFingerprint: 'c'.repeat(64),
    candidateId: 'CLUSTER_REGIONS',
    representationFamily: 'CLUSTER',
    analyticalMethod: {
      name: 'source-partition-cluster-summary',
      version: 'source-partition-cluster-summary-v1',
      parameters: {
        partitionField: 'group',
        coordinateFields: ['x', 'y'],
        membershipAuthority: 'source-partition',
        coordinateValidity: 'complete-case-finite',
        spatialSummary: 'arithmetic-centroid-axis-aligned-bounds',
        maxGroups: 256,
      },
    },
    approximation: { mode: 'BOUNDED', representedRowCount: 6 },
    informationContract: {
      preserves: ['cluster-separation', 'aggregate-group-magnitude'],
      loses: [
        'individual-observation-identity',
        'exact-metric-values',
        'population-density-distribution',
        'empirical-bivariate-bin-mass',
        'empirical-distribution-shape',
        'outlier-boundary-visibility',
      ],
    },
    resource: { sourceRowCount: 6, elementCount: 3, maxElementCount: 256 },
    provenance: {
      kernelVersion: 'test',
      algorithmVersion: 'source-partition-cluster-columnar-v1',
      decisionId: 'decision-a2-cluster',
      decisionModelVersion: 'bootstrap-fitness-v4',
    },
    result: {
      status: 'READY',
      payload: {
        kind: 'CLUSTER_REGIONS',
        data: {
          partitionField: 'group',
          coordinateFields: ['x', 'y'],
          counts: {
            sourceCount: 6,
            assignedCount: 6,
            unassignedCount: 0,
            coordinateValidCount: 6,
            coordinateExcludedCount: 0,
          },
          regions: [0, 1, 2].map((index) => ({
            semanticId: `cluster-region:${index}`,
            sourcePartitionValue: `g${index}`,
            assignedCount: 2,
            coordinateValidCount: 2,
            coordinateExcludedCount: 0,
            spatialSummary: {
              axes: [
                { field: 'x', centroid: index, min: index - 0.25, max: index + 0.25 },
                { field: 'y', centroid: index, min: index - 0.25, max: index + 0.25 },
              ],
            },
          })),
        },
      },
    },
  };
}

function minimalFacts(): MonetaFacts {
  return {
    topology: 'TABULAR', rowCount: 0, nodeCount: 0, edgeCount: 0, depth: 0,
    numericColumns: 0, categoricalColumns: 0, temporalColumns: 0,
    hasTimeSeries: false, hasContinuousValues: false, density: 0, estimatedDensity: 0,
    outlierCount: 0, cardinalityOfColor: 0, hasHighCardinality: false, isLargeDataset: false,
    clusterCount: 0, columnStats: {}, correlationMatrix: {}, categoryDistribution: {},
    trendDirection: 'flat', seasonalityHint: false, hasOutliers: false, hasHighVariance: false,
    numericSkew: 0, topCategory: null,
  };
}

function solverResult(entry: InventoryEntry): SolverResult {
  return {
    facts: minimalFacts(),
    cost: 0,
    spec: { layout: entry.layout, geometry: entry.geometry, behavior: 'STATIC', interaction: 'INSPECT_CELL' },
  };
}

function inputThatForbidsRawRows(candidateId: SemanticRepresentationId): MonetaDataInput {
  const input = { encodings: {} } as MonetaDataInput & {
    semanticEmbodiment?: ProductionSemanticEmbodimentEnvelopeV1;
    semanticEmbodimentCandidateId?: 'CLUSTER_REGIONS';
  };
  if (candidateId === 'AGGREGATE_VOLUME') input.semanticEmbodiment = aggregateEnvelope();
  if (candidateId === 'DISTRIBUTION_FIELD') input.semanticEmbodiment = distributionEnvelope();
  if (candidateId === 'DENSITY_FIELD') input.semanticEmbodiment = densityEnvelope();
  if (candidateId === 'CLUSTER_REGIONS') {
    input.semanticEmbodiment = clusterEnvelope();
    input.semanticEmbodimentCandidateId = 'CLUSTER_REGIONS';
  }
  Object.defineProperty(input, 'rows', {
    configurable: true,
    get() { throw new Error(RAW_ROW_SENTINEL); },
  });
  return input;
}

function rendererSource(path: string): string {
  return readFileSync(path, 'utf8');
}

function semanticRenderCount(
  geometry: 'AGGREGATE_BARS' | 'DENSITY_FIELD' | 'DISTRIBUTION_FIELD' | 'CLUSTER_VOLUME'
): number {
  const layouts = new TopologyLayoutEmbodiment('none');
  const scalable = new ScalableTopologyEmbodiment(layouts, 'none', null);
  const group = new THREE.Group();
  const nodeMeshes: THREE.Mesh[] = [];
  try {
    if (geometry === 'AGGREGATE_BARS') {
      scalable.buildAggregateBars(group, nodeMeshes, aggregateEnvelope());
    } else if (geometry === 'DISTRIBUTION_FIELD') {
      scalable.buildDistributionField(group, nodeMeshes, distributionEnvelope());
    } else if (geometry === 'DENSITY_FIELD') {
      buildDensitySemanticField(group, nodeMeshes, densityEnvelope());
    } else {
      buildClusterSemanticRegions(group, nodeMeshes, clusterEnvelope());
    }
    return nodeMeshes.length;
  } finally {
    disposeObject(group);
  }
}

describe('Stream A representation inventory', () => {
  it('covers every semantic candidate and keeps production reachability explicit', () => {
    const candidateIds = Object.keys(MONETA_REPRESENTATION_CANDIDATES).sort();
    expect(Object.keys(INVENTORY).sort()).toEqual(candidateIds);
    const reachable = new Set(Object.values(FAMILY_TO_CANDIDATE_IDS).flat());
    const actualUnreachable = candidateIds.filter((id) => !reachable.has(id as SemanticRepresentationId));
    const inventoriedUnreachable = candidateIds.filter((id) => !INVENTORY[id as SemanticRepresentationId].productionReachable);
    expect(actualUnreachable).toEqual(inventoriedUnreachable);
    expect(actualUnreachable).toEqual([]);
  });

  it('makes DATASET_LEVEL_VALID a mechanical raw-row-free renderer gate', () => {
    for (const candidateId of Object.keys(INVENTORY) as SemanticRepresentationId[]) {
      const entry = INVENTORY[candidateId];
      let error: unknown = null;
      try {
        const artifact = VRTopologyTranslator.synthesizeArtifact(
          solverResult(entry),
          inputThatForbidsRawRows(candidateId)
        );
        disposeObject(artifact.group);
      } catch (caught) {
        error = caught;
      }
      if (entry.classification === 'DATASET_LEVEL_VALID') {
        expect(error, `${candidateId} must render without source rows after migration`).toBeNull();
      } else {
        expect(error, `${candidateId} current row dependency must remain explicit`).toBeInstanceOf(Error);
        expect((error as Error).message).toBe(RAW_ROW_SENTINEL);
      }
    }
  });

  it('keeps semantic overclaims explicit while candidate authority stays separate from geometry primitives', () => {
    const translator = rendererSource('src/moneta/VRTopologyTranslator.ts');
    const densityAdapter = rendererSource('src/moneta/embodiment/DensitySemanticEmbodiment.ts');
    const clusterAdapter = rendererSource('src/moneta/embodiment/ClusterSemanticEmbodiment.ts');
    const learned = rendererSource('src/moneta/representation/LearnedMonetaRuntime.ts');
    const bootstrap = rendererSource('src/moneta/representation/MonetaHypothesisEngine.ts');

    expect(translator).not.toContain('const rows = dataset?.rows ?? dataInput.rows ?? [];');
    expect(translator).toContain('buildDensitySemanticField(group, nodeMeshes, semanticInput.semanticEmbodiment)');
    expect(translator).toContain("semanticEmbodimentCandidateId === 'CLUSTER_REGIONS'");
    expect(translator).toContain('buildClusterSemanticRegions(');
    expect(translator).toContain('scalable.buildClusterVolume(');
    expect(translator.indexOf('buildClusterSemanticRegions(')).toBeLessThan(
      translator.indexOf('rows = dataset?.rows')
    );
    expect(translator.indexOf('scalable.buildClusterVolume(')).toBeGreaterThan(
      translator.indexOf('rows = dataset?.rows')
    );
    expect(translator).not.toContain('scalable.buildDensityField(');
    expect(densityAdapter).not.toContain('dataset.rows');
    expect(densityAdapter).not.toContain('computeLayoutPositions');
    expect(densityAdapter).not.toContain('for (const row');
    expect(clusterAdapter).not.toContain('dataset.rows');
    expect(clusterAdapter).not.toContain('computeLayoutPositions');
    expect(clusterAdapter).not.toContain('SphereGeometry');

    expect(INVENTORY.DENSITY_FIELD.classification).toBe('DATASET_LEVEL_VALID');
    expect(INVENTORY.DISTRIBUTION_FIELD.classification).toBe('DATASET_LEVEL_VALID');
    expect(INVENTORY.CLUSTER_REGIONS.classification).toBe('DATASET_LEVEL_VALID');
    expect(INVENTORY.MANIFOLD_EMBEDDING.classification).toBe('SEMANTICALLY_OVERCLAIMED');
    expect(INVENTORY.MULTISCALE_FIELD.classification).toBe('SEMANTICALLY_OVERCLAIMED');

    expect(learned).toContain("candidateId === 'DENSITY_FIELD'");
    expect(bootstrap).toContain("candidateId === 'DENSITY_FIELD'");
  });

  it('bounds migrated semantic primitive counts by payload elements rather than source N', () => {
    expect(semanticRenderCount('AGGREGATE_BARS')).toBe(aggregateEnvelope().resource.elementCount);
    expect(semanticRenderCount('DISTRIBUTION_FIELD')).toBe(distributionEnvelope().resource.elementCount);
    expect(semanticRenderCount('DENSITY_FIELD')).toBe(densityEnvelope().resource.elementCount);
    expect(semanticRenderCount('CLUSTER_VOLUME')).toBe(clusterEnvelope().resource.elementCount);
  });
});
