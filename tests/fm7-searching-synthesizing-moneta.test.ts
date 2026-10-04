import { describe, test, expect } from 'vitest';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.ts';
import {
  RepresentationSearchEngine,
  DeterministicReferenceComposer,
  RepresentationGenomeHandoff,
  validateGraphAgainstGrammar,
  paretoDominates,
  type RepresentationGenomeV1,
} from '../src/moneta/search/index.ts';
import { buildDatasetSignature } from '../src/moneta/representation/SignatureBuilder.ts';

describe('FM7: Searching / Synthesizing Moneta (L5-SYNTH/SEARCH / AP-SEARCH)', () => {
  function makeMultiDimensionalDataset(): Dataset {
    const rows = [];
    for (let i = 0; i < 60; i++) {
      rows.push({
        dim1: i * 1.5,
        dim2: (i % 5) * 2.0,
        dim3: (i % 3) * 3.5,
        category: i % 2 === 0 ? 'A' : 'B',
      });
    }
    return new Dataset(
      'multi-dim-ds',
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
      'time-series-ds',
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

  test('falsifier A: synthesizes novel admissible representations outside fixed catalogue satisfying grammar bounds', () => {
    const bridge = makeKernelMockBridge();
    const atlas = new AtlasCore({ kernel: bridge });
    const ds = makeMultiDimensionalDataset();
    atlas.loadDataset(ds);

    atlas.commitInvestigationContext('node-root', {
      schemaVersion: 2,
      nodeId: 'node-root',
      intent: {
        schemaVersion: 1,
        researchQuestion: 'How do clusters align across numeric dimensions?',
        variablesOfInterest: ['dim1', 'dim2'],
        currentTask: 'cluster_analysis',
      },
      epistemicPurpose: 'CLAIM_BEARING',
    });

    const searchResult = atlas.searchRepresentations({
      maxGenerations: 3,
      populationSize: 8,
    });

    expect(searchResult).toBeDefined();
    expect(searchResult.candidates.length).toBeGreaterThan(0);
    expect(searchResult.paretoFrontier.length).toBeGreaterThan(0);
    expect(searchResult.referenceCandidate).toBeDefined();

    // Verify at least one synthesized candidate has distinct multi-primitive composition
    const novelCandidate = searchResult.candidates.find(
      (c) => c.candidateId !== searchResult.referenceCandidate.candidateId
    );
    expect(novelCandidate).toBeDefined();
    expect(novelCandidate!.graph.primitives.length).toBeGreaterThanOrEqual(1);

    // Verify grammar validation on all candidates
    for (const cand of searchResult.candidates) {
      const validation = validateGraphAgainstGrammar(cand.graph);
      expect(validation.valid).toBe(true);
      expect(cand.graph.primitives.length).toBeLessThanOrEqual(16);
      expect(cand.graph.edges.length).toBeLessThanOrEqual(32);
      expect(cand.lineage.searchSessionId).toBe(searchResult.searchSessionId);
    }
  });

  test('falsifier B: searching representations preserves analytical dataset identity and historical digests bitwise invariant', async () => {
    const bridge = makeKernelMockBridge();
    const atlas = new AtlasCore({ kernel: bridge });
    const ds = makeMultiDimensionalDataset();
    atlas.loadDataset(ds);

    const initialFingerprint = atlas.datasetFingerprint;
    const initialDigest = await atlas.computeDigest();

    // Perform multiple searches with varying options
    atlas.searchRepresentations({ preference: 'SIMPLER' });
    atlas.searchRepresentations({ preference: 'SHOW_MORE_UNCERTAINTY' });
    atlas.searchRepresentations({ preference: 'HIGH_FIDELITY' });

    // Assert strict analytical and historical invariance
    expect(atlas.datasetFingerprint).toBe(initialFingerprint);
    expect(await atlas.computeDigest()).toBe(initialDigest);
  });

  test('falsifier C: evaluates 7-dimensional objective vector and non-dominated Pareto frontier', () => {
    const ds = makeMultiDimensionalDataset();
    const signature = buildDatasetSignature(ds);

    const result = RepresentationSearchEngine.search(signature, {
      preference: 'BALANCED',
      maxGenerations: 2,
      populationSize: 6,
    });

    for (const cand of result.candidates) {
      const vec = cand.objectiveVector;
      // All 7 dimensions must be in [0, 1]
      expect(vec.taskRelevance).toBeGreaterThanOrEqual(0);
      expect(vec.taskRelevance).toBeLessThanOrEqual(1);
      expect(vec.informationPreservation).toBeGreaterThanOrEqual(0);
      expect(vec.informationPreservation).toBeLessThanOrEqual(1);
      expect(vec.perceptualRecoverability).toBeGreaterThanOrEqual(0);
      expect(vec.perceptualRecoverability).toBeLessThanOrEqual(1);
      expect(vec.interactionCost).toBeGreaterThanOrEqual(0);
      expect(vec.interactionCost).toBeLessThanOrEqual(1);
      expect(vec.resourceCost).toBeGreaterThanOrEqual(0);
      expect(vec.resourceCost).toBeLessThanOrEqual(1);
      expect(vec.stability).toBeGreaterThanOrEqual(0);
      expect(vec.stability).toBeLessThanOrEqual(1);
      expect(vec.explicitLoss).toBeGreaterThanOrEqual(0);
      expect(vec.explicitLoss).toBeLessThanOrEqual(1);

      expect(cand.paretoRank).toBeGreaterThanOrEqual(1);
    }

    // Verify Pareto non-domination on rank 1 frontier
    const frontier = result.paretoFrontier;
    for (let i = 0; i < frontier.length; i++) {
      for (let j = 0; j < frontier.length; j++) {
        if (i === j) continue;
        // No frontier member should strictly dominate another frontier member
        expect(paretoDominates(frontier[i].objectiveVector, frontier[j].objectiveVector)).toBe(false);
      }
    }
  });

  test('falsifier D: grammar hard constraints and inadmissible composition relations fail closed', () => {
    const ds = makeMultiDimensionalDataset();
    const signature = buildDatasetSignature(ds);

    const base = DeterministicReferenceComposer.composeReferenceGraph(signature);

    // Construct invalid graph with inadmissible composition relation:
    // DETAIL_EXPANSION cannot DERIVE_FROM UNCERTAINTY directly
    const invalidGraph = {
      ...base,
      graphId: 'invalid-graph-test',
      semanticMappings: {},
      primitives: [
        {
          id: 'p1',
          kind: 'UNCERTAINTY' as const,
          semanticInputs: [],
          visualEncoding: {},
          interactionAffordances: [],
          analyticalDependencies: [],
          parameters: {},
          limitations: [],
        },
        {
          id: 'p2',
          kind: 'DETAIL_EXPANSION' as const,
          semanticInputs: [],
          visualEncoding: {},
          interactionAffordances: [],
          analyticalDependencies: [],
          parameters: {},
          limitations: [],
        },
      ],
      edges: [
        {
          from: 'p1',
          to: 'p2',
          relation: 'DERIVES_FROM' as const, // Inadmissible for UNCERTAINTY -> DETAIL_EXPANSION
        },
      ],
    };

    const validation = validateGraphAgainstGrammar(invalidGraph);
    expect(validation.valid).toBe(false);
    expect(validation.violations.length).toBeGreaterThan(0);
    expect(validation.violations.some((v) => v.includes('Inadmissible relation'))).toBe(true);
  });

  test('falsifier E: deterministic reference composer produces bitwise identical graphs across repeated runs', () => {
    const ds = makeTimeSeriesDataset();
    const signature = buildDatasetSignature(ds);

    const ref1 = DeterministicReferenceComposer.composeReferenceGraph(signature);
    const ref2 = DeterministicReferenceComposer.composeReferenceGraph(signature);

    expect(JSON.stringify(ref1)).toBe(JSON.stringify(ref2));
    expect(ref1.primitives[0].kind).toBe('TEMPORAL');
  });

  test('falsifier F: MCR7 genome handoff validates external genome and rejects analytical mutations', () => {
    const ds = makeMultiDimensionalDataset();
    const signature = buildDatasetSignature(ds);

    // 1. Valid laboratory genome
    const validGenome: RepresentationGenomeV1 = {
      schemaVersion: '1.0.0',
      genomeId: 'lab-genome-042',
      lineage: {
        generation: 15,
        parentGenomeIds: ['lab-genome-030', 'lab-genome-038'],
        laboratoryEngineVersion: 'lab-nsga3-v2.1',
      },
      primitiveGenes: [
        {
          geneId: 'g-point',
          kind: 'POINT_IDENTITY',
          encodings: { position: 'xyz' },
        },
        {
          geneId: 'g-cluster',
          kind: 'CLUSTER',
          encodings: { color: 'categorical' },
        },
      ],
      compositionGenes: [
        {
          fromGeneId: 'g-point',
          toGeneId: 'g-cluster',
          relation: 'CONTAINS',
        },
      ],
    };

    const admitted = RepresentationGenomeHandoff.materializeGenome(validGenome, signature);
    expect(admitted.status).toBe('ADMITTED');
    if (admitted.status === 'ADMITTED') {
      expect(admitted.graph.graphId).toBe('synth-genome-lab-genome-042');
      expect(admitted.graph.provenance.datasetFingerprint).toBe(signature.provenance.datasetFingerprint);
      expect(admitted.graph.provenance.fitnessModelVersion).toBe('GenomeHandoff-lab-nsga3-v2.1');
    }

    // 2. Malicious genome attempting to forge analytical dataset identity
    const maliciousGenome = {
      ...validGenome,
      datasetFingerprint: 'forged-fingerprint-0000',
    } as unknown as RepresentationGenomeV1;

    const rejected = RepresentationGenomeHandoff.materializeGenome(maliciousGenome, signature);
    expect(rejected.status).toBe('ABSTAIN');
    if (rejected.status === 'ABSTAIN') {
      expect(rejected.reason).toContain('forbidden datasetFingerprint');
    }

    // 3. Out of grammar genome (unsupported relation)
    const outOfGrammarGenome: RepresentationGenomeV1 = {
      ...validGenome,
      compositionGenes: [
        {
          fromGeneId: 'g-cluster',
          toGeneId: 'g-point',
          relation: 'OVERLAY', // Cluster OVERLAY Point is inadmissible in grammar
        },
      ],
    };
    const outOfGrammar = RepresentationGenomeHandoff.materializeGenome(outOfGrammarGenome, signature);
    expect(outOfGrammar.status).toBe('OUT_OF_GRAMMAR');
  });

  test('falsifier G: governed researcher adjustments and TechnoCore trade-off explanations', () => {
    const bridge = makeKernelMockBridge();
    const atlas = new AtlasCore({ kernel: bridge });
    const ds = makeMultiDimensionalDataset();
    atlas.loadDataset(ds);

    // Search under SIMPLER preference
    const simplerResult = atlas.searchRepresentations({
      preference: 'SIMPLER',
      maxGenerations: 2,
    });
    expect(simplerResult.preference).toBe('SIMPLER');

    // Search under SHOW_MORE_UNCERTAINTY preference
    const uncertaintyResult = atlas.searchRepresentations({
      preference: 'SHOW_MORE_UNCERTAINTY',
      maxGenerations: 2,
    });
    expect(uncertaintyResult.preference).toBe('SHOW_MORE_UNCERTAINTY');

    // Explain trade-offs
    const topCandidate = simplerResult.paretoFrontier[0];
    const explanation = atlas.explainObjectiveTradeoffs(topCandidate, 'SIMPLER');
    expect(explanation).toContain('Evaluation under [SIMPLER] profile:');
    expect(explanation).toContain('Task Relevance:');
    expect(explanation).toContain('Resource Efficiency:');
  });
});
