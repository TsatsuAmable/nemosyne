/**
 * State-pattern controller for the `novice | intermediate | expert` user mode.
 * Applies the appropriate visibility and coaching policy without `World.js`
 * branching on mode strings directly.
 */

export class UserModeController {
  /**
   * @param {import('../../utils/EventBus.js').WorldEventBus} [eventBus]
   * @param {object} options
   * @param {() => string} options.getUserMode
   * @param {() => { isActive: boolean, isFinished: boolean }} options.getTourState
   * @param {() => void} options.startTour
   * @param {() => void} options.skipTour
   * @param {(mode: string) => void} options.setCoachMode
   * @param {(mode: string) => void} options.setTourMode
   * @param {(enabled: boolean) => void} options.setTooltipEnabled
   * @param {() => void} options.hideCoachPanel
   */
  constructor(eventBus, options) {
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

  /** @returns {string} */
  get mode() {
    return this.getUserMode();
  }

  /**
   * Apply the current user mode to the interaction coach, guided tour, and
   * tooltip manager.
   */
  apply() {
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
   * @param {string} mode
   */
  setMode(mode) {
    // The actual source of truth is the settings panel; this method is a
    // convenience that re-applies effects after a mode change.
    this.apply();
  }
}
