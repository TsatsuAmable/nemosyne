import * as THREE from 'three';
import type { InteractableEntry, SceneHit, SemanticTargetKind } from './InteractableRegistry.ts';

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
  private readonly _normalizedGaze = new THREE.Vector3();
  private readonly _meshWorldPos = new THREE.Vector3();
  private readonly _toMesh = new THREE.Vector3();

  constructor(weights: Partial<SemanticResolverWeights> = {}, assistanceRadius = 0.05) {
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

    const totalWeight =
      this.weights.w_distance +
      this.weights.w_salience +
      this.weights.w_taskPrior +
      this.weights.w_gaze;

    let normalizedGaze: THREE.Vector3 | undefined;
    if (gazeDir) {
      if (
        !Number.isFinite(gazeDir.x) ||
        !Number.isFinite(gazeDir.y) ||
        !Number.isFinite(gazeDir.z)
      ) {
        throw new TypeError('Semantic resolver gaze direction must contain finite coordinates');
      }
      if (gazeDir.lengthSq() < 1e-8) {
        throw new TypeError('Semantic resolver gaze direction must be non-zero');
      }
      normalizedGaze = this._normalizedGaze.copy(gazeDir).normalize();
    }

    let bestIndex = -1;
    let bestEntry: InteractableEntry | null = null;
    let bestKind: SemanticTargetKind = 'command';
    let bestEntryStructureId: string | undefined;
    let bestScore = -Infinity;
    let bestConfidence = 0;

    let bestStructureIndex = -1;
    let bestStructureEntry: InteractableEntry | null = null;
    let bestStructureKind: SemanticTargetKind = 'mapper-node';
    let bestStructureId: string | undefined;
    let bestStructureScore = -Infinity;
    let bestStructureConfidence = 0;
    let bestStructureDistance = Infinity;

    let nearestObservationDistance = Infinity;

    for (let index = 0; index < rawHits.length; index++) {
      const hit = rawHits[index];
      if (!Number.isFinite(hit.distance) || hit.distance < 0) continue;

      const entry = hit.entry;
      const kind: SemanticTargetKind =
        entry.semantic?.kind ?? (entry.data ? 'observation' : 'command');
      const structureId = entry.semantic?.structureId;
      const structureKind = isStructureKind(kind);

      const distScore = clamp01(1 - hit.distance / 10);
      const salienceScore = clamp01(entry.semantic?.salience ?? (structureKind ? 0.85 : 0.4));

      let gazeScore = 0.5;
      if (normalizedGaze && entry.mesh) {
        entry.mesh.getWorldPosition(this._meshWorldPos);
        this._toMesh.copy(this._meshWorldPos).sub(ray.origin);
        if (this._toMesh.lengthSq() > 1e-8) {
          gazeScore = clamp01(normalizedGaze.dot(this._toMesh.normalize()));
        }
      }

      const taskPrior = activeTaskPrior && structureId === activeTaskPrior ? 1 : 0.5;
      const weightedScore =
        this.weights.w_distance * distScore +
        this.weights.w_salience * salienceScore +
        this.weights.w_taskPrior * taskPrior +
        this.weights.w_gaze * gazeScore;
      const score = clamp01(weightedScore / totalWeight);
      const confidence = clamp01(distScore * 0.5 + salienceScore * 0.5);

      // Strict comparison preserves Array#sort stability: equal-score candidates
      // retain the earliest raw-hit position, matching the pre-UXR0C3 resolver.
      if (score > bestScore) {
        bestIndex = index;
        bestEntry = entry;
        bestKind = kind;
        bestEntryStructureId = structureId;
        bestScore = score;
        bestConfidence = confidence;
      }

      if (structureKind && score > bestStructureScore) {
        bestStructureIndex = index;
        bestStructureEntry = entry;
        bestStructureKind = kind;
        bestStructureId = structureId;
        bestStructureScore = score;
        bestStructureConfidence = confidence;
        bestStructureDistance = hit.distance;
      }

      if (kind === 'observation' && hit.distance < nearestObservationDistance) {
        nearestObservationDistance = hit.distance;
      }
    }

    if (bestIndex < 0 || bestEntry === null) {
      this._heldTarget = null;
      return null;
    }

    let winnerEntry = bestEntry;
    let winnerKind = bestKind;
    let winnerStructureId = bestEntryStructureId;
    let winnerScore = bestScore;
    let winnerConfidence = bestConfidence;

    if (
      bestStructureIndex >= 0 &&
      bestStructureIndex !== bestIndex &&
      bestStructureEntry !== null &&
      Number.isFinite(nearestObservationDistance) &&
      Number.isFinite(bestStructureDistance) &&
      Math.abs(bestStructureDistance - nearestObservationDistance) <= this.assistanceRadius &&
      bestStructureScore >= bestScore - 0.2
    ) {
      winnerEntry = bestStructureEntry;
      winnerKind = bestStructureKind;
      winnerStructureId = bestStructureId;
      winnerScore = bestStructureScore;
      winnerConfidence = bestStructureConfidence;
    }

    const materializeWinner = (): RankedSemanticTarget => ({
      kind: winnerKind,
      entry: winnerEntry,
      structureId: winnerStructureId,
      score: winnerScore,
      confidence: winnerConfidence,
    });

    if (!this._heldTarget) {
      const winner = materializeWinner();
      this._heldTarget = {
        target: winner,
        heldSince: now,
        consecutiveOverrideFrames: 0,
        lastScore: winnerScore,
      };
      return winner;
    }

    if (this._heldTarget.target.entry === winnerEntry) {
      this._heldTarget.consecutiveOverrideFrames = 0;
      this._heldTarget.lastScore = winnerScore;
      return this._heldTarget.target;
    }

    const isDwellExpired = now - this._heldTarget.heldSince > 1200;
    const beatsHeldSignificantly = winnerScore > this._heldTarget.lastScore * 1.5;

    if (isDwellExpired) {
      const winner = materializeWinner();
      this._heldTarget = {
        target: winner,
        heldSince: now,
        consecutiveOverrideFrames: 0,
        lastScore: winnerScore,
      };
      return winner;
    }

    if (beatsHeldSignificantly) {
      this._heldTarget.consecutiveOverrideFrames++;
      if (this._heldTarget.consecutiveOverrideFrames >= 3) {
        const winner = materializeWinner();
        this._heldTarget = {
          target: winner,
          heldSince: now,
          consecutiveOverrideFrames: 0,
          lastScore: winnerScore,
        };
        return winner;
      }
    } else {
      this._heldTarget.consecutiveOverrideFrames = 0;
    }

    return this._heldTarget.target;
  }
}
