import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { Dataset } from '../src/data/Dataset.ts';
import { VRTopologyTranslator } from '../src/moneta/VRTopologyTranslator.ts';
import { ScalableTopologyEmbodiment } from '../src/moneta/embodiment/ScalableTopologyEmbodiment.ts';
import { TopologyLayoutEmbodiment } from '../src/moneta/embodiment/TopologyLayoutEmbodiment.ts';
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
}

const INVENTORY: Record<SemanticRepresentationId, InventoryEntry> = {
  POINT_SET: {
    classification: 'OBSERVATION_LEVEL',
    productionReachable: true,
    layout: 'GRID_3D',
    geometry: 'CUBE_MATRIX',
  },
  DENSITY_FIELD: {
    classification: 'SEMANTICALLY_OVERCLAIMED',
    productionReachable: true,
    layout: 'GRID_3D',
    geometry: 'DENSITY_FIELD',
  },
  DISTRIBUTION_FIELD: {
    classification: 'SEMANTICALLY_OVERCLAIMED',
    productionReachable: true,
    layout: 'GRID_3D',
    geometry: 'DENSITY_FIELD',
  },
  CLUSTER_REGIONS: {
    classification: 'DATASET_LEVEL_ROW_DERIVED',
    productionReachable: true,
    layout: 'GRID_3D',
    geometry: 'CLUSTER_VOLUME',
  },
  AGGREGATE_VOLUME: {
    classification: 'NOT_PRODUCTION_REACHABLE',
    productionReachable: false,
    layout: 'GRID_3D',
    geometry: 'AGGREGATE_BARS',
  },
  TEMPORAL_TRAJECTORY: {
    classification: 'DATASET_LEVEL_ROW_DERIVED',
    productionReachable: true,
    layout: 'TIME_RIBBON',
    geometry: 'BEAM',
  },
  HIERARCHICAL_SPACE: {
    classification: 'DATASET_LEVEL_ROW_DERIVED',
    productionReachable: true,
    layout: 'RADIAL_ORBITAL',
    geometry: 'CONICAL_TREE',
  },
  RELATIONSHIP_GRAPH: {
    classification: 'DATASET_LEVEL_ROW_DERIVED',
    productionReachable: true,
    layout: 'FORCE_DIRECTED_3D',
    geometry: 'ICOSA_NODE',
  },
  MATRIX_FIELD: {
    classification: 'OBSERVATION_LEVEL',
    productionReachable: true,
    layout: 'GRID_3D',
    geometry: 'CUBE_MATRIX',
  },
  MANIFOLD_EMBEDDING: {
    classification: 'SEMANTICALLY_OVERCLAIMED',
    productionReachable: true,
    layout: 'FORCE_DIRECTED_3D',
    geometry: 'ICOSA_NODE',
  },
  SPATIAL_REGION: {
    classification: 'OBSERVATION_LEVEL',
    productionReachable: true,
    layout: 'GEO_SURFACE',
    geometry: 'GEO_COLUMN',
  },
  MULTISCALE_FIELD: {
    classification: 'SEMANTICALLY_OVERCLAIMED',
    productionReachable: true,
    layout: 'SPECTRAL_VOLUME',
    geometry: 'SPECTRAL_BAR',
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
  return readFileSync(path, 'utf8');
}

function scalableRenderCount(
  geometry: 'AGGREGATE_BARS' | 'CLUSTER_VOLUME' | 'DENSITY_FIELD',
  rowCount = 24
): number {
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
  const layouts = new TopologyLayoutEmbodiment('none');
  const layoutSpy = vi.spyOn(layouts, 'computeLayoutPositions').mockReturnValue(
    rows.map((row, index) => ({
      row,
      index,
      position: new THREE.Vector3(index % 6, Math.floor(index / 6), index % 2),
    }))
  );
  const scalable = new ScalableTopologyEmbodiment(layouts, 'none', null);
  const group = new THREE.Group();
  const nodeMeshes: THREE.Mesh[] = [];
  const spec = {
    layout: 'GRID_3D' as const,
    geometry,
    behavior: 'STATIC' as const,
    interaction: 'INSPECT_CELL' as const,
  };
  const encodings = { color: 'group', size: 'value' };

  try {
    if (geometry === 'AGGREGATE_BARS') {
      scalable.buildAggregateBars(group, nodeMeshes, rows, dataset, encodings, spec);
    } else if (geometry === 'CLUSTER_VOLUME') {
      scalable.buildClusterVolume(group, nodeMeshes, rows, dataset, encodings, spec);
    } else {
      scalable.buildDensityField(group, nodeMeshes, rows, dataset, encodings, spec);
    }
    return nodeMeshes.length;
  } finally {
    layoutSpy.mockRestore();
    disposeObject(group);
  }
}

describe('Stream A A2 representation inventory', () => {
  it('covers every semantic candidate and pins current Moneta reachability', () => {
    const candidateIds = Object.keys(MONETA_REPRESENTATION_CANDIDATES).sort();
    expect(Object.keys(INVENTORY).sort()).toEqual(candidateIds);

    const reachable = new Set(Object.values(FAMILY_TO_CANDIDATE_IDS).flat());
    const actualUnreachable = candidateIds.filter(
      (id) => !reachable.has(id as SemanticRepresentationId)
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

  it('records bounded primitive behavior without replacing Rust layout authority in the test', () => {
    const rowCount = 24;
    expect(scalableRenderCount('AGGREGATE_BARS', rowCount)).toBe(3);
    expect(scalableRenderCount('CLUSTER_VOLUME', rowCount)).toBe(3);

    const densityVoxels = scalableRenderCount('DENSITY_FIELD', rowCount);
    expect(densityVoxels).toBeGreaterThan(0);
    expect(densityVoxels).toBeLessThanOrEqual(216);
  });
});
