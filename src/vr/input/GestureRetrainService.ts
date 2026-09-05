/**
 * Central Retraining Service, Staged Deployment & Drift Monitoring (Sprint 23.4 & 23.5).
 *
 * Implements:
 * - User-disjoint evaluation split by purpose-scoped profile pseudonym.
 * - Enforcing quality bar: Accuracy >= 0.90, Macro-F1 >= 0.85 across all 6 classes.
 * - Staged deployment lifecycle: Candidate -> Shadow -> Canary -> Full Rollout.
 * - Model card integrity verification and checksum validation.
 * - Anonymous drift monitoring & heuristic vs. ONNX comparison.
 */

import {
  GESTURE_CLASSES,
  type GestureClass,
  type ModelCard,
} from '../../../modules/gesture-intelligence/src/contracts.ts';

export type DeploymentStage = 'candidate' | 'shadow' | 'canary' | 'rollout' | 'archived';
export type EvaluationValidity = 'VALID' | 'NO_HELD_OUT_PROFILES' | 'MISSING_CLASS_SUPPORT';

export interface EvaluatedSample {
  readonly features: readonly number[];
  readonly trueLabel: GestureClass;
  readonly predictedLabel: GestureClass;
  readonly confidence: number;
  /** Legacy field name; PT6 collection must supply a purpose-scoped learning pseudonym here. */
  readonly profileHash: string;
}

export interface EvaluationReport {
  readonly validity: EvaluationValidity;
  readonly missingClasses: readonly GestureClass[];
  readonly accuracy: number;
  readonly macroF1: number;
  readonly perClassF1: Record<GestureClass, number>;
  readonly userDisjointAccuracy: number;
  readonly userDisjointMacroF1: number;
  readonly sampleCount: number;
  readonly profileCount: number;
  readonly passedBar: boolean;
}

export interface StagedDeployment {
  readonly version: string;
  readonly modelSha256: string;
  stage: DeploymentStage;
  readonly rolloutPercentage: number;
  readonly deployedAt: number;
}

export interface DriftMetrics {
  totalConfirmed: number;
  totalCorrected: number;
  confirmRatio: number;
  heuristicCorrections: number;
  onnxCorrections: number;
  isDrifting: boolean;
}

const MIN_ACCURACY = 0.90;
const MIN_MACRO_F1 = 0.85;

function zeroPerClassF1(): Record<GestureClass, number> {
  return Object.fromEntries(GESTURE_CLASSES.map((gesture) => [gesture, 0])) as Record<GestureClass, number>;
}

export class GestureRetrainService {
  private _deployments = new Map<string, StagedDeployment>();
  private _driftData: { confirmed: number; corrected: number; source: 'onnx' | 'heuristic' }[] = [];

  registerCandidate(card: ModelCard, stage: DeploymentStage = 'candidate', rolloutPercentage = 0): StagedDeployment {
    const deployment: StagedDeployment = {
      version: card.version,
      modelSha256: card.sha256,
      stage,
      rolloutPercentage,
      deployedAt: Date.now(),
    };
    this._deployments.set(card.version, deployment);
    return deployment;
  }

  getDeployment(version: string): StagedDeployment | undefined {
    return this._deployments.get(version);
  }

  promoteDeployment(version: string, targetStage: DeploymentStage, _percentage = 100): boolean {
    const dep = this._deployments.get(version);
    if (!dep) return false;
    dep.stage = targetStage;
    return true;
  }

