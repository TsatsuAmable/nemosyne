/**
 * Perception Subsystem — Barrel Export
 */

export { MultimodalPerceptionEngine } from './MultimodalPerceptionEnvelope.ts';
export type {
  PerceptionSource,
  GazeCandidate,
  GestureCandidate,
  VoiceIntentCandidate,
  MultimodalPerceptionSnapshot,
} from './MultimodalPerceptionEnvelope.ts';
export {
  GeometricGestureRecognizer,
  type Point3D,
  type GestureTemplate,
  type GestureMatchResult,
} from './GeometricGestureRecognizer.ts';
export {
  GESTURE_MAP,
  gesturesForAction,
  getGestureMeta,
  type GestureMeta,
} from '../../utils/GestureMapping.ts';
