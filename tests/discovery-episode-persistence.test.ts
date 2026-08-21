import { describe, expect, it } from 'vitest';
import {
  DISCOVERY_EPISODE_SCHEMA_VERSION,
  DISCOVERY_EPISODE_STORE_SCHEMA_VERSION,
  DiscoveryEpisodeStore,
  type DiscoveryEpisode,
} from '../src/investigation/index.ts';

function episode(id = 'discovery-1'): DiscoveryEpisode {
  return {
    schemaVersion: DISCOVERY_EPISODE_SCHEMA_VERSION,
    discoveryId: id,
    investigationId: 'investigation-1',
    notice: 'Two groups appear separated.',
    question: 'Is the separation analytically supported?',
    hypothesis: 'The observations form two distinct groups.',
    explorationPath: ['notice', 'filter', 'compare'],
    analyticalTests: [
      {
        id: 'test-1',
        method: 'cluster-separation',
        evidenceIds: ['cluster:global'],
        outcome: 'SUPPORTS',
      },
    ],
    evidenceIds: ['cluster:global'],
    conclusion: 'The separation is supported by the analytical evidence.',
    validationStatus: 'SUPPORTED',
    representationContext: { representationGraphId: 'graph-1' },
    provenance: {
      datasetFingerprint: 'sha256:fixture',
      kernelVersion: 'wasm-3',
      investigationVersion: '1',
      randomSeeds: {},
    },
  };
}

describe('DiscoveryEpisode persistence', () => {
  it('round-trips validated episodes through a durable snapshot', () => {
    const store = new DiscoveryEpisodeStore();
    store.record(episode());

    const snapshot = store.toJSON();
    expect(snapshot.schemaVersion).toBe(DISCOVERY_EPISODE_STORE_SCHEMA_VERSION);

    const restored = new DiscoveryEpisodeStore();
    restored.restore(snapshot);
    expect(restored.get('discovery-1')).toEqual(episode());
  });

  it('restores atomically when a snapshot is invalid', () => {
    const store = new DiscoveryEpisodeStore();
    store.record(episode('existing'));

    const invalid = episode('broken');
    invalid.notice = '';

    expect(() =>
      store.restore({
        schemaVersion: DISCOVERY_EPISODE_STORE_SCHEMA_VERSION,
        episodes: [episode('candidate'), invalid],
      }),
    ).toThrow();

    expect(store.get('existing')).not.toBeNull();
    expect(store.get('candidate')).toBeNull();
  });

  it('rejects duplicate identities rather than overwriting research history', () => {
    const store = new DiscoveryEpisodeStore();
    store.record(episode());
    expect(() => store.record(episode())).toThrow(/already exists/i);
  });

  it('supports explicit validated replacement without mutating caller-owned objects', () => {
    const store = new DiscoveryEpisodeStore();
    const source = episode();
    store.record(source);
    source.conclusion = 'caller mutation';

    expect(store.get(source.discoveryId)?.conclusion).not.toBe('caller mutation');

    const replacement = episode();
    replacement.validationStatus = 'EXTERNALLY_VALIDATED';
    replacement.conclusion = 'Replicated externally.';
    store.replace(replacement);
    expect(store.get(replacement.discoveryId)?.validationStatus).toBe('EXTERNALLY_VALIDATED');
  });
});
