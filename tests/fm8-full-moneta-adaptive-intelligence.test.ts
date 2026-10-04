import { describe, test, expect } from 'vitest';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.ts';
import {
  QUEST_CONSTRAINED_BUDGET,
  DESKTOP_EXPANSIVE_BUDGET,
} from '../src/moneta/forma/FormaResolutionBroker.ts';
import { FullMonetaEngine } from '../src/moneta/adaptation/index.ts';
import { buildDatasetSignature } from '../src/moneta/representation/SignatureBuilder.ts';

describe('FM8: Full Moneta / Controlled Adaptive Representation Intelligence', () => {
  function makeMultiDimensionalDataset(): Dataset {
    const rows = [];
    for (let i = 0; i < 80; i++) {
      rows.push({
        dim1: i * 2.0,
        dim2: (i % 6) * 1.5,
        dim3: (i % 4) * 3.0,
        category: i % 2 === 0 ? 'TypeA' : 'TypeB',
      });
    }
    return new Dataset(
      'fm8-multi-dim-ds',
      [
        { name: 'dim1', type: ColumnType.NUMERIC },
        { name: 'dim2', type: ColumnType.NUMERIC },
        { name: 'dim3', type: ColumnType.NUMERIC },
        { name: 'category', type: ColumnType.CATEGORICAL },
      ],
      rows
    );
  }

  function makeTimeSeriesDataset(): Dataset {
    return new Dataset(
      'fm8-time-series-ds',
      [
        { name: 'timestamp', type: ColumnType.TEMPORAL },
        { name: 'metric1', type: ColumnType.NUMERIC },
        { name: 'metric2', type: ColumnType.NUMERIC },
      ],
      [
        { timestamp: '2026-01-01T00:00:00Z', metric1: 10, metric2: 100 },
        { timestamp: '2026-01-02T00:00:00Z', metric1: 20, metric2: 120 },
        { timestamp: '2026-01-03T00:00:00Z', metric1: 15, metric2: 110 },
        { timestamp: '2026-01-04T00:00:00Z', metric1: 30, metric2: 150 },
      ]
    );
  }

  test('falsifier A: synthesizes complete Full Moneta representation integrating context, search, multi-element runtime, and budget adaptation', () => {
    const bridge = makeKernelMockBridge();
    const atlas = new AtlasCore({ kernel: bridge });
    const ds = makeMultiDimensionalDataset();
    atlas.loadDataset(ds);

    atlas.commitInvestigationContext('node-fm8-root', {
      schemaVersion: 2,
      nodeId: 'node-fm8-root',
      intent: {
        schemaVersion: 1,
        researchQuestion: 'How do multi-dimensional points cluster across dimensions?',
        variablesOfInterest: ['dim1', 'dim2'],
        currentTask: 'cluster_analysis',
      },
      epistemicPurpose: 'CLAIM_BEARING',
    });

    const result = atlas.adaptRepresentation({
      preference: 'BALANCED',
      budget: DESKTOP_EXPANSIVE_BUDGET,
      maxGenerations: 2,
    });

    expect(result).toBeDefined();
    expect(result.synthesisId).toContain('fm8-synth-');
    expect(result.selectedGraph.primitives.length).toBeGreaterThan(0);
    expect(result.resolutionVariant.variantTier).toBe('MONA_LISA_EXPANSIVE');
    expect(result.composedState.elements.length).toBeGreaterThan(0);
    expect(result.composedState.composedIdentity).toContain('composed-forma-v1:');
    expect(result.paretoFrontier.length).toBeGreaterThan(0);
    expect(result.provenance.datasetFingerprint).toBe(atlas.datasetFingerprint);
  });

  test('falsifier B: adaptive representation operations preserve analytical dataset identity and investigation DAG digests bitwise invariant', async () => {
    const bridge = makeKernelMockBridge();
    const atlas = new AtlasCore({ kernel: bridge });
    const ds = makeMultiDimensionalDataset();
    atlas.loadDataset(ds);

    const initialFingerprint = atlas.datasetFingerprint;
    const initialDigest = await atlas.computeDigest();

    // Perform multiple adaptive syntheses with distinct profiles and budgets
    atlas.adaptRepresentation({ preference: 'SIMPLER', budget: QUEST_CONSTRAINED_BUDGET });
    atlas.adaptRepresentation({ preference: 'HIGH_FIDELITY', budget: DESKTOP_EXPANSIVE_BUDGET });
    atlas.adaptRepresentation({ preference: 'SHOW_MORE_UNCERTAINTY' });

    // Assert strict analytical and historical invariance
    expect(atlas.datasetFingerprint).toBe(initialFingerprint);
    expect(await atlas.computeDigest()).toBe(initialDigest);
  });

  test('falsifier C: adaptive resolution transitions across hardware budgets produce congruent variants preserving core obligations', () => {
    const bridge = makeKernelMockBridge();
    const atlas = new AtlasCore({ kernel: bridge });
    const ds = makeMultiDimensionalDataset();
    atlas.loadDataset(ds);

    // 1. Constrained budget (e.g. standalone Quest)
    const constrainedResult = atlas.adaptRepresentation({
      budget: QUEST_CONSTRAINED_BUDGET,
      mandatoryChannels: ['spatial_position', 'spatial_scatter'],
    });

    expect(constrainedResult.resolutionVariant.variantTier).toBe('STICKMAN_SPARSE');
    expect(constrainedResult.resolutionVariant.shedOptionalChannels).toContain('secondary_voxel_surface');
    expect(constrainedResult.resolutionVariant.preservedObligations.mandatoryChannels).toEqual([
      'spatial_position',
      'spatial_scatter',
    ]);

    // 2. Expansive budget (e.g. desktop/PC-XR)
    const expansiveResult = atlas.adaptRepresentation({
      budget: DESKTOP_EXPANSIVE_BUDGET,
    });

    expect(expansiveResult.resolutionVariant.variantTier).toBe('MONA_LISA_EXPANSIVE');
    expect(expansiveResult.resolutionVariant.shedOptionalChannels).toEqual([]);
  });

  test('falsifier D: orientation preservation and transition stability ratings prevent cognitive disorientation', () => {
    const bridge = makeKernelMockBridge();
    const atlas = new AtlasCore({ kernel: bridge });
    const ds = makeMultiDimensionalDataset();
    atlas.loadDataset(ds);

    // Initial representation
    const initial = atlas.adaptRepresentation({
      preference: 'BALANCED',
      maxGenerations: 2,
    });

    // Adaptive step from initial graph
    const adapted = atlas.adaptRepresentation({
      preference: 'SIMPLER',
      currentGraph: initial.selectedGraph,
      maxGenerations: 2,
    });

    expect(adapted.transition).toBeDefined();
    const t = adapted.transition!;
    expect(t.fromGraphId).toBe(initial.selectedGraph.graphId);
    expect(t.toGraphId).toBe(adapted.selectedGraph.graphId);
    expect(t.landmarkStability).toBeGreaterThanOrEqual(0);
    expect(t.landmarkStability).toBeLessThanOrEqual(1);
    expect(t.semanticContinuity).toBeGreaterThanOrEqual(0);
    expect(t.semanticContinuity).toBeLessThanOrEqual(1);
    expect(t.visualContinuityRating).toBeGreaterThanOrEqual(0);
    expect(t.visualContinuityRating).toBeLessThanOrEqual(1);
    expect(t.coordinateScalePreservation).toBe(true);
    expect(t.summary).toContain('Continuity score:');
  });

  test('falsifier E: Research Mode freezing locks all dynamic priors and search parameters, guaranteeing exact bitwise reproducibility', () => {
    const bridge = makeKernelMockBridge();
    const atlas = new AtlasCore({ kernel: bridge });
    const ds = makeTimeSeriesDataset();
    atlas.loadDataset(ds);

    expect(atlas.isResearchMode()).toBe(false);
    atlas.setResearchMode(true);
    expect(atlas.isResearchMode()).toBe(true);

    const r1 = atlas.adaptRepresentation({ maxGenerations: 2 });
    const r2 = atlas.adaptRepresentation({ maxGenerations: 2 });

    expect(r1.researchModeFrozen).toBe(true);
    expect(r2.researchModeFrozen).toBe(true);
    expect(r1.provenance.fitnessModelVersion).toBe('FullMonetaEngine-FrozenResearchMode-v1');
    expect(r2.provenance.fitnessModelVersion).toBe('FullMonetaEngine-FrozenResearchMode-v1');
    expect(r1.selectedGraph.graphId).toBe(r2.selectedGraph.graphId);
  });

  test('falsifier F: multi-layer TechnoCore explanation articulates evidence facts, intent alignment, Pareto trade-offs, and budget modifications', () => {
    const bridge = makeKernelMockBridge();
    const atlas = new AtlasCore({ kernel: bridge });
    const ds = makeMultiDimensionalDataset();
    atlas.loadDataset(ds);

    const initial = atlas.adaptRepresentation({ preference: 'BALANCED' });
    const adapted = atlas.adaptRepresentation({
      preference: 'SIMPLER',
      currentGraph: initial.selectedGraph,
    });

    const report = atlas.explainFullMonetaDecision(adapted, 'SIMPLER');
    expect(report).toContain('FULL MONETA SYNTHESIS REPORT');
    expect(report).toContain('Objective Vector Evaluation (Preference: [SIMPLER]');
    expect(report).toContain('Composition Topology:');
    expect(report).toContain('Hardware Resolution Brokering:');
    expect(report).toContain('Cognitive Orientation & Transition Stability:');
    expect(report).toContain('Landmark Stability:');
  });

  test('falsifier G: refusal of unsatisfied mandatory channel obligations fails closed', () => {
    const ds = makeMultiDimensionalDataset();
    const signature = buildDatasetSignature(ds);

    // Requesting a channel that QUEST_CONSTRAINED_BUDGET cannot satisfy
    expect(() => {
      FullMonetaEngine.synthesizeOrAdapt(signature, undefined, undefined, {
        budget: QUEST_CONSTRAINED_BUDGET,
        mandatoryChannels: ['spatial_surface', 'secondary_voxel_surface'],
      });
    }).toThrowError(/Resolution adaptation refused.*MANDATORY_OBLIGATION_UNSATISFIED/);
  });
});
