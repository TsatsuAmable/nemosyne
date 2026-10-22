import { describe, it, expect } from 'vitest';
import {
  runDSE6Qualification,
  DSE6_QUALIFICATION_SCHEMA_VERSION,
  DSE6_EVIDENCE_SCOPE,
  type DSE6QualificationReportV2,
} from '../src/moneta/representation/DSE6LoopQualification.ts';
import {
  compileDirectEmbodimentPlan,
} from '../src/moneta/representation/DirectEmbodimentCompiler.ts';
import {
  QUEST_CONSTRAINED_BUDGET,
} from '../src/moneta/forma/FormaResolutionBroker.js';
import {
  SEMANTIC_SNAPSHOT_SCHEMA_VERSION,
  computeSnapshotId,
  type SemanticSnapshotV1,
} from '../src/moneta/representation/SemanticSnapshotV1.ts';
import type { CommittedInvestigationContextV2 } from '../src/atlas/domain/CommittedInvestigationContext.ts';

const TEST_FINGERPRINT = 'e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7';

function makeSimpleSnapshot(): SemanticSnapshotV1 {
  const body = {
    analyticalDatasetFingerprint: TEST_FINGERPRINT,
    kernelVersion: '1.0.0-rust-wasm',
    semanticVocabulary: { id: 'vocab-test', version: '1.0.0', digest: 'digest-001' },
    normalizer: { id: 'norm-test', version: '1.0.0', digest: 'digest-002' },
    coverage: [
      { family: 'DISTRIBUTION', analyticalRequestDigest: 'digest-req-001', status: 'AVAILABLE' as const },
    ],
    sources: [
      {
        sourceId: 'src-01',
        family: 'DISTRIBUTION',
        analyticalRequestIdentity: 'req-01',
        method: 'kde',
        methodVersion: '1.0.0',
        parametersDigest: 'params-001',
        state: { status: 'AVAILABLE' as const },
        evidenceReferences: [],
        limitations: [],
      },
    ],
    nodes: [
      {
        nodeId: 'node-01',
        sourceId: 'src-01',
        producerSemanticId: 'kde',
        propertyPath: 'val',
        descriptor: { label: 'val', valueType: 'number' as const, frame: 'stat' },
        value: 42,
        state: { status: 'AVAILABLE' as const },
      },
    ],
    relations: [],
    limitations: [],
  };
  return { schemaVersion: SEMANTIC_SNAPSHOT_SCHEMA_VERSION, snapshotId: computeSnapshotId(body), body };
}

