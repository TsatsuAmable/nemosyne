import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { strToU8, unzipSync, zipSync } from 'fflate';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import {
  canonicalizeCommittedInvestigationContext,
  type CommittedInvestigationContextV2,
} from '../src/atlas/domain/CommittedInvestigationContext.ts';
import type { ContextBinding } from '../src/atlas/domain/index.ts';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import { LoadDatasetUseCase } from '../src/app/dataset/LoadDatasetUseCase.ts';
import {
  compileFormaSpatialSlice,
  type FormaCompiledSliceV1,
} from '../src/moneta/forma/FormaSpatialCompiler.ts';
import { createKB0Manifest } from '../src/moneta/forma/KB0Manifest.ts';
import {
  normalizeEnvelopeToSnapshot,
  type EvidenceReferenceTupleV1,
} from '../src/moneta/representation/SemanticSnapshotV1.ts';
import type { SemanticEmbodimentEnvelopeV1 } from '../src/moneta/representation/SemanticEmbodimentPayload.ts';
import { VRTopologyTranslator } from '../src/moneta/VRTopologyTranslator.ts';
import { MonetaTopologyNode } from '../src/moneta/MonetaTopologyNode.ts';
import {
  RepresentationSurface,
  type RepresentationSurfaceDependencies,
} from '../src/vr/presentation/representation/RepresentationSurface.ts';
import { NemosyneSession } from '../src/session/NemosyneSession.ts';
import {
  FORMA_INVESTIGATION_ENTRY,
  FORMA_PACKAGE_FORMAT_VERSION,
  NemosynePackageManager,
  type NemosynePackagePayload,
} from '../src/session/NemosynePackage.ts';
import { sha256Hex } from '../src/security/CryptoHash.ts';
import {
  governedPayload,
  reproducibleIdentity,
  runner,
} from './helpers/f1GovernedArchive.ts';

