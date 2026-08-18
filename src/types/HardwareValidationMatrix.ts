/**
 * Hardware Validation Matrix.
 *
 * Formalizes repeatable validation across headset targets and stress test dimensions:
 * Headset (Desktop | Quest 3S | Quest 3 | Vision Pro)
 *   x Test (startup, hand_tracking, controller, 1k_dataset, 8k_dataset, 65k_dataset, 100k_dataset, comfort, text_readability, reduced_motion).
 */

export type HeadsetDevice =
  | 'DESKTOP_EMULATOR'
  | 'META_QUEST_3S'
  | 'META_QUEST_3'
  | 'APPLE_VISION_PRO'
  | 'OTHER_WEBXR_HEADSET';

export type HardwareTestSuite =
  | 'startup_lifecycle'
  | 'hand_tracking_tracking_loss'
  | 'controller_precision'
  | 'scale_1k_nodes'
  | 'scale_8k_nodes'
  | 'scale_65k_nodes'
  | 'scale_100k_nodes'
  | 'comfort_vignette_snap_turn'
  | 'text_readability_contrast'
  | 'reduced_motion_stability';

export interface HardwareValidationRun {
  runId: string;
  headset: HeadsetDevice;
  suite: HardwareTestSuite;
  firmwareVersion: string;
  browserVersion: string;
  passed: boolean;
  frameRateP50Fps: number;
  frameRateP99Fps: number;
  memoryUsedMb: number;
  testedAt: number;
}

export class HardwareValidationMatrixRegistry {
  private _runs: HardwareValidationRun[] = [];

  recordRun(run: HardwareValidationRun): void {
    this._runs.push(run);
  }

  getRunsForHeadset(headset: HeadsetDevice): HardwareValidationRun[] {
    return this._runs.filter((r) => r.headset === headset);
  }

  isSuitePassingOnHeadset(headset: HeadsetDevice, suite: HardwareTestSuite): boolean {
    const runs = this._runs.filter((r) => r.headset === headset && r.suite === suite);
    if (runs.length === 0) return false;
    return runs[runs.length - 1].passed;
  }

  getHeadsetCoverage(headset: HeadsetDevice): number {
    const testedSuites = new Set(this._runs.filter((r) => r.headset === headset).map((r) => r.suite));
    const totalSuites = 10;
    return testedSuites.size / totalSuites;
  }
}
