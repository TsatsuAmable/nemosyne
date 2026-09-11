import type {
  ScenarioFaultController,
  ScenarioFaultEffect,
} from '../xr-simulator/ScenarioRunner.ts';
import type { ScenarioStep } from '../xr-simulator/ScenarioFixtures.ts';
import type { FaultEnvelope } from './ExperimentalProfiles.ts';

export interface FaultInjectionSummary {
  envelopeId: string;
  seed: string;
  evaluatedSteps: number;
  injected: Record<string, number>;
  configuredDimensions: string[];
  unexercisedDimensions: string[];
}

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0 || 0x9e3779b9;
}

class XorShift32 {
  constructor(private _state: number) {}
  next(): number {
    let x = this._state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this._state = x >>> 0;
    return this._state / 0x100000000;
  }
  between(min: number, max: number): number {
    return min + (max - min) * this.next();
  }
  chance(probability: number): boolean {
    return probability > 0 && this.next() < probability;
  }
}

export class SeededFaultController implements ScenarioFaultController {
  readonly id: string;
  readonly seed: string;
  private readonly _rng: XorShift32;
  private readonly _injected: Record<string, number> = {};
  private _steps = 0;

  constructor(
    private readonly _fault: FaultEnvelope,
    seed: string
  ) {
    this.id = _fault.id;
    this.seed = seed;
    this._rng = new XorShift32(hashSeed(seed));
  }

  effectForStep(step: ScenarioStep, stepIndex: number): ScenarioFaultEffect {
    this._steps++;
    const effect: ScenarioFaultEffect = { labels: [] };
    const note = (label: string) => {
      effect.labels!.push(label);
      this._injected[label] = (this._injected[label] ?? 0) + 1;
    };

    if (step.kind === 'pose' && this._fault.trackingPositionNoiseM > 0) {
      const amplitude = this._fault.trackingPositionNoiseM;
      effect.positionOffset = {
        x: this._rng.between(-amplitude, amplitude),
        y: this._rng.between(-amplitude, amplitude),
        z: this._rng.between(-amplitude, amplitude),
      };
      note('tracking-position-noise');
    }
    if (step.kind === 'pose' && this._fault.trackingAngularNoiseDeg > 0) {
      const amplitude = this._fault.trackingAngularNoiseDeg;
      effect.angularOffsetDeg = {
        x: this._rng.between(-amplitude, amplitude),
        y: this._rng.between(-amplitude, amplitude),
        z: this._rng.between(-amplitude, amplitude),
      };
      note('tracking-angular-noise');
    }
    if (step.kind === 'pose' && this._rng.chance(this._fault.droppedPoseProbability)) {
      effect.dropPose = true;
      effect.freezePoseMs = this._fault.poseFreezeMs;
      note('dropped-pose');
      if (effect.freezePoseMs > 0) note('pose-freeze');
    }

    const [minLatency, maxLatency] = this._fault.workerLatencyMs;
    if (maxLatency > 0) {
      effect.workerLatencyMs = Math.round(this._rng.between(minLatency, maxLatency));
      note('worker-latency');
    }
    if (
      this._fault.frameSpikeEveryNFrames > 0 &&
      (stepIndex + 1) % this._fault.frameSpikeEveryNFrames === 0
    ) {
      effect.frameSpikeMs = this._fault.periodicFrameSpikeMs;
      note('periodic-frame-spike');
    }
    // Inject transient source loss during pose/tracking steps only. Dropping an
    // intentional press while disconnected and then requiring it to replay on
    // reconnect would make ghost input the success condition. Recovery is
    // tested by the subsequent fresh input step.
    if (step.kind === 'pose' && this._rng.chance(this._fault.inputDisconnectProbability)) {
      effect.disconnectInput = true;
      note('input-disconnect');
    }
    return effect;
  }

  summary(): FaultInjectionSummary {
    const configured = [
      this._fault.trackingPositionNoiseM > 0 && 'tracking-position-noise',
      this._fault.trackingAngularNoiseDeg > 0 && 'tracking-angular-noise',
      this._fault.droppedPoseProbability > 0 && 'dropped-pose',
      this._fault.poseFreezeMs > 0 && 'pose-freeze',
      this._fault.workerLatencyMs[1] > 0 && 'worker-latency',
      this._fault.periodicFrameSpikeMs > 0 && 'periodic-frame-spike',
      this._fault.inputDisconnectProbability > 0 && 'input-disconnect',
    ].filter((value): value is string => Boolean(value));
    return {
      envelopeId: this._fault.id,
      seed: this.seed,
      evaluatedSteps: this._steps,
      injected: { ...this._injected },
      configuredDimensions: configured,
      unexercisedDimensions: configured.filter((dimension) => !this._injected[dimension]),
    };
  }
}
