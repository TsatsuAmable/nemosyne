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

export class SemanticTargetResolver {
  readonly weights: SemanticResolverWeights;
  readonly assistanceRadius: number;
  private _heldTarget: TargetHoldState | null = null;

  constructor(
    weights: Partial<SemanticResolverWeights> = {},
    assistanceRadius = 0.05
  ) {
    this.weights = { ...DEFAULT_RESOLVER_WEIGHTS, ...weights };
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

    const scored: RankedSemanticTarget[] = [];

    for (const hit of rawHits) {
      const entry = hit.entry;
      const kind: SemanticTargetKind =
        entry.semantic?.kind ?? (entry.data ? 'observation' : 'command');
      const structureId = entry.semantic?.structureId;

      // Distance score: inverse distance normalised within 10m
      const distScore = Math.max(0, 1 - hit.distance / 10);

      // Salience: analytical structures get higher salience by default
      const salienceScore =
        entry.semantic?.salience ??
        (kind === 'mapper-node' ||
        kind === 'cluster-region' ||
        kind === 'persistence-structure'
          ? 0.85
          : 0.4);

      // Gaze alignment
      let gazeScore = 0.5;
      if (gazeDir && hit.entry.mesh) {
        const meshWorldPos = new THREE.Vector3();
        hit.entry.mesh.getWorldPosition(meshWorldPos);
        const toMesh = meshWorldPos.clone().sub(ray.origin).normalize();
        const dot = Math.max(0, gazeDir.dot(toMesh));
        gazeScore = dot;
      }

      // Task prior
      let taskPrior = 0.5;
      if (activeTaskPrior && structureId?.includes(activeTaskPrior)) {
        taskPrior = 1.0;
      }

      const score =
        this.weights.w_distance * distScore +
        this.weights.w_salience * salienceScore +
        this.weights.w_taskPrior * taskPrior +
        this.weights.w_gaze * gazeScore;

      const confidence = Math.min(
        1,
        Math.max(0, distScore * 0.5 + salienceScore * 0.5)
      );

      scored.push({
        kind,
        entry,
        structureId,
        score,
        confidence,
      });
    }

    scored.sort((a, b) => b.score - a.score);

    // Semantic Coercion:
    // If a structure target is within assistance radius of the nearest raw-observation hit,
    // and its score is competitive, prefer the meaningful structure.
    const bestHit = scored[0];
    const bestStructure = scored.find(
      (s) =>
        s.kind === 'mapper-node' ||
        s.kind === 'cluster-region' ||
        s.kind === 'persistence-structure'
    );

    let winner = bestHit;
    if (bestStructure && bestStructure !== bestHit) {
      const hitDist = rawHits[0]?.distance ?? 0;
      const structHit = rawHits.find((h) => h.entry === bestStructure.entry);
      const structDist = structHit?.distance ?? Infinity;

      if (Math.abs(structDist - hitDist) <= this.assistanceRadius) {
        if (bestStructure.score >= bestHit.score - 0.2) {
          winner = bestStructure;
        }
      }
    }

    // Hysteresis & Target Hold:
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

    if (isDwellExpired || beatsHeldSignificantly) {
      this._heldTarget.consecutiveOverrideFrames++;
      if (this._heldTarget.consecutiveOverrideFrames >= 3 || isDwellExpired) {
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
