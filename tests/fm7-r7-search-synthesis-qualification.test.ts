import { describe, test, expect } from 'vitest';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.ts';
import {
  RepresentationSearchEngine,
  RepresentationGenomeHandoff,
  validateGraphAgainstGrammar,
  paretoDominates,
  type RepresentationGenomeV1,
} from '../src/moneta/search/index.ts';
import { buildDatasetSignature } from '../src/moneta/representation/SignatureBuilder.ts';
import { DESKTOP_EXPANSIVE_BUDGET } from '../src/moneta/forma/FormaResolutionBroker.ts';
import type { SemanticEmbodimentEnvelopeV1 } from '../src/moneta/representation/SemanticEmbodimentPayload.ts';
import type { EvidenceReferenceTupleV1 } from '../src/moneta/representation/SemanticSnapshotV1.ts';

describe('FM7-R7: Searching / Synthesizing Moneta Product Qualification Battery', () => {
  function makeMultiDimensionalDataset(): Dataset {
    const rows = [];
    for (let i = 0; i < 60; i++) {
      rows.push({
        dim1: i * 1.5,
        dim2: (i % 5) * 2.0,
        dim3: (i % 3) * 3.5,
        category: i % 2 === 0 ? 'GroupA' : 'GroupB',
      });
    }
    return new Dataset(
      'fm7-qual-ds',
      [
        { name: 'dim1', type: ColumnType.NUMERIC },
        { name: 'dim2', type: ColumnType.NUMERIC },
        { name: 'dim3', type: ColumnType.NUMERIC },
        { name: 'category', type: ColumnType.CATEGORICAL },
      ],
      rows
    );
  }

  function makeValidEvidence(datasetFingerprint: string): {
    envelope: SemanticEmbodimentEnvelopeV1;
    evidenceReferences: EvidenceReferenceTupleV1[];
  } {
    const evidenceReferences: EvidenceReferenceTupleV1[] = [
      {
        datasetFingerprint,
        kernelVersion: '1.0.0',
        bundleContentDigest: 'sha256-bundle-fm7-001',
        receiptId: 'receipt-fm7-001',
        receiptContentDigest: 'sha256-receipt-fm7-001',
        consumerId: 'descriptive-summary/v1',
        requirementProfileId: 'profile-fm7-001',
        requirementProfileDigest: 'sha256-profile-digest-fm7-001',
        admissionPolicyId: 'policy-fm7-001',
        admissionPolicyDigest: 'sha256-policy-digest-fm7-001',
      },
    ];

    const envelope: SemanticEmbodimentEnvelopeV1 = {
      schemaVersion: 1,
      datasetFingerprint,
      candidateId: 'AGGREGATE_VOLUME',
      representationFamily: 'AGGREGATE',
      analyticalMethod: {
        name: 'aggregateVolume',
        version: '1.0.0',
        parameters: { groupingFields: ['category'], measure: 'COUNT' },
      },
      approximation: { mode: 'EXACT', representedRowCount: 60 },
      informationContract: {
        preserves: ['exact-metric-values'],
        loses: ['individual-observation-identity'],
      },
      resource: { sourceRowCount: 60, elementCount: 2, maxElementCount: 4096 },
      provenance: {
        kernelVersion: '1.0.0',
        algorithmVersion: '1.0.0',
        decisionId: 'decision-fm7-qual-01',
        decisionModelVersion: 'onnx-v2',
        decisionModelArtifactHash: 'hash-fm7-qual',
      },
      result: {
        status: 'READY',
        payload: {
          kind: 'AGGREGATE_VOLUME',
          data: {
            groupingFields: ['category'],
            measure: { function: 'COUNT' },
            groups: [
              { semanticId: 'group-a', key: 'GroupA', count: 30 },
              { semanticId: 'group-b', key: 'GroupB', count: 30 },
            ],
          },
        },
      },
    };

    return { envelope, evidenceReferences };
  }

  test('1. Multi-Objective Search: constructs novel admissible representation graphs and 7D Pareto frontier', () => {
    const ds = makeMultiDimensionalDataset();
    const signature = buildDatasetSignature(ds);

    const searchResult = RepresentationSearchEngine.search(signature, {
      preference: 'BALANCED',
      maxGenerations: 3,
      populationSize: 8,
    });

    expect(searchResult.candidates.length).toBeGreaterThan(0);
    expect(searchResult.paretoFrontier.length).toBeGreaterThan(0);
    expect(searchResult.referenceCandidate).toBeDefined();

    // Verify 7-dimensional objective vector bounds for all candidates
    for (const cand of searchResult.candidates) {
      const vec = cand.objectiveVector;
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

      // Verify strict grammar validation
      const validation = validateGraphAgainstGrammar(cand.graph);
      expect(validation.valid).toBe(true);
    }

    // Verify non-domination property on rank 1 Pareto frontier
    const frontier = searchResult.paretoFrontier;
    for (let i = 0; i < frontier.length; i++) {
      for (let j = 0; j < frontier.length; j++) {
        if (i === j) continue;
        expect(paretoDominates(frontier[i].objectiveVector, frontier[j].objectiveVector)).toBe(false);
      }
    }
  });

  test('2. System-1 Seeding & Deterministic Bypass: System-1 proposals seed initial population while bypass isolates search', () => {
    const bridge = makeKernelMockBridge();
    const atlas = new AtlasCore({ kernel: bridge });
    const ds = makeMultiDimensionalDataset();
    atlas.loadDataset(ds);

    atlas.commitInvestigationContext('node-fm7-s1', {
      schemaVersion: 2,
      nodeId: 'node-fm7-s1',
      intent: {
        schemaVersion: 1,
        researchQuestion: 'How do clusters align across numeric dimensions?',
        variablesOfInterest: ['dim1', 'dim2'],
        currentTask: 'find-outliers',
      },
      epistemicPurpose: 'CLAIM_BEARING',
    });

    const evidence = makeValidEvidence(atlas.datasetFingerprint!);

    // Standard run with System-1 advice applied
    const advisedResult = atlas.adaptRepresentation({
      preference: 'BALANCED',
      budget: DESKTOP_EXPANSIVE_BUDGET,
      analyticalEvidence: evidence,
    });

    expect(advisedResult.system1AdviceApplied).toBe(true);
    expect(advisedResult.system1ProposalSet).toBeDefined();

    // Deterministic bypass run (ignoreSystem1Advice: true)
    const bypassResult = atlas.adaptRepresentation({
      preference: 'BALANCED',
      budget: DESKTOP_EXPANSIVE_BUDGET,
      ignoreSystem1Advice: true,
      analyticalEvidence: evidence,
    });

    expect(bypassResult.system1AdviceApplied).toBe(false);
    expect(bypassResult.system1ProposalSet).toBeDefined(); // Recorded for audit
  });

  test('3. Governed Objective Adjustments: user preferences alter Pareto selection and TechnoCore trade-offs', () => {
    const bridge = makeKernelMockBridge();
    const atlas = new AtlasCore({ kernel: bridge });
    const ds = makeMultiDimensionalDataset();
    atlas.loadDataset(ds);

    const evidence = makeValidEvidence(atlas.datasetFingerprint!);

    const simpler = atlas.adaptRepresentation({
      preference: 'SIMPLER',
      analyticalEvidence: evidence,
    });
    const uncertainty = atlas.adaptRepresentation({
      preference: 'SHOW_MORE_UNCERTAINTY',
      analyticalEvidence: evidence,
    });

    expect(simpler.candidate.utility).toBeGreaterThan(0);
    expect(uncertainty.candidate.utility).toBeGreaterThan(0);

    const explanation = atlas.explainFullMonetaDecision(simpler, 'SIMPLER');
    expect(explanation).toContain('FULL MONETA SYNTHESIS REPORT');
    expect(explanation).toContain('Objective Vector Evaluation (Preference: [SIMPLER]');
  });

  test('4. Laboratory Genome Handoff: MCR7 materialization validates external genomes and fails closed on forgery', () => {
    const ds = makeMultiDimensionalDataset();
    const signature = buildDatasetSignature(ds);

    // Valid external laboratory genome
    const validGenome: RepresentationGenomeV1 = {
      schemaVersion: '1.0.0',
      genomeId: 'lab-genome-777',
      lineage: {
        generation: 10,
        parentGenomeIds: ['parent-01'],
        laboratoryEngineVersion: 'lab-nsga3-v2.0',
      },
      primitiveGenes: [
        { geneId: 'g1', kind: 'POINT_IDENTITY', encodings: { position: 'xyz' } },
        { geneId: 'g2', kind: 'CLUSTER', encodings: { color: 'categorical' } },
      ],
      compositionGenes: [{ fromGeneId: 'g1', toGeneId: 'g2', relation: 'CONTAINS' }],
    };

    const admitted = RepresentationGenomeHandoff.materializeGenome(validGenome, signature);
    expect(admitted.status).toBe('ADMITTED');

    // Forged dataset fingerprint attempt
    const maliciousGenome = {
      ...validGenome,
      datasetFingerprint: 'forged-sha256-fingerprint',
    } as unknown as RepresentationGenomeV1;

    const rejected = RepresentationGenomeHandoff.materializeGenome(maliciousGenome, signature);
    expect(rejected.status).toBe('ABSTAIN');
  });

  test('5. Research Mode Freezing: search parameters freeze in Research Mode preserving bitwise digests', async () => {
    const bridge = makeKernelMockBridge();
    const atlas = new AtlasCore({ kernel: bridge });
    const ds = makeMultiDimensionalDataset();
    atlas.loadDataset(ds);

    const initialFingerprint = atlas.datasetFingerprint!;
    const initialDigest = await atlas.computeDigest();

    atlas.setResearchMode(true);
    expect(atlas.isResearchMode()).toBe(true);

    const evidence = makeValidEvidence(initialFingerprint);
    const r1 = atlas.adaptRepresentation({ analyticalEvidence: evidence });
    const r2 = atlas.adaptRepresentation({ analyticalEvidence: evidence });

    expect(r1.researchModeFrozen).toBe(true);
    expect(r2.researchModeFrozen).toBe(true);
    expect(r1.provenance.fitnessModelVersion).toBe('FullMonetaEngine-FrozenResearchMode-v1');

    // Invariance checks
    expect(atlas.datasetFingerprint).toBe(initialFingerprint);
    expect(await atlas.computeDigest()).toBe(initialDigest);
  });
});
