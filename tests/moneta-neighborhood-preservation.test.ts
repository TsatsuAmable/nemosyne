import { describe, expect, it } from 'vitest';
import {
  computeNeighborhoodPreservation,
  permuteCoordinatesWithinClusters,
} from '../dev/xr-lab/MonetaNeighborhoodPreservationCampaign.ts';
import { generatePlantedThreeClusterDataset } from '../dev/xr-lab/MonetaKnownStructureCampaign.ts';

describe('Moneta neighborhood preservation', () => {
  it('detects local neighborhood loss hidden by a preserved coordinate multiset', () => {
    const source = generatePlantedThreeClusterDataset(20260911, 48, 0.55).map(
      (point, id) => ({ ...point, id })
    );
    const scrambled = permuteCoordinatesWithinClusters(source);
    const identity = computeNeighborhoodPreservation(source, source, 5);
    const degraded = computeNeighborhoodPreservation(source, scrambled, 5);

    expect(identity.trustworthiness).toBe(1);
    expect(identity.continuity).toBe(1);
    expect(identity.meanKnnOverlap).toBe(1);
    expect(degraded.trustworthiness).toBeLessThan(0.9);
    expect(degraded.continuity).toBeLessThan(0.9);
    expect(degraded.meanKnnOverlap).toBeLessThan(0.25);
  });
});