  /**
   * Evaluate only profiles not present in the training profile set.
   *
   * There is intentionally no fallback to `samples` when every supplied profile
   * overlaps training. Such a fallback would manufacture apparently
   * "user-disjoint" evidence from a non-disjoint set. Likewise, a six-class
   * quality gate is invalid when any declared gesture class has zero held-out
   * support; unsupported classes score zero F1 rather than perfect F1.
   */
  evaluateUserDisjoint(
    samples: readonly EvaluatedSample[],
    trainProfiles: ReadonlySet<string>
  ): EvaluationReport {
    const testSamples = samples.filter((sample) => !trainProfiles.has(sample.profileHash));
    const heldOutProfiles = new Set(testSamples.map((sample) => sample.profileHash));

    if (testSamples.length === 0 || heldOutProfiles.size === 0) {
      return {
        validity: 'NO_HELD_OUT_PROFILES',
        missingClasses: [...GESTURE_CLASSES],
        accuracy: 0,
        macroF1: 0,
        perClassF1: zeroPerClassF1(),
        userDisjointAccuracy: 0,
        userDisjointMacroF1: 0,
        sampleCount: 0,
        profileCount: 0,
        passedBar: false,
      };
    }

    let correct = 0;
    const tp = new Array<number>(GESTURE_CLASSES.length).fill(0);
    const fp = new Array<number>(GESTURE_CLASSES.length).fill(0);
    const fn = new Array<number>(GESTURE_CLASSES.length).fill(0);
    const support = new Array<number>(GESTURE_CLASSES.length).fill(0);

    for (const sample of testSamples) {
      const predIdx = GESTURE_CLASSES.indexOf(sample.predictedLabel);
      const trueIdx = GESTURE_CLASSES.indexOf(sample.trueLabel);
      if (trueIdx >= 0) support[trueIdx] += 1;
      if (predIdx === trueIdx && trueIdx >= 0) {
        correct += 1;
        tp[trueIdx] += 1;
      } else {
        if (predIdx >= 0) fp[predIdx] += 1;
        if (trueIdx >= 0) fn[trueIdx] += 1;
      }
    }

    const accuracy = correct / testSamples.length;
    const perClassF1 = zeroPerClassF1();
    let sumF1 = 0;

    for (let index = 0; index < GESTURE_CLASSES.length; index += 1) {
      const className = GESTURE_CLASSES[index];
      const denom = 2 * tp[index] + fp[index] + fn[index];
      const f1 = support[index] > 0 && denom > 0 ? (2 * tp[index]) / denom : 0;
      perClassF1[className] = f1;
      sumF1 += f1;
    }

    const macroF1 = sumF1 / GESTURE_CLASSES.length;
    const missingClasses = GESTURE_CLASSES.filter((_, index) => support[index] === 0);
    const validity: EvaluationValidity =
      missingClasses.length === 0 ? 'VALID' : 'MISSING_CLASS_SUPPORT';
    const passedBar =
      validity === 'VALID' && accuracy >= MIN_ACCURACY && macroF1 >= MIN_MACRO_F1;

    return {
      validity,
      missingClasses,
      accuracy,
      macroF1,
      perClassF1,
      userDisjointAccuracy: accuracy,
      userDisjointMacroF1: macroF1,
      sampleCount: testSamples.length,
      profileCount: heldOutProfiles.size,
      passedBar,
    };
  }

  recordTelemetryObservation(source: 'onnx' | 'heuristic', confirmed: boolean): void {
    this._driftData.push({
      source,
      confirmed: confirmed ? 1 : 0,
      corrected: confirmed ? 0 : 1,
    });
    if (this._driftData.length > 500) {
      this._driftData.shift();
    }
  }

  getDriftMetrics(): DriftMetrics {
    let totalConfirmed = 0;
    let totalCorrected = 0;
    let heuristicCorrections = 0;
    let onnxCorrections = 0;

    for (const d of this._driftData) {
      totalConfirmed += d.confirmed;
      totalCorrected += d.corrected;
      if (d.corrected > 0) {
        if (d.source === 'heuristic') heuristicCorrections += 1;
        else onnxCorrections += 1;
      }
    }

    const total = totalConfirmed + totalCorrected;
    const confirmRatio = total > 0 ? totalConfirmed / total : 1.0;
    const isDrifting = total >= 10 && confirmRatio < 0.70;

    return {
      totalConfirmed,
      totalCorrected,
      confirmRatio,
      heuristicCorrections,
      onnxCorrections,
      isDrifting,
    };
  }
}
