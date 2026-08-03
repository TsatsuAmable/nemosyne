/**
 * Applies comfort-related settings (snap turn, vignette, seated height, panel
 * distance) to the engine/locomotion and the analyst anchor.
 */

export class ComfortSettingsController {
  /**
   * @param {import('../Engine.js').Engine} engine
   * @param {import('three').Group} analystAnchor
   */
  constructor(engine, analystAnchor) {
    this.engine = engine;
    this.analystAnchor = analystAnchor;
  }

  /**
   * Apply comfort settings from the settings panel.
   * @param {object} settings
   * @param {boolean} [settings.snapTurn]
   * @param {number} [settings.snapTurnAngle]
   * @param {boolean} [settings.reducedMotion]
   * @param {number} [settings.seatedHeightOffset]
   * @param {boolean} [settings.vignette]
   * @param {number} [settings.vignetteIntensity]
   */
  apply(settings = {}) {
    const locomotion = this.engine.locomotion;
    locomotion.setSnapTurnEnabled?.(settings.snapTurn ?? true);
    locomotion.setSnapAngle?.(((settings.snapTurnAngle ?? 30) * Math.PI) / 180);
    locomotion.setReducedMotion?.(settings.reducedMotion ?? false);
    locomotion.setSeatedHeightOffset?.(settings.seatedHeightOffset ?? 0);
    this.engine.setVignetteEnabled?.(settings.vignette ?? false, settings.vignetteIntensity ?? 0.4);
  }

  /**
   * Apply the default panel distance by moving the analyst anchor forward/back.
   * Panels remain at their local positions relative to the anchor.
   * @param {number} distance
   */
  applyPanelDistance(distance = 1.2) {
    if (this.analystAnchor) {
      this.analystAnchor.position.z = -distance;
    }
  }
}
