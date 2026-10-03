/**
 * Perception Subsystem — Barrel Export
 *
 * Re-pointed at PerceptualFitnessSampler-only content by the CMS-6 ARCHIVE
 * package (docs/review-plans/CMS6_MULTIMODAL_PERCEPTION_AUDIT_2026-10-02.md §8):
 * `MultimodalPerceptionEngine` and `GeometricGestureRecognizer` were deleted as
 * production-unreachable heuristic prototypes. `PerceptualFitnessSampler` stays:
 * it is production-reachable (src/app/*EvidenceDiagnostics.ts) and governed
 * (Moneta F-7, tests/tec3-ma2-f5-f7-controls.test.ts).
 */

export { PerceptualFitnessSampler } from './PerceptualFitnessSampler.ts';
export type {
  PerceptualSamplerPose,
  PerceptualSamplingTarget,
} from './PerceptualFitnessSampler.ts';