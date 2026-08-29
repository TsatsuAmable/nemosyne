import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Dataset } from '../src/data/Dataset.ts';
import { VRTopologyTranslator } from '../src/moneta/VRTopologyTranslator.ts';
import {
  MONETA_REPRESENTATION_CANDIDATES,
  type SemanticRepresentationId,
} from '../src/moneta/representation/RepresentationCandidate.ts';
import { FAMILY_TO_CANDIDATE_IDS } from '../src/moneta/representation/RepresentationFamily.ts';
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
  currentRenderer: string;
  claimedSemantics: string;
  actualCurrentSemantics: string;
}

const INVENTORY: Record<SemanticRepresentationId, InventoryEntry> = {
  POINT_SET: {
    classification: 'OBSERVATION_LEVEL',
    productionReachable: true,
    layout: 'GRID_3D',
    geometry: 'CUBE_MATRIX',
    currentRenderer: 'TopologyLayoutEmbodiment.buildGrid',
    claimedSemantics: 'discrete observations',
    actualCurrentSemantics: 'one row-derived grid mark per observation',
  },
  DENSITY_FIELD: {
    classification: 'SEMANTICALLY_OVERCLAIMED',
    productionReachable: true,
    layout: 'GRID_3D',
    geometry: 'DENSITY_FIELD',
    currentRenderer: 'ScalableTopologyEmbodiment.buildDensityField',
    claimedSemantics: 'continuous population density estimation',
    actualCurrentSemantics: 'fixed 6x6x6 histogram over TypeScript layout positions',
  },
  DISTRIBUTION_FIELD: {
    classification: 'SEMANTICALLY_OVERCLAIMED',
    productionReachable: true,
    layout: 'GRID_3D',
    geometry: 'DENSITY_FIELD',
    currentRenderer: 'ScalableTopologyEmbodiment.buildDensityField',
    claimedSemantics: 'distribution contours, quantiles and probability density',
    actualCurrentSemantics: 'same fixed spatial histogram used for DENSITY_FIELD',
  },
  CLUSTER_REGIONS: {
    classification: 'DATASET_LEVEL_ROW_DERIVED',
    productionReachable: true,
    layout: 'GRID_3D',
    geometry: 'CLUSTER_VOLUME',
    currentRenderer: 'ScalableTopologyEmbodiment.buildClusterVolume',
    claimedSemantics: 'cluster regions with centroid and boundary markers',
    actualCurrentSemantics: 'TypeScript grouping plus bounding spheres over row-derived positions',
  },
  AGGREGATE_VOLUME: {
    classification: 'NOT_PRODUCTION_REACHABLE',
    productionReachable: false,
    layout: 'GRID_3D',
    geometry: 'AGGREGATE_BARS',
    currentRenderer: 'ScalableTopologyEmbodiment.buildAggregateBars',
    claimedSemantics: 'aggregated summary measures',
    actualCurrentSemantics:
      'renderer exists and groups/averages raw rows, but Moneta candidate generation does not emit it',
  },
  TEMPORAL_TRAJECTORY: {
    classification: 'DATASET_LEVEL_ROW_DERIVED',
    productionReachable: true,
    layout: 'TIME_RIBBON',
    geometry: 'BEAM',
    currentRenderer: 'TopologyLayoutEmbodiment.buildTimeRibbon',
    claimedSemantics: 'chronological temporal trajectory',
    actualCurrentSemantics: 'TypeScript row ordering and tube construction by series',
  },
  HIERARCHICAL_SPACE: {
    classification: 'DATASET_LEVEL_ROW_DERIVED',
    productionReachable: true,
    layout: 'RADIAL_ORBITAL',
    geometry: 'CONICAL_TREE',
    currentRenderer: 'TopologyLayoutEmbodiment.buildRadial',
    claimedSemantics: 'nested hierarchy with parent-child structure',
    actualCurrentSemantics: 'row-derived radial nodes plus parent-index edges',
  },
  RELATIONSHIP_GRAPH: {
    classification: 'DATASET_LEVEL_ROW_DERIVED',
    productionReachable: true,
    layout: 'FORCE_DIRECTED_3D',
    geometry: 'ICOSA_NODE',
    currentRenderer: 'TopologyLayoutEmbodiment.buildForceDirected',
    claimedSemantics: 'relational topology',
    actualCurrentSemantics: 'row/edge inputs converted into per-observation nodes and edges',
  },
  MATRIX_FIELD: {
    classification: 'OBSERVATION_LEVEL',
    productionReachable: true,
    layout: 'GRID_3D',
    geometry: 'CUBE_MATRIX',
    currentRenderer: 'TopologyLayoutEmbodiment.buildGrid',
    claimedSemantics: 'regular indexed observation matrix',
    actualCurrentSemantics: 'one row-derived grid mark per observation',
  },
  MANIFOLD_EMBEDDING: {
    classification: 'SEMANTICALLY_OVERCLAIMED',
    productionReachable: true,
    layout: 'FORCE_DIRECTED_3D',
    geometry: 'ICOSA_NODE',
    currentRenderer: 'TopologyLayoutEmbodiment.buildForceDirected',
    claimedSemantics: 'dimensionality-reduced manifold preserving neighbourhood topology',
    actualCurrentSemantics:
      'generic force-directed or grid row layout; no manifold payload reaches the renderer',
  },
  SPATIAL_REGION: {
    classification: 'OBSERVATION_LEVEL',
    productionReachable: true,
    layout: 'GEO_SURFACE',
    geometry: 'GEO_COLUMN',
    currentRenderer: 'TopologyLayoutEmbodiment.buildGeoSurface',
    claimedSemantics: 'geographic coordinate mapping',
    actualCurrentSemantics: 'one row-derived geospatial column per observation',
  },
  MULTISCALE_FIELD: {
    classification: 'SEMANTICALLY_OVERCLAIMED',
    productionReachable: true,
    layout: 'SPECTRAL_VOLUME',
    geometry: 'SPECTRAL_BAR',
    currentRenderer: 'TopologyLayoutEmbodiment.buildSpectralVolume',
    claimedSemantics: 'multiscale frequency and wavelet structure',
    actualCurrentSemantics:
      'row-derived spectral bars; no multiscale/wavelet payload reaches the renderer',
  },
};

