from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match in {path}, got {count}")
    p.write_text(text.replace(old, new, 1))


replace_once(
    "scripts/analyze-quest-telemetry.mjs",
    """    minimumGovernorLodScale: minimum(steps.map((step) => step.representation?.governorLodScaleMinimum)),
    minimumRenderedFraction: minimum(steps.map((step) => step.representation?.renderedFraction)),
    totalGovernorThrottleEvents: steps.reduce(""",
    """    minimumGovernorLodScale: minimum(steps.map((step) => step.representation?.governorLodScaleMinimum)),
    minimumRenderedFraction: minimum(steps.map((step) => step.representation?.renderedFraction)),
    maximumSceneObjectCount: maximum(steps.map((step) => step.representation?.sceneObjectCountEnd)),
    maximumSceneObjectDelta: maximum(steps.map((step) => step.representation?.sceneObjectCountDelta)),
    maximumVisibleSceneObjectCount: maximum(
      steps.map((step) => step.representation?.visibleSceneObjectCountEnd)
    ),
    maximumVisibleSceneObjectDelta: maximum(
      steps.map((step) => step.representation?.visibleSceneObjectCountDelta)
    ),
    totalGovernorThrottleEvents: steps.reduce(""",
    "analyzer scene cardinality aggregates",
)
replace_once(
    "scripts/analyze-quest-telemetry.mjs",
    """    missingJsHeapStepCount: steps.filter((step) => step.memory?.jsHeapPeakBytes == null).length,
    missingWasmMemoryStepCount: steps.filter((step) => step.memory?.wasmPeakBytes == null).length,""",
    """    missingJsHeapStepCount: steps.filter((step) => step.memory?.jsHeapPeakBytes == null).length,
    missingWasmMemoryStepCount: steps.filter((step) => step.memory?.wasmPeakBytes == null).length,
    missingSceneCardinalityStepCount: steps.filter(
      (step) =>
        step.representation?.sceneObjectCountStart == null ||
        step.representation?.sceneObjectCountEnd == null
    ).length,""",
    "analyzer missing scene cardinality count",
)
replace_once(
    "tests/quest-telemetry-analysis.test.ts",
    """            governorLodScaleMinimum: 0.8,
            renderedFraction: 0.5,
            governorThrottleEvents: 2,""",
    """            governorLodScaleMinimum: 0.8,
            renderedFraction: 0.5,
            sceneObjectCountStart: 100,
            sceneObjectCountEnd: 100 + p95Ms,
            sceneObjectCountDelta: p95Ms,
            visibleSceneObjectCountStart: 80,
            visibleSceneObjectCountEnd: 80 + p95Ms,
            visibleSceneObjectCountDelta: p95Ms,
            governorThrottleEvents: 2,""",
    "analysis fixture scene cardinality",
)
replace_once(
    "tests/quest-telemetry-analysis.test.ts",
    """    expect(group.maximumWasmPeakBytes).toBe(200);
    expect(group.totalGovernorThrottleEvents).toBe(4);""",
    """    expect(group.maximumWasmPeakBytes).toBe(200);
    expect(group.maximumSceneObjectCount).toBe(114);
    expect(group.maximumSceneObjectDelta).toBe(14);
    expect(group.maximumVisibleSceneObjectCount).toBe(94);
    expect(group.maximumVisibleSceneObjectDelta).toBe(14);
    expect(group.missingSceneCardinalityStepCount).toBe(0);
    expect(group.totalGovernorThrottleEvents).toBe(4);""",
    "analysis scene cardinality assertions",
)
