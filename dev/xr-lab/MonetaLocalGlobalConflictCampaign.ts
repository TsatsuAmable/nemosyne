import type { DatasetJSON } from '../../src/data/types.ts';
import {
  generatePlantedThreeClusterDataset,
  perturbKnownStructure,
  type ClusterProfileObservation,
  type KnownStructurePoint,
  type StructureProfiler,
} from './MonetaKnownStructureCampaign.ts';

export interface LocalGlobalConflictResult {
  baseProfile: ClusterProfileObservation;
  scrambledProfile: ClusterProfileObservation;
  perturbationRuns: number;
  plantedClusterRecoveryRate: number;
  meanLocalNeighbourRetention: number;
}

export interface LocalGlobalConflictOptions {
  seed?: number;
  pointsPerCluster?: number;
  jitter?: number;
  perturbationRuns?: number;
  perturbationMagnitude?: number;
  neighbours?: number;
}

function toDataset(name: string, rows: readonly KnownStructurePoint[]): DatasetJSON {
  return {
    name,
    columns: [
      { name: 'u', type: 'NUMERIC' },
      { name: 'v', type: 'NUMERIC' },
    ],
    rows: rows.map((point) => ({ u: point.x, v: point.y })),
  };
}

function seededPermutation(length: number, seed: number): number[] {
  const values = Array.from({ length }, (_, index) => index);
  let state = seed >>> 0;
  const random = () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [values[index], values[swap]] = [values[swap], values[index]];
  }
  return values;
}

/**
 * Preserve the exact coordinate multiset inside each planted cluster while
 * reassigning those coordinates to different observation identities.
 *
 * Global cluster geometry is therefore unchanged, while observation-local
 * neighbourhoods are deliberately corrupted.
 */
export function scrambleWithinClusters(
  points: readonly KnownStructurePoint[],
  seed: number
): KnownStructurePoint[] {
  const output = points.map((point) => ({ ...point }));
  const labels = [...new Set(points.map((point) => point.label))].sort((a, b) => a - b);

  for (const label of labels) {
    const indices = points
      .map((point, index) => (point.label === label ? index : -1))
      .filter((index) => index >= 0);
    const permutation = seededPermutation(indices.length, seed ^ Math.imul(label + 1, 0x9e3779b1));
    for (let position = 0; position < indices.length; position += 1) {
      const target = indices[position];
      const source = indices[permutation[position]];
      output[target] = {
        x: points[source].x,
        y: points[source].y,
        label: points[target].label,
      };
    }
  }

  return output;
}

function squaredDistance(a: KnownStructurePoint, b: KnownStructurePoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function neighbourSet(
  points: readonly KnownStructurePoint[],
  index: number,
  neighbours: number
): Set<number> {
  return new Set(
    points
      .map((point, candidate) => ({
        candidate,
        distance: candidate === index ? Number.POSITIVE_INFINITY : squaredDistance(points[index], point),
      }))
      .sort((a, b) => a.distance - b.distance || a.candidate - b.candidate)
      .slice(0, neighbours)
      .map(({ candidate }) => candidate)
  );
}

/**
 * Mean fraction of each observation's k nearest neighbours that remain the
 * same after a representation transform. This is a benchmark falsifier, not a
 * production analytical score.
 */
export function localNeighbourRetention(
  before: readonly KnownStructurePoint[],
  after: readonly KnownStructurePoint[],
  neighbours = 5
): number {
  if (before.length !== after.length) throw new Error('point sets must have equal length');
  if (!Number.isInteger(neighbours) || neighbours < 1 || neighbours >= before.length) {
    throw new Error('neighbours must be an integer in [1, pointCount)');
  }

  let retained = 0;
  for (let index = 0; index < before.length; index += 1) {
    const left = neighbourSet(before, index, neighbours);
    const right = neighbourSet(after, index, neighbours);
    let overlap = 0;
    for (const candidate of left) if (right.has(candidate)) overlap += 1;
    retained += overlap / neighbours;
  }
  return retained / before.length;
}

export function runLocalGlobalConflictCampaign(
  profile: StructureProfiler,
  options: LocalGlobalConflictOptions = {}
): LocalGlobalConflictResult {
  const seed = options.seed ?? 20260911;
  const pointsPerCluster = options.pointsPerCluster ?? 48;
  const jitter = options.jitter ?? 0.55;
  const perturbationRuns = options.perturbationRuns ?? 8;
  const perturbationMagnitude = options.perturbationMagnitude ?? 0.1;
  const neighbours = options.neighbours ?? 5;

  const groundTruth = generatePlantedThreeClusterDataset(seed, pointsPerCluster, jitter);
  const scrambled = scrambleWithinClusters(groundTruth, seed ^ 0xa11ce);
  const baseProfile = profile(toDataset('local-global-base', groundTruth));
  const scrambledProfile = profile(toDataset('local-global-scrambled', scrambled));

  let recovered = 0;
  let retentionTotal = 0;
  for (let run = 0; run < perturbationRuns; run += 1) {
    const perturbed = perturbKnownStructure(
      groundTruth,
      seed ^ Math.imul(run + 1, 0x85ebca6b),
      perturbationMagnitude
    );
    const perturbedScrambled = scrambleWithinClusters(
      perturbed,
      seed ^ Math.imul(run + 1, 0xc2b2ae35)
    );
    const observation = profile(toDataset(`local-global-scrambled-${run}`, perturbedScrambled));
    if (observation.hasClusters && observation.estimatedCount === 3) recovered += 1;
    retentionTotal += localNeighbourRetention(perturbed, perturbedScrambled, neighbours);
  }

  return {
    baseProfile,
    scrambledProfile,
    perturbationRuns,
    plantedClusterRecoveryRate: recovered / perturbationRuns,
    meanLocalNeighbourRetention: retentionTotal / perturbationRuns,
  };
}