const RAW_ROW_SENTINEL = 'A2_RAW_ROWS_ACCESSED';

function minimalFacts(): MonetaFacts {
  return {
    topology: 'TABULAR',
    rowCount: 0,
    nodeCount: 0,
    edgeCount: 0,
    depth: 0,
    numericColumns: 0,
    categoricalColumns: 0,
    temporalColumns: 0,
    hasTimeSeries: false,
    hasContinuousValues: false,
    density: 0,
    estimatedDensity: 0,
    outlierCount: 0,
    cardinalityOfColor: 0,
    hasHighCardinality: false,
    isLargeDataset: false,
    clusterCount: 0,
    columnStats: {},
    correlationMatrix: {},
    categoryDistribution: {},
    trendDirection: 'flat',
    seasonalityHint: false,
    hasOutliers: false,
    hasHighVariance: false,
    numericSkew: 0,
    topCategory: null,
  };
}

function solverResult(entry: InventoryEntry): SolverResult {
  return {
    facts: minimalFacts(),
    cost: 0,
    spec: {
      layout: entry.layout,
      geometry: entry.geometry,
      behavior: 'STATIC',
      interaction: 'INSPECT_CELL',
    },
  };
}

function inputThatForbidsRawRows(): MonetaDataInput {
  const input: MonetaDataInput = { encodings: {} };
  Object.defineProperty(input, 'rows', {
    configurable: true,
    get() {
      throw new Error(RAW_ROW_SENTINEL);
    },
  });
  return input;
}

