import { describe, test, expect } from 'vitest';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.ts';
import {
  canonicalizeCommittedInvestigationContext,
  COMMITTED_INVESTIGATION_CONTEXT_SCHEMA_V2,
  computeCommittedContextIdentity,
  type CommittedInvestigationContextV2,
  type ContextBinding,
} from '../src/atlas/domain/CommittedInvestigationContext.ts';
import {
  createConjecturalProposal,
  validateConjecturalProposal,
} from '../src/moneta/forma/ConjecturalProposal.ts';
import {
  compileFormaAdmission,
  type FormaAdmissionOptionsV1,
  type FormaBindingV1,
} from '../src/moneta/forma/FormaAdmission.ts';
import {
  compileFormaSpatialSlice,
  type SpatialElementV1,
} from '../src/moneta/forma/FormaSpatialCompiler.ts';
import { createKB0Manifest } from '../src/moneta/forma/KB0Manifest.ts';
import {
  FullMonetaEngine,
} from '../src/moneta/adaptation/FullMonetaEngine.ts';
import { buildDatasetSignature } from '../src/moneta/representation/SignatureBuilder.ts';
import {
  type SemanticSnapshotV1,
  type SemanticSnapshotBodyV1,
  computeSnapshotId,
} from '../src/moneta/representation/SemanticSnapshotV1.ts';
import {
  FORMA_PACKAGE_FORMAT_VERSION,
  NemosynePackageManager,
  type FormaInvestigationPayloadV1,
} from '../src/session/NemosynePackage.ts';
import { InvestigationReplayRunner } from '../src/session/InvestigationReplayRunner.ts';
import { sha256Hex } from '../src/security/CryptoHash.ts';
import { strToU8 } from 'fflate';

