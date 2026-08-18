/**
 * Multimodal Perception Envelope & Engine (Definitive Vision §11 — Perception and ML).
 *
 * Implements:
 * - Multimodal input interpretation (Gaze + Gesture + Voice Intent).
 * - Explicit metadata: modelVersion, featureSchema, confidence, source, personalizationState, fallbackReason.
 * - Strict architectural boundary: Perception interprets human input; it does NOT mutate analytical truth.
 * - Study treatment control: freezeable perception profiles for experimental trials.
 */

export type PerceptionSource =
  | 'GAZE'
  | 'HAND_GESTURE'
  | 'VOICE_INTENT'
  | 'CONTROLLER'
  | 'HYBRID_MULTIMODAL';

export interface GazeCandidate {
  targetEntityId: string | null;
  direction: [number, number, number];
  dwellDurationMs: number;
  confidence: number;
}

export interface GestureCandidate {
  gesture: string;
  handedness: 'left' | 'right' | 'both';
  confidence: number;
  velocity: number;
}

export interface VoiceIntentCandidate {
  intent: string;
  transcript: string;
  parameters: Record<string, unknown>;
  confidence: number;
}

export interface MultimodalPerceptionSnapshot {
  timestamp: number;
  source: PerceptionSource;
  modelVersion: string;
  featureSchema: string;
  confidence: number;
  personalizationState: 'default' | 'calibrated' | 'adapted';
  fallbackReason?: string;
  gaze?: GazeCandidate;
  gesture?: GestureCandidate;
  voiceIntent?: VoiceIntentCandidate;
  resolvedAction?: string;
  isFrozen: boolean;
}

export interface MultimodalPerceptionEngineOptions {
  modelVersion?: string;
  featureSchema?: string;
  personalizationState?: 'default' | 'calibrated' | 'adapted';
}

export class MultimodalPerceptionEngine {
  private _modelVersion: string;
  private _featureSchema: string;
  private _personalizationState: 'default' | 'calibrated' | 'adapted';
  private _isFrozen = false;

  private _latestGaze: GazeCandidate | null = null;
  private _latestGesture: GestureCandidate | null = null;
  private _latestVoice: VoiceIntentCandidate | null = null;

  constructor(options: MultimodalPerceptionEngineOptions = {}) {
    this._modelVersion = options.modelVersion ?? 'v2.5.0-multimodal';
    this._featureSchema = options.featureSchema ?? 'gaze+gesture+voice_intent_v1';
    this._personalizationState = options.personalizationState ?? 'default';
  }

  get modelVersion(): string {
    return this._modelVersion;
  }

  get isFrozen(): boolean {
    return this._isFrozen;
  }

  get personalizationState(): 'default' | 'calibrated' | 'adapted' {
    return this._personalizationState;
  }

  freeze(): void {
    this._isFrozen = true;
  }

  unfreeze(): void {
    this._isFrozen = false;
  }

  setPersonalizationState(state: 'default' | 'calibrated' | 'adapted'): void {
    if (this._isFrozen) {
      throw new Error('Cannot modify personalization state while perception engine is frozen for study trial');
    }
    this._personalizationState = state;
  }

  updateGaze(candidate: GazeCandidate): void {
    this._latestGaze = candidate;
  }

  updateGesture(candidate: GestureCandidate): void {
    this._latestGesture = candidate;
  }

  updateVoiceIntent(candidate: VoiceIntentCandidate): void {
    this._latestVoice = candidate;
  }

  evaluateSnapshot(): MultimodalPerceptionSnapshot {
    const timestamp = Date.now();
    const hasGaze = this._latestGaze != null && this._latestGaze.confidence > 0.4;
    const hasGesture = this._latestGesture != null && this._latestGesture.confidence > 0.5;
    const hasVoice = this._latestVoice != null && this._latestVoice.confidence > 0.6;

    let source: PerceptionSource = 'CONTROLLER';
    let overallConfidence = 0.5;
    let resolvedAction: string | undefined;

    if (hasVoice && hasGaze) {
      source = 'HYBRID_MULTIMODAL';
      overallConfidence = Math.min(1.0, (this._latestVoice!.confidence + this._latestGaze!.confidence) / 2 + 0.1);
      resolvedAction = `${this._latestVoice!.intent}:${this._latestGaze!.targetEntityId ?? 'active_view'}`;
    } else if (hasGesture && hasGaze) {
      source = 'HYBRID_MULTIMODAL';
      overallConfidence = Math.min(1.0, (this._latestGesture!.confidence + this._latestGaze!.confidence) / 2 + 0.1);
      resolvedAction = `${this._latestGesture!.gesture}:${this._latestGaze!.targetEntityId ?? 'world'}`;
    } else if (hasVoice) {
      source = 'VOICE_INTENT';
      overallConfidence = this._latestVoice!.confidence;
      resolvedAction = this._latestVoice!.intent;
    } else if (hasGesture) {
      source = 'HAND_GESTURE';
      overallConfidence = this._latestGesture!.confidence;
      resolvedAction = this._latestGesture!.gesture;
    } else if (hasGaze) {
      source = 'GAZE';
      overallConfidence = this._latestGaze!.confidence;
      resolvedAction = `focus:${this._latestGaze!.targetEntityId ?? 'none'}`;
    }

    return {
      timestamp,
      source,
      modelVersion: this._modelVersion,
      featureSchema: this._featureSchema,
      confidence: Math.round(overallConfidence * 100) / 100,
      personalizationState: this._personalizationState,
      fallbackReason: overallConfidence < 0.5 ? 'low_signal_confidence' : undefined,
      gaze: this._latestGaze ? { ...this._latestGaze } : undefined,
      gesture: this._latestGesture ? { ...this._latestGesture } : undefined,
      voiceIntent: this._latestVoice ? { ...this._latestVoice } : undefined,
      resolvedAction,
      isFrozen: this._isFrozen,
    };
  }

  reset(): void {
    this._latestGaze = null;
    this._latestGesture = null;
    this._latestVoice = null;
  }
}
