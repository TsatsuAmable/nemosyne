/**
 * State-pattern controller for the `novice | intermediate | expert` user mode.
 * Applies the appropriate visibility and coaching policy without `World.js`
 * branching on mode strings directly.
 */

import type { WorldEventBus } from '../../utils/EventBus.js';
import type { UserMode, UserModeControllerOptions } from './types.ts';

export class UserModeController {
  eventBus: WorldEventBus | null;
  getUserMode: () => UserMode | string;
  getTourState: () => { isActive: boolean; isFinished: boolean };
  startTour: () => void;
  skipTour: () => void;
  setCoachMode: (mode: UserMode | string) => void;
  setTourMode: (mode: UserMode | string) => void;
  setTooltipEnabled: (enabled: boolean) => void;
  hideCoachPanel: () => void;
  private _tourAutoStarted: boolean;

  constructor(eventBus: WorldEventBus | null, options: UserModeControllerOptions) {
    this.eventBus = eventBus ?? null;
    this.getUserMode = options.getUserMode;
    this.getTourState = options.getTourState;
    this.startTour = options.startTour;
    this.skipTour = options.skipTour;
    this.setCoachMode = options.setCoachMode;
    this.setTourMode = options.setTourMode;
    this.setTooltipEnabled = options.setTooltipEnabled;
    this.hideCoachPanel = options.hideCoachPanel;
    this._tourAutoStarted = false;
  }

  get mode(): UserMode | string {
    return this.getUserMode();
  }

  /**
   * Apply the current user mode to the interaction coach, guided tour, and
   * tooltip manager.
   */
  apply(): void {
    const mode = this.getUserMode();
    this.setCoachMode?.(mode);
    this.setTourMode?.(mode);
    this.setTooltipEnabled?.(mode !== 'expert');

    if (mode === 'novice') {
      const tour = this.getTourState();
      if (tour && !tour.isActive && !tour.isFinished && !this._tourAutoStarted) {
        this.startTour?.();
        this._tourAutoStarted = true;
      }
    } else if (mode === 'expert') {
      this.hideCoachPanel?.();
      const tour = this.getTourState();
      if (tour && !tour.isFinished) {
        this.skipTour?.();
      }
    }

    if (this.eventBus) {
      this.eventBus.emit('userMode:applied', { mode });
    }
  }

  /**
   * Explicitly set the current mode. This is useful for tests or external
   * mode-switch commands.
   */
  setMode(_mode: UserMode | string): void {
    // The actual source of truth is the settings panel; this method is a
    // convenience that re-applies effects after a mode change.
    this.apply();
  }
}
