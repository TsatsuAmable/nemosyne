/**
 * UX Frustration Signal & Hypothesis Triage Engine.
 *
 * Implements scientific rigor for telemetry interpretation:
 * Interaction Signal -> Possible UX Hypothesis -> Human Validation Triage.
 *
 * NEVER treats telemetry events as a definitive "frustration score".
 * (e.g. long dwell may indicate careful inspection / interest rather than confusion;
 * high gesture counts may indicate exploratory enthusiasm rather than disorientation).
 */

export type InteractionSignalType =
  | 'LONG_DWELL_HESITATION'
  | 'HIGH_FREQUENCY_GESTURES'
  | 'RAPID_CANCEL_RETRIES'
  | 'POINTER_OVERSHOOT_CORRECTION'
  | 'FREQUENT_VIEWPORT_RESET';

export interface UXHypothesis {
  hypothesisId: string;
  signalType: InteractionSignalType;
  primaryHypothesis: string;
  alternativeHypothesis: string;
  confidenceScore: number;
  recommendedObservationalCheck: string;
  timestamp: number;
}

export class UXHypothesisTriageEngine {
  private _hypotheses: UXHypothesis[] = [];

  triageSignal(signal: InteractionSignalType, metadata?: Record<string, unknown>): UXHypothesis {
    let primary = '';
    let alternative = '';
    let check = '';

    switch (signal) {
      case 'LONG_DWELL_HESITATION':
        primary = 'Analyst is confused by visual metaphor or tool options.';
        alternative = 'Analyst is deeply inspecting data details or reading complex text.';
        check = 'Ask participant during retrospective interview what they were examining.';
        break;
      case 'HIGH_FREQUENCY_GESTURES':
        primary = 'Analyst is struggling with gesture recognition thresholds or target acquisition.';
        alternative = 'Analyst is highly engaged and rapidly testing data hypotheses.';
        check = 'Review video recording to verify if gestures succeeded or missed.';
        break;
      case 'RAPID_CANCEL_RETRIES':
        primary = 'Action affordance is ambiguous and triggering unintended activations.';
        alternative = 'Analyst is exploring interactive limits of preview tools.';
        check = 'Inspect action target history to see if same action was repeatedly aborted.';
        break;
      case 'POINTER_OVERSHOOT_CORRECTION':
        primary = 'Laser pointer raycasting filter has excessive lag or inadequate damping.';
        alternative = 'Target UI button is too small for comfortable hand distance.';
        check = 'Compare pointer trajectory smoothness with button bounding box size.';
        break;
      case 'FREQUENT_VIEWPORT_RESET':
        primary = 'Analyst got disoriented in 3D spatial coordinate space.';
        alternative = 'Analyst finished analyzing a sub-cluster and intentionally returned to overview.';
        check = 'Check if reset occurred after a complete finding record was saved.';
        break;
    }

    const hypothesis: UXHypothesis = {
      hypothesisId: `HYP_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      signalType: signal,
      primaryHypothesis: primary,
      alternativeHypothesis: alternative,
      confidenceScore: typeof metadata?.confidence === 'number' ? metadata.confidence : 0.5,
      recommendedObservationalCheck: check,
      timestamp: Date.now(),
    };

    this._hypotheses.push(hypothesis);
    return hypothesis;
  }

  getAllHypotheses(): UXHypothesis[] {
    return [...this._hypotheses];
  }
}
