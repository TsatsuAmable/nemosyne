import { describe, expect, it } from 'vitest';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { InvestigationAggregate } from '../src/atlas/domain/InvestigationAggregate.ts';
import {
  DISCOVERY_EPISODE_SCHEMA_VERSION,
  DISCOVERY_EPISODE_STORE_SCHEMA_VERSION,
  type DiscoveryEpisode,
} from '../src/investigation/index.ts';
import { NemosyneSession } from '../src/session/NemosyneSession.ts';

function episode(id = 'discovery-1'): DiscoveryEpisode {
  return {
    schemaVersion: DISCOVERY_EPISODE_SCHEMA_VERSION,
    discoveryId: id,
    investigationId: 'investigation-1',
    notice: 'Two regions appear separated.',
    question: 'Is the separation analytically supported?',
    hypothesis: 'The regions are structurally distinct.',
    explorationPath: ['notice', 'compare'],
    analyticalTests: [
      {
        id: `test-${id}`,
        method: 'cluster-separation',
        evidenceIds: ['cluster:global'],
        outcome: 'SUPPORTS',
      },
    ],
    evidenceIds: ['cluster:global'],
    conclusion: 'The separation is supported.',
    validationStatus: 'SUPPORTED',
    representationContext: { representationGraphId: 'graph-1' },
    provenance: {
      datasetFingerprint: 'sha256:fixture',
      kernelVersion: 'wasm-test',
      investigationVersion: '1',
      randomSeeds: {},
    },
  };
}

describe('DiscoveryEpisode aggregate and session adoption', () => {
  it('round-trips discoveries through AtlasCore state', () => {
    const source = new InvestigationAggregate({ sessionId: 'source' });
    source.discoveries.record(episode());

    const restored = new InvestigationAggregate({ sessionId: 'restored' });
    restored.restoreState(source.toState());

    expect(restored.discoveries.get('discovery-1')).toEqual(episode());
  });

  it('restores older Atlas snapshots without discovery state as an empty store', () => {
    const source = new InvestigationAggregate({ sessionId: 'source' });
    source.discoveries.record(episode());
    const legacyState = source.toState();
    delete legacyState.discoveryEpisodes;

    const restored = new InvestigationAggregate({ sessionId: 'restored' });
    restored.discoveries.record(episode('pre-existing'));
    restored.restoreState(legacyState);

    expect(restored.discoveries.size).toBe(0);
  });

  it('rejects corrupt discovery snapshots before replacing live discovery history', () => {
    const aggregate = new InvestigationAggregate({ sessionId: 'aggregate' });
    aggregate.discoveries.record(episode('existing'));
    const state = aggregate.toState();
    const invalid = episode('broken');
    invalid.notice = '';
    state.discoveryEpisodes = {
      schemaVersion: DISCOVERY_EPISODE_STORE_SCHEMA_VERSION,
      episodes: [invalid],
    };

    expect(() => aggregate.restoreState(state)).toThrow();
    expect(aggregate.discoveries.get('existing')).not.toBeNull();
  });

  it('includes DiscoveryEpisode state in the canonical investigation digest', async () => {
    const aggregate = new InvestigationAggregate({ sessionId: 'aggregate' });
    const before = await aggregate.computeDigest('wasm-test');

    aggregate.discoveries.record(episode());
    const after = await aggregate.computeDigest('wasm-test');

    expect(after).not.toBe(before);
  });

  it('persists discovery and other optional investigation state through NemosyneSession JSON', () => {
    const atlas = new AtlasCore({ sessionId: 'atlas-source' });
    atlas.aggregate.discoveries.record(episode());

    const session = new NemosyneSession({ atlas, sessionId: 'session-source' });
    const json = session.serialize();

    expect(json.discoveryEpisodes?.episodes).toHaveLength(1);
    expect(json.discoveryEpisodes?.episodes[0].discoveryId).toBe('discovery-1');

    const restoredAtlas = new AtlasCore({ sessionId: 'atlas-restored' });
    NemosyneSession.deserialize(json, restoredAtlas);
    expect(restoredAtlas.aggregate.discoveries.get('discovery-1')).toEqual(episode());
  });
});
