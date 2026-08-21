import { describe, expect, it } from 'vitest';
import {
  DISCOVERY_EPISODE_SCHEMA_VERSION,
  InvalidDiscoveryEpisodeError,
  assertDiscoveryEpisode,
  validateDiscoveryEpisode,
  type DiscoveryEpisode,
} from '../src/investigation/DiscoveryEpisode.ts';

function episodeFixture(): DiscoveryEpisode {
  return {
    schemaVersion: DISCOVERY_EPISODE_SCHEMA_VERSION,
    discoveryId: 'discovery-1',
    investigationId: 'investigation-1',
    notice: 'Two groups appear separated in the current representation.',
    question: 'Is the separation analytically supported?',
    hypothesis: 'The observations form two separable clusters.',
    explorationPath: ['load', 'represent', 'isolate-clusters'],
    analyticalTests: [
      {
        id: 'test-1',
        method: 'silhouette-score',
        evidenceIds: ['cluster:silhouette'],
        outcome: 'SUPPORTS',
      },
    ],
    evidenceIds: ['cluster:silhouette'],
    conclusion: 'The two-cluster interpretation is supported for this dataset and method.',
    validationStatus: 'SUPPORTED',
    representationContext: {
      representationGraphId: 'representation:clusters',
      fitnessModelVersion: 'bootstrap-fitness-1',
    },
    researcherJudgement: { relevance: 0.8, novelty: 0.6, confidence: 0.7 },
    provenance: {
      datasetFingerprint: 'sha256:dataset-001',
      kernelVersion: 'wasm-kernel-3',
      investigationVersion: 'investigation-v1',
      randomSeeds: { kmeans: 1729 },
    },
  };
}

describe('DiscoveryEpisode V3 contract', () => {
  it('accepts an analytically supported discovery episode', () => {
    expect(validateDiscoveryEpisode(episodeFixture())).toEqual([]);
  });

  it('does not allow an observation to become a supported finding without tests', () => {
    const episode = episodeFixture();
    episode.analyticalTests = [];
    expect(() => assertDiscoveryEpisode(episode)).toThrow(InvalidDiscoveryEpisodeError);
  });

  it('requires a hypothesis once investigation begins', () => {
    const episode = episodeFixture();
    episode.hypothesis = undefined;
    episode.validationStatus = 'UNDER_INVESTIGATION';
    expect(validateDiscoveryEpisode(episode)).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'hypothesis' })])
    );
  });

  it('permits refutation as a first-class terminal outcome', () => {
    const episode = episodeFixture();
    episode.validationStatus = 'REFUTED';
    episode.analyticalTests = [
      {
        id: 'test-refute',
        method: 'permutation-test',
        evidenceIds: ['dependency:permutation'],
        outcome: 'REFUTES',
      },
    ];
    episode.conclusion = 'The apparent separation is not supported.';
    expect(validateDiscoveryEpisode(episode)).toEqual([]);
  });

  it('bounds researcher judgement scores without treating them as analytical truth', () => {
    const episode = episodeFixture();
    episode.researcherJudgement = { novelty: 1.2 };
    expect(validateDiscoveryEpisode(episode)).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'researcherJudgement.novelty' })])
    );
  });
});
