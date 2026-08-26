import * as THREE from 'three';

export type FocusLevel =
  | 'investigation'
  | 'dataset'
  | 'structure'
  | 'region'
  | 'observation';

const HIERARCHY_ORDER: FocusLevel[] = [
  'investigation',
  'dataset',
  'structure',
  'region',
  'observation',
];

export interface FocusContextState {
  currentLevel: FocusLevel;
  focusedStructureId: string | null;
  anchorMatrix: THREE.Matrix4 | null;
}

function isFocusLevel(value: unknown): value is FocusLevel {
  return typeof value === 'string' && HIERARCHY_ORDER.includes(value as FocusLevel);
}

function levelRequiresStructure(level: FocusLevel): boolean {
  return level === 'structure' || level === 'region' || level === 'observation';
}

export class FocusContextController {
  private _currentLevel: FocusLevel = 'dataset';
  private _focusedStructureId: string | null = null;
  private _anchorMatrix: THREE.Matrix4 | null = null;

  get currentLevel(): FocusLevel {
    return this._currentLevel;
  }

  get focusedStructureId(): string | null {
    return this._focusedStructureId;
  }

  get anchorMatrix(): THREE.Matrix4 | null {
    return this._anchorMatrix;
  }

  /**
   * Set focused structure with its persistent anchor transform.
   */
  focusStructure(structureId: string, anchorMatrix?: THREE.Matrix4): void {
    if (!structureId.trim()) {
      throw new TypeError('FocusContextController requires a non-empty structureId');
    }
    this._focusedStructureId = structureId;
    this._currentLevel = 'structure';
    this._anchorMatrix = anchorMatrix ? anchorMatrix.clone() : null;
  }

  /**
   * Clear focused structure and return to dataset overview.
   */
  clearFocus(): void {
    this._focusedStructureId = null;
    this._anchorMatrix = null;
    this._currentLevel = 'dataset';
  }

  /**
   * Step down the hierarchy toward deeper detail. Deeper semantic levels require
   * an actual focused structure; a bare controller cannot invent one.
   */
  drillDown(): FocusLevel {
    const idx = HIERARCHY_ORDER.indexOf(this._currentLevel);
    if (idx >= HIERARCHY_ORDER.length - 1) return this._currentLevel;

    const next = HIERARCHY_ORDER[idx + 1];
    if (levelRequiresStructure(next) && !this._focusedStructureId) {
      return this._currentLevel;
    }
    this._currentLevel = next;
    return this._currentLevel;
  }

  /**
   * Step up the hierarchy toward broader overview.
   */
  overview(): FocusLevel {
    const idx = HIERARCHY_ORDER.indexOf(this._currentLevel);
    if (idx > 0) {
      this._currentLevel = HIERARCHY_ORDER[idx - 1];
      if (this._currentLevel === 'dataset' || this._currentLevel === 'investigation') {
        this._focusedStructureId = null;
        this._anchorMatrix = null;
      }
    }
    return this._currentLevel;
  }

  /**
   * Update focus level by distance-to-target band.
   * A distance alone cannot create semantic focus; without a focused structure
   * the controller remains at dataset context.
   */
  updateByDistance(distanceMeters: number): FocusLevel {
    if (!Number.isFinite(distanceMeters) || distanceMeters < 0) {
      throw new TypeError('FocusContextController distance must be finite and non-negative');
    }
    if (!this._focusedStructureId) {
      this._currentLevel = 'dataset';
      return this._currentLevel;
    }

    if (distanceMeters > 3.5) {
      this._currentLevel = 'dataset';
    } else if (distanceMeters >= 1.2) {
      this._currentLevel = 'structure';
    } else {
      this._currentLevel = 'observation';
    }
    return this._currentLevel;
  }

  /**
   * Export minimal reproducible investigation state.
   * Camera pose / anchor matrix remain presentation state and are intentionally
   * excluded from the portable investigation state.
   */
  exportState(): { currentLevel: FocusLevel; focusedStructureId: string | null } {
    return {
      currentLevel: this._currentLevel,
      focusedStructureId: this._focusedStructureId,
    };
  }

  /**
   * Restore validated semantic focus state. Deeper levels require a durable
   * structure identity; broad levels cannot retain a stale structure identity.
   */
  restoreState(state: { currentLevel: FocusLevel; focusedStructureId: string | null }): void {
    if (!state || !isFocusLevel(state.currentLevel)) {
      throw new TypeError('FocusContextController restore state has invalid currentLevel');
    }
    if (state.focusedStructureId !== null && !state.focusedStructureId.trim()) {
      throw new TypeError('FocusContextController restore state has invalid focusedStructureId');
    }
    if (levelRequiresStructure(state.currentLevel) && !state.focusedStructureId) {
      throw new TypeError(
        `Focus level ${state.currentLevel} requires a focusedStructureId`
      );
    }

    this._currentLevel = state.currentLevel;
    this._focusedStructureId = levelRequiresStructure(state.currentLevel)
      ? state.focusedStructureId
      : null;
    this._anchorMatrix = null;
  }
}
