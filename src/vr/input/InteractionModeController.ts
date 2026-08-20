/**
 * Interaction State Machine & Focus Vocabulary (Sprint 24.1 / P0.4).
 *
 * Implements:
 * - Authoritative InteractionMode state machine (NAVIGATE | INTERACT | TRANSFORM | OBSERVE).
 * - Explicit transition adjacency table — not every transition is legal.
 * - Context-sensitive guards (e.g. TRANSFORM requires a selection).
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

/**
 * Context passed to transition guards. Callers who do not supply context get
 * backward-compatible permissive behaviour; callers who explicitly supply
 * `hasSelection: false` trigger the guard.
 */
export interface TransitionContext {
  hasSelection?: boolean;
}

/**
 * Explicit transition adjacency table. Each entry lists the modes the source
 * mode may legally transition to. This is the authoritative transition graph —
 * a transition not listed here is rejected by {@link validateTransition}.
 */
const TRANSITION_TABLE: Record<InteractionMode, InteractionMode[]> = {
  NAVIGATE: ['INTERACT', 'TRANSFORM', 'OBSERVE'],
  INTERACT: ['NAVIGATE', 'TRANSFORM', 'OBSERVE'],
  TRANSFORM: ['NAVIGATE', 'INTERACT', 'OBSERVE'],
  OBSERVE: ['NAVIGATE', 'INTERACT'],
};

/**
 * Context-sensitive guards. Each guard receives the transition context and
 * returns `true` when the transition is permitted. A guard key of
 * `"→TARGET"` applies to all transitions into TARGET.
 */
type GuardFn = (ctx: TransitionContext) => boolean;
const TRANSITION_GUARDS: Record<string, GuardFn> = {
  // TRANSFORM requires a selection. When context is omitted (undefined) the
  // guard is permissive for backward compatibility; it only fires when a
  // caller explicitly signals `hasSelection: false`.
  '→TRANSFORM': (ctx) => ctx.hasSelection !== false,
};

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
   * Validate whether a mode transition is legally permitted. Checks both the
   * transition adjacency table and any context-sensitive guards.
   */
  validateTransition(targetMode: InteractionMode, context?: TransitionContext): boolean {
    const validModes: InteractionMode[] = ['NAVIGATE', 'INTERACT', 'TRANSFORM', 'OBSERVE'];
    if (!validModes.includes(targetMode)) return false;

    // Adjacency check: the source mode must list the target as a legal transition.
    const allowed = TRANSITION_TABLE[this._currentMode] ?? [];
    if (!allowed.includes(targetMode)) return false;

    // Guard check: context-sensitive guards may veto a legal adjacency.
    const guard = TRANSITION_GUARDS[`→${targetMode}`];
    if (guard && context) {
      if (!guard(context)) return false;
    }

    return true;
  }

  setMode(targetMode: InteractionMode, reason = 'user_action', context?: TransitionContext): boolean {
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

  /**
   * Resolve the both-pinch gesture action for the current mode. Every mode
   * has an explicit, non-suppressing action — there is no `default` fallthrough.
   */
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
        return {
          action: 'commitSelection',
          description: 'Confirming pending filter, clustering or view operation',
        };
    }
  }
}