import type { DatasetJSON } from '../../src/data/types.ts';
import {
  generatePlantedThreeClusterDataset,
  type ClusterProfileObservation,
  type KnownStructurePoint,
  type StructureProfiler,
} from './MonetaKnownStructureCampaign.ts';

export interface IdentifiedKnownStructurePoint extends KnownStructurePoint {
  id: number;
}

export interface NeighborhoodPreservationScore {
  k: number;
  trustworthiness: number;
  continuity: number;
  meanKnnOverlap: number;
}

export interface NeighborhoodAdversaryResult {
  candidateId: 'identity' | 'within-cluster-permutation';
  profile: ClusterProfileObservation;
  neighborhood: NeighborhoodPreservationScore;
}

function asIdentified(points: readonly KnownStructurePoint[]): IdentifiedKnownStructurePoint[] {
  return points.map((point, id) => ({ ...point, id }));
}

function toDataset(
  name: string,
  points: readonly IdentifiedKnownStructurePoint[]
): DatasetJSON {
  return {
    name,
    columns: [
      { name: 'u', type: 'NUMERIC' },
      { name: 'v', type: 'NUMERIC' },
    ],
    rows: points.map((point) => ({ u: point.x, v: point.y })),
  };
}

/**
 * Reassign each observation the coordinates of another observation in the same
 * planted macro-cluster. The coordinate multiset is unchanged, so any
 * permutation-invariant global cluster summary sees the same geometry, while
 * observation-level local neighborhoods are deliberately corrupted.
 *
 * This is a benchmark-only adversary. It is not a product representation.
 */
export function permuteCoordinatesWithinClusters(
  points: readonly IdentifiedKnownStructurePoint[]
): IdentifiedKnownStructurePoint[] {
  const grouped = new Map<number, IdentifiedKnownStructurePoint[]>();
  for (const point of points) {
    const bucket = grouped.get(point.label) ?? [];
    bucket.push(point);
    grouped.set(point.label, bucket);
  }

  const coordinateById = new Map<number, Pick<IdentifiedKnownStructurePoint, 'x' | 'y'>>();
  for (const bucket of grouped.values()) {
    if (bucket.length < 2) throw new Error('each cluster requires at least two observations');
    const shift = Math.max(1, Math.floor(bucket.length / 2));
    for (let index = 0; index < bucket.length; index += 1) {
      const target = bucket[(index + shift) % bucket.length];
      coordinateById.set(bucket[index].id, { x: target.x, y: target.y });
    }
  }

  return points.map((point) => {
    const coordinate = coordinateById.get(point.id);
    if (!coordinate) throw new Error(`missing permuted coordinate for point ${point.id}`);
    return { ...point, ...coordinate };
  });
}

function rankMatrix(points: readonly IdentifiedKnownStructurePoint[]): number[][] {
  const n = points.length;
  const ranks = Array.from({ length: n }, () => Array<number>(n).fill(0));

  for (let i = 0; i < n; i += 1) {
    const source = points[i];
    const ordered = points
      .map((target, j) => {
        if (i === j) return null;
        const dx = source.x - target.x;
        const dy = source.y - target.y;
        return { j, id: target.id, distanceSquared: dx * dx + dy * dy };
      })
      .filter((value): value is NonNullable<typeof value> => value !== null)
      .sort(
        (a, b) =>
          a.distanceSquared - b.distanceSquared ||
          a.id - b.id
      );

    ordered.forEach((entry, rankIndex) => {
      ranks[i][entry.j] = rankIndex + 1;
    });
  }

  return ranks;
}

/**
 * Rank-based neighborhood quality following the trustworthiness/continuity
 * family formalised by Venna & Kaski and reviewed in Lee & Verleysen (2008).
 *
 * Ground-truth observation identity is benchmark metadata only. This function
 * never participates in Moneta's production analytical authority.
 */
export function computeNeighborhoodPreservation(
  source: readonly IdentifiedKnownStructurePoint[],
  representation: readonly IdentifiedKnownStructurePoint[],
  k = 5
): NeighborhoodPreservationScore {
  const n = source.length;
  if (n !== representation.length || n < 3) {
    throw new Error('source and representation must contain the same >= 3 observations');
  }
  if (!Number.isInteger(k) || k < 1 || k >= n / 2) {
    throw new Error('k must be an integer in [1, n/2)');
  }

  const sourceIds = source.map((point) => point.id);
  const representedIds = representation.map((point) => point.id);
  if (new Set(sourceIds).size !== n || new Set(representedIds).size !== n) {
    throw new Error('observation ids must be unique');
  }
  if (sourceIds.some((id, index) => id !== representedIds[index])) {
    throw new Error('source and representation must preserve row identity and order');
  }

  const sourceRanks = rankMatrix(source);
  const representationRanks = rankMatrix(representation);
  let trustPenalty = 0;
  let continuityPenalty = 0;
  let overlap = 0;

  for (let i = 0; i < n; i += 1) {
    const sourceNeighborhood = new Set<number>();
    const representedNeighborhood = new Set<number>();

    for (let j = 0; j < n; j += 1) {
      if (sourceRanks[i][j] > 0 && sourceRanks[i][j] <= k) sourceNeighborhood.add(j);
      if (
        representationRanks[i][j] > 0 &&
        representationRanks[i][j] <= k
      ) {
        representedNeighborhood.add(j);
      }
    }

    for (const j of representedNeighborhood) {
      if (sourceNeighborhood.has(j)) {
        overlap += 1;
      } else {
        trustPenalty += sourceRanks[i][j] - k;
      }
    }
    for (const j of sourceNeighborhood) {
      if (!representedNeighborhood.has(j)) {
        continuityPenalty += representationRanks[i][j] - k;
      }
    }
  }

  // Lee & Verleysen (2008), eqs. 2-4 for K < N/2.
  const normalizer = n * k * (2 * n - 3 * k - 1);
  return {
    k,
    trustworthiness: 1 - (2 * trustPenalty) / normalizer,
    continuity: 1 - (2 * continuityPenalty) / normalizer,
    meanKnnOverlap: overlap / (n * k),
  };
}

/**
 * Demonstrate the blind spot explicitly: global cluster evidence is evaluated
 * by the production Rust/WASM profiler, while benchmark-only rank metrics
 * evaluate observation-level neighborhood preservation.
 */
export function runNeighborhoodPreservationAdversary(
  profile: StructureProfiler,
  options: { seed?: number; pointsPerCluster?: number; jitter?: number; k?: number } = {}
): NeighborhoodAdversaryResult[] {
  const source = asIdentified(
    generatePlantedThreeClusterDataset(
      options.seed ?? 20260911,
      options.pointsPerCluster ?? 48,
      options.jitter ?? 0.55
    )
  );
  const scrambled = permuteCoordinatesWithinClusters(source);
  const k = options.k ?? 5;

  return [
    {
      candidateId: 'identity',
      profile: profile(toDataset('neighborhood-identity', source)),
      neighborhood: computeNeighborhoodPreservation(source, source, k),
    },
    {
      candidateId: 'within-cluster-permutation',
      profile: profile(toDataset('neighborhood-within-cluster-permutation', scrambled)),
      neighborhood: computeNeighborhoodPreservation(source, scrambled, k),
    },
  ];
}
