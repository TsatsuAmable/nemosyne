from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match in {path}, got {count}")
    p.write_text(text.replace(old, new, 1))


replace_once(
    "src/vr/scalability/LoadTestThresholds.ts",
    """export interface StepRepresentationStats {
  sourceRowCount: number;
  renderedNodeCount: number | null;
  renderedFraction: number | null;
  geometry: string | null;
  layout: string | null;
  governorLodScaleMinimum: number | null;
  governorLodScaleFinal: number | null;
  governorThrottleEvents: number;
}""",
    """export interface StepRepresentationStats {
  sourceRowCount: number;
  renderedNodeCount: number | null;
  renderedFraction: number | null;
  /** Scene cardinality is sampled only at step boundaries so observation does not add per-frame traversal cost. */
  sceneObjectCountStart: number | null;
  sceneObjectCountEnd: number | null;
  sceneObjectCountDelta: number | null;
  visibleSceneObjectCountStart: number | null;
  visibleSceneObjectCountEnd: number | null;
  visibleSceneObjectCountDelta: number | null;
  geometry: string | null;
  layout: string | null;
  governorLodScaleMinimum: number | null;
  governorLodScaleFinal: number | null;
  governorThrottleEvents: number;
}""",
    "representation scene cardinality schema",
)

replace_once(
    "src/vr/scalability/LoadTestCollector.ts",
    """export interface LoadTestRuntimeProbe {
  getWasmMemoryBytes?(): number | null;
}""",
    """export interface LoadTestSceneStats {
  objectCount: number;
  visibleObjectCount: number;
}

export interface LoadTestRuntimeProbe {
  getWasmMemoryBytes?(): number | null;
  /** Expensive scene traversal probe. Called only at step start/end, never per frame. */
  getSceneStats?(): LoadTestSceneStats | null;
}""",
    "collector scene probe contract",
)
replace_once(
    "src/vr/scalability/LoadTestCollector.ts",
    """  private _wasmStart: number | null = null;
  private _wasmSamples: number[] = [];
  private _lodScaleSamples: number[] = [];""",
    """  private _wasmStart: number | null = null;
  private _wasmSamples: number[] = [];
  private _sceneStart: LoadTestSceneStats | null = null;
  private _lodScaleSamples: number[] = [];""",
    "collector scene start field",
)
replace_once(
    "src/vr/scalability/LoadTestCollector.ts",
    """    this._wasmStart = null;
    this._wasmSamples = [];
    this._lodScaleSamples = [];""",
    """    this._wasmStart = null;
    this._wasmSamples = [];
    this._sceneStart = null;
    this._lodScaleSamples = [];""",
    "collector reset scene state",
)
replace_once(
    "src/vr/scalability/LoadTestCollector.ts",
    """    this._heapStart = heapUsed();
    this._wasmStart = this._runtimeProbe.getWasmMemoryBytes?.() ?? null;
    this._governorThrottleStart = this._engine.frameGovernor?.getMetrics().throttleCount ?? 0;""",
    """    this._heapStart = heapUsed();
    this._wasmStart = this._runtimeProbe.getWasmMemoryBytes?.() ?? null;
    this._sceneStart = this._runtimeProbe.getSceneStats?.() ?? null;
    this._governorThrottleStart = this._engine.frameGovernor?.getMetrics().throttleCount ?? 0;""",
    "collector start scene sample",
)
replace_once(
    "src/vr/scalability/LoadTestCollector.ts",
    """    const heapEnd = heapUsed();
    const wasmEnd = this._runtimeProbe.getWasmMemoryBytes?.() ?? null;
    const heapDeltaBytes = nullableDelta(this._heapStart, heapEnd);""",
    """    const heapEnd = heapUsed();
    const wasmEnd = this._runtimeProbe.getWasmMemoryBytes?.() ?? null;
    const sceneEnd = this._runtimeProbe.getSceneStats?.() ?? null;
    const heapDeltaBytes = nullableDelta(this._heapStart, heapEnd);""",
    "collector end scene sample",
)
replace_once(
    "src/vr/scalability/LoadTestCollector.ts",
    """        renderedFraction:
          typeof opts.renderedNodeCount === 'number' && spec.rowCount > 0
            ? opts.renderedNodeCount / spec.rowCount
            : null,
        geometry: opts.specGeometry ?? null,""",
    """        renderedFraction:
          typeof opts.renderedNodeCount === 'number' && spec.rowCount > 0
            ? opts.renderedNodeCount / spec.rowCount
            : null,
        sceneObjectCountStart: this._sceneStart?.objectCount ?? null,
        sceneObjectCountEnd: sceneEnd?.objectCount ?? null,
        sceneObjectCountDelta: nullableDelta(
          this._sceneStart?.objectCount ?? null,
          sceneEnd?.objectCount ?? null
        ),
        visibleSceneObjectCountStart: this._sceneStart?.visibleObjectCount ?? null,
        visibleSceneObjectCountEnd: sceneEnd?.visibleObjectCount ?? null,
        visibleSceneObjectCountDelta: nullableDelta(
          this._sceneStart?.visibleObjectCount ?? null,
          sceneEnd?.visibleObjectCount ?? null
        ),
        geometry: opts.specGeometry ?? null,""",
    "collector result scene cardinality",
)

