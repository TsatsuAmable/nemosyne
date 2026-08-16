/**
 * Configurable gesture confidence thresholds for Nemosyne WebXR interaction.
 *
 * Defines explicit per-gesture confidence floors, ceilings, and motion parameters,
 * replacing hardcoded magic numbers in gesture classification and feedback loops.
 */

export interface SingleGestureThreshold {
  confidenceFloor: number;
  confidenceCeiling: number;
  minDisplacement: number;
  maxVelocity: number;
  cooldownMs: number;
}

export type GestureThresholdMap = Record<string, SingleGestureThreshold>;

export const DEFAULT_GESTURE_THRESHOLDS: GestureThresholdMap = {
  pinchTogether: {
    confidenceFloor: 0.70,
    confidenceCeiling: 0.98,
    minDisplacement: 0.08,
    maxVelocity: 2.5,
    cooldownMs: 650,
  },
  pinchApart: {
    confidenceFloor: 0.70,
    confidenceCeiling: 0.98,
    minDisplacement: 0.08,
    maxVelocity: 2.5,
    cooldownMs: 650,
  },
  swipeLeft: {
    confidenceFloor: 0.65,
    confidenceCeiling: 0.95,
    minDisplacement: 0.12,
    maxVelocity: 3.0,
    cooldownMs: 500,
  },
  swipeRight: {
    confidenceFloor: 0.65,
    confidenceCeiling: 0.95,
    minDisplacement: 0.12,
    maxVelocity: 3.0,
    cooldownMs: 500,
  },
  pushForward: {
    confidenceFloor: 0.75,
    confidenceCeiling: 0.99,
    minDisplacement: 0.15,
    maxVelocity: 2.0,
    cooldownMs: 750,
  },
  fistClose: {
    confidenceFloor: 0.80,
    confidenceCeiling: 0.99,
    minDisplacement: 0.05,
    maxVelocity: 1.5,
    cooldownMs: 600,
  },
  pointIndex: {
    confidenceFloor: 0.60,
    confidenceCeiling: 0.92,
    minDisplacement: 0.03,
    maxVelocity: 1.2,
    cooldownMs: 400,
  },
  scoopUp: {
    confidenceFloor: 0.70,
    confidenceCeiling: 0.96,
    minDisplacement: 0.10,
    maxVelocity: 2.2,
    cooldownMs: 700,
  },
};

export class GestureConfidenceThresholds {
  private _thresholds: GestureThresholdMap;

  constructor(customThresholds: Partial<GestureThresholdMap> = {}) {
    this._thresholds = { ...DEFAULT_GESTURE_THRESHOLDS };
    for (const [key, val] of Object.entries(customThresholds)) {
      if (val) {
        this._thresholds[key] = { ...this._thresholds[key], ...val };
      }
    }
  }

  getThreshold(gestureName: string): SingleGestureThreshold {
    return (
      this._thresholds[gestureName] ?? {
        confidenceFloor: 0.65,
        confidenceCeiling: 0.95,
        minDisplacement: 0.10,
        maxVelocity: 2.0,
        cooldownMs: 500,
      }
    );
  }

  setThreshold(gestureName: string, config: Partial<SingleGestureThreshold>): void {
    const existing = this.getThreshold(gestureName);
    this._thresholds[gestureName] = { ...existing, ...config };
  }

  /**
   * Evaluates gesture confidence given measured displacement, velocity, and raw score.
   */
  evaluateConfidence(
    gestureName: string,
    measuredDisplacement: number,
    measuredVelocity: number,
    rawScore = 0.85
  ): { isValid: boolean; confidence: number; reason?: string } {
    const t = this.getThreshold(gestureName);

    if (measuredDisplacement < t.minDisplacement) {
      return {
        isValid: false,
        confidence: 0.0,
        reason: `Displacement (${measuredDisplacement.toFixed(3)}m) below floor (${t.minDisplacement}m)`,
      };
    }

    if (measuredVelocity > t.maxVelocity) {
      return {
        isValid: false,
        confidence: 0.0,
        reason: `Velocity (${measuredVelocity.toFixed(2)}m/s) exceeded ceiling (${t.maxVelocity}m/s)`,
      };
    }

    const scaledConfidence = Math.max(
      t.confidenceFloor,
      Math.min(t.confidenceCeiling, rawScore)
    );

    return {
      isValid: scaledConfidence >= t.confidenceFloor,
      confidence: Number(scaledConfidence.toFixed(3)),
    };
  }
}