describe('L2-FORMA-1 / FM3 Vertical Slice & FMA-08 / FMA-09 Assurance', () => {
  const dummyEvidence: EvidenceReferenceTupleV1[] = [
    {
      datasetFingerprint: 'sha256-dataset-1234567890abcdef',
      kernelVersion: '1.0.0',
      bundleContentDigest: 'sha256-bundle-001',
      receiptId: 'receipt-001',
      receiptContentDigest: 'sha256-receipt-digest-001',
      consumerId: 'descriptive-summary/v1',
      requirementProfileId: 'profile-001',
      requirementProfileDigest: 'sha256-profile-digest-001',
      admissionPolicyId: 'policy-001',
      admissionPolicyDigest: 'sha256-policy-digest-001',
    },
  ];

  const dummyEnvelope: SemanticEmbodimentEnvelopeV1 = {
    schemaVersion: 1,
    datasetFingerprint: 'sha256-dataset-1234567890abcdef',
    candidateId: 'AGGREGATE_VOLUME',
    representationFamily: 'AGGREGATE',
    analyticalMethod: {
      name: 'aggregateVolume',
      version: '1.0.0',
      parameters: { groupingFields: ['region'], measure: 'COUNT' },
    },
    approximation: {
      mode: 'EXACT',
      representedRowCount: 1000,
    },
    informationContract: {
      preserves: ['exact-metric-values'],
      loses: ['individual-observation-identity'],
    },
    resource: {
      sourceRowCount: 1000,
      elementCount: 2,
      maxElementCount: 4096,
    },
    provenance: {
      kernelVersion: '1.0.0',
      algorithmVersion: '1.0.0',
      decisionId: 'decision-abc-123',
      decisionModelVersion: 'onnx-v2',
      decisionModelArtifactHash: 'hash-xyz',
    },
    result: {
      status: 'READY',
      payload: {
        kind: 'AGGREGATE_VOLUME',
        data: {
          groupingFields: ['region'],
          measure: { function: 'COUNT' },
          groups: [
            { semanticId: 'group-north', key: 'North', count: 600 },
            { semanticId: 'group-south', key: 'South', count: 400 },
          ],
        },
      },
    },
  };

  const contextA = canonicalizeCommittedInvestigationContext({
    schemaVersion: 2,
    nodeId: 'node-investigation-01',
    intent: {
      schemaVersion: 1,
      researchQuestion: 'Initial question',
      variablesOfInterest: ['region', 'count'],
    },
    epistemicPurpose: 'EXPLORATORY_ABDUCTION',
  }) as CommittedInvestigationContextV2;

  function createTestDataset(): Dataset {
    return new Dataset(
      'Test Dataset',
      [
        { name: 'region', type: ColumnType.CATEGORICAL },
        { name: 'count', type: ColumnType.NUMERIC },
      ],
      [
        { region: 'North', count: 600 },
        { region: 'South', count: 400 },
      ]
    );
  }

  function compileTestSlice(): FormaCompiledSliceV1 {
    const snapshot = normalizeEnvelopeToSnapshot(dummyEnvelope, dummyEvidence);
    const manifest = createKB0Manifest();
    const outcome = compileFormaSpatialSlice(snapshot, contextA, manifest, 'SPATIAL_SCATTER_V1');
    if (outcome.status !== 'COMPILED') {
      throw new Error(`Failed to compile test slice: ${outcome.status}`);
    }
    return outcome.slice;
  }

  describe('FMA-08: Investigation Context Identity & LoadDatasetUseCase Adoption Seam', () => {
    it('LoadDatasetUseCase derives requirements from active context when requirements is omitted', async () => {
      const atlas = new AtlasCore({ kernel: null });
      atlas.commitInvestigationContext('node-investigation-01', contextA);
      const dataset = createTestDataset();

      const useCase = new LoadDatasetUseCase(atlas);
      const result = await useCase.execute({ dataset, topology: 'TABULAR' });

      expect(result.dataInput.contextBinding).toBeDefined();
      expect(result.dataInput.contextBinding?.contextId).toBe(
        atlas.getActiveContextBinding()?.contextId
      );
      expect(result.dataInput.contextBinding?.activationEpoch).toBe(
        atlas.getActiveContextBinding()?.activationEpoch
      );
      expect(result.dataInput.canAdopt).toBeDefined();
      expect(result.dataInput.assertCanAdopt).toBeDefined();
      expect(result.dataInput.canAdopt!(result.dataInput.contextBinding!)).toBe(true);
    });

    it('Falsifier: RepresentationSurface.replace throws when called with stale or superseded context binding', () => {
      const atlas = new AtlasCore({ kernel: null });
      atlas.commitInvestigationContext('node-investigation-01', contextA);

      const scene = new THREE.Scene();
      const deps: RepresentationSurfaceDependencies = {
        scene,
        cameraGroup: new THREE.Group(),
        analystAnchor: new THREE.Group(),
        getColorblindMode: () => 'none',
        getFactProvider: () => atlas.asFactProvider(),
        addUpdatable: vi.fn(),
        removeUpdatable: vi.fn(),
        addInteractable: vi.fn(),
        removeInteractable: vi.fn(),
        addDiagnosticPanel: vi.fn(),
        removeDiagnosticPanel: vi.fn(),
        setTooltipTargets: vi.fn(),
        clearStructureHandles: vi.fn(),
        rebuildStructureHandles: vi.fn(),
        onSelectNode: vi.fn(),
        assertCanAdopt: (binding: ContextBinding) => atlas.assertCanAdopt(binding),
        canAdopt: (binding: ContextBinding) => atlas.canAdopt(binding),
      };

      const surface = new RepresentationSurface(deps);
      const initialBinding = atlas.getActiveContextBinding()!;

      // Advance epoch by committing a new context
      atlas.commitInvestigationContext('node-investigation-01', {
        ...contextA,
        intent: { ...contextA.intent, researchQuestion: 'Advanced question' },
        epistemicPurpose: 'CLAIM_BEARING',
      });

      // Calling replace with initial (stale) binding must fail closed
      expect(() => {
        surface.replace(
          { topology: 'TABULAR' },
          null,
          initialBinding
        );
      }).toThrow(/stale|superseded|epoch|refused|cannot adopt/i);
    });

    it('Falsifier: Asynchronous embodiment promise resolving after epoch advance is refused and does not mutate node', async () => {
      const atlas = new AtlasCore({ kernel: null });
      atlas.commitInvestigationContext('node-investigation-01', contextA);

      let resolvePromise!: (val: unknown) => void;
      const delayedPromise = new Promise((res) => {
        resolvePromise = res;
      });

      const scene = new THREE.Scene();
      const initialBinding = atlas.getActiveContextBinding()!;
      const node = new MonetaTopologyNode(
        scene,
        {
          topology: 'TABULAR',
          contextBinding: initialBinding,
          canAdopt: (b: ContextBinding) => atlas.canAdopt(b),
          assertCanAdopt: (b: ContextBinding) => atlas.assertCanAdopt(b),
          semanticEmbodimentCandidateId: 'CLUSTER_REGIONS',
          semanticEmbodimentPromise: delayedPromise as never,
        },
        [0, 1.4, -3.5],
        { colorblindMode: 'none' },
        atlas.asFactProvider()
      );

      const initialGroupChildrenCount = node.group?.children.length ?? 0;

      // Advance epoch before async promise resolves
      atlas.commitInvestigationContext('node-investigation-01', {
        ...contextA,
        intent: { ...contextA.intent, researchQuestion: 'Advanced question after load' },
        epistemicPurpose: 'CLAIM_BEARING',
      });

      // Resolve delayed promise
      resolvePromise({
        schemaVersion: 1,
        datasetFingerprint: 'sha256-dataset-1234567890abcdef',
        candidateId: 'CLUSTER_REGIONS',
        representationFamily: 'CLUSTER',
        analyticalMethod: { name: 'cluster', version: '1.0.0', parameters: {} },
        approximation: { mode: 'EXACT', representedRowCount: 100 },
        informationContract: { preserves: [], loses: [] },
        resource: { sourceRowCount: 100, elementCount: 1, maxElementCount: 100 },
        provenance: {
          kernelVersion: '1.0.0',
          algorithmVersion: '1.0.0',
          decisionId: 'dec-1',
          decisionModelVersion: '1',
          decisionModelArtifactHash: 'hash',
        },
        result: {
          status: 'READY',
          payload: {
            kind: 'CLUSTER_REGIONS',
            data: {
              clusters: [
                {
                  clusterId: 1,
                  label: 'Cluster 1',
                  pointCount: 10,
                  centroid: [0, 0, 0],
                  radius: 1,
                  density: 1,
                  dispersion: 0.5,
                },
              ],
            },
          },
        },
      });

      // Wait a microtask tick for promise resolution handler
      await new Promise((r) => setTimeout(r, 10));

      // Because the context epoch moved, the resolution must have been refused:
      // node group must not have gained new cluster meshes
      expect(node.group?.children.length ?? 0).toBe(initialGroupChildrenCount);
    });
  });

  describe('L2-FORMA-1 / FM3: 3D Renderer, Visual Encoding & Reverse Explanation', () => {
    it('VRTopologyTranslator.buildFormaSpatialSlice renders meshes with matching geometry, position, color, and wireframe', () => {
      const slice = compileTestSlice();
      expect(slice.elements.length).toBeGreaterThan(0);

      const artifact = VRTopologyTranslator.synthesizeArtifact(
        {
          facts: {
            topology: 'TABULAR',
            rowCount: slice.elements.length,
            nodeCount: slice.elements.length,
            edgeCount: 0,
            depth: 1,
            numericColumns: 0,
            categoricalColumns: 0,
            temporalColumns: 0,
            hasTimeSeries: false,
            hasContinuousValues: false,
            density: 1,
            estimatedDensity: 1,
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
          },
          spec: { layout: 'GRID_3D', geometry: 'CLUSTER_VOLUME', behavior: 'STATIC', interaction: 'INSPECT_CELL' },
          cost: 0,
        },
        { topology: 'TABULAR', formaSlice: slice }
      );

      expect(artifact.nodeMeshes.length).toBe(slice.elements.length);

      for (const element of slice.elements) {
        const mesh = artifact.nodeMeshes.find((m) => m.name === element.elementId);
        expect(mesh).toBeDefined();
        if (!mesh) continue;

        expect(mesh.userData.representationKind).toBe('FORMA_SPATIAL_SLICE');
        expect(mesh.userData.elementId).toBe(element.elementId);
        expect(mesh.userData.bindingKind).toBe(element.bindingKind);
        expect(mesh.userData.epistemicStatus).toBe(element.epistemicStatus);
        expect(mesh.userData.reverseExplanation).toBeDefined();

        if (element.visualEncoding.shape === 'VOXEL') {
          expect(mesh.geometry).toBeInstanceOf(THREE.BoxGeometry);
        } else if (element.visualEncoding.shape === 'SPHERE') {
          expect(mesh.geometry).toBeInstanceOf(THREE.SphereGeometry);
        }

        const mat = mesh.material as THREE.MeshStandardMaterial;
        expect(mat.wireframe).toBe(Boolean(element.visualEncoding.isConjectural || element.bindingKind === 'CONJECTURAL'));
      }
    });

    it('RepresentationSurface wires forma interactables and provides getSelectedReverseExplanation', () => {
      const slice = compileTestSlice();
      const atlas = new AtlasCore({ kernel: null });
      atlas.commitInvestigationContext('node-investigation-01', contextA);

      const scene = new THREE.Scene();
      const interactables: { mesh: THREE.Mesh; options: unknown }[] = [];
      const deps: RepresentationSurfaceDependencies = {
        scene,
        cameraGroup: new THREE.Group(),
        analystAnchor: new THREE.Group(),
        getColorblindMode: () => 'none',
        getFactProvider: () => atlas.asFactProvider(),
        addUpdatable: vi.fn(),
        removeUpdatable: vi.fn(),
        addInteractable: (mesh, options) => interactables.push({ mesh, options }),
        removeInteractable: vi.fn(),
        addDiagnosticPanel: vi.fn(),
        removeDiagnosticPanel: vi.fn(),
        setTooltipTargets: vi.fn(),
        clearStructureHandles: vi.fn(),
        rebuildStructureHandles: vi.fn(),
        onSelectNode: vi.fn(),
        assertCanAdopt: (b: ContextBinding) => atlas.assertCanAdopt(b),
        canAdopt: (b: ContextBinding) => atlas.canAdopt(b),
      };

      const surface = new RepresentationSurface(deps);
      surface.replace(
        { topology: 'TABULAR', formaSlice: slice },
        null,
        atlas.getActiveContextBinding()!
      );

      expect(interactables.length).toBe(slice.elements.length);

      // Select the first mesh
      const firstMesh = surface.currentNode?.artifact?.nodeMeshes[0];
      expect(firstMesh).toBeDefined();
      if (!firstMesh) return;

      surface.setSelectedMesh(firstMesh);
      const trace = surface.getSelectedReverseExplanation();
      expect(trace).toBeDefined();
      expect(trace?.elementId).toBe(firstMesh.userData.elementId);
      expect(trace?.bindingKind).toBe(firstMesh.userData.bindingKind);
      expect(trace?.epistemicStatus).toBe(firstMesh.userData.epistemicStatus);
      expect(trace?.semanticNodeId).toBeDefined();
      expect(trace?.evidenceReferences.length).toBeGreaterThan(0);
    });
  });

  describe('FMA-09: Session Serialization, V4 Package Export & Clean-Room Replay', () => {
    it('NemosyneSession serializes and restores static forma state to/from JSON', () => {
      const slice = compileTestSlice();
      const atlas = new AtlasCore({ kernel: null });
      atlas.commitInvestigationContext('node-investigation-01', contextA);
      atlas.loadDataset(createTestDataset());
      atlas.setFormaState({
        schemaVersion: 1,
        slice,
        context: contextA,
      });

      const session = new NemosyneSession({ atlas });
      const json = session.serialize();
      expect(json.formaInvestigationSnapshot).toBeDefined();

      const restoredAtlas = new AtlasCore({ kernel: null });
      const restoredSession = new NemosyneSession({ atlas: restoredAtlas });
      restoredSession.loadFromJSON(json);

      expect(restoredAtlas.getActiveFormaSlice()?.sliceId).toBe(slice.sliceId);
      expect(restoredSession.formaInvestigationBytes).toBeDefined();
    });

    it('exports and verifies V4 package with investigation/forma.json and formaDigest', async () => {
      const slice = compileTestSlice();
      const identity = await reproducibleIdentity();
      const formaState = {
        schemaVersion: 1,
        slice,
        context: contextA,
      };
      const formaBytes = strToU8(JSON.stringify(formaState));
      const formaDigest = sha256Hex(formaBytes);

      // Probe to get recomputed investigation digest
      const probePayload = governedPayload({ identity });
      const probe = await runner().replayPayload(probePayload);
      const investigationDigest = probe.investigationDigest;

      const v4Payload: NemosynePackagePayload = {
        ...probePayload,
        manifest: {
          ...probePayload.manifest,
          formatVersion: FORMA_PACKAGE_FORMAT_VERSION,
          formaDigest,
          investigationDigest,
        },
        formaInvestigationBytes: formaBytes,
      };

      const pkgBytes = NemosynePackageManager.pack({
        manifest: v4Payload.manifest,
        datasetBytes: v4Payload.datasetBytes,
        commandLogBytes: v4Payload.commandLogBytes,
        evidenceReceiptBytes: v4Payload.evidenceReceiptBytes,
        formaInvestigationBytes: v4Payload.formaInvestigationBytes,
      });

      const unpacked = NemosynePackageManager.unpack(pkgBytes);
      expect(unpacked.manifest.formatVersion).toBe(FORMA_PACKAGE_FORMAT_VERSION);
      expect(unpacked.manifest.formaDigest).toBe(formaDigest);
      expect(unpacked.formaInvestigationBytes).toBeDefined();

        const replayResult = await runner().replayArchive(pkgBytes);
        expect(replayResult.success).toBe(true);
        expect(replayResult.historicalInspectionCapability).toBeDefined();
        expect(replayResult.historicalInspectionCapability?.captureId).toBe(formaDigest);
        expect(replayResult.discrepancies).toEqual([]);
      });

      it('Falsifier: Tampered investigation/forma.json in V4 archive fails replay closed', async () => {
        const slice = compileTestSlice();
        const identity = await reproducibleIdentity();
        const formaState = {
          schemaVersion: 1,
          slice,
          context: contextA,
        };
        const formaBytes = strToU8(JSON.stringify(formaState));
        const formaDigest = sha256Hex(formaBytes);

        const probePayload = governedPayload({ identity });
        const probe = await runner().replayPayload(probePayload);
        const investigationDigest = probe.investigationDigest;

        const v4Payload: NemosynePackagePayload = {
          ...probePayload,
          manifest: {
            ...probePayload.manifest,
            formatVersion: FORMA_PACKAGE_FORMAT_VERSION,
            formaDigest,
            investigationDigest,
          },
          formaInvestigationBytes: formaBytes,
        };

        const pkgBytes = NemosynePackageManager.pack({
          manifest: v4Payload.manifest,
          datasetBytes: v4Payload.datasetBytes,
          commandLogBytes: v4Payload.commandLogBytes,
          evidenceReceiptBytes: v4Payload.evidenceReceiptBytes,
          formaInvestigationBytes: v4Payload.formaInvestigationBytes,
        });

        // Tamper with forma.json in zip
        const files = unzipSync(pkgBytes);
        files[FORMA_INVESTIGATION_ENTRY] = strToU8('{"tampered": true}');
        const tamperedArchive = zipSync(files);

        // Replay must fail closed at transport unpacking
        await expect(runner().replayArchive(tamperedArchive)).rejects.toThrow(
          /Forma investigation entry digest mismatch/i
        );

        // And replayPayload directly also fails closed with governed forma integrity discrepancy
        const payloadResult = await runner().replayPayload({
          ...v4Payload,
          formaInvestigationBytes: strToU8('{"tampered": true}'),
        });
        expect(payloadResult.success).toBe(false);
        expect(
          payloadResult.discrepancies.some((d) =>
            d.includes('digest mismatch') || d.includes('Governed forma integrity failure')
          )
        ).toBe(true);
      });
  });
});
