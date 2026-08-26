import * as THREE from 'three';
import {
  PERCEPTUAL_FITNESS_EVIDENCE_VERSION,
  type PerceptualFitnessEvidence,
  type MeasuredPerceptualEvidence,
  type ViewpointSample,
  validatePerceptualFitnessEvidence,
} from '../../moneta/evidence/PerceptualFitnessEvidence.ts';
import type { RepresentationCandidate } from '../../moneta/representation/RepresentationCandidate.ts';

export interface PerceptualSamplerPose {
  position: THREE.Vector3;
  gazeDirection: THREE.Vector3;
}

export interface PerceptualSamplingTarget {
  candidate: RepresentationCandidate;
  datasetFingerprint: string;
  markPositions: THREE.Vector3[];
  labels?: THREE.Vector3[];
  deviceClass?: 'desktop' | 'quest-3s' | 'other-headset';
}

/**
 * Deterministic viewpoint offsets for spatial fitness sampling.
 * 8 bounded offsets around current anchor: ±0.3m lateral, ±0.15m vertical, ±15 deg yaw.
 */
const ENVELOPE_OFFSETS: Array<{ dx: number; dy: number; dyawDeg: number }> = [
  { dx: -0.3, dy: -0.15, dyawDeg: -15 },
  { dx: -0.3, dy: 0.15, dyawDeg: 15 },
  { dx: 0.3, dy: -0.15, dyawDeg: -15 },
  { dx: 0.3, dy: 0.15, dyawDeg: 15 },
  { dx: -0.3, dy: 0, dyawDeg: 0 },
  { dx: 0.3, dy: 0, dyawDeg: 0 },
  { dx: 0, dy: -0.15, dyawDeg: -15 },
  { dx: 0, dy: 0.15, dyawDeg: 15 },
];

function computePoseHash(pos: [number, number, number], gaze: [number, number, number]): string {
  const pStr = `${pos[0].toFixed(3)},${pos[1].toFixed(3)},${pos[2].toFixed(3)}`;
  const gStr = `${gaze[0].toFixed(3)},${gaze[1].toFixed(3)},${gaze[2].toFixed(3)}`;
  return `pose_${pStr}_${gStr}`;
}

