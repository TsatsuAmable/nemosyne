/**
 * Bounded XR evaluation evidence (dev/test-only).
 *
 * The episode vocabulary matches the schema defined in
 * `docs/AI_XR_AGENT_HARNESS_SPEC.md` (section 6.8) and the P1-USIM governing
 * review. It records deterministic simulator/interaction evidence with an
 * explicit environment mode. `desktop-simulator` evidence may satisfy
 * deterministic spatial/input/layout gates; it is never device qualification.
 *
 * The recorder is intentionally bounded and append-only so a long or hostile
 * scenario cannot grow unbounded in-memory evidence.
 */

export type XREvaluationMode = 'browser-ci' | 'desktop-simulator' | 'quest-browser';

export type XREvaluationOutcome = 'PASSED' | 'FAILED' | 'INCOMPLETE' | 'UNSUPPORTED';

export type EvidenceSource = 'measured' | 'observed' | 'suggested';

export interface AgentIdentity {
  /** Stable dev/test identity; never a real person's identity. */
  id: string;
  kind: 'engineering' | 'simulator' | 'agent';
}

export interface XREvaluationStep {
  /** Deterministic step id (e.g. `pose-1`, `press-trigger-2`). */
  stepId: string;
  sequence: number;
  description: string;
  outcome: 'PASSED' | 'FAILED' | 'INCOMPLETE' | 'UNSUPPORTED' | 'SKIPPED';
  /** Optional pose label or scenario fixture id. */
  poseRef?: string | null;
  durationMs?: number | null;
}

export interface XREvaluationMeasurement {
  measurementId: string;
  metric: string;
  value: number;
  unit: string | null;
  source: EvidenceSource;
  /** Optional reference into the scenario/scene (e.g. object id). */
  objectRef?: string | null;
}

export interface XREvaluationObservation {
  observationId: string;
  text: string;
  severity: 'info' | 'warning' | 'error';
  evidenceRef?: string | null;
}

export interface XREvaluationSuggestion {
  suggestionId: string;
  text: string;
  rationale?: string | null;
}

export interface XRScreenshotReference {
  id: string;
  label: string;
  /** Mirror canvas vs compositor evidence; must never be silently swapped. */
  evidenceType: 'browser-mirror' | 'xr-compositor';
  url: string | null;
}

export interface XREvaluationEpisode {
  schemaVersion: '1';
  evaluationId: string;
  buildHash: string;
  scenarioId: string;
  environment: {
    mode: XREvaluationMode;
    browser: string;
    device: string | null;
    xrRuntime: string | null;
    refreshRateHz: number | null;
  };
  agent: AgentIdentity;
  capabilityGrant: string[];
  consentRecordId: string | null;
  startedAt: string;
  finishedAt: string;
  steps: XREvaluationStep[];
  measurements: XREvaluationMeasurement[];
  observations: XREvaluationObservation[];
  suggestions: XREvaluationSuggestion[];
  screenshots: XRScreenshotReference[];
  uxTraceReference: string | null;
  investigationReference: string | null;
  outcome: XREvaluationOutcome;
}

/** Bounded-array defaults for the recorder. */
export const EPISODE_BOUNDS = {
  maxSteps: 256,
  maxMeasurements: 128,
  maxObservations: 64,
  maxSuggestions: 32,
  maxScreenshots: 8,
} as const;

export interface XREvaluationEpisodeInput {
  scenarioId: string;
  buildHash?: string;
  environment?: Partial<XREvaluationEpisode['environment']>;
  agent?: AgentIdentity;
  capabilityGrant?: string[];
}

/**
 * Bounded, append-only episode recorder. Produces a complete
 * `XREvaluationEpisode` on `finish()`. `begin()`/`finish()` are guarded so an
 * unfinished episode cannot be produced.
 */
export class XREvaluationRecorder {
  private _started: string | null = null;
  private _finished: string | null = null;
  private _steps: XREvaluationStep[] = [];
  private _measurements: XREvaluationMeasurement[] = [];
  private _observations: XREvaluationObservation[] = [];
  private _suggestions: XREvaluationSuggestion[] = [];
  private _screenshots: XRScreenshotReference[] = [];
  private _outcome: XREvaluationOutcome = 'INCOMPLETE';

  constructor(private readonly _input: XREvaluationEpisodeInput) {}

  begin(): void {
    if (this._started) throw new Error('XREvaluationRecorder: begin() called twice');
    this._started = new Date().toISOString();
  }

  recordStep(step: Omit<XREvaluationStep, 'sequence'> & { sequence?: number }): XREvaluationStep {
    this._assertRunning();
    const full: XREvaluationStep = { sequence: this._steps.length + 1, ...step };
    if (this._steps.length >= EPISODE_BOUNDS.maxSteps) return full;
    this._steps.push(full);
    return full;
  }

  recordMeasurement(
    measurement: Omit<XREvaluationMeasurement, 'measurementId'> & { measurementId?: string }
  ): XREvaluationMeasurement {
    this._assertRunning();
    const full: XREvaluationMeasurement = {
      measurementId: `m-${this._measurements.length + 1}`,
      ...measurement,
    };
    if (this._measurements.length >= EPISODE_BOUNDS.maxMeasurements) return full;
    this._measurements.push(full);
    return full;
  }

  recordObservation(
    observation: Omit<XREvaluationObservation, 'observationId'> & { observationId?: string }
  ): XREvaluationObservation {
    this._assertRunning();
    const full: XREvaluationObservation = {
      observationId: `o-${this._observations.length + 1}`,
      ...observation,
    };
    if (this._observations.length >= EPISODE_BOUNDS.maxObservations) return full;
    this._observations.push(full);
    return full;
  }

  recordSuggestion(
    suggestion: Omit<XREvaluationSuggestion, 'suggestionId'> & { suggestionId?: string }
  ): XREvaluationSuggestion {
    this._assertRunning();
    const full: XREvaluationSuggestion = {
      suggestionId: `s-${this._suggestions.length + 1}`,
      ...suggestion,
    };
    if (this._suggestions.length >= EPISODE_BOUNDS.maxSuggestions) return full;
    this._suggestions.push(full);
    return full;
  }

  recordScreenshot(reference: XRScreenshotReference): XRScreenshotReference {
    this._assertRunning();
    if (this._screenshots.length >= EPISODE_BOUNDS.maxScreenshots) return reference;
    this._screenshots.push(reference);
    return reference;
  }

  setOutcome(outcome: XREvaluationOutcome): void {
    this._assertRunning();
    this._outcome = outcome;
  }

  finish(): XREvaluationEpisode {
    if (!this._started) throw new Error('XREvaluationRecorder: finish() before begin()');
    if (this._finished) throw new Error('XREvaluationRecorder: finish() called twice');
    this._finished = new Date().toISOString();
    const environment: XREvaluationEpisode['environment'] = {
      mode: 'desktop-simulator',
      browser: 'unknown',
      device: null,
      xrRuntime: 'iwer',
      refreshRateHz: null,
      ...this._input.environment,
    };
    return {
      schemaVersion: '1',
      evaluationId: `episode-${this._input.scenarioId}-${Date.now()}`,
      buildHash: this._input.buildHash ?? 'unknown',
      scenarioId: this._input.scenarioId,
      environment,
      agent: this._input.agent ?? { id: 'nemosyne-usim-0', kind: 'engineering' },
      capabilityGrant: this._input.capabilityGrant ?? [],
      consentRecordId: null,
      startedAt: this._started,
      finishedAt: this._finished,
      steps: [...this._steps],
      measurements: [...this._measurements],
      observations: [...this._observations],
      suggestions: [...this._suggestions],
      screenshots: [...this._screenshots],
      uxTraceReference: null,
      investigationReference: null,
      outcome: this._outcome,
    };
  }

  get running(): boolean {
    return this._started !== null && this._finished === null;
  }

  private _assertRunning(): void {
    if (!this._started) throw new Error('XREvaluationRecorder: record before begin()');
    if (this._finished) throw new Error('XREvaluationRecorder: record after finish()');
  }
}