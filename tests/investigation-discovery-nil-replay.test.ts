import { describe, expect, it, vi } from 'vitest';
import { strToU8, strFromU8 } from 'fflate';
import { AtlasCore, type WasmRuntimeBridgeFull } from '../src/atlas/AtlasCore.ts';
import { Dataset } from '../src/data/Dataset.ts';
import { fnv1aHex } from '../src/atlas/DatasetSpace.ts';
import {
  DISCOVERY_EPISODE_SCHEMA_VERSION,
  canonicalJsonStringify,
  type DiscoveryEpisode,
  type NoFeasibleRepresentationRecord,
} from '../src/investigation/index.ts';
import type { RepresentationDecision } from '../src/moneta/representation/RepresentationDecision.ts';
import { NemosynePackageManager } from '../src/session/NemosynePackage.ts';
import { InvestigationReplayRunner } from '../src/session/InvestigationReplayRunner.ts';
import { NemosyneSession } from '../src/session/NemosyneSession.ts';

const MODEL_VERSION = 'learned-replay-v1';
const MODEL_ARTIFACT = 'sha256:learned-replay-artifact';

function bridge(): WasmRuntimeBridgeFull {
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
    kernelVersion: () => 'unknown',
    kernelProvenance: () => null,
    datasetFingerprint: () => null,
  };
}

function dataset(): Dataset {
  return Dataset.fromJSON({
    name: 'discovery-nil-replay',
    topology: 'TABULAR',
    columns: [{ name: 'value', type: 'float', values: [1, 2, 3] }],
  });
}

function decision(fp: string): RepresentationDecision {
  return {
    id: 'decision-replay-1',
    chosenCandidateId: 'scatter' as RepresentationDecision['chosenCandidateId'],
    chosenFamily: 'POINT_CLOUD' as RepresentationDecision['chosenFamily'],
    chosenLayout: 'grid' as RepresentationDecision['chosenLayout'],
    utilityScore: 0.81,
    fitnessModelVersion: MODEL_VERSION,
    fitnessModelArtifactHash: MODEL_ARTIFACT,
    representationFamily: 'POINT_CLOUD' as RepresentationDecision['representationFamily'],
    embodiment: {
      primaryLayout: 'grid' as RepresentationDecision['embodiment']['primaryLayout'],
      primaryGeometry: 'sphere' as RepresentationDecision['embodiment']['primaryGeometry'],
      primaryBehavior: 'static' as RepresentationDecision['embodiment']['primaryBehavior'],
      primaryInteraction: 'inspect' as RepresentationDecision['embodiment']['primaryInteraction'],
      spatialStrategy: {
        id: 'strategy-replay-1',
        provenance: {
          generatedAt: 0,
          engine: 'MonetaHypothesisEngine',
          version: 'learned',
          datasetFingerprint: fp,
          requirementsHash: 'requirements-replay',
          fitnessModelVersion: MODEL_VERSION,
          fitnessModelArtifactHash: MODEL_ARTIFACT,
        },
      } as RepresentationDecision['embodiment']['spatialStrategy'],
    },
    evidence: [
      { fact: 'cardinality evidence', weight: 0.4, supports: true, source: 'kernel' },
    ],
    rejectedAlternatives: [],
    provenance: {
      generatedAt: 0,
      engine: 'MonetaHypothesisEngine',
      version: 'learned',
      datasetFingerprint: fp,
      requirementsHash: 'requirements-replay',
      fitnessModelVersion: MODEL_VERSION,
      fitnessModelArtifactHash: MODEL_ARTIFACT,
    },
    datasetSignature: {} as RepresentationDecision['datasetSignature'],
  };
}

