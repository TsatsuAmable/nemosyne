import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  DEFAULT_RESOLVER_WEIGHTS,
  SemanticTargetResolver,
  type RankedSemanticTarget,
  type SemanticResolverWeights,
} from '../src/vr/input/SemanticTargetResolver.ts';
import type {
  InteractableEntry,
  SceneHit,
  SemanticTargetKind,
} from '../src/vr/input/InteractableRegistry.ts';

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function isStructureKind(kind: SemanticTargetKind): boolean {
  return (
    kind === 'mapper-node' ||
    kind === 'cluster-region' ||
    kind === 'persistence-structure' ||
    kind === 'investigation-artifact'
  );
}

/** Frozen pre-UXR0C3 first-call oracle. Deliberately retains the old allocation-heavy shape. */
function legacyFirstRank(
  rawHits: SceneHit[],
  ray: THREE.Ray,
  gazeDir?: THREE.Vector3,
  activeTaskPrior?: string,
  weights: SemanticResolverWeights = DEFAULT_RESOLVER_WEIGHTS,
  assistanceRadius = 0.05
): RankedSemanticTarget | null {
  if (rawHits.length === 0) return null;

  const scored: RankedSemanticTarget[] = [];
  const totalWeight = Object.values(weights).reduce((sum, value) => sum + value, 0);
  const normalizedGaze = gazeDir?.clone();
  if (normalizedGaze) normalizedGaze.normalize();

  for (const hit of rawHits) {
    if (!Number.isFinite(hit.distance) || hit.distance < 0) continue;

    const entry = hit.entry;
    const kind: SemanticTargetKind =
      entry.semantic?.kind ?? (entry.data ? 'observation' : 'command');
    const structureId = entry.semantic?.structureId;
    const distScore = clamp01(1 - hit.distance / 10);
    const salienceScore = clamp01(entry.semantic?.salience ?? (isStructureKind(kind) ? 0.85 : 0.4));

    let gazeScore = 0.5;
    if (normalizedGaze && entry.mesh) {
      const meshWorldPos = new THREE.Vector3();
      entry.mesh.getWorldPosition(meshWorldPos);
      const toMesh = meshWorldPos.clone().sub(ray.origin);
      if (toMesh.lengthSq() > 1e-8) gazeScore = clamp01(normalizedGaze.dot(toMesh.normalize()));
    }

    const taskPrior = activeTaskPrior && structureId === activeTaskPrior ? 1 : 0.5;
    const weightedScore =
      weights.w_distance * distScore +
      weights.w_salience * salienceScore +
      weights.w_taskPrior * taskPrior +
      weights.w_gaze * gazeScore;
    const score = clamp01(weightedScore / totalWeight);
    const confidence = clamp01(distScore * 0.5 + salienceScore * 0.5);
    scored.push({ kind, entry, structureId, score, confidence });
  }

  if (scored.length === 0) return null;
  scored.sort((a, b) => b.score - a.score);

  const bestHit = scored[0];
  const bestStructure = scored.find((target) => isStructureKind(target.kind));
  const nearestObservation = rawHits
    .filter(
      (hit) =>
        (hit.entry.semantic?.kind ?? (hit.entry.data ? 'observation' : 'command')) === 'observation'
    )
    .filter((hit) => Number.isFinite(hit.distance) && hit.distance >= 0)
    .sort((a, b) => a.distance - b.distance)[0];

  let winner = bestHit;
  if (bestStructure && bestStructure !== bestHit && nearestObservation) {
    const structHit = rawHits.find((hit) => hit.entry === bestStructure.entry);
    const structDist = structHit?.distance ?? Infinity;
    if (
      Number.isFinite(structDist) &&
      Math.abs(structDist - nearestObservation.distance) <= assistanceRadius &&
      bestStructure.score >= bestHit.score - 0.2
    ) {
      winner = bestStructure;
    }
  }
  return winner;
}

function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

const KINDS: SemanticTargetKind[] = [
  'observation',
  'command',
  'mapper-node',
  'cluster-region',
  'persistence-structure',
  'investigation-artifact',
];

function makeFixture(random: () => number, count: number): SceneHit[] {
  const hits: SceneHit[] = [];
  for (let index = 0; index < count; index++) {
    const mesh = new THREE.Object3D();
    mesh.position.set(random() * 2 - 1, random() * 2 - 1, 0.1 + random() * 5);
    mesh.updateMatrixWorld();
    const kind = KINDS[Math.floor(random() * KINDS.length)];
    const entry: InteractableEntry = {
      mesh,
      data: kind === 'observation' ? { row: index } : undefined,
      semantic: {
        kind,
        structureId: isStructureKind(kind) ? `structure-${index % 5}` : undefined,
        salience: random(),
      },
    };
    let distance = random() * 12;
    const invalidSelector = random();
    if (invalidSelector < 0.03) distance = Number.NaN;
    else if (invalidSelector < 0.06) distance = -1;
    hits.push({ entry, distance });
  }
  return hits;
}

describe('UXR0C3: semantic resolver equivalence oracle', () => {
  it('matches the pre-C3 first-call winner and score across deterministic varied fixtures', () => {
    const random = rng(0x5e4a71c);
    const ray = new THREE.Ray(new THREE.Vector3(0.2, -0.1, 0.05), new THREE.Vector3(0, 0, 1));

    for (const count of [1, 2, 8, 32]) {
      for (let trial = 0; trial < 125; trial++) {
        const hits = makeFixture(random, count);
        const gaze = trial % 3 === 0 ? new THREE.Vector3(0.1, 0.2, 1) : undefined;
        const taskPrior = trial % 4 === 0 ? `structure-${trial % 5}` : undefined;
        const expected = legacyFirstRank(hits, ray, gaze, taskPrior);
        const actual = new SemanticTargetResolver().rank(hits, ray, gaze, taskPrior, 1_000);

        expect(actual?.entry ?? null).toBe(expected?.entry ?? null);
        expect(actual?.kind ?? null).toBe(expected?.kind ?? null);
        expect(actual?.structureId ?? null).toBe(expected?.structureId ?? null);
        if (expected && actual) {
          expect(actual.score).toBeCloseTo(expected.score, 14);
          expect(actual.confidence).toBeCloseTo(expected.confidence, 14);
        }
      }
    }
  });

  it('preserves stable first-hit precedence for exact score ties', () => {
    const first = { mesh: new THREE.Object3D(), semantic: { kind: 'command' as const } };
    const second = { mesh: new THREE.Object3D(), semantic: { kind: 'command' as const } };
    const ray = new THREE.Ray(new THREE.Vector3(), new THREE.Vector3(0, 0, 1));
    const result = new SemanticTargetResolver().rank(
      [
        { entry: first, distance: 1 },
        { entry: second, distance: 1 },
      ],
      ray,
      undefined,
      undefined,
      1_000
    );
    expect(result?.entry).toBe(first);
  });
});
