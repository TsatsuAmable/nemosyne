/**
 * Applies comfort-related settings (snap turn, vignette, seated height, panel
 * distance) to the engine/locomotion and the analyst anchor.
 */

import type { Group } from 'three';
import type { Engine } from '../Engine.ts';
import type { ComfortSettings } from './types.ts';
import type { WorldSceneComposer } from './WorldSceneComposer.ts';

export class ComfortSettingsController {
  engine: Engine;
  analystAnchor: Group;
  composer?: WorldSceneComposer;

  constructor(engine: Engine, analystAnchor: Group, composer?: WorldSceneComposer) {
    this.engine = engine;
    this.analystAnchor = analystAnchor;
    this.composer = composer;
  }

  /**
   * Apply comfort settings from the settings panel.
   */
  apply(settings: ComfortSettings = {}): void {
    const locomotion = this.engine.locomotion;
    locomotion.setSnapTurnEnabled?.(settings.snapTurn ?? true);
    locomotion.setSnapAngle?.(((settings.snapTurnAngle ?? 30) * Math.PI) / 180);
    locomotion.setReducedMotion?.(settings.reducedMotion ?? false);
    locomotion.setSeatedHeightOffset?.(settings.seatedHeightOffset ?? 0);
    this.engine.setVignetteEnabled?.(settings.vignette ?? false, settings.vignetteIntensity ?? 0.4);
  }

  /**
   * Apply the default panel distance by moving the analyst anchor forward/back.
   * Panels remain at their local positions relative to the anchor. Routed through
   * the scene composer's `setPanelDistance` so the offset survives the composer's
   * per-frame torso tracking (which previously overwrote a one-shot `position.z`
   * write, silently making the Panel Distance setting a no-op). Falls back to the
   * legacy one-shot write when no composer is wired (e.g. direct unit tests).
   */
  applyPanelDistance(distance = 1.2): void {
    if (this.composer) {
      this.composer.setPanelDistance(distance);
    } else if (this.analystAnchor) {
      this.analystAnchor.position.z = -distance;
    }
  }
}
