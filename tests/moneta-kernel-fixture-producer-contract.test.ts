import { describe, expect, it } from 'vitest';
import { createMonetaStructureProfile } from './helpers/moneta-kernel-fixture.ts';

/**
 * TEC2 Q4/Q5 closure falsifier. The shared TypeScript kernel fixture is the
 * test seam that stands in for the Rust analytical authority wherever a real
 * WASM runtime is not loaded. Before this contract, it invented values the
 * producer cannot emit:
 *
 * - `heuristicSilhouettePartitionScore: hasClusters ? 0.8 : 1` inverted the
 *   producer's fail-closed rule (no detected partition -> 0.0, never 1);
 * - `heuristicScaleDensityProxy: 0.5` is outside the reachable set
 *   {0.15, 0.4, 0.7} that the producer's row-count thresholds emit;
 * - `heuristicSparseByRowCount: false` was hardcoded regardless of row count,
 *   even for datasets the producer would report as sparse.
 *
 * Such fixtures mask contract drift: tests pass against payloads the authority
 * can never produce, so a producer change or an adapter that coerces these
 * values would not be caught on the mock-seam paths. This test pins the
 * fixture to the producer semantics asserted on the real kernel by
 * `tests/wasm-columnar-structure-profile.test.ts` (row-count thresholds and
 * the empty-profile silhouette rule). The two files must not diverge: if the
 * producer semantics change, both must change together, and this suite is the
 * seam-side alarm.
 */

const REACHABLE_DENSITY_PROXY_VALUES = [0.15, 0.4, 0.7] as const;

function producerDensityProxy(rowCount: number): number {
  if (rowCount >= 50) return 0.7;
  if (rowCount >= 20) return 0.4;
  return 0.15;
}

describe('shared kernel fixture mirrors the Rust producer value contract', () => {
  it('derives the scale/density proxy from the row-count thresholds', () => {
    for (const rowCount of [3, 14, 15, 19, 20, 49, 50, 128, 65_537]) {
      const profile = createMonetaStructureProfile({
        datasetName: `contract-${rowCount}`,
        rowCount,
        columnCount: 3,
        numericColumns: 2,
        categoricalColumns: 1,
      });
      expect(profile.density.heuristicScaleDensityProxy).toBe(producerDensityProxy(rowCount));
      expect(REACHABLE_DENSITY_PROXY_VALUES).toContain(profile.density.heuristicScaleDensityProxy);
    }
  });

  it('derives the sparse flag from the row-count threshold, not a constant', () => {
    const sparse = createMonetaStructureProfile({
      datasetName: 'sparse',
      rowCount: 14,
      columnCount: 3,
      numericColumns: 2,
      categoricalColumns: 1,
    });
    expect(sparse.density.heuristicSparseByRowCount).toBe(true);
    const notSparse = createMonetaStructureProfile({
      datasetName: 'not-sparse',
      rowCount: 15,
      columnCount: 3,
      numericColumns: 2,
      categoricalColumns: 1,
    });
    expect(notSparse.density.heuristicSparseByRowCount).toBe(false);
  });

  it('emits a fail-closed 0 partition score when no partition is detected', () => {
    // The prior fixture inverted this exact case to 1. Any positive value
    // here would re-teach the opposite of the producer's honesty rule.
    for (const rowCount of [5, 50, 128]) {
      const profile = createMonetaStructureProfile({
        datasetName: `no-clusters-${rowCount}`,
        rowCount,
        columnCount: 3,
        numericColumns: 2,
        categoricalColumns: 1,
        clusterCount: 1,
      });
      expect(profile.clusters.hasClusters).toBe(false);
      expect(profile.clusters.separationScore).toBe(0);
      expect(profile.clusters.heuristicSilhouettePartitionScore).toBe(0);
    }
  });

  it('derives the partition score from the separation score when clusters exist', () => {
    for (const separationScore of [0.36, 0.5, 0.8, 1]) {
      const profile = createMonetaStructureProfile({
        datasetName: `clustered-${separationScore}`,
        rowCount: 128,
        columnCount: 3,
        numericColumns: 2,
        categoricalColumns: 1,
        clusterCount: 3,
        separationScore,
      });
      expect(profile.clusters.hasClusters).toBe(true);
      // Producer relation (wasm/src/data/profile.rs): the partition score is
      // (best_silhouette * 0.9) clamped to [0.1, 1.0], and the separation score
      // is best_silhouette clamped to [0, 1].
      expect(profile.clusters.heuristicSilhouettePartitionScore).toBe(
        Math.min(1, Math.max(0.1, separationScore * 0.9))
      );
      expect(profile.clusters.heuristicSilhouettePartitionScore).toBeGreaterThanOrEqual(0.1);
      expect(profile.clusters.heuristicSilhouettePartitionScore).toBeLessThanOrEqual(1);
    }
  });

  it('mirrors the producer relation mode_count === estimated_count', () => {
    const profile = createMonetaStructureProfile({
      datasetName: 'mode-count',
      rowCount: 128,
      columnCount: 3,
      numericColumns: 2,
      categoricalColumns: 1,
      clusterCount: 4,
    });
    expect(profile.density.modeCount).toBe(profile.clusters.estimatedCount);
  });

  it('mirrors the producer bounded bottom-k sampling contract above 65,536 rows', () => {
    const unbounded = createMonetaStructureProfile({
      datasetName: 'full-population',
      rowCount: 65_536,
      columnCount: 3,
      numericColumns: 2,
      categoricalColumns: 1,
    });
    expect(unbounded.clusters.method).toBe('full-complete-row-kmeans');
    expect(unbounded.clusters.samplingSeed).toBeNull();
    expect(unbounded.clusters.sampleCount).toBe(65_536);
    expect(unbounded.clusters.sourceObservationsPerSample).toBe(1);

    const bounded = createMonetaStructureProfile({
      datasetName: 'bottom-k',
      rowCount: 10_000_000,
      columnCount: 3,
      numericColumns: 2,
      categoricalColumns: 1,
    });
    expect(bounded.clusters.method).toBe('fixed-seed-bottom-k-complete-row-kmeans');
    expect(bounded.clusters.samplingSeed).toBe(0x4e4d5359);
    expect(bounded.clusters.sampleCount).toBe(65_536);
    expect(bounded.clusters.sourceObservationsPerSample).toBe(10_000_000 / 65_536);
    expect(bounded.clusters.silhouetteSampleCount).toBe(50);
  });
});