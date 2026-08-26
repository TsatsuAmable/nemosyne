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
    this._focusedStructureId = structureId;
    this._currentLevel = 'structure';
    if (anchorMatrix) {
      this._anchorMatrix = anchorMatrix.clone();
    }
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
   * Step down the hierarchy toward deeper detail.
   */
  drillDown(): FocusLevel {
    const idx = HIERARCHY_ORDER.indexOf(this._currentLevel);
    if (idx < HIERARCHY_ORDER.length - 1) {
      this._currentLevel = HIERARCHY_ORDER[idx + 1];
    }
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
      }
    }
    return this._currentLevel;
  }

  /**
   * Update focus level by distance-to-target band.
   *   > 3.5m -> dataset
   *   1.2m - 3.5m -> structure
   *   < 1.2m -> observation
   */
  updateByDistance(distanceMeters: number): FocusLevel {
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
   * Persists structureId and level only when a meaningful structure is focused.
   */
  exportState(): { currentLevel: FocusLevel; focusedStructureId: string | null } {
    return {
      currentLevel: this._currentLevel,
      focusedStructureId: this._focusedStructureId,
    };
  }

  /**
   * Restore focus state.
   */
  restoreState(state: { currentLevel: FocusLevel; focusedStructureId: string | null }): void {
    this._currentLevel = state.currentLevel;
    this._focusedStructureId = state.focusedStructureId;
  }
}
