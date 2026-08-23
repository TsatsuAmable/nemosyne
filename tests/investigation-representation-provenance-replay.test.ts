import { describe, expect, it, vi } from 'vitest';
import { strToU8 } from 'fflate';
import { AtlasCore, type WasmRuntimeBridgeFull } from '../src/atlas/AtlasCore.ts';
import { Dataset } from '../src/data/Dataset.ts';
import type { RepresentationDecision } from '../src/moneta/representation/RepresentationDecision.ts';
import {
  NemosynePackageManager,
  type NemosynePackageManifest,
} from '../src/session/NemosynePackage.ts';
import { InvestigationReplayRunner } from '../src/session/InvestigationReplayRunner.ts';
import { NemosyneSession } from '../src/session/NemosyneSession.ts';

const MODEL_VERSION = 'learned-v7';
const MODEL_ARTIFACT = 'sha256:model-a';

function representationDecision(artifactHash = MODEL_ARTIFACT): RepresentationDecision {
  return {
    chosenCandidateId: 'scatter' as RepresentationDecision['chosenCandidateId'],
    chosenFamily: 'POINT_CLOUD' as RepresentationDecision['chosenFamily'],
    chosenLayout: 'grid' as RepresentationDecision['chosenLayout'],
    utilityScore: 0.82,
    fitnessModelVersion: MODEL_VERSION,
    fitnessModelArtifactHash: artifactHash,
    representationFamily: 'POINT_CLOUD' as RepresentationDecision['representationFamily'],
    embodiment: {
      primaryLayout: 'grid' as RepresentationDecision['embodiment']['primaryLayout'],
      primaryGeometry: 'sphere' as RepresentationDecision['embodiment']['primaryGeometry'],
      primaryBehavior: 'static' as RepresentationDecision['embodiment']['primaryBehavior'],
      primaryInteraction: 'inspect' as RepresentationDecision['embodiment']['primaryInteraction'],
      spatialStrategy: {
        id: 'strategy_scatter',
        provenance: {
          generatedAt: 1,
          engine: 'moneta',
          version: 'v3',
          datasetFingerprint: 'dataset-fp',
          requirementsHash: 'requirements-hash',
          fitnessModelVersion: MODEL_VERSION,
          fitnessModelArtifactHash: artifactHash,
        },
      } as RepresentationDecision['embodiment']['spatialStrategy'],
    },
    evidence: [],
    rejectedAlternatives: [],
    provenance: {
      generatedAt: 1,
      engine: 'moneta',
      version: 'v3',
      datasetFingerprint: 'dataset-fp',
      fitnessModelVersion: MODEL_VERSION,
      fitnessModelArtifactHash: artifactHash,
    },
    datasetSignature: {} as RepresentationDecision['datasetSignature'],
  };
}

function createReplayBridge(): WasmRuntimeBridgeFull {
  return {
    isReady: () => true,
    capabilities: () => 0xff,
    loadDatasetJson: vi.fn().mockReturnValue(1),
    loadCsv: vi.fn().mockReturnValue(1),
    loadJson: vi.fn().mockReturnValue(1),
    loadSample: vi.fn().mockReturnValue(1),
    sampleKeys: () => [],
    getDatasetJson: vi.fn().mockReturnValue(null),
    destroyDataset: vi.fn(),
    runOperation: vi.fn().mockReturnValue(0),
    executeOperation: vi.fn().mockReturnValue(null),
    statistics: vi.fn().mockReturnValue(null),
    inferTopology: vi.fn().mockReturnValue('TABULAR'),
    inferEncodings: vi.fn().mockReturnValue({}),
    parseDatasetBytes: vi.fn().mockReturnValue(null),
    kernelVersion: () => '0.2.0',
    kernelProvenance: () => null,
    datasetFingerprint: () => 'kernel-dataset-fp',
  };
}

function createDataset(): Dataset {
  return Dataset.fromJSON({
    name: 'portable-representation',
    topology: 'TABULAR',
    columns: [{ name: 'value', type: 'float', values: [1, 2, 3] }],
  });
}

function buildArchive(manifestArtifactHash = MODEL_ARTIFACT): Uint8Array {
  const dataset = createDataset();
  const decision = representationDecision();
  const manifest: NemosynePackageManifest = {
    formatVersion: 1,
    sessionId: 'portable-representation-session',
    datasetFingerprint: String(dataset.fingerprint),
    datasetName: dataset.name,
    kernelVersion: '0.2.0',
    createdAt: 1787503000000,
    commandCount: 0,
    representationModel: {
      fitnessModelVersion: MODEL_VERSION,
      fitnessModelArtifactHash: manifestArtifactHash,
    },
    environment: {
      platform: 'headless',
      webxrSupported: false,
    },
  };

  return NemosynePackageManager.pack({
    manifest,
    datasetBytes: strToU8(JSON.stringify(dataset.toJSON())),
    commandLogBytes: strToU8('[]'),
    representationDecisionBytes: strToU8(JSON.stringify(decision)),
  });
}

describe('portable Moneta representation provenance', () => {
  it('round-trips and verifies exact learned-model identity during replay', async () => {
    const archive = buildArchive();
    const unpacked = NemosynePackageManager.unpack(archive);

    expect(unpacked.representationDecisionBytes).toBeInstanceOf(Uint8Array);
    expect(unpacked.manifest.representationModel).toEqual({
      fitnessModelVersion: MODEL_VERSION,
      fitnessModelArtifactHash: MODEL_ARTIFACT,
    });

    const result = await new InvestigationReplayRunner(createReplayBridge()).replayPayload(unpacked);

    expect(result.success).toBe(true);
    expect(result.representationProvenanceVerified).toBe(true);
    expect(result.discrepancies).toEqual([]);
  });

  it('exports representation provenance automatically from the authoritative session state', async () => {
    const atlas = new AtlasCore({ sessionId: 'portable-representation-session' });
    atlas.loadDataset(createDataset());
    atlas.aggregate.representation.restoreDecision(representationDecision());
    const session = new NemosyneSession({ atlas, sessionId: atlas.sessionId });

    const unpacked = NemosynePackageManager.unpack(
      await session.exportPortablePackage({ platform: 'headless', webxrSupported: false })
    );

    expect(unpacked.manifest.representationModel).toEqual({
      fitnessModelVersion: MODEL_VERSION,
      fitnessModelArtifactHash: MODEL_ARTIFACT,
    });
    expect(unpacked.representationDecisionBytes).toBeInstanceOf(Uint8Array);
  });

  it('fails closed when package model identity drifts from the persisted decision', async () => {
    const result = await new InvestigationReplayRunner(createReplayBridge()).replayArchive(
      buildArchive('sha256:model-b')
    );

    expect(result.success).toBe(false);
    expect(result.representationProvenanceVerified).toBe(false);
    expect(
      result.discrepancies.some((entry) =>
        entry.includes('Representation provenance drift: decision fitnessModelArtifactHash')
      )
    ).toBe(true);
  });
});
