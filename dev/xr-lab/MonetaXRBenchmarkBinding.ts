import * as THREE from 'three';
import { AtlasCore, type WasmRuntimeBridgeFull } from '../../src/atlas/AtlasCore.ts';
import { assertRustDatasetStructureProfile } from '../../src/atlas/MonetaEvidenceAuthority.ts';
import { Dataset } from '../../src/data/Dataset.ts';
import { MonetaTopologyNode } from '../../src/moneta/MonetaTopologyNode.ts';
import { createDefaultRequirements } from '../../src/moneta/representation/RepresentationRequirements.ts';
import type { SemanticEmbodimentEnvelopeV1 } from '../../src/moneta/representation/SemanticEmbodimentPayload.ts';
import * as bridge from '../../src/wasm/RuntimeBridge.ts';
import { buildDensitySemanticEmbodimentV1 } from '../../src/wasm/runtime/SemanticEmbodimentBridge.ts';
import type { CampaignTargetBinding } from './AdversarialCampaign.ts';
import { generatePlantedThreeClusterDataset } from './MonetaKnownStructureCampaign.ts';

export interface KnownStructureXRBinding {
  evidence: Record<string, unknown>;
  createTarget(scene: THREE.Scene): CampaignTargetBinding;
  dispose(): void;
}

export interface KnownStructureXRBindingOptions {
  seed?: number;
  pointsPerCluster?: number;
  jitter?: number;
}

function exactDataset(options: KnownStructureXRBindingOptions): Dataset {
  const points = generatePlantedThreeClusterDataset(
    options.seed ?? 20260912,
    options.pointsPerCluster ?? 48,
    options.jitter ?? 0.55
  );
  return Dataset.fromJSON({
    name: 'xr-known-three-cluster',
    columns: [
      { name: 'x', type: 'NUMERIC' },
      { name: 'y', type: 'NUMERIC' },
    ],
    rows: points.map(({ x, y }) => ({ x, y })),
  });
}

function readyDensity(envelope: SemanticEmbodimentEnvelopeV1 | null): SemanticEmbodimentEnvelopeV1 {
  if (!envelope || envelope.result.status !== 'READY') {
    throw new Error('Rust density embodiment unavailable for known-structure XR benchmark');
  }
  if (envelope.result.payload.kind !== 'BINNED_DENSITY') {
    throw new Error(`unexpected semantic payload kind: ${envelope.result.payload.kind}`);
  }
  return envelope;
}

export async function createKnownStructureXRBinding(
  options: KnownStructureXRBindingOptions = {}
): Promise<KnownStructureXRBinding> {
  if (!bridge.isReady()) await bridge.initRuntime('/wasm/pkg/nemosyne_wasm_bg.wasm');
  if (!bridge.isReady()) throw new Error('real WASM runtime unavailable');

  const dataset = exactDataset(options);
  const atlas = new AtlasCore({ kernel: bridge as unknown as WasmRuntimeBridgeFull });
  atlas.loadDataset(dataset);
  const requirements = createDefaultRequirements('spatial-analysis', ['x', 'y']);
  const decision = atlas.arbitrateRepresentation(requirements);
  if (decision.chosenCandidateId !== 'DENSITY_FIELD' || decision.decisionStatus !== 'DECISIVE') {
    throw new Error(
      `expected decisive DENSITY_FIELD, got ${decision.chosenCandidateId ?? 'none'}:${decision.decisionStatus ?? 'unknown'}`
    );
  }

  const handle = bridge.loadDatasetJson(dataset.toJSON());
  if (handle <= 0) throw new Error('Rust rejected known-structure benchmark dataset');
  const fingerprint = bridge.datasetFingerprint(handle);
  if (!fingerprint || fingerprint !== atlas.datasetFingerprint) {
    bridge.destroyDataset(handle);
    atlas.dispose();
    throw new Error('Atlas/Rust dataset fingerprint mismatch');
  }

  const profile = bridge.computeDatasetStructureProfile(handle);
  if (!profile) {
    bridge.destroyDataset(handle);
    atlas.dispose();
    throw new Error('Rust structure profile unavailable');
  }
  assertRustDatasetStructureProfile(profile);
  const decisionId = decision.id ?? `xr-density-${fingerprint.slice(0, 12)}`;
  const envelope = readyDensity(
    buildDensitySemanticEmbodimentV1(handle, {
      schemaVersion: 1,
      candidateId: 'DENSITY_FIELD',
      measureFieldX: 'x',
      measureFieldY: 'y',
      binsX: 10,
      binsY: 10,
      decisionId,
      decisionModelVersion: decision.fitnessModelVersion,
    })
  );
  bridge.destroyDataset(handle);
  const factProvider = atlas.aggregate.representation.asFactProvider(() => atlas.facts());
  const evidence = {
    benchmarkFamily: 'synthetic-structure-lab',
    oracle: 'planted-three-clusters',
    datasetFingerprint: fingerprint,
    kernelVersion: atlas.kernelVersion(),
    rustClusters: {
      hasClusters: profile.clusters.hasClusters,
      estimatedCount: profile.clusters.estimatedCount,
      separationScore: profile.clusters.separationScore,
    },
    chosenCandidateId: decision.chosenCandidateId,
    decisionStatus: decision.decisionStatus,
    utilityScore: decision.utilityScore,
    decisionMargin: decision.decisionMargin,
    semanticPayloadKind:
      envelope.result.status === 'READY' ? envelope.result.payload.kind : 'REFUSED',
    sourceRowCount: envelope.resource.sourceRowCount,
    elementCount: envelope.resource.elementCount,
    rawRowsCrossSemanticBoundary: false,
  };

  return {
    evidence,
    createTarget(scene) {
      const node = new MonetaTopologyNode(
        scene,
        { dataset, semanticEmbodiment: envelope },
        [0, 0, 0],
        {},
        factProvider,
        false,
        decision
      );
      const target = node.artifact?.nodeMeshes[0];
      if (!target || !node.group)
        throw new Error('semantic density artifact produced no XR target mesh');
      scene.updateMatrixWorld(true);
      const current = target.getWorldPosition(new THREE.Vector3());
      node.group.position.add(new THREE.Vector3(0, 1.4, -2).sub(current));
      scene.updateMatrixWorld(true);
      return { target, datasetBinding: 'rust-moneta-semantic', datasetEvidence: evidence };
    },
    dispose() {
      atlas.dispose();
    },
  };
}