describe('DSE6 synthetic development battery: dataset-first direct loop, not promotion evidence', () => {
  it('runs bounded synthetic checks but refuses real-world qualification', async () => {
    const report: DSE6QualificationReportV2 = await runDSE6Qualification({
      targetCommit: 'test-commit-dse6',
      datasetFingerprint: TEST_FINGERPRINT,
      enduranceCycles: 10,
    });

    expect(report.schemaVersion).toBe(DSE6_QUALIFICATION_SCHEMA_VERSION);
    expect(report.reportId).toMatch(/^dse6-qual-[0-9a-f]{16}$/);
    expect(report.targetCommit).toBe('test-commit-dse6');
    expect(report.evidenceScope).toBe(DSE6_EVIDENCE_SCOPE);
    expect(report.qualification.status).toBe('NOT_QUALIFIED');
    expect(report.qualification.missingEvidenceGates).toHaveLength(5);
    expect(report.qualification.missingEvidenceGates).toContain('Physical Quest resource/frame and interaction measurements');
    expect(report.verdict.decision).toBe('REVISE');
    expect(report.verdict.rationale).toContain('Synthetic direct-plan');
    expect(report.verdict.rationale).toContain('DSE6 promotion is not authorised');
    expect(report.verdict.retainedDirectCapabilities.length).toBeGreaterThanOrEqual(4);
    expect(report.verdict.conditionalDeferredCapabilities).toContain(
      'DSE4 Multi-dataset comparison (offline lab research only)'
    );
    expect(report.verdict.conditionalDeferredCapabilities).toContain(
      'DSE5 Runtime population search (offline lab research only)'
    );
  });

  describe('Dimension 1: synthetic desktop and constrained-budget plan comparison', () => {
    it('enforces physical primitive envelope and shared traversal root', async () => {
      const report = await runDSE6Qualification({ enduranceCycles: 2 });
      const { budgetSimulation } = report;

      expect(budgetSimulation.status).toBe('PASS');
      expect(budgetSimulation.constrainedElements).toBeLessThanOrEqual(QUEST_CONSTRAINED_BUDGET.maxElements);
      expect(budgetSimulation.constrainedElements).toBeLessThanOrEqual(50);
      expect(budgetSimulation.desktopElements).toBeGreaterThanOrEqual(budgetSimulation.constrainedElements);
      expect(budgetSimulation.mandatoryNodesSurviving).toBe(true);
      expect(budgetSimulation.mandatoryChannelsSurviving).toBe(true);
      expect(budgetSimulation.traversalRootShared).toBe(true);
      expect(budgetSimulation.shedOptionalChannels).toBeInstanceOf(Array);
    });

    it('fails closed when budget violates finite positive constraint', () => {
      const snapshot = makeSimpleSnapshot();
      const context: CommittedInvestigationContextV2 = {
        schemaVersion: 2,
        nodeId: 'ctx-invalid-budget',
        epistemicPurpose: 'CLAIM_BEARING',
        intent: { schemaVersion: 1, researchQuestion: 'budget test', currentTask: 'test' },
      };

      expect(() => {
        compileDirectEmbodimentPlan({
          datasetFingerprint: TEST_FINGERPRINT,
          snapshot,
          context,
          budget: {
            profileName: 'INVALID',
            maxElements: NaN,
            maxMemoryBytes: 1024,
            maxChannels: 3,
            allowedShapes: ['SPHERE'],
            allowSecondaryEncodings: false,
          },
        });
      }).toThrow(/Refused: device budget 'maxElements' must be a finite positive number/);
    });
  });

  describe('Dimension 2: fixture plan cardinality, not real-N resource measurement', () => {
    it('compares identically sized synthetic fixtures with distinct row-count metadata', async () => {
      const report = await runDSE6Qualification({ enduranceCycles: 2 });
      const { syntheticCardinality } = report;

      expect(syntheticCardinality.status).toBe('PASS');
      expect(syntheticCardinality.executionRegime).toBe('DIRECT_DETERMINISTIC');
      expect(syntheticCardinality.neuralInferencesExecuted).toBe(0);
      expect(syntheticCardinality.evolutionaryGenerationsSpawned).toBe(0);
      expect(syntheticCardinality.planCardinalityStable).toBe(true);
      expect(syntheticCardinality.smallFixtureCompileMs).toBeGreaterThan(0);
      expect(syntheticCardinality.largeFixtureCompileMs).toBeGreaterThan(0);
      expect('memoryGrowthBytes' in syntheticCardinality).toBe(false);
    });
  });

  describe('Dimension 3: mock traversal eviction and rebuild', () => {
    it('completes mock page reconstruction without fabricating leak or byte-identity proof', async () => {
      const cycles = 15;
      const report = await runDSE6Qualification({ enduranceCycles: cycles });
      const { mockTraversal } = report;

      expect(mockTraversal.status).toBe('PASS');
      expect(mockTraversal.completedCycles).toBe(cycles);
      expect(mockTraversal.reconstructedPagesVerified).toBe(cycles);
      expect('byteIdenticalRebuildConfirmed' in mockTraversal).toBe(false);
      expect('memoryLeakDetected' in mockTraversal).toBe(false);
      expect(mockTraversal.activePagesAfterEviction).toBe(0);
    });
  });

  describe('Dimension 4: synthetic structure and mock lineage checks', () => {
    it('compiles fixture elements and follows mock traversal lineage', async () => {
      const report = await runDSE6Qualification({ enduranceCycles: 2 });
      const { syntheticStructure } = report;

      expect(syntheticStructure.status).toBe('PASS');
      expect(syntheticStructure.distributionElementsPresent).toBe(true);
      expect(syntheticStructure.clusterElementsPresent).toBe(true);
      expect(syntheticStructure.mockTraversalLineageConsistent).toBe(true);
      expect(syntheticStructure.mockDecisionIdentityConsistent).toBe(true);
    });
  });

  describe('Dimension 5: conjectural disclosure and color-remapping helper checks', () => {
    it('verifies claim-bearing refusal, exploratory disclosure, and color remapping', async () => {
      const report = await runDSE6Qualification({ enduranceCycles: 2 });
      const { syntheticDisclosure } = report;

      expect(syntheticDisclosure.status).toBe('PASS');
      expect(syntheticDisclosure.claimBearingRejectionVerified).toBe(true);
      expect(syntheticDisclosure.exploratoryConjectureVisible).toBe(true);
      expect(syntheticDisclosure.colorRemappingChangesColor).toBe(true);
      expect(syntheticDisclosure.conjecturalDisclosureCoverage).toBe(1.0);
    });
  });

  describe('Dimension 6: promotion refusal despite green fixture checks', () => {
    it('returns REVISE when all synthetic checks pass because real qualification is absent', async () => {
      const report = await runDSE6Qualification({ enduranceCycles: 5 });

      expect(report.verdict.decision).toBe('REVISE');
      expect(report.qualification.status).toBe('NOT_QUALIFIED');
      expect(JSON.stringify(report)).not.toMatch(/memoryGrowthBytes|memoryLeakDetected|byteIdenticalRebuildConfirmed/);
      expect(report.budgetSimulation.status).toBe('PASS');
      expect(report.syntheticCardinality.status).toBe('PASS');
      expect(report.mockTraversal.status).toBe('PASS');
      expect(report.syntheticStructure.status).toBe('PASS');
      expect(report.syntheticDisclosure.status).toBe('PASS');
      expect(report.verdict.retainedDirectCapabilities).toContain(
        'DirectEmbodimentCompiler (single-pass deterministic overview)'
      );
      expect(report.verdict.retainedDirectCapabilities).toContain(
        'DirectTraversalSession (reversible structure -> subset -> observation)'
      );
    });
  });
});
