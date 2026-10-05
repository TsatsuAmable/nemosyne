import { describe, it, expect } from 'vitest';
import {
  runDSE6Qualification,
  DSE6_QUALIFICATION_SCHEMA_VERSION,
  type DSE6QualificationReportV1,
} from '../src/moneta/representation/DSE6LoopQualification.ts';
import {
  compileDirectEmbodimentPlan,
  compileObligationPreservingVariants,
} from '../src/moneta/representation/DirectEmbodimentCompiler.ts';
import {
  DESKTOP_EXPANSIVE_BUDGET,
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

describe('DSE6 Qualification Battery: Complete Dataset-First Direct Loop', () => {
  it('executes full qualification battery and issues CONTINUE verdict', async () => {
    const report: DSE6QualificationReportV1 = await runDSE6Qualification({
      targetCommit: 'test-commit-dse6',
      datasetFingerprint: TEST_FINGERPRINT,
      enduranceCycles: 10,
    });

    expect(report.schemaVersion).toBe(DSE6_QUALIFICATION_SCHEMA_VERSION);
    expect(report.reportId).toMatch(/^dse6-qual-[0-9a-f]{16}$/);
    expect(report.targetCommit).toBe('test-commit-dse6');
    expect(report.verdict.decision).toBe('CONTINUE');
    expect(report.verdict.rationale).toContain('Direct dataset-first embodiment satisfies');
    expect(report.verdict.retainedDirectCapabilities.length).toBeGreaterThanOrEqual(4);
    expect(report.verdict.conditionalDeferredCapabilities).toContain(
      'DSE4 Multi-dataset comparison (offline lab research only)'
    );
    expect(report.verdict.conditionalDeferredCapabilities).toContain(
      'DSE5 Runtime population search (offline lab research only)'
    );
  });

  describe('Dimension 1: Physical Device Qualification (Desktop Expansive vs Quest Constrained)', () => {
    it('enforces physical primitive envelope and shared traversal root', async () => {
      const report = await runDSE6Qualification({ enduranceCycles: 2 });
      const { physicalDevice } = report;

      expect(physicalDevice.status).toBe('PASS');
      expect(physicalDevice.constrainedElements).toBeLessThanOrEqual(QUEST_CONSTRAINED_BUDGET.maxElements);
      expect(physicalDevice.constrainedElements).toBeLessThanOrEqual(50);
      expect(physicalDevice.desktopElements).toBeGreaterThanOrEqual(physicalDevice.constrainedElements);
      expect(physicalDevice.mandatoryNodesSurviving).toBe(true);
      expect(physicalDevice.mandatoryChannelsSurviving).toBe(true);
      expect(physicalDevice.traversalRootShared).toBe(true);
      expect(physicalDevice.shedOptionalChannels).toBeInstanceOf(Array);
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
            maxDrawCalls: 10,
          },
        });
      }).toThrow(/Refused: device budget 'maxElements' must be a finite positive number/);
    });
  });

  describe('Dimension 2: Resource Attribution & N-Independence', () => {
    it('proves O(1) plan cardinality across small and large datasets with zero neural overhead', async () => {
      const report = await runDSE6Qualification({ enduranceCycles: 2 });
      const { resourceAttribution } = report;

      expect(resourceAttribution.status).toBe('PASS');
      expect(resourceAttribution.executionRegime).toBe('DIRECT_DETERMINISTIC');
      expect(resourceAttribution.neuralInferencesExecuted).toBe(0);
      expect(resourceAttribution.evolutionaryGenerationsSpawned).toBe(0);
      expect(resourceAttribution.isNIndependent).toBe(true);
      expect(resourceAttribution.smallDatasetCompileMs).toBeGreaterThan(0);
      expect(resourceAttribution.largeDatasetCompileMs).toBeGreaterThan(0);
      expect(resourceAttribution.memoryGrowthBytes).toBe(0);
    });
  });

  describe('Dimension 3: Long-Session Endurance & Recovery', () => {
    it('executes repeated drill-down, eviction, and reconstruction cycles without leak', async () => {
      const cycles = 15;
      const report = await runDSE6Qualification({ enduranceCycles: cycles });
      const { longSessionEndurance } = report;

      expect(longSessionEndurance.status).toBe('PASS');
      expect(longSessionEndurance.completedCycles).toBe(cycles);
      expect(longSessionEndurance.reconstructedPagesVerified).toBe(cycles);
      expect(longSessionEndurance.byteIdenticalRebuildConfirmed).toBe(true);
      expect(longSessionEndurance.memoryLeakDetected).toBe(false);
      expect(longSessionEndurance.activePagesAfterEviction).toBe(0);
    });
  });

  describe('Dimension 4: Known-Structure Semantic Recovery', () => {
    it('recovers distribution modes and cluster hulls with intact multiscale lineage', async () => {
      const report = await runDSE6Qualification({ enduranceCycles: 2 });
      const { semanticRecovery } = report;

      expect(semanticRecovery.status).toBe('PASS');
      expect(semanticRecovery.distributionModeRecovered).toBe(true);
      expect(semanticRecovery.clusterCentroidsRecovered).toBe(true);
      expect(semanticRecovery.multiscaleLineageIntact).toBe(true);
      expect(semanticRecovery.dualDecisionProvenanceVerified).toBe(true);
    });
  });

  describe('Dimension 5: Accessibility & Dual-Mode Epistemic Disclosure', () => {
    it('verifies claim-bearing refusal, exploratory disclosure, and color remapping', async () => {
      const report = await runDSE6Qualification({ enduranceCycles: 2 });
      const { accessibilityAndDisclosure } = report;

      expect(accessibilityAndDisclosure.status).toBe('PASS');
      expect(accessibilityAndDisclosure.claimBearingRejectionVerified).toBe(true);
      expect(accessibilityAndDisclosure.exploratoryConjectureVisible).toBe(true);
      expect(accessibilityAndDisclosure.highContrastPaletteAccessible).toBe(true);
      expect(accessibilityAndDisclosure.conjecturalDisclosureCoverage).toBe(1.0);
    });
  });

  describe('Dimension 6: STOP / CONTINUE / REVISE Decision Logic', () => {
    it('returns CONTINUE when all dimensions pass, and provides transparent capability boundaries', async () => {
      const report = await runDSE6Qualification({ enduranceCycles: 5 });

      expect(report.verdict.decision).toBe('CONTINUE');
      expect(report.physicalDevice.status).toBe('PASS');
      expect(report.resourceAttribution.status).toBe('PASS');
      expect(report.longSessionEndurance.status).toBe('PASS');
      expect(report.semanticRecovery.status).toBe('PASS');
      expect(report.accessibilityAndDisclosure.status).toBe('PASS');
      expect(report.verdict.retainedDirectCapabilities).toContain(
        'DirectEmbodimentCompiler (single-pass deterministic overview)'
      );
      expect(report.verdict.retainedDirectCapabilities).toContain(
        'DirectTraversalSession (reversible structure -> subset -> observation)'
      );
    });
  });
});
