/**
 * Status Strip & Calm Spotlight Context Model (Sprint 24.8).
 *
 * Implements:
 * - Constrained semantic color roles: neutral | accent | success | warning | danger | analysis | observation.
 * - Persistent status strip ("what am I doing?"):
 *     - What dataset / topology am I inspecting?
 *     - What interaction mode is active?
 *     - What item / cluster is focused?
 *     - What operation just executed?
 *     - What affordance is available next?
 * - Spotlight visual priority model (PRIMARY VIEW focus vs. muted tertiary tools).
 */

import { InteractionMode } from '../input/InteractionModeController.ts';

export type SemanticColorRole =
  | 'neutral'
  | 'accent'
  | 'success'
  | 'warning'
  | 'danger'
  | 'analysis'
  | 'observation';

export const SEMANTIC_PALETTE: Record<SemanticColorRole, string> = {
  neutral: '#8892b0',
  accent: '#64ffda',
  success: '#20c997',
  warning: '#ffd166',
  danger: '#ef476f',
  analysis: '#70a5fd',
  observation: '#d8b4e2',
};

export interface StatusStripState {
  datasetLabel: string;
  topology: string;
  itemCount: number;
  mode: InteractionMode;
  focusTarget: string | null;
  lastAction: string | null;
  nextAffordance: string | null;
}

export const DEFAULT_STATUS_STRIP_STATE: StatusStripState = {
  datasetLabel: 'NONE',
  topology: 'TABULAR',
  itemCount: 0,
  mode: 'NAVIGATE',
  focusTarget: null,
  lastAction: null,
  nextAffordance: 'Select dataset or open HandWheel',
};

export class StatusStripController {
  private _state: StatusStripState = { ...DEFAULT_STATUS_STRIP_STATE };
  private _spotlightEntityId: string | null = null;

  get state(): StatusStripState {
    return this._state;
  }

  get spotlightEntityId(): string | null {
    return this._spotlightEntityId;
  }

  setDatasetContext(datasetLabel: string, topology: string, itemCount: number): void {
    this._state.datasetLabel = datasetLabel;
    this._state.topology = topology;
    this._state.itemCount = itemCount;
  }

  setInteractionMode(mode: InteractionMode): void {
    this._state.mode = mode;
  }

  setFocusTarget(target: string | null): void {
    this._state.focusTarget = target;
  }

  recordAction(action: string, nextAffordance?: string): void {
    this._state.lastAction = action;
    if (nextAffordance) {
      this._state.nextAffordance = nextAffordance;
    }
  }

  setSpotlight(entityId: string | null): void {
    this._spotlightEntityId = entityId;
  }

  formatStripText(): string {
    const dataPart = `${this._state.topology} / ${this._state.itemCount.toLocaleString()} items`;
    const modePart = `MODE: ${this._state.mode}`;
    const focusPart = this._state.focusTarget ? `FOCUS: ${this._state.focusTarget}` : 'FOCUS: NONE';
    const actionPart = this._state.lastAction ? `ACTION: ${this._state.lastAction}` : null;

    return [dataPart, modePart, focusPart, actionPart].filter(Boolean).join(' · ');
  }
}
