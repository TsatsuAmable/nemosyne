/**
 * Frozen shared contracts for @nemosyne/gesture-intelligence.
 *
 * This file is the single source of truth for cross-component interfaces.
 * Implementations live in sibling modules (trajectory.ts, features.ts,
 * heuristic.ts, calibration.ts, engine.ts, store.ts, onnx/, personalizer.ts)
 * and must conform to these types without editing this file.
 *
 * Design rules enforced module-wide:
 * - No host-framework types (no three.js). Geometry is plain Vec3.
 * - Every classification carries an honest Provenance: `source` reports the
 *   path that actually produced the numbers, `confidence` is always derived
 *   from measured quantities, never a hardcoded constant.
 * - ONNX is optional and injected (OrtFactoryLike / NeuralClassifierPort);
 *   absence degrades to the heuristic with an explicit degradedReason.
 */

export type Vec3 = { readonly x: number; readonly y: number; readonly z: number };

export type HandId = string;

export const GESTURE_CLASSES = [
  'idle',
  'pinchTogether',
  'pinchApart',
  'scoopUp',
  'pushForward',
  'bothPinched',
] as const;

export type GestureClass = (typeof GESTURE_CLASSES)[number];

export const FEATURE_DIM = 56;
export const FEATURE_WINDOW_FRAMES = 16;
export const TRAJECTORY_CAPACITY = 60;

export interface HandSample {
  hand: HandId;
  position: Vec3;
  pinched: boolean;
  timestamp: number;
}

export interface HandFrame {
  position: Vec3;
  pinched: boolean;
  timestamp: number;
  speed: Vec3;
}

export type ProvenanceSource = 'onnx' | 'heuristic';

export type DegradedReason =
  | 'no-runtime'
  | 'no-model'
  | 'init-failed'
  | 'session-error'
  | 'insufficient-data'
  | 'stale-neural';

export interface Provenance {
  source: ProvenanceSource;
  modelVersion: string | null;
  latencyMs: number;
  sampleCount: number;
  windowMs: number;
  degradedReason: DegradedReason | null;
}

export type ScoreTable = Readonly<Record<GestureClass, number>>;

export interface ClassificationResult {
  gesture: GestureClass;
  confidence: number;
  scores: ScoreTable | null;
  provenance: Provenance;
}

export interface CalibrationState {
  moveThreshold: number;
  pinchThreshold: number;
  releaseThreshold: number;
  meanSpeedEma: number;
  updatedAt: number;
}

export interface FeedbackSample {
  gesture: GestureClass;
  confirmed: boolean;
  timestamp: number;
  features: Float32Array;
}

export interface FeedbackStats {
  confirms: number;
  corrections: number;
  lastUpdatedAt: number;
}

export interface StoredProfile {
  schemaVersion: 2;
  profileId: string;
  updatedAt: number;
  calibration: CalibrationState;
  feedbackStats: FeedbackStats;
}

export interface GesturePersistence {
  readonly backend: 'indexeddb' | 'memory';
  loadProfile(profileId: string): Promise<StoredProfile | null>;
  saveProfile(profileId: string, profile: StoredProfile): Promise<boolean>;
  deleteProfile(profileId: string): Promise<boolean>;
  close(): void;
}

export interface OrtTensorLike {
  data: Float32Array;
  dims: readonly number[];
}

export interface OrtSessionLike {
  run(inputs: Record<string, OrtTensorLike>): Promise<Record<string, OrtTensorLike>>;
  release(): void;
}

export interface OrtFactoryLike {
  createSession(source: string | Uint8Array): Promise<OrtSessionLike>;
}

export interface ModelCard {
  name: string;
  version: string;
  inputName: string;
  outputName: string;
  featureDim: number;
  classes: readonly GestureClass[];
  featureSpec: string;
  metrics: {
    heldOutAccuracy: number;
    macroF1: number;
    samples: number;
    confusion: number[][];
  };
  sha256: string;
}

export interface NeuralScore {
  scores: ScoreTable;
  latencyMs: number;
  modelVersion: string;
}

export interface NeuralClassifierPort {
  readonly ready: boolean;
  readonly modelVersion: string | null;
  init(): Promise<boolean>;
  score(features: Float32Array): Promise<NeuralScore>;
  dispose(): void;
}

export interface PersonalizationResult {
  calibration: CalibrationState;
  replayF1Before: number;
  replayF1After: number;
  samplesUsed: number;
}

export interface PersonalizerPort {
  ingest(sample: FeedbackSample): void;
  stats(): FeedbackStats;
  optimize(): PersonalizationResult | null;
  reset(): void;
}

export interface EngineOptions {
  modelUrl?: string;
  modelCard?: ModelCard;
  ortFactory?: OrtFactoryLike;
  neural?: NeuralClassifierPort;
  personalizer?: PersonalizerPort;
  persistence?: GesturePersistence;
  profileId?: string;
  historyLimit?: number;
  clock?: () => number;
}

export type EngineInitState = 'idle' | 'loading' | 'ready' | 'failed';

export interface EngineStatus {
  init: EngineInitState;
  runtime: ProvenanceSource;
  modelVersion: string | null;
  persistenceBackend: 'indexeddb' | 'memory' | 'disabled';
  supportedGestures: readonly GestureClass[];
}

export interface GestureEngine {
  init(): Promise<EngineStatus>;
  recordSample(sample: HandSample): void;
  classify(): ClassificationResult;
  classifyWithNeural(): Promise<ClassificationResult>;
  getCalibration(): CalibrationState;
  reportFeedback(gesture: GestureClass, confirmed: boolean): void;
  status(): EngineStatus;
  dispose(): void;
}
