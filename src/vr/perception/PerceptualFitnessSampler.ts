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

export class PerceptualFitnessSampler {
  /**
   * Generate a 9-pose viewpoint envelope from an anchor camera pose.
   */
  generateViewpointEnvelope(anchor: PerceptualSamplerPose): ViewpointSample[] {
    const samples: ViewpointSample[] = [];

    // 1. Center pose
    const centerPos: [number, number, number] = [
      anchor.position.x,
      anchor.position.y,
      anchor.position.z,
    ];
    const centerGaze: [number, number, number] = [
      anchor.gazeDirection.x,
      anchor.gazeDirection.y,
      anchor.gazeDirection.z,
    ];
    samples.push({
      position: centerPos,
      gazeDirection: centerGaze,
      poseHash: computePoseHash(centerPos, centerGaze),
    });

    // Right vector orthogonal to gaze in horizontal plane
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(anchor.gazeDirection, up).normalize();
    if (right.lengthSq() < 1e-4) {
      right.set(1, 0, 0);
    }

    for (const offset of ENVELOPE_OFFSETS) {
      const pos = anchor.position.clone()
        .addScaledVector(right, offset.dx)
        .addScaledVector(up, offset.dy);

      const rad = (offset.dyawDeg * Math.PI) / 180;
      const gaze = anchor.gazeDirection.clone().applyAxisAngle(up, rad).normalize();

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
    const envelope = this.generateViewpointEnvelope(anchor);
    if (envelope.length < 2) {
      throw new Error('PerceptualFitnessSampler requires a multi-pose viewpoint envelope');
    }

    const marks = target.markPositions;
    const nMarks = marks.length;
    const deviceClass = target.deviceClass ?? 'desktop';

    if (nMarks === 0) {
      const emptyMeasured: MeasuredPerceptualEvidence = {
        projectedOverlapFraction: 0,
        hiddenMarkFraction: 0,
        medianProjectedGlyphSizePx: 24,
        labelCrowdingIndex: 0,
        depthOrderAmbiguityFraction: 0,
        spatialExtentMeters: 0,
        requiredViewpointTravelMeters: 0,
        viewpointEnvelope: envelope,
        deviceClass,
      };

      return validatePerceptualFitnessEvidence({
        version: PERCEPTUAL_FITNESS_EVIDENCE_VERSION,
        candidateId: target.candidate.id,
        datasetFingerprint: target.datasetFingerprint,
        source: 'measured',
        measured: emptyMeasured,
        priors: {
          occlusionResistance: target.candidate.interactionCharacteristics.occlusionResistance,
          cognitiveLoad: target.candidate.interactionCharacteristics.cognitiveLoad,
        },
      });
    }

    // Spatial extent computation
    const box = new THREE.Box3();
    for (const p of marks) {
      box.expandByPoint(p);
    }
    const spatialExtentMeters = box.getSize(new THREE.Vector3()).length();

    // Required viewpoint travel to bring median mark into legible 1.2m range
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

      const depths: number[] = [];
      const projX: number[] = [];
      const projY: number[] = [];

      let hiddenInPose = 0;

      for (const p of marks) {
        const toMark = p.clone().sub(camPos);
        const depth = toMark.dot(camGaze);
        if (depth <= 0.1 || depth > 10.0) {
          hiddenInPose++;
        } else {
          depths.push(depth);
          projX.push(toMark.x / depth);
          projY.push(toMark.y / depth);
        }
      }

      totalHidden += hiddenInPose / nMarks;

      const validCount = depths.length;
      if (validCount > 1) {
        // Measure overlaps in projected coordinates
        let overlaps = 0;
        let nearTies = 0;
        const maxPairs = Math.min(validCount, 100);

        for (let i = 0; i < maxPairs; i++) {
          for (let j = i + 1; j < maxPairs; j++) {
            const dx = projX[i] - projX[j];
            const dy = projY[i] - projY[j];
            if (dx * dx + dy * dy < 0.002) {
              overlaps++;
            }
            if (Math.abs(depths[i] - depths[j]) < 0.05) {
              nearTies++;
            }
          }
        }
        const pairs = (maxPairs * (maxPairs - 1)) / 2;
        if (pairs > 0) {
          totalOverlap += overlaps / pairs;
          totalAmbiguity += nearTies / pairs;
        }
      }

      // Median glyph size estimate (world mark ~0.02m projected at median depth)
      const medianDepth = validCount > 0 ? depths[Math.floor(validCount / 2)] : 1.5;
      const glyphPx = Math.max(4, Math.min(128, (0.02 / Math.max(0.2, medianDepth)) * 1000));
      totalGlyphPx += glyphPx;
    }

    const nPoses = envelope.length;
    const projectedOverlapFraction = Math.min(1, totalOverlap / nPoses);
    const hiddenMarkFraction = Math.min(1, totalHidden / nPoses);
    const depthOrderAmbiguityFraction = Math.min(1, totalAmbiguity / nPoses);
    const medianProjectedGlyphSizePx = totalGlyphPx / nPoses;

    // Label crowding calculation
    const nLabels = target.labels ? target.labels.length : 0;
    const labelCrowdingIndex = Math.min(1, (nLabels / Math.max(1, spatialExtentMeters * 10)));

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
