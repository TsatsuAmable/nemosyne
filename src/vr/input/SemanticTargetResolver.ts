import * as THREE from 'three';
import type {
  InteractableEntry,
  SceneHit,
  SemanticTargetKind,
} from './InteractableRegistry.ts';

export interface RankedSemanticTarget {
  kind: SemanticTargetKind;
  entry: InteractableEntry;
  structureId?: string;
  score: number;
  /** Selection-strength heuristic, not a calibrated probability. */
  confidence: number;
}

export interface TargetHoldState {
  target: RankedSemanticTarget;
  heldSince: number;
  consecutiveOverrideFrames: number;
  lastScore: number;
}

export interface SemanticResolverWeights {
  w_distance: number;
  w_salience: number;
  w_taskPrior: number;
  w_gaze: number;
}

export const DEFAULT_RESOLVER_WEIGHTS: SemanticResolverWeights = {
  w_distance: 0.4,
  w_salience: 0.25,
  w_taskPrior: 0.2,
  w_gaze: 0.15,
};

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

function validateWeights(weights: SemanticResolverWeights): void {
  const entries = Object.entries(weights);
  for (const [name, value] of entries) {
    if (!Number.isFinite(value) || value < 0) {
      throw new TypeError(`Semantic resolver weight ${name} must be finite and non-negative`);
    }
  }
  const sum = entries.reduce((total, [, value]) => total + value, 0);
  if (sum <= 0) {
    throw new TypeError('Semantic resolver weights must have positive total weight');
  }
}

export class SemanticTargetResolver {
  readonly weights: SemanticResolverWeights;
  readonly assistanceRadius: number;
  private _heldTarget: TargetHoldState | null = null;

  constructor(
    weights: Partial<SemanticResolverWeights> = {},
    assistanceRadius = 0.05
  ) {
    this.weights = { ...DEFAULT_RESOLVER_WEIGHTS, ...weights };
    validateWeights(this.weights);
    if (!Number.isFinite(assistanceRadius) || assistanceRadius < 0) {
      throw new TypeError('Semantic resolver assistanceRadius must be finite and non-negative');
    }
    this.assistanceRadius = assistanceRadius;
  }

  get heldTarget(): RankedSemanticTarget | null {
    return this._heldTarget?.target ?? null;
  }

  clearHold(): void {
    this._heldTarget = null;
  }

  /**
   * Rank scene hits and resolve best semantic target with coercion and hysteresis.
   * `confidence` is a bounded selection-strength heuristic only; it is not a
   * calibrated probability or scientific confidence measure.
   */
  rank(
    rawHits: SceneHit[],
    ray: THREE.Ray,
    gazeDir?: THREE.Vector3,
    activeTaskPrior?: string,
    now = Date.now()
  ): RankedSemanticTarget | null {
    if (rawHits.length === 0) {
      this._heldTarget = null;
      return null;
    }
    if (!Number.isFinite(now)) {
      throw new TypeError('Semantic resolver timestamp must be finite');
    }

    const scored: RankedSemanticTarget[] = [];
    const totalWeight = Object.values(this.weights).reduce((sum, value) => sum + value, 0);
    const normalizedGaze = gazeDir?.clone();
    if (normalizedGaze) {
      if (![normalizedGaze.x, normalizedGaze.y, normalizedGaze.z].every(Number.isFinite)) {
        throw new TypeError('Semantic resolver gaze direction must contain finite coordinates');
      }
      if (normalizedGaze.lengthSq() < 1e-8) {
        throw new TypeError('Semantic resolver gaze direction must be non-zero');
      }
      normalizedGaze.normalize();
    }

    for (const hit of rawHits) {
      if (!Number.isFinite(hit.distance) || hit.distance < 0) {
        continue;
      }

      const entry = hit.entry;
      const kind: SemanticTargetKind =
        entry.semantic?.kind ?? (entry.data ? 'observation' : 'command');
      const structureId = entry.semantic?.structureId;

      const distScore = clamp01(1 - hit.distance / 10);
      const salienceScore = clamp01(
        entry.semantic?.salience ?? (isStructureKind(kind) ? 0.85 : 0.4)
      );

      let gazeScore = 0.5;
      if (normalizedGaze && hit.entry.mesh) {
        const meshWorldPos = new THREE.Vector3();
        hit.entry.mesh.getWorldPosition(meshWorldPos);
        const toMesh = meshWorldPos.clone().sub(ray.origin);
        if (toMesh.lengthSq() > 1e-8) {
          gazeScore = clamp01(normalizedGaze.dot(toMesh.normalize()));
        }
      }

      // Task priors require exact semantic identity. Substring matching on a
      // structure ID is intentionally avoided because IDs are opaque durable identities.
      const taskPrior = activeTaskPrior && structureId === activeTaskPrior ? 1 : 0.5;

      const weightedScore =
        this.weights.w_distance * distScore +
        this.weights.w_salience * salienceScore +
        this.weights.w_taskPrior * taskPrior +
        this.weights.w_gaze * gazeScore;
      const score = clamp01(weightedScore / totalWeight);

      const confidence = clamp01(distScore * 0.5 + salienceScore * 0.5);

      scored.push({
        kind,
        entry,
        structureId,
        score,
        confidence,
      });
    }

    if (scored.length === 0) {
      this._heldTarget = null;
      return null;
    }

    scored.sort((a, b) => b.score - a.score);

    // Semantic coercion compares a candidate structure against the nearest
    // raw observation, not whichever hit happened to be first in the array.
    const bestHit = scored[0];
    const bestStructure = scored.find((target) => isStructureKind(target.kind));
    const nearestObservation = rawHits
      .filter((hit) => (hit.entry.semantic?.kind ?? (hit.entry.data ? 'observation' : 'command')) === 'observation')
      .filter((hit) => Number.isFinite(hit.distance) && hit.distance >= 0)
      .sort((a, b) => a.distance - b.distance)[0];

    let winner = bestHit;
    if (bestStructure && bestStructure !== bestHit && nearestObservation) {
      const structHit = rawHits.find((hit) => hit.entry === bestStructure.entry);
      const structDist = structHit?.distance ?? Infinity;

      if (
        Number.isFinite(structDist) &&
        Math.abs(structDist - nearestObservation.distance) <= this.assistanceRadius &&
        bestStructure.score >= bestHit.score - 0.2
      ) {
        winner = bestStructure;
      }
    }

    if (!this._heldTarget) {
      this._heldTarget = {
        target: winner,
        heldSince: now,
        consecutiveOverrideFrames: 0,
        lastScore: winner.score,
      };
      return winner;
    }

    if (this._heldTarget.target.entry === winner.entry) {
      this._heldTarget.consecutiveOverrideFrames = 0;
      this._heldTarget.lastScore = winner.score;
      return this._heldTarget.target;
    }

    const isDwellExpired = now - this._heldTarget.heldSince > 1200;
    const beatsHeldSignificantly = winner.score > this._heldTarget.lastScore * 1.5;

    if (isDwellExpired) {
      this._heldTarget = {
        target: winner,
        heldSince: now,
        consecutiveOverrideFrames: 0,
        lastScore: winner.score,
      };
      return winner;
    }

    if (beatsHeldSignificantly) {
      this._heldTarget.consecutiveOverrideFrames++;
      if (this._heldTarget.consecutiveOverrideFrames >= 3) {
        this._heldTarget = {
          target: winner,
          heldSince: now,
          consecutiveOverrideFrames: 0,
          lastScore: winner.score,
        };
        return winner;
      }
    } else {
      this._heldTarget.consecutiveOverrideFrames = 0;
    }

    return this._heldTarget.target;
  }
}
