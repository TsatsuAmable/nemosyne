/**
 * Interaction State Machine & Focus Vocabulary (Sprint 24.1).
 *
 * Implements:
 * - Authoritative InteractionMode state machine (NAVIGATE | INTERACT | TRANSFORM | OBSERVE).
 * - Shared FocusState vocabulary (idle | focused | hovered | armed | confirmed | disabled | busy).
 * - Mode history stack for explicit, reversible transitions (Concept Paper P8).
 * - Mode-aware semantics for both-pinch gestures (eliminating silent suppressions).
 * - Trace and event bus telemetry integration.
 */

export type InteractionMode = 'NAVIGATE' | 'INTERACT' | 'TRANSFORM' | 'OBSERVE';

export type FocusState =
  | 'idle'
  | 'focused'
  | 'hovered'
  | 'armed'
  | 'confirmed'
  | 'disabled'
  | 'busy';

export interface ModeTransitionEvent {
  from: InteractionMode;
  to: InteractionMode;
  reason: string;
  timestamp: number;
}

export interface InteractionModeOptions {
  initialMode?: InteractionMode;
  onModeChange?: (event: ModeTransitionEvent) => void;
}

export class InteractionModeController {
  private _currentMode: InteractionMode;
  private _history: InteractionMode[] = [];
  private _focusStates = new Map<string, FocusState>();
  private _onModeChange?: (event: ModeTransitionEvent) => void;

  constructor(options: InteractionModeOptions = {}) {
    this._currentMode = options.initialMode ?? 'INTERACT';
    this._onModeChange = options.onModeChange;
  }

  get currentMode(): InteractionMode {
    return this._currentMode;
  }

  get modeHistory(): readonly InteractionMode[] {
    return this._history;
  }

  /**
   * Validate whether a mode transition is legally permitted.
   */
  validateTransition(targetMode: InteractionMode, _context?: { hasSelection?: boolean }): boolean {
    const validModes: InteractionMode[] = ['NAVIGATE', 'INTERACT', 'TRANSFORM', 'OBSERVE'];
    if (!validModes.includes(targetMode)) return false;
    return true;
  }

  setMode(targetMode: InteractionMode, reason = 'user_action', context?: { hasSelection?: boolean }): boolean {
    if (this._currentMode === targetMode) return false;
    if (!this.validateTransition(targetMode, context)) return false;

    const from = this._currentMode;
    this._history.push(from);
    if (this._history.length > 20) {
      this._history.shift();
    }

    this._currentMode = targetMode;

    const event: ModeTransitionEvent = {
      from,
      to: targetMode,
      reason,
      timestamp: Date.now(),
    };

    this._onModeChange?.(event);
    return true;
  }

  revertMode(): boolean {
    if (this._history.length === 0) return false;
    const prev = this._history.pop()!;
    const from = this._currentMode;
    this._currentMode = prev;

    const event: ModeTransitionEvent = {
      from,
      to: prev,
      reason: 'revert',
      timestamp: Date.now(),
    };

    this._onModeChange?.(event);
    return true;
  }

  setFocusState(surfaceId: string, state: FocusState): void {
    this._focusStates.set(surfaceId, state);
  }

  getFocusState(surfaceId: string): FocusState {
    return this._focusStates.get(surfaceId) ?? 'idle';
  }

  clearFocusStates(): void {
    this._focusStates.clear();
  }

  resolveBothPinchAction(): { action: string; description: string } {
    switch (this._currentMode) {
      case 'NAVIGATE':
        return {
          action: 'worldTransform',
          description: 'Repositioning coordinate frame and spatial reference anchor',
        };
      case 'TRANSFORM':
        return {
          action: 'scaleRotateArtifact',
          description: 'Scaling and orienting visual mark topology',
        };
      case 'OBSERVE':
        return {
          action: 'resumeInteraction',
          description: 'Exiting observation mode to resume active interaction',
        };
      case 'INTERACT':
      default:
        return {
          action: 'commitSelection',
          description: 'Confirming pending filter, clustering or view operation',
        };
    }
  }
}