replace_once(
    "src/app/devEvidence.ts",
    """function usabilityDigest(telemetry: TelemetryCollectorLike): LoadTestSummary['usability'] {
  const digest = telemetry.frustrationAnalyzer.getCompactDigest();
  return {
    frictionLevel: digest.frictionLevel,
    dissatisfactionScore: digest.dissatisfactionScore,
    detectedPatterns: digest.detectedPatterns.map((pattern) => pattern.type),
    telemetryConsentEnabled: telemetry.enabled,
  };
}
""",
    """function usabilityDigest(telemetry: TelemetryCollectorLike): LoadTestSummary['usability'] {
  const digest = telemetry.frustrationAnalyzer.getCompactDigest();
  return {
    frictionLevel: digest.frictionLevel,
    dissatisfactionScore: digest.dissatisfactionScore,
    detectedPatterns: digest.detectedPatterns.map((pattern) => pattern.type),
    telemetryConsentEnabled: telemetry.enabled,
  };
}

function captureSceneCardinality(engine: Engine): {
  objectCount: number;
  visibleObjectCount: number;
} {
  let objectCount = 0;
  let visibleObjectCount = 0;
  engine.scene.traverse((object) => {
    objectCount += 1;
    if (object.visible) visibleObjectCount += 1;
  });
  return { objectCount, visibleObjectCount };
}
""",
    "dev evidence scene cardinality helper",
)
replace_once(
    "src/app/devEvidence.ts",
    """    { loadDataset, getActiveSpecInfo, eventBus },
    engine,
    { getWasmMemoryBytes }
  );""",
    """    { loadDataset, getActiveSpecInfo, eventBus },
    engine,
    {
      getWasmMemoryBytes,
      getSceneStats: () => captureSceneCardinality(engine),
    }
  );""",
    "dev evidence collector probe wiring",
)

marker = """export const QUEST_3S_QUALIFICATION_PROFILE: LoadTestProfile = {
  name: 'quest-3s-qualification',
  deviceTarget: 'META_QUEST_3S',
  settleSec: 5,
  steps: [
    {
      topology: 'TABULAR',
      rowCount: 1_000,
      durationSec: 15,
      label: 'warmup (ungraded)',
      warmup: true,
    },
    { topology: 'TABULAR', rowCount: 1_000, durationSec: 30, label: '1k baseline' },
    { topology: 'TABULAR', rowCount: 8_000, durationSec: 30, label: '8k baseline' },
    { topology: 'TABULAR', rowCount: 65_000, durationSec: 45, label: '65k scale' },
    { topology: 'TABULAR', rowCount: 100_000, durationSec: 300, label: '100k soak' },
    { topology: 'TABULAR', rowCount: 250_000, durationSec: 60, label: '250k stretch' },
  ],
};"""
addition = marker + """

export type Uxr0QualificationProfileKind =
  | 'functional-5m'
  | 'resource-trend-30m'
  | 'sustained-60m';

export const UXR0_PROFILE_DURATIONS_SEC: Readonly<Record<Uxr0QualificationProfileKind, number>> = {
  'functional-5m': 5 * 60,
  'resource-trend-30m': 30 * 60,
  'sustained-60m': 60 * 60,
};

/**
 * Build an attributable UXR0 observation profile around one fixed source scale.
 * The warmup and measured steps use the same topology/cardinality so startup
 * effects stay explicitly separated from sustained evidence. These profiles do
 * not alter load-test thresholds or make a device-performance claim by existing.
 */
export function createUxr0QualificationProfile(
  kind: Uxr0QualificationProfileKind,
  rowCount = 100_000,
  deviceTarget?: QuestDeviceTarget
): LoadTestProfile {
  if (!Number.isSafeInteger(rowCount) || rowCount <= 0) {
    throw new Error('UXR0 qualification rowCount must be a positive safe integer.');
  }
  const durationSec = UXR0_PROFILE_DURATIONS_SEC[kind];
  return {
    name: `uxr0-${kind}`,
    ...(deviceTarget ? { deviceTarget } : {}),
    settleSec: 5,
    steps: [
      {
        topology: 'TABULAR',
        rowCount,
        durationSec: 30,
        label: 'same-scale warmup (ungraded)',
        warmup: true,
      },
      {
        topology: 'TABULAR',
        rowCount,
        durationSec,
        label: kind,
      },
    ],
  };
}

export const UXR0_FUNCTIONAL_5M_PROFILE = createUxr0QualificationProfile('functional-5m');
export const UXR0_RESOURCE_TREND_30M_PROFILE = createUxr0QualificationProfile(
  'resource-trend-30m'
);
export const UXR0_SUSTAINED_60M_PROFILE = createUxr0QualificationProfile('sustained-60m');"""
replace_once("src/vr/scalability/LoadTestDriver.ts", marker, addition, "UXR0 profile contract")