function rendererSource(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

function renderCount(geometry: VRGeometry, rowCount = 24): number {
  const rows = Array.from({ length: rowCount }, (_, index) => ({
    group: `g${index % 3}`,
    x: index % 6,
    y: Math.floor(index / 6),
    value: index + 1,
  }));
  const dataset = new Dataset(
    `a2-${geometry}`,
    [
      { name: 'group', type: 'CATEGORICAL' },
      { name: 'x', type: 'NUMERIC' },
      { name: 'y', type: 'NUMERIC' },
      { name: 'value', type: 'NUMERIC' },
    ],
    rows
  );
  const artifact = VRTopologyTranslator.synthesizeArtifact(
    {
      facts: { ...minimalFacts(), rowCount, numericColumns: 3, categoricalColumns: 1 },
      cost: 0,
      spec: {
        layout: 'GRID_3D',
        geometry,
        behavior: 'STATIC',
        interaction: 'INSPECT_CELL',
      },
    },
    { dataset, encodings: { color: 'group', size: 'value' } }
  );
  const count = artifact.nodeMeshes.length;
  disposeObject(artifact.group);
  return count;
}

describe('Stream A A2 representation inventory', () => {
  it('covers every semantic candidate and pins current Moneta reachability', () => {
    const candidateIds = Object.keys(MONETA_REPRESENTATION_CANDIDATES).sort();
    expect(Object.keys(INVENTORY).sort()).toEqual(candidateIds);

    const reachable = new Set(Object.values(FAMILY_TO_CANDIDATE_IDS).flat());
    const actualUnreachable = candidateIds.filter((id) =>
      !reachable.has(id as SemanticRepresentationId)
    );
    const inventoriedUnreachable = candidateIds.filter(
      (id) => !INVENTORY[id as SemanticRepresentationId].productionReachable
    );

    expect(actualUnreachable).toEqual(inventoriedUnreachable);
    expect(actualUnreachable).toEqual(['AGGREGATE_VOLUME']);
  });

  it('makes DATASET_LEVEL_VALID a mechanical raw-row-free renderer gate', () => {
    for (const candidateId of Object.keys(INVENTORY) as SemanticRepresentationId[]) {
      const entry = INVENTORY[candidateId];
      let error: unknown = null;
      try {
        const artifact = VRTopologyTranslator.synthesizeArtifact(
          solverResult(entry),
          inputThatForbidsRawRows()
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

  it('pins the current semantic-overclaim mechanisms instead of treating bounded meshes as analytical authority', () => {
    const translator = rendererSource('src/moneta/VRTopologyTranslator.ts');
    const scalable = rendererSource('src/moneta/embodiment/ScalableTopologyEmbodiment.ts');
    const bootstrap = rendererSource('src/moneta/representation/MonetaHypothesisEngine.ts');
    const learned = rendererSource('src/moneta/representation/LearnedMonetaRuntime.ts');

    expect(translator).toContain('const rows = dataset?.rows ?? dataInput.rows ?? [];');
    expect(scalable).toContain('const BINS = 6;');
    expect(scalable).toContain("representationKind: 'DENSITY_FIELD'");
    expect(scalable).toContain("representationKind: 'CLUSTER_REGIONS'");
    expect(scalable).toContain("representationKind: 'AGGREGATE_VOLUME'");

    expect(INVENTORY.DENSITY_FIELD.classification).toBe('SEMANTICALLY_OVERCLAIMED');
    expect(INVENTORY.DISTRIBUTION_FIELD.classification).toBe('SEMANTICALLY_OVERCLAIMED');
    expect(INVENTORY.MANIFOLD_EMBEDDING.classification).toBe('SEMANTICALLY_OVERCLAIMED');
    expect(INVENTORY.MULTISCALE_FIELD.classification).toBe('SEMANTICALLY_OVERCLAIMED');

    expect(bootstrap).toContain("candidateId === 'AGGREGATE_VOLUME'");
    expect(bootstrap).toContain("candidateId === 'CLUSTER_REGIONS'");
    expect(bootstrap).toContain(
      "candidateId === 'DENSITY_FIELD' || candidateId === 'DISTRIBUTION_FIELD'"
    );

    expect(learned).toContain('function geometryForLayout(layout: VRLayout): VRGeometry');
    expect(learned).toContain('geometryForLayout(winner.layout)');
    expect(learned).not.toContain(
      'function geometryForLayout(layout: VRLayout, candidateId?: SemanticRepresentationId)'
    );
  });

  it('records source-N versus rendered primitive behavior for the existing scalable renderers', () => {
    const rowCount = 24;
    expect(renderCount('CUBE_MATRIX', rowCount)).toBe(rowCount);
    expect(renderCount('AGGREGATE_BARS', rowCount)).toBe(3);

    const clusters = renderCount('CLUSTER_VOLUME', rowCount);
    expect(clusters).toBe(3);

    const densityVoxels = renderCount('DENSITY_FIELD', rowCount);
    expect(densityVoxels).toBeGreaterThan(0);
    expect(densityVoxels).toBeLessThanOrEqual(216);
  });
});
