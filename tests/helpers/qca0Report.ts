import type { ValidationManifest } from '../../src/validation/validation-manifest.ts';
import { LOAD_TEST_THRESHOLDS } from '../../src/vr/scalability/LoadTestThresholds.ts';

export const QCA0_TEST_STEPS = [
  { rowCount: 1_000, durationSec: 10, warmup: true },
  { rowCount: 1_000, durationSec: 15, warmup: false },
  { rowCount: 8_000, durationSec: 15, warmup: false },
  { rowCount: 32_000, durationSec: 15, warmup: false },
  { rowCount: 65_000, durationSec: 15, warmup: false },
  { rowCount: 100_000, durationSec: 30, warmup: false },
] as const;

function frameFor(grade: 'green' | 'yellow' | 'red') {
  if (grade === 'red') return { p95Ms: 20, p99Ms: 25, droppedPct: 2 };
  if (grade === 'yellow') return { p95Ms: 15, p99Ms: 20, droppedPct: 2 };
  return { p95Ms: 10, p99Ms: 12, droppedPct: 1 };
}

function fullFrame(grade: 'green' | 'yellow' | 'red') {
  const compact = frameFor(grade);
  return {
    frameCount: 900,
    dropped: compact.droppedPct * 9,
    droppedPct: compact.droppedPct,
    p50Ms: compact.p95Ms - 2,
    p95Ms: compact.p95Ms,
    p99Ms: compact.p99Ms,
    avgMs: compact.p95Ms - 1,
    minMs: 5,
    maxMs: compact.p99Ms,
    fpsAvg: 1000 / (compact.p95Ms - 1),
    gcSpikes: 0,
  };
}

export function makeQca0Report(
  value: ValidationManifest,
  grades: Array<'green' | 'yellow' | 'red'> = ['green', 'green', 'green', 'green', 'green']
) {
  let gradedIndex = 0;
  return {
    version: '2',
    profileName: 'qca0-row-addressable-knee-v1',
    xrActive: true,
    aborted: false,
    failure: null,
    thresholds: { ...LOAD_TEST_THRESHOLDS },
    device: {
      buildId: value.buildId,
      declaredDeviceTarget: 'META_QUEST_3S',
      identityBasis: 'adb-system-property',
      declaredFirmwareVersion: value.deviceIdentity?.buildIncremental,
      xr: { active: true },
    },
    collection: {
      rawFrameTraceIncluded: false,
      datasetRowsIncluded: false,
      cameraPosesIncluded: false,
    },
    steps: QCA0_TEST_STEPS.map((policy, index) => {
      const grade = policy.warmup ? 'green' : (grades[gradedIndex++] ?? 'green');
      const scale = [1, 1, 1.2, 1.5, 2.5, 3][index];
      return {
        spec: { topology: 'TABULAR', ...policy },
        frames: fullFrame(grade),
        frameCadence: fullFrame(grade),
        gpu: {
          drawCallsMax: 10 * scale,
          drawCallsAvg: 10 * scale,
          trianglesMax: 1_000 * scale,
          trianglesAvg: 1_000 * scale,
          pointsMax: 0,
          pointsAvg: 0,
          linesMax: 0,
          linesAvg: 0,
          geometriesMax: 1,
          texturesMax: 0,
        },
        heapDeltaBytes: null,
        memory: {
          jsHeapStartBytes: null,
          jsHeapPeakBytes: null,
          jsHeapEndBytes: null,
          jsHeapDeltaBytes: null,
          wasmStartBytes: null,
          wasmPeakBytes: null,
          wasmEndBytes: null,
          wasmDeltaBytes: null,
        },
        representation: {
          sourceRowCount: policy.rowCount,
          candidateId: 'MATRIX_FIELD',
          renderedNodeCount: policy.rowCount,
          representedSourceRows: null,
          renderedFraction: 1,
          semanticEmbodimentStatus: null,
          coverageMode: 'ROW_ADDRESSABLE',
          usefulRepresentation: true,
          sceneObjectCountStart: 10 * scale,
          sceneObjectCountEnd: 10 * scale,
          sceneObjectCountDelta: 0,
          visibleSceneObjectCountStart: 10 * scale,
          visibleSceneObjectCountEnd: 10 * scale,
          visibleSceneObjectCountDelta: 0,
          geometry: 'INSTANCED_POINT_CLOUD',
          layout: 'GRID_3D',
          governorLodScaleMinimum: 1,
          governorLodScaleFinal: 1,
          governorThrottleEvents: index,
        },
        sustainedPerformance: {
          supported: false,
          cpuLevelStart: null,
          cpuLevelMinimum: null,
          cpuLevelEnd: null,
          gpuLevelStart: null,
          gpuLevelMinimum: null,
          gpuLevelEnd: null,
        },
        loadDurationMs: [100, 100, 120, 1_000, 2_000, 3_000][index],
        criticalViolations: 0,
        warnings: 0,
        errors: 0,
        specGeometry: 'INSTANCED_POINT_CLOUD',
        specLayout: 'GRID_3D',
        grade,
        reasons: [],
      };
    }),
  };
}