replace_once(
    "tests/quest-telemetry.test.ts",
    """    let wasmBytes = 100;
    let throttleCount = 2;""",
    """    let wasmBytes = 100;
    let throttleCount = 2;
    let sceneObjectCount = 20;
    let visibleSceneObjectCount = 18;""",
    "quest telemetry scene test state",
)
replace_once(
    "tests/quest-telemetry.test.ts",
    """    const collector = new LoadTestCollector(engine, { getWasmMemoryBytes: () => wasmBytes });""",
    """    const collector = new LoadTestCollector(engine, {
      getWasmMemoryBytes: () => wasmBytes,
      getSceneStats: () => ({
        objectCount: sceneObjectCount,
        visibleObjectCount: visibleSceneObjectCount,
      }),
    });""",
    "quest telemetry scene probe test",
)
replace_once(
    "tests/quest-telemetry.test.ts",
    """    const result = collector.endStep({
      renderedNodeCount: 250,""",
    """    sceneObjectCount = 24;
    visibleSceneObjectCount = 19;
    const result = collector.endStep({
      renderedNodeCount: 250,""",
    "quest telemetry end scene mutation",
)
replace_once(
    "tests/quest-telemetry.test.ts",
    """    expect(result.representation.renderedFraction).toBe(0.25);
    expect(result.representation.governorLodScaleMinimum).toBe(0.75);""",
    """    expect(result.representation.renderedFraction).toBe(0.25);
    expect(result.representation.sceneObjectCountStart).toBe(20);
    expect(result.representation.sceneObjectCountEnd).toBe(24);
    expect(result.representation.sceneObjectCountDelta).toBe(4);
    expect(result.representation.visibleSceneObjectCountStart).toBe(18);
    expect(result.representation.visibleSceneObjectCountEnd).toBe(19);
    expect(result.representation.visibleSceneObjectCountDelta).toBe(1);
    expect(result.representation.governorLodScaleMinimum).toBe(0.75);""",
    "quest telemetry scene assertions",
)

replace_once(
    "tests/loadtest-driver.test.ts",
    """  DEFAULT_LOAD_TEST_PROFILE,
  QUEST_3S_QUALIFICATION_PROFILE,
  type LoadTestProfile,""",
    """  DEFAULT_LOAD_TEST_PROFILE,
  QUEST_3S_QUALIFICATION_PROFILE,
  UXR0_FUNCTIONAL_5M_PROFILE,
  UXR0_RESOURCE_TREND_30M_PROFILE,
  UXR0_SUSTAINED_60M_PROFILE,
  createUxr0QualificationProfile,
  type LoadTestProfile,""",
    "loadtest UXR0 imports",
)
replace_once(
    "tests/loadtest-driver.test.ts",
    """describe('LoadTestDriver state machine', () => {
  it('transitions IDLE → SETTLING → MEASURING → COMPLETE across the staircase', async () => {""",
    """describe('LoadTestDriver state machine', () => {
  it('freezes UXR0 5m/30m/60m same-scale observation profiles without changing legacy profiles', () => {
    const profiles = [
      UXR0_FUNCTIONAL_5M_PROFILE,
      UXR0_RESOURCE_TREND_30M_PROFILE,
      UXR0_SUSTAINED_60M_PROFILE,
    ];
    expect(profiles.map((profile) => profile.steps[1].durationSec)).toEqual([300, 1800, 3600]);
    for (const profile of profiles) {
      expect(profile.steps).toHaveLength(2);
      expect(profile.steps[0].warmup).toBe(true);
      expect(profile.steps[0].rowCount).toBe(profile.steps[1].rowCount);
      expect(profile.steps[0].topology).toBe(profile.steps[1].topology);
    }
    expect(QUEST_3S_QUALIFICATION_PROFILE.name).toBe('quest-3s-qualification');
    expect(createUxr0QualificationProfile('functional-5m', 8_000).steps[1].rowCount).toBe(8_000);
    expect(() => createUxr0QualificationProfile('functional-5m', 0)).toThrow(/positive safe integer/);
  });

  it('transitions IDLE → SETTLING → MEASURING → COMPLETE across the staircase', async () => {""",
    "loadtest UXR0 profile falsifier",
)
