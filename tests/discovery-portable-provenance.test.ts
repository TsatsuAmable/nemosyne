import { describe, expect, it } from 'vitest';
import { strFromU8 } from 'fflate';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { Dataset } from '../src/data/Dataset.ts';
import {
  DISCOVERY_EPISODE_SCHEMA_VERSION,
  DISCOVERY_EPISODE_STORE_SCHEMA_VERSION,
  DiscoveryEpisodeStore,
  type DiscoveryEpisode,
  type DiscoveryEpisodeStoreSnapshot,
} from '../src/investigation/index.ts';
import { NemosynePackageManager } from '../src/session/NemosynePackage.ts';
import { NemosyneSession } from '../src/session/NemosyneSession.ts';

function discovery(datasetFingerprint: string): DiscoveryEpisode {
  return {
    schemaVersion: DISCOVERY_EPISODE_SCHEMA_VERSION,
    discoveryId: 'discovery-portable-1',
    investigationId: 'portable-discovery-session',
    notice: 'A stable separation is visible.',
    question: 'Does the separation survive analytical validation?',
    hypothesis: 'The observed groups remain separated under validation.',
    explorationPath: ['notice', 'inspect', 'validate'],
    analyticalTests: [
      {
        id: 'test-cluster-separation',
        method: 'cluster-separation',
        evidenceIds: ['result:cluster-separation'],
        outcome: 'SUPPORTS',
      },
    ],
    evidenceIds: ['result:cluster-separation'],
    conclusion: 'The separation is supported.',
    validationStatus: 'SUPPORTED',
    representationContext: {
      representationDecisionId: 'decision_scatter_fixture',
      fitnessModelVersion: 'learned-v7',
      fitnessModelArtifactHash: 'sha256:model-a',
      decisionDatasetFingerprint: datasetFingerprint,
    },
    provenance: {
      datasetFingerprint,
      datasetVersion: 0,
      kernelVersion: 'unknown',
      investigationVersion: '1',
      randomSeeds: {},
    },
  };
}

describe('portable discovery provenance', () => {
  it('exports the authoritative DiscoveryEpisodeStore snapshot into .nemosyne', async () => {
    const dataset = Dataset.fromJSON({
      name: 'portable-discovery',
      topology: 'TABULAR',
      columns: [{ name: 'value', type: 'float', values: [1, 2, 3] }],
    });
    const atlas = new AtlasCore({ sessionId: 'portable-discovery-session' });
    atlas.loadDataset(dataset);
    atlas.aggregate.discoveries.record(discovery(String(dataset.fingerprint)));

    const session = new NemosyneSession({ atlas, sessionId: 'portable-discovery-session' });
    const archive = await session.exportPortablePackage({ platform: 'headless' });
    const unpacked = NemosynePackageManager.unpack(archive);

    expect(unpacked.manifest.discoveryCount).toBe(1);
    expect(unpacked.discoveryEpisodesBytes).toBeInstanceOf(Uint8Array);

    const snapshot = JSON.parse(
      strFromU8(unpacked.discoveryEpisodesBytes!)
    ) as DiscoveryEpisodeStoreSnapshot;
    expect(snapshot.schemaVersion).toBe(DISCOVERY_EPISODE_STORE_SCHEMA_VERSION);
    expect(snapshot.episodes).toHaveLength(1);
    expect(snapshot.episodes[0].representationContext).toMatchObject({
      representationDecisionId: 'decision_scatter_fixture',
      fitnessModelVersion: 'learned-v7',
      fitnessModelArtifactHash: 'sha256:model-a',
      decisionDatasetFingerprint: String(dataset.fingerprint),
    });

    const restored = new DiscoveryEpisodeStore();
    restored.restore(snapshot);
    expect(restored.get('discovery-portable-1')?.provenance.datasetVersion).toBe(0);
  });

  it('fails closed when a manifest declares discoveries but the discovery entry is absent', () => {
    const dataset = new TextEncoder().encode('{"name":"fixture"}');
    const archive = NemosynePackageManager.pack({
      manifest: {
        formatVersion: 1,
        sessionId: 'missing-discovery-entry',
        datasetFingerprint: 'fixture-fp',
        datasetName: 'fixture',
        kernelVersion: 'unknown',
        createdAt: 1,
        commandCount: 0,
        discoveryCount: 1,
        environment: {},
      },
      datasetBytes: dataset,
      commandLogBytes: new TextEncoder().encode('[]'),
    });

    expect(() => NemosynePackageManager.unpack(archive)).toThrow(/declares discoveries/i);
  });

  it('rejects malformed exact model identity fields before persistence', () => {
    const store = new DiscoveryEpisodeStore();
    const malformed = discovery('dataset-fp');
    malformed.representationContext.fitnessModelArtifactHash = '';

    expect(() => store.record(malformed)).toThrow(/fitnessModelArtifactHash/i);
  });
});