function median(values: number[]): number {
  if (values.length === 0) return 1.5;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function cameraBasis(gaze: THREE.Vector3): { right: THREE.Vector3; up: THREE.Vector3 } {
  const worldUp = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(gaze, worldUp);
  if (right.lengthSq() < 1e-8) {
    right.set(1, 0, 0);
  } else {
    right.normalize();
  }
  const up = new THREE.Vector3().crossVectors(right, gaze).normalize();
  return { right, up };
}

interface ProjectedMark {
  depth: number;
  x: number;
  y: number;
}

function boundedProjectedSample(points: ProjectedMark[], maxCount = 100): ProjectedMark[] {
  const ordered = points.slice().sort((a, b) => a.x - b.x || a.y - b.y || a.depth - b.depth);
  if (ordered.length <= maxCount) return ordered;

  const sampled: ProjectedMark[] = [];
  for (let i = 0; i < maxCount; i++) {
    const index = Math.round((i * (ordered.length - 1)) / (maxCount - 1));
    sampled.push(ordered[index]);
  }
  return sampled;
}

function assertFiniteVector(label: string, value: THREE.Vector3): void {
  if (![value.x, value.y, value.z].every(Number.isFinite)) {
    throw new TypeError(`${label} must contain only finite coordinates`);
  }
}

export class PerceptualFitnessSampler {
  /**
   * Generate a 9-pose viewpoint envelope from an anchor camera pose.
   */
  generateViewpointEnvelope(anchor: PerceptualSamplerPose): ViewpointSample[] {
    assertFiniteVector('Perceptual sampler anchor position', anchor.position);
    assertFiniteVector('Perceptual sampler gaze direction', anchor.gazeDirection);
    if (anchor.gazeDirection.lengthSq() < 1e-8) {
      throw new TypeError('Perceptual sampler gaze direction must be non-zero');
    }

    const anchorGaze = anchor.gazeDirection.clone().normalize();
    const samples: ViewpointSample[] = [];

    // 1. Center pose
    const centerPos: [number, number, number] = [
      anchor.position.x,
      anchor.position.y,
      anchor.position.z,
    ];
    const centerGaze: [number, number, number] = [
      anchorGaze.x,
      anchorGaze.y,
      anchorGaze.z,
    ];
    samples.push({
      position: centerPos,
      gazeDirection: centerGaze,
      poseHash: computePoseHash(centerPos, centerGaze),
    });

    // Right vector orthogonal to gaze in horizontal plane
    const up = new THREE.Vector3(0, 1, 0);
    const { right } = cameraBasis(anchorGaze);

    for (const offset of ENVELOPE_OFFSETS) {
      const pos = anchor.position.clone()
        .addScaledVector(right, offset.dx)
        .addScaledVector(up, offset.dy);

      const rad = (offset.dyawDeg * Math.PI) / 180;
      const gaze = anchorGaze.clone().applyAxisAngle(up, rad).normalize();

      const pArr: [number, number, number] = [pos.x, pos.y, pos.z];
      const gArr: [number, number, number] = [gaze.x, gaze.y, gaze.z];

      samples.push({
        position: pArr,
        gazeDirection: gArr,
        poseHash: computePoseHash(pArr, gArr),
      });
    }

    return samples;
  }

  /**
   * Sample measured perceptual fitness over a target candidate and its marks.
   */
  sample(
    target: PerceptualSamplingTarget,
    anchor: PerceptualSamplerPose
  ): PerceptualFitnessEvidence {
    if (!target.datasetFingerprint) {
      throw new TypeError('PerceptualFitnessSampler requires a dataset fingerprint');
    }

    const marks = target.markPositions;
    if (marks.length === 0) {
      throw new Error(
        'PerceptualFitnessSampler cannot produce measured evidence for an embodiment with zero marks'
      );
    }
    for (const mark of marks) {
      assertFiniteVector('Perceptual sampler mark position', mark);
    }
    for (const label of target.labels ?? []) {
      assertFiniteVector('Perceptual sampler label position', label);
    }

    const envelope = this.generateViewpointEnvelope(anchor);
    if (envelope.length < 2) {
      throw new Error('PerceptualFitnessSampler requires a multi-pose viewpoint envelope');
    }

    const nMarks = marks.length;
    const deviceClass = target.deviceClass ?? 'desktop';

    // Spatial extent computation
    const box = new THREE.Box3();
    for (const p of marks) {
      box.expandByPoint(p);
    }
    const spatialExtentMeters = box.getSize(new THREE.Vector3()).length();

    // Required viewpoint travel to bring the embodiment center into the governed 1.2m range.
    const center = box.getCenter(new THREE.Vector3());
    const distToCenter = anchor.position.distanceTo(center);
    const requiredViewpointTravelMeters = Math.max(0, distToCenter - 1.2);

    let totalOverlap = 0;
    let totalHidden = 0;
    let totalAmbiguity = 0;
    let totalGlyphPx = 0;

    for (const pose of envelope) {
      const camPos = new THREE.Vector3(...pose.position);
      const camGaze = new THREE.Vector3(...pose.gazeDirection).normalize();
      const { right, up } = cameraBasis(camGaze);
      const projected: ProjectedMark[] = [];
      let hiddenInPose = 0;

      for (const p of marks) {
        const toMark = p.clone().sub(camPos);
        const depth = toMark.dot(camGaze);
        if (depth <= 0.1 || depth > 10.0) {
          hiddenInPose++;
          continue;
        }

        projected.push({
          depth,
          x: toMark.dot(right) / depth,
          y: toMark.dot(up) / depth,
        });
      }

      totalHidden += hiddenInPose / nMarks;

      if (projected.length > 1) {
        const sampled = boundedProjectedSample(projected);
        let overlaps = 0;
        let nearTies = 0;

        for (let i = 0; i < sampled.length; i++) {
          for (let j = i + 1; j < sampled.length; j++) {
            const dx = sampled[i].x - sampled[j].x;
            const dy = sampled[i].y - sampled[j].y;
            if (dx * dx + dy * dy < 0.002) {
              overlaps++;
            }
            if (Math.abs(sampled[i].depth - sampled[j].depth) < 0.05) {
              nearTies++;
            }
          }
        }
        const pairs = (sampled.length * (sampled.length - 1)) / 2;
        if (pairs > 0) {
          totalOverlap += overlaps / pairs;
          totalAmbiguity += nearTies / pairs;
        }
      }

      // Median glyph size estimate (world mark ~0.02m projected at median depth).
      const medianDepth = median(projected.map((point) => point.depth));
      const glyphPx = Math.max(
        4,
        Math.min(128, (0.02 / Math.max(0.2, medianDepth)) * 1000)
      );
      totalGlyphPx += glyphPx;
    }

    const nPoses = envelope.length;
    const projectedOverlapFraction = Math.min(1, totalOverlap / nPoses);
    const hiddenMarkFraction = Math.min(1, totalHidden / nPoses);
    const depthOrderAmbiguityFraction = Math.min(1, totalAmbiguity / nPoses);
    const medianProjectedGlyphSizePx = totalGlyphPx / nPoses;

    // Label crowding is currently a bounded engineering surrogate. Label positions are
    // validated above, but a real screen-space label-overlap measure remains review work.
    const nLabels = target.labels ? target.labels.length : 0;
    const labelCrowdingIndex = Math.min(1, nLabels / Math.max(1, spatialExtentMeters * 10));

    const measured: MeasuredPerceptualEvidence = {
      projectedOverlapFraction,
      hiddenMarkFraction,
      medianProjectedGlyphSizePx,
      labelCrowdingIndex,
      depthOrderAmbiguityFraction,
      spatialExtentMeters,
      requiredViewpointTravelMeters,
      viewpointEnvelope: envelope,
      deviceClass,
    };

    const evidence: PerceptualFitnessEvidence = {
      version: PERCEPTUAL_FITNESS_EVIDENCE_VERSION,
      candidateId: target.candidate.id,
      datasetFingerprint: target.datasetFingerprint,
      source: 'measured',
      measured,
      priors: {
        occlusionResistance: target.candidate.interactionCharacteristics.occlusionResistance,
        cognitiveLoad: target.candidate.interactionCharacteristics.cognitiveLoad,
      },
    };

    return validatePerceptualFitnessEvidence(evidence);
  }
}