function discovery(fp: string): DiscoveryEpisode {
  return {
    schemaVersion: DISCOVERY_EPISODE_SCHEMA_VERSION,
    discoveryId: 'discovery-replay-1',
    investigationId: 'replay-session',
    notice: 'A stable separation is visible.',
    hypothesis: 'The separation is analytically meaningful.',
    explorationPath: ['notice', 'inspect'],
    analyticalTests: [
      {
        id: 'test-1',
        method: 'cluster-separation',
        evidenceIds: ['cluster:global'],
        outcome: 'SUPPORTS',
      },
    ],
    evidenceIds: ['cluster:global'],
    conclusion: 'The evidence supports the observed separation.',
    validationStatus: 'SUPPORTED',
    representationContext: {
      representationDecisionId: 'decision-replay-1',
      fitnessModelVersion: MODEL_VERSION,
      fitnessModelArtifactHash: MODEL_ARTIFACT,
      decisionDatasetFingerprint: fp,
    },
    provenance: {
      datasetFingerprint: fp,
      datasetVersion: 1,
      kernelVersion: 'unknown',
      investigationVersion: '1',
      randomSeeds: {},
    },
  };
}

async function archive(): Promise<Uint8Array> {
  const source = dataset();
  const fp = String(source.fingerprint);
  const atlas = new AtlasCore({ sessionId: 'replay-session' });
  atlas.loadDataset(source);
  const rep = decision(fp);
  atlas.aggregate.representation.restoreDecision(rep);
  atlas.aggregate.discoveries.record(discovery(fp));

  const session = new NemosyneSession({ atlas, sessionId: 'replay-session' });
  const nil: NoFeasibleRepresentationRecord = {
    nilId: 'nil-replay-1',
    recordedAt: 1,
    traces: [{ ruleName: 'hardware-limit', passed: false, reason: 'too many elements' }],
    nearMisses: [],
    provenance: {
      datasetFingerprint: fp,
      kernelVersion: 'unknown',
      evidenceIds: ['cardinality:dataset'],
      requirementsHash: 'requirements-replay',
      fitnessModelVersion: MODEL_VERSION,
      fitnessModelArtifactHash: MODEL_ARTIFACT,
      sourceDecisionId: rep.id,
      sourceDecisionEvidenceHash: fnv1aHex(canonicalJsonStringify(rep.evidence)),
    },
  };
  session.recordNoFeasibleRepresentation(nil);
  return session.exportPortablePackage({ platform: 'headless', webxrSupported: false });
}

describe('portable discovery + NIL replay provenance', () => {
  it('restores discoveries and verifies representation/NIL identities end to end', async () => {
    const result = await new InvestigationReplayRunner(bridge()).replayArchive(await archive());
    expect(result.success, result.discrepancies.join('\n')).toBe(true);
    expect(result.representationProvenanceVerified).toBe(true);
    expect(result.discoveryProvenanceVerified).toBe(1);
    expect(result.nilProvenanceVerified).toBe(1);
  });

  it('fails closed when discovery model-artifact identity is tampered', async () => {
    const unpacked = NemosynePackageManager.unpack(await archive());
    const discoveries = JSON.parse(strFromU8(unpacked.discoveryEpisodesBytes!));
    discoveries.episodes[0].representationContext.fitnessModelArtifactHash = 'sha256:tampered';
    const tampered = NemosynePackageManager.pack({
      ...unpacked,
      discoveryEpisodesBytes: strToU8(JSON.stringify(discoveries)),
    });

    const result = await new InvestigationReplayRunner(bridge()).replayArchive(tampered);
    expect(result.success).toBe(false);
    expect(result.discrepancies.some((entry) => entry.includes('Discovery provenance drift'))).toBe(true);
  });

  it('fails closed when NIL source-decision evidence identity is tampered', async () => {
    const unpacked = NemosynePackageManager.unpack(await archive());
    const nil = JSON.parse(strFromU8(unpacked.nilOutcomesBytes!));
    nil.outcomes[0].provenance.sourceDecisionEvidenceHash = 'deadbeef';
    const tampered = NemosynePackageManager.pack({
      ...unpacked,
      nilOutcomesBytes: strToU8(JSON.stringify(nil)),
    });

    const result = await new InvestigationReplayRunner(bridge()).replayArchive(tampered);
    expect(result.success).toBe(false);
    expect(result.discrepancies.some((entry) => entry.includes('NIL provenance drift'))).toBe(true);
  });
});