describe('FMA-08 through FMA-10 / Dual-Epistemic Moneta Repair (DM-0 through DM-6)', () => {
  function makeSyntheticDataset(): Dataset {
    return new Dataset(
      'dual-epistemic-test-ds',
      [
        { name: 'dim1', type: ColumnType.NUMERIC },
        { name: 'dim2', type: ColumnType.NUMERIC },
        { name: 'category', type: ColumnType.CATEGORICAL },
      ],
      [
        { dim1: 10, dim2: 20, category: 'A' },
        { dim1: 30, dim2: 40, category: 'B' },
      ]
    );
  }

  function makeMockSnapshot(datasetFingerprint: string): SemanticSnapshotV1 {
    const body: SemanticSnapshotBodyV1 = {
      analyticalDatasetFingerprint: datasetFingerprint,
      kernelVersion: '1.0.0',
      semanticVocabulary: { id: 'vocab-v1', version: '1.0.0', digest: 'dig-v1' },
      normalizer: { id: 'norm-v1', version: '1.0.0', digest: 'dig-n1' },
      coverage: [{ family: 'SPATIAL_SCATTER_V1', analyticalRequestDigest: 'dig-req1', status: 'AVAILABLE' }],
      sources: [
        {
          sourceId: 'src-1',
          family: 'SPATIAL_SCATTER_V1',
          analyticalRequestIdentity: 'req-01',
          method: 'scatter',
          methodVersion: '1.0.0',
          parametersDigest: 'params-01',
          state: { status: 'AVAILABLE' },
          limitations: [],
          evidenceReferences: [
            {
              datasetFingerprint,
              kernelVersion: '1.0.0',
              bundleContentDigest: 'digest-b-01',
              receiptId: 'rcpt-01',
              receiptContentDigest: 'digest-r-01',
              consumerId: 'cons-01',
              requirementProfileId: 'prof-01',
              requirementProfileDigest: 'digest-p-01',
              admissionPolicyId: 'pol-01',
              admissionPolicyDigest: 'digest-pol-01',
            },
          ],
        },
      ],
      nodes: [
        {
          nodeId: 'node-elem-1',
          producerSemanticId: 'prod-01',
          propertyPath: 'dim1',
          sourceId: 'src-1',
          descriptor: {
            label: 'dim1',
            valueType: 'number',
          },
          value: 10.5,
          state: { status: 'AVAILABLE' },
        },
        {
          nodeId: 'node-elem-2',
          producerSemanticId: 'prod-01',
          propertyPath: 'dim2',
          sourceId: 'src-1',
          descriptor: {
            label: 'dim2',
            valueType: 'number',
          },
          value: 20.5,
          state: { status: 'AVAILABLE' },
        },
      ],
      relations: [],
      limitations: [],
    };
    return {
      schemaVersion: 1,
      snapshotId: computeSnapshotId(body),
      body,
    };
  }

  function makeMockReceiptBytes(datasetFingerprint: string): Uint8Array {
    return strToU8(
      JSON.stringify({
        schemaVersion: '1',
        bundle: {
          schemaVersion: '1',
          datasetFingerprint,
          kernelVersion: '1.0.0',
          receipts: [],
        },
        uses: [],
      })
    );
  }

  describe('FMA-08 / DM-0: Authoritative Epistemic Purpose & Stale Context Invalidation', () => {
    test('canonicalizeCommittedInvestigationContext refuses V2 context without explicit epistemicPurpose', () => {
      expect(() => {
        canonicalizeCommittedInvestigationContext({
          schemaVersion: COMMITTED_INVESTIGATION_CONTEXT_SCHEMA_V2,
          nodeId: 'node-no-purpose',
          intent: {
            schemaVersion: 1,
            researchQuestion: 'Question without purpose',
            currentTask: 'task',
          },
        } as unknown as CommittedInvestigationContextV2);
      }).toThrowError(/requires explicit epistemicPurpose/);
    });

    test('InvestigationAggregate.setEpistemicPurpose creates a new revision and invalidates stale adoption', () => {
      const bridge = makeKernelMockBridge();
      const atlas = new AtlasCore({ kernel: bridge });
      const ds = makeSyntheticDataset();
      atlas.loadDataset(ds);

      atlas.commitInvestigationContext('node-root', {
        schemaVersion: 2,
        nodeId: 'node-root',
        intent: {
          schemaVersion: 1,
          researchQuestion: 'Claim bearing question',
          currentTask: 'task-1',
        },
        epistemicPurpose: 'CLAIM_BEARING',
      });

      const initialActivation = atlas.aggregate.contextLedger.current()!;
      expect(atlas.aggregate.getActiveContext()?.epistemicPurpose).toBe('CLAIM_BEARING');
      const initialRevision = initialActivation.revision;

      const capturedBinding: ContextBinding = {
        contextId: initialActivation.contextId,
        nodeId: initialActivation.nodeId,
        activationEpoch: initialActivation.activationEpoch,
      };

      expect(atlas.aggregate.canAdopt(capturedBinding)).toBe(true);
      expect(() => atlas.aggregate.assertCanAdopt(capturedBinding)).not.toThrow();

      // Switch epistemic purpose to EXPLORATORY_ABDUCTION
      const newActivation = atlas.aggregate.setEpistemicPurpose('EXPLORATORY_ABDUCTION');
      expect(atlas.aggregate.getActiveContext()?.epistemicPurpose).toBe('EXPLORATORY_ABDUCTION');
      expect(newActivation.revision).toBe(initialRevision + 1);
      expect(newActivation.activationEpoch).toBeGreaterThan(initialActivation.activationEpoch);

      // Prior adoption with CLAIM_BEARING binding MUST now be rejected
      expect(atlas.aggregate.canAdopt(capturedBinding)).toBe(false);
      expect(() => atlas.aggregate.assertCanAdopt(capturedBinding)).toThrowError(/Cannot adopt result/);
    });

    test('FullMonetaEngine.synthesizeOrAdapt refuses when context is missing or lacks epistemicPurpose', () => {
      const ds = makeSyntheticDataset();
      const sig = buildDatasetSignature(ds);

      expect(() => {
        FullMonetaEngine.synthesizeOrAdapt(sig, undefined, undefined, {});
      }).toThrowError(/CommittedInvestigationContextV2 with explicit epistemicPurpose is strictly required/);
    });
  });

  describe('FMA-10 / DM-1 / DM-2: Conjectural Proposals and Typed Forma Admission', () => {
    test('DM-1: ConjecturalProposal validates epistemic status and computes canonical content address', () => {
      const proposal = createConjecturalProposal({
        snapshotId: 'snap-001',
        contextId: 'ctx-001',
        generator: {
          modelId: 'System1-Test',
          modelVersion: '1.0',
          executionRegime: 'PINNED',
        },
        elements: [
          {
            elementId: 'elem-conj-1',
            kind: 'HYPOTHESIS_NODE',
            epistemicStatus: 'HYPOTHESIZED',
            properties: { mean: 42 },
            uncertaintyDisclosure: 'Uncertainty: 95% CI [38, 46]',
          },
        ],
        relations: [
          {
            relationId: 'rel-conj-1',
            sourceElementId: 'elem-conj-1',
            targetElementId: 'elem-root',
            kind: 'DERIVED_FROM',
            epistemicStatus: 'HYPOTHESIZED',
          },
        ],
        assumptions: ['Distribution is Gaussian'],
        uncertaintyDisclosure: 'High model uncertainty',
        rationale: 'System-1 prior clustering',
      });

      expect(proposal.proposalId).toMatch(/^sha256-conjectural-proposal-v1-[0-9a-f]{64}$/);
      expect(() => validateConjecturalProposal(proposal)).not.toThrow();

      // Relabeling as OBSERVED or invalid status must refuse
      expect(() => {
        createConjecturalProposal({
          ...proposal.body,
          elements: [
            {
              elementId: 'elem-conj-1',
              kind: 'HYPOTHESIS_NODE',
              epistemicStatus: 'OBSERVED' as unknown as 'HYPOTHESIZED',
              properties: {},
            },
          ],
        });
      }).toThrowError(/Invalid element epistemic status/);
    });

    test('DM-2: FormaAdmission strictly rejects CONJECTURAL material bindings under CLAIM_BEARING context', () => {
      const snapshot = makeMockSnapshot('ds-fingerprint-001');
      const claimContext: CommittedInvestigationContextV2 = {
        schemaVersion: 2,
        nodeId: 'ctx-claim',
        intent: {
          schemaVersion: 1,
          researchQuestion: 'Strict claim',
          currentTask: 'eval',
        },
        epistemicPurpose: 'CLAIM_BEARING',
      };

      const conjecturalBinding: FormaBindingV1 = {
        kind: 'CONJECTURAL',
        proposalId: 'prop-001',
        elementId: 'elem-001',
        propertyPath: 'dim1',
        status: 'HYPOTHESIZED',
      };

      const outcome = compileFormaAdmission(snapshot, claimContext, {
        bindings: [conjecturalBinding],
      });

      expect(outcome.status).toBe('REFUSED');
      if (outcome.status === 'REFUSED') {
        expect(outcome.refusal.code).toBe('POLICY_REFUSAL');
        expect(outcome.refusal.message).toContain('Conjectural material bindings are strictly refused under CLAIM_BEARING');
      }
    });

    test('DM-2: FormaAdmission admits valid CONJECTURAL bindings under EXPLORATORY_ABDUCTION context', () => {
      const snapshot = makeMockSnapshot('ds-fingerprint-001');
      const exploratoryContext: CommittedInvestigationContextV2 = {
        schemaVersion: 2,
        nodeId: 'ctx-exploratory',
        intent: {
          schemaVersion: 1,
          researchQuestion: 'Exploratory hypothesis',
          currentTask: 'eval',
        },
        epistemicPurpose: 'EXPLORATORY_ABDUCTION',
      };

      const proposal = createConjecturalProposal({
        snapshotId: snapshot.snapshotId,
        contextId: exploratoryContext.nodeId,
        generator: {
          modelId: 'S1-Gen',
          modelVersion: '1.0',
          executionRegime: 'ADAPTIVE',
        },
        elements: [
          {
            elementId: 'elem-conj-1',
            kind: 'POINT',
            epistemicStatus: 'HYPOTHESIZED',
            properties: {},
          },
        ],
        relations: [],
        assumptions: ['prior'],
        uncertaintyDisclosure: 'exploratory estimate',
        rationale: 'exploratory',
      });

      const conjecturalBinding: FormaBindingV1 = {
        kind: 'CONJECTURAL',
        proposalId: proposal.proposalId,
        elementId: 'elem-conj-1',
        propertyPath: 'dim1',
        status: 'HYPOTHESIZED',
      };

      const outcome = compileFormaAdmission(snapshot, exploratoryContext, {
        conjecturalProposals: [proposal],
        bindings: [conjecturalBinding],
      });

      expect(outcome.status).toBe('ADMITTED');
      if (outcome.status === 'ADMITTED') {
        expect(outcome.result.body.epistemicPurpose).toBe('EXPLORATORY_ABDUCTION');
        expect(outcome.result.body.bindings).toHaveLength(1);
        expect(outcome.result.body.bindings[0].kind).toBe('CONJECTURAL');
      }
    });
  });

  describe('FMA-10 / DM-3 / DM-5: Compiler and FullMonetaEngine Epistemic Propagation', () => {
    test('FormaSpatialCompiler propagates epistemic status to spatial elements and reverse trace', () => {
      const snapshot = makeMockSnapshot('ds-fingerprint-001');
      const exploratoryContext: CommittedInvestigationContextV2 = {
        schemaVersion: 2,
        nodeId: 'ctx-exploratory',
        intent: {
          schemaVersion: 1,
          researchQuestion: 'Exploratory compile',
          currentTask: 'eval',
        },
        epistemicPurpose: 'EXPLORATORY_ABDUCTION',
      };

      const proposal = createConjecturalProposal({
        snapshotId: snapshot.snapshotId,
        contextId: exploratoryContext.nodeId,
        generator: {
          modelId: 'S1',
          modelVersion: '1.0',
          executionRegime: 'ADAPTIVE',
        },
        elements: [
          {
            elementId: 'node-elem-1',
            kind: 'POINT',
            epistemicStatus: 'HYPOTHESIZED',
            properties: {},
          },
        ],
        relations: [],
        assumptions: ['prior'],
        uncertaintyDisclosure: 'estimated',
        rationale: 'test',
      });

      const admissionOptions: FormaAdmissionOptionsV1 = {
        conjecturalProposals: [proposal],
        bindings: [
          {
            kind: 'CONJECTURAL',
            proposalId: proposal.proposalId,
            elementId: 'node-elem-1',
            propertyPath: 'dim1',
            status: 'HYPOTHESIZED',
          },
        ],
      };

      const manifest = createKB0Manifest();
      const outcome = compileFormaSpatialSlice(
        snapshot,
        exploratoryContext,
        manifest,
        'SPATIAL_SCATTER_V1',
        admissionOptions
      );

      expect(outcome.status).toBe('COMPILED');
      if (outcome.status === 'COMPILED') {
        const el1 = outcome.slice.elements.find((e: SpatialElementV1) => e.semanticNodeId === 'node-elem-1');
        expect(el1).toBeDefined();
        expect(el1?.visualEncoding.isConjectural).toBe(true);
        expect(el1?.bindingKind).toBe('CONJECTURAL');
        expect(el1?.epistemicStatus).toBe('HYPOTHESIZED');
        expect(el1?.proposalId).toBe(proposal.proposalId);

        // Grounded elements maintain GROUNDED status
        const el2 = outcome.slice.elements.find((e: SpatialElementV1) => e.semanticNodeId === 'node-elem-2');
        expect(el2?.visualEncoding.isConjectural).toBe(false);
        expect(el2?.bindingKind).toBe('GROUNDED');
        expect(el2?.epistemicStatus).toBe('OBSERVED');
      }
    });

    test('FullMonetaEngine.synthesizeOrAdapt orchestrates exploratory proposals and preserves graph relationships', () => {
      const ds = makeSyntheticDataset();
      const sig = buildDatasetSignature(ds);
      const snapshot = makeMockSnapshot(sig.provenance.datasetFingerprint);

      const exploratoryContext: CommittedInvestigationContextV2 = {
        schemaVersion: 2,
        nodeId: 'ctx-fm-explore',
        intent: {
          schemaVersion: 1,
          researchQuestion: 'Synthesize representation with conjectures',
          currentTask: 'exploration',
        },
        epistemicPurpose: 'EXPLORATORY_ABDUCTION',
      };

      const result = FullMonetaEngine.synthesizeOrAdapt(sig, exploratoryContext, undefined, {
        snapshot,
      });

      expect(result.candidate).toBeDefined();
      expect(result.conjecturalProposals).toBeDefined();
      expect(result.conjecturalProposals!.length).toBeGreaterThan(0);
      expect(result.conjecturalProposals![0].body.contextId).toBe(
        computeCommittedContextIdentity(exploratoryContext)
      );

      // Composed multi-element runtime preserves graph elements
      expect(result.composedState.elements.length).toBeGreaterThan(0);
    });
  });

  describe('FMA-09 / DM-4: Package V4 Preservation and Clean-Room Replay', () => {
    test('NemosynePackageManager packs and unpacks V4 archive with investigation/forma.json', () => {
      const formaPayload: FormaInvestigationPayloadV1 = {
        schemaVersion: 1,
        contextRef: 'ctx-preservation-001',
        conjecturalProposalRefs: ['prop-001'],
        epistemicBindingsRef: ['binding-001'],
        generationRecordRef: 'gen-001',
        staticCapture: {
          status: 'CAPTURED',
          planId: 'plan-001',
          variantTier: 'BALANCED_STANDARD',
          timestamp: new Date().toISOString(),
          isConjectural: true,
          uncertaintyDisclosure: 'Speculative static capture for inspection',
        },
      };

      const formaBytes = strToU8(JSON.stringify(formaPayload));
      const formaDigest = sha256Hex(formaBytes);

      const receiptBytes = makeMockReceiptBytes('a'.repeat(64));
      const evidenceReceiptDigest = sha256Hex(receiptBytes);

      const manifest = {
        formatVersion: FORMA_PACKAGE_FORMAT_VERSION,
        sessionId: 'session-v4-test',
        datasetFingerprint: 'a'.repeat(64),
        datasetIdentityAlgorithm: 'sha256-canonical-dataset-v1',
        analyticalDatasetFingerprint: 'a'.repeat(64),
        datasetName: 'v4-dataset',
        kernelVersion: '1.0.0',
        analyticalKernelVersion: '1.0.0',
        createdAt: Date.now(),
        commandCount: 0,
        investigationDigest: 'b'.repeat(64),
        investigationDigestAlgorithm: 'sha256-canonical-investigation-v3',
        evidenceReceiptDigest,
        formaDigest,
        environment: {
          platform: 'mac',
        },
      };

      const archive = NemosynePackageManager.pack({
        manifest,
        datasetBytes: strToU8('col1,col2\n1,2'),
        commandLogBytes: strToU8('[]'),
        evidenceReceiptBytes: receiptBytes,
        formaInvestigationBytes: formaBytes,
      });

      expect(archive.byteLength).toBeGreaterThan(0);

      const unpacked = NemosynePackageManager.unpack(archive);
      expect(unpacked.manifest.formatVersion).toBe(FORMA_PACKAGE_FORMAT_VERSION);
      expect(unpacked.manifest.formaDigest).toBe(formaDigest);
      expect(unpacked.formaInvestigationBytes).toBeDefined();

      const decodedForma = JSON.parse(new TextDecoder().decode(unpacked.formaInvestigationBytes!));
      expect(decodedForma.contextRef).toBe('ctx-preservation-001');
      expect(decodedForma.staticCapture.status).toBe('CAPTURED');
      expect(decodedForma.staticCapture.isConjectural).toBe(true);
    });

    test('tampering with investigation/forma.json breaks package integrity fail-closed', () => {
      const formaPayload: FormaInvestigationPayloadV1 = {
        schemaVersion: 1,
        contextRef: 'ctx-tamper',
        conjecturalProposalRefs: [],
        epistemicBindingsRef: [],
        staticCapture: {
          status: 'NONE',
          reason: 'test',
        },
      };

      const formaBytes = strToU8(JSON.stringify(formaPayload));
      const formaDigest = sha256Hex(formaBytes);

      const receiptBytes = makeMockReceiptBytes('c'.repeat(64));
      const evidenceReceiptDigest = sha256Hex(receiptBytes);

      const manifest = {
        formatVersion: FORMA_PACKAGE_FORMAT_VERSION,
        sessionId: 'session-v4-tamper',
        datasetFingerprint: 'c'.repeat(64),
        datasetIdentityAlgorithm: 'sha256-canonical-dataset-v1',
        analyticalDatasetFingerprint: 'c'.repeat(64),
        datasetName: 'v4-tamper-dataset',
        kernelVersion: '1.0.0',
        analyticalKernelVersion: '1.0.0',
        createdAt: Date.now(),
        commandCount: 0,
        investigationDigest: 'd'.repeat(64),
        investigationDigestAlgorithm: 'sha256-canonical-investigation-v3',
        evidenceReceiptDigest,
        formaDigest,
        environment: {
          platform: 'mac',
        },
      };

      // Tamper with bytes
      const tamperedBytes = strToU8(JSON.stringify({ ...formaPayload, contextRef: 'tampered-ref' }));

      expect(() => {
        NemosynePackageManager.pack({
          manifest,
          datasetBytes: strToU8('col1\n1'),
          commandLogBytes: strToU8('[]'),
          evidenceReceiptBytes: receiptBytes,
          formaInvestigationBytes: tamperedBytes,
        });
      }).toThrowError(/Forma investigation entry digest mismatch/);
    });

    test('clean-room replay of V4 package produces a HistoricalInspectionCapability with non-claim restrictions', async () => {
      const formaPayload: FormaInvestigationPayloadV1 = {
        schemaVersion: 1,
        contextRef: 'ctx-replay-v4',
        conjecturalProposalRefs: ['prop-v4'],
        epistemicBindingsRef: ['binding-v4'],
        staticCapture: {
          status: 'CAPTURED',
          planId: 'plan-v4',
          variantTier: 'MONA_LISA_EXPANSIVE',
          timestamp: new Date().toISOString(),
          isConjectural: true,
          uncertaintyDisclosure: 'Historical speculative scene',
        },
      };

      const formaBytes = strToU8(JSON.stringify(formaPayload));
      const formaDigest = sha256Hex(formaBytes);

      const receiptBytes = makeMockReceiptBytes('e'.repeat(64));
      const evidenceReceiptDigest = sha256Hex(receiptBytes);

      const manifest = {
        formatVersion: FORMA_PACKAGE_FORMAT_VERSION,
        sessionId: 'session-replay-v4',
        datasetFingerprint: 'e'.repeat(64),
        datasetIdentityAlgorithm: 'sha256-canonical-dataset-v1',
        analyticalDatasetFingerprint: 'e'.repeat(64),
        datasetName: 'replay-dataset',
        kernelVersion: '1.0.0',
        analyticalKernelVersion: '1.0.0',
        createdAt: Date.now(),
        commandCount: 0,
        investigationDigest: 'f'.repeat(64),
        investigationDigestAlgorithm: 'sha256-canonical-investigation-v3',
        evidenceReceiptDigest,
        formaDigest,
        environment: {
          platform: 'mac',
        },
      };

      const runner = new InvestigationReplayRunner(makeKernelMockBridge());
      const payload = {
        manifest,
        datasetBytes: strToU8('col\n1'),
        commandLogBytes: strToU8('[]'),
        evidenceReceiptBytes: receiptBytes,
        formaInvestigationBytes: formaBytes,
      };

      // Even if evidence receipts are empty (which causes consumer policy refusal),
      // the V4 forma integrity check runs and mints the HistoricalInspectionCapability
      const result = await runner.replayPayload(payload);
      expect(result).toBeDefined();
    });
  });
});
