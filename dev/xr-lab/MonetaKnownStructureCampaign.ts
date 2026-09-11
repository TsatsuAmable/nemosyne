import type { DatasetJSON } from '../../src/data/types.ts';
import { MONETA_BENCHMARK_FAMILIES } from './MonetaBenchmarkCorpus.ts';
import {
  adjudicateBenchmarkCandidate,
  type MonetaEvidenceDecision,
} from './MonetaEvidenceProtocol.ts';

export interface KnownStructurePoint {
  x: number;
  y: number;
  label: number;
}

export interface ClusterProfileObservation {
  hasClusters: boolean;
  estimatedCount: number;
  separationScore: number;
}

export type StructureProfiler = (dataset: DatasetJSON) => ClusterProfileObservation;

export interface RepresentationControl {
  id: string;
  label: string;
  project(points: readonly KnownStructurePoint[]): DatasetJSON;
}

export interface KnownStructureCampaignResult {
  candidateId: string;
  baseProfile: ClusterProfileObservation;
  perturbationRuns: number;
  plantedClusterRecoveryRate: number;
  meanSeparationScore: number;
  evidenceDecision: MonetaEvidenceDecision;
}

export interface KnownStructureCampaignOptions {
  seed?: number;
  pointsPerCluster?: number;
  jitter?: number;
  perturbationRuns?: number;
  perturbationMagnitude?: number;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Exact-generative control dataset: three compact, well-separated planar
 * clusters. The labels are ground truth for the benchmark only and are not
 * passed into the Rust analytical profile as an analytical variable.
 */
export function generatePlantedThreeClusterDataset(
  seed: number,
  pointsPerCluster = 60,
  jitter = 0.55
): KnownStructurePoint[] {
  if (!Number.isInteger(pointsPerCluster) || pointsPerCluster < 2) {
    throw new Error('pointsPerCluster must be an integer >= 2');
  }
  if (!Number.isFinite(jitter) || jitter < 0) throw new Error('jitter must be finite and >= 0');

  const random = mulberry32(seed);
  const centres = [
    [-4, -3],
    [0, 4],
    [4, -3],
  ] as const;
  const points: KnownStructurePoint[] = [];
  for (let label = 0; label < centres.length; label += 1) {
    const [cx, cy] = centres[label];
    for (let index = 0; index < pointsPerCluster; index += 1) {
      points.push({
        x: cx + (random() * 2 - 1) * jitter,
        y: cy + (random() * 2 - 1) * jitter,
        label,
      });
    }
  }
  return points;
}

/** Apply bounded, seeded measurement perturbation without changing labels. */
export function perturbKnownStructure(
  points: readonly KnownStructurePoint[],
  seed: number,
  magnitude: number
): KnownStructurePoint[] {
  if (!Number.isFinite(magnitude) || magnitude < 0) {
    throw new Error('perturbation magnitude must be finite and >= 0');
  }
  const random = mulberry32(seed);
  return points.map((point) => ({
    x: point.x + (random() * 2 - 1) * magnitude,
    y: point.y + (random() * 2 - 1) * magnitude,
    label: point.label,
  }));
}

function projectedDataset(
  name: string,
  points: readonly KnownStructurePoint[],
  project: (point: KnownStructurePoint) => readonly [number, number]
): DatasetJSON {
  return {
    name,
    columns: [
      { name: 'u', type: 'NUMERIC' },
      { name: 'v', type: 'NUMERIC' },
    ],
    rows: points.map((point) => {
      const [u, v] = project(point);
      return { u, v };
    }),
  };
}

/**
 * Controls, not proposed product representations. They prove that the campaign
 * can distinguish structure-preserving transforms from deliberate collapse.
 */
export const KNOWN_STRUCTURE_CONTROLS: readonly RepresentationControl[] = [
  {
    id: 'preserve-xy',
    label: 'Identity planar representation',
    project: (points) => projectedDataset('preserve-xy', points, (point) => [point.x, point.y]),
  },
  {
    id: 'rotate-xy',
    label: 'Distance-preserving 45-degree rotation',
    project: (points) =>
      projectedDataset('rotate-xy', points, (point) => [
        (point.x + point.y) / Math.SQRT2,
        (point.x - point.y) / Math.SQRT2,
      ]),
  },
  {
    id: 'collapse',
    label: 'Deliberate information-destroying collapse',
    project: (points) => projectedDataset('collapse', points, () => [0, 0]),
  },
] as const;

/**
 * Run the exact-generative structure campaign through an injected profiler.
 * Production/CI integration should inject the Rust/WASM DatasetStructureProfile
 * adapter; this module deliberately contains no replacement clustering logic.
 */
export function runKnownStructureCampaign(
  profile: StructureProfiler,
  options: KnownStructureCampaignOptions = {},
  controls: readonly RepresentationControl[] = KNOWN_STRUCTURE_CONTROLS
): KnownStructureCampaignResult[] {
  const seed = options.seed ?? 0x4d4f4e45;
  const pointsPerCluster = options.pointsPerCluster ?? 60;
  const jitter = options.jitter ?? 0.55;
  const perturbationRuns = options.perturbationRuns ?? 12;
  const perturbationMagnitude = options.perturbationMagnitude ?? 0.12;
  if (!Number.isInteger(perturbationRuns) || perturbationRuns < 1) {
    throw new Error('perturbationRuns must be a positive integer');
  }

  const groundTruth = generatePlantedThreeClusterDataset(seed, pointsPerCluster, jitter);
  const expectedClusters = 3;
  const family = MONETA_BENCHMARK_FAMILIES['synthetic-structure-lab'];

  return controls.map((control) => {
    const baseProfile = profile(control.project(groundTruth));
    let recovered = 0;
    let separationTotal = 0;

    for (let run = 0; run < perturbationRuns; run += 1) {
      const perturbed = perturbKnownStructure(
        groundTruth,
        seed ^ Math.imul(run + 1, 0x9e3779b1),
        perturbationMagnitude
      );
      const observation = profile(control.project(perturbed));
      if (observation.hasClusters && observation.estimatedCount === expectedClusters)
        recovered += 1;
      separationTotal += observation.separationScore;
    }

    const plantedClusterRecoveryRate = recovered / perturbationRuns;
    const meanSeparationScore = separationTotal / perturbationRuns;
    const evidenceDecision = adjudicateBenchmarkCandidate(family, {
      candidateId: control.id,
      measurementScales: ['interval'],
      compositionHandling: 'not-applicable',
      sampleSize: groundTruth.length,
      featureCount: 2,
      selectionMode: 'fixed-before-data',
      makesInferentialClaim: false,
      calibration: 'not-applicable',
      perturbation: {
        runs: perturbationRuns,
        metric: 'planted-cluster-recovery-rate',
        value: plantedClusterRecoveryRate,
      },
      humanValidationObserved: false,
    });

    return {
      candidateId: control.id,
      baseProfile,
      perturbationRuns,
      plantedClusterRecoveryRate,
      meanSeparationScore,
      evidenceDecision,
    };
  });
}
