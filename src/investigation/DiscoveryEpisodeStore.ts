import {
  DISCOVERY_EPISODE_SCHEMA_VERSION,
  assertDiscoveryEpisode,
  type DiscoveryEpisode,
} from './DiscoveryEpisode.ts';

export const DISCOVERY_EPISODE_STORE_SCHEMA_VERSION = '1.0.0' as const;

export interface DiscoveryEpisodeStoreSnapshot {
  schemaVersion: typeof DISCOVERY_EPISODE_STORE_SCHEMA_VERSION;
  episodes: readonly DiscoveryEpisode[];
}

function cloneEpisode(episode: DiscoveryEpisode): DiscoveryEpisode {
  return structuredClone(episode);
}

/**
 * Durable domain collection for DiscoveryEpisode records.
 *
 * Restore is atomic: every incoming episode is validated, checked for duplicate
 * identity, and cloned before the live store is replaced. A corrupt package can
 * therefore never leave half-restored discovery state behind.
 */
export class DiscoveryEpisodeStore {
  private episodesById = new Map<string, DiscoveryEpisode>();

  get size(): number {
    return this.episodesById.size;
  }

  all(): readonly DiscoveryEpisode[] {
    return [...this.episodesById.values()].map(cloneEpisode);
  }

  get(discoveryId: string): DiscoveryEpisode | null {
    const episode = this.episodesById.get(discoveryId);
    return episode ? cloneEpisode(episode) : null;
  }

  record(episode: DiscoveryEpisode): void {
    assertDiscoveryEpisode(episode);
    if (this.episodesById.has(episode.discoveryId)) {
      throw new Error(`DiscoveryEpisode already exists: ${episode.discoveryId}`);
    }
    this.episodesById.set(episode.discoveryId, cloneEpisode(episode));
  }

  replace(episode: DiscoveryEpisode): void {
    assertDiscoveryEpisode(episode);
    if (!this.episodesById.has(episode.discoveryId)) {
      throw new Error(`Cannot replace unknown DiscoveryEpisode: ${episode.discoveryId}`);
    }
    this.episodesById.set(episode.discoveryId, cloneEpisode(episode));
  }

  reset(): void {
    this.episodesById.clear();
  }

  toJSON(): DiscoveryEpisodeStoreSnapshot {
    return {
      schemaVersion: DISCOVERY_EPISODE_STORE_SCHEMA_VERSION,
      episodes: this.all(),
    };
  }

  restore(snapshot: DiscoveryEpisodeStoreSnapshot): void {
    if (snapshot.schemaVersion !== DISCOVERY_EPISODE_STORE_SCHEMA_VERSION) {
      throw new Error(`Unsupported DiscoveryEpisodeStore schema version: ${snapshot.schemaVersion}`);
    }

    const next = new Map<string, DiscoveryEpisode>();
    for (const episode of snapshot.episodes) {
      assertDiscoveryEpisode(episode);
      if (next.has(episode.discoveryId)) {
        throw new Error(`Duplicate DiscoveryEpisode in snapshot: ${episode.discoveryId}`);
      }
      next.set(episode.discoveryId, cloneEpisode(episode));
    }

    this.episodesById = next;
  }
}

export { DISCOVERY_EPISODE_SCHEMA_VERSION };
