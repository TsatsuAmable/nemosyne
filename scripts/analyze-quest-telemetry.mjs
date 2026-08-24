import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function readReports(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return raw.split(/\r?\n/).filter(Boolean).map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`${filePath}:${index + 1}: ${error.message}`);
      }
    });
  }
}

function finiteValues(values) {
  return values.filter((value) => typeof value === 'number' && Number.isFinite(value));
}

function maximum(values) {
  const finite = finiteValues(values);
  return finite.length > 0 ? Math.max(...finite) : null;
}

function minimum(values) {
  const finite = finiteValues(values);
  return finite.length > 0 ? Math.min(...finite) : null;
}

function validateQuestReport(report, source) {
  const issues = [];
  if (!report || typeof report !== 'object' || Array.isArray(report)) issues.push('expected object');
  if (report?.version !== '2') issues.push('version must be 2');
  if (report?.profileName !== 'quest-3s-qualification') issues.push('unexpected profileName');
  if (report?.xrActive !== true) issues.push('xrActive must be true');
  if (report?.device?.declaredDeviceTarget !== 'META_QUEST_3S') issues.push('device target must be META_QUEST_3S');
  if (report?.device?.identityBasis !== 'investigator-declared') issues.push('device identity must be investigator-declared');
  if (!Array.isArray(report?.steps) || report.steps.length === 0) issues.push('steps must be non-empty');
  if (report?.collection?.rawFrameTraceIncluded !== false) issues.push('raw frame trace policy missing');
  if (report?.collection?.datasetRowsIncluded !== false) issues.push('dataset row policy missing');
  if (report?.collection?.cameraPosesIncluded !== false) issues.push('camera pose policy missing');
  return issues.map((issue) => `${source}: ${issue}`);
}

function summarizeGroup(reports) {
  const steps = reports.flatMap((report) => report.steps);
  const thermalClasses = {};
  for (const step of steps) {
    const key = step.sustainedPerformance?.classification ?? 'missing';
    thermalClasses[key] = (thermalClasses[key] ?? 0) + 1;
  }
  return {
    runCount: reports.length,
    completedRunCount: reports.filter((report) => !report.aborted).length,
    xrActiveRunCount: reports.filter((report) => report.xrActive).length,
    browserIdentities: [...new Set(reports.map((report) => report.device?.userAgent ?? 'unknown'))],
    worstFrameCadenceP95Ms: maximum(steps.map((step) => step.frameCadence?.p95Ms)),
    worstFrameCadenceP99Ms: maximum(steps.map((step) => step.frameCadence?.p99Ms)),
    maximumDroppedFramePercent: maximum(steps.map((step) => step.frameCadence?.droppedPct)),
    maximumJsHeapPeakBytes: maximum(steps.map((step) => step.memory?.jsHeapPeakBytes)),
    maximumWasmPeakBytes: maximum(steps.map((step) => step.memory?.wasmPeakBytes)),
    maximumSustainedP95DriftPercent: maximum(
      steps.map((step) => step.sustainedPerformance?.p95DriftPercent)
    ),
    sustainedPerformanceClassifications: thermalClasses,
    minimumGovernorLodScale: minimum(
      steps.map((step) => step.representation?.governorLodScaleMinimum)
    ),
    minimumRenderedFraction: minimum(steps.map((step) => step.representation?.renderedFraction)),
    totalGovernorThrottleEvents: steps.reduce(
      (total, step) => total + (step.representation?.governorThrottleEvents ?? 0),
      0
    ),
    totalVisibilityInterruptions: reports.reduce(
      (total, report) => total + (report.visibility?.interruptionCount ?? 0),
      0
    ),
    missingJsHeapStepCount: steps.filter((step) => step.memory?.jsHeapPeakBytes == null).length,
    missingWasmMemoryStepCount: steps.filter((step) => step.memory?.wasmPeakBytes == null).length,
  };
}

export function analyzeQuestTelemetry(filePaths) {
  const candidates = filePaths.flatMap((filePath) =>
    readReports(filePath).map((report, index) => ({ report, source: `${filePath}#${index + 1}` }))
  );
  const quest = candidates.filter(({ report }) => report?.profileName === 'quest-3s-qualification');
  const validationErrors = quest.flatMap(({ report, source }) => validateQuestReport(report, source));
  const valid = quest.filter(({ report, source }) => validateQuestReport(report, source).length === 0);
  const groups = new Map();
  for (const { report } of valid) {
    const key = [
      report.device.declaredDeviceTarget,
      report.device.buildId ?? 'unknown-build',
      report.device.declaredFirmwareVersion ?? 'unknown-firmware',
      report.device.xr.nominalFrameRateHz ?? 'unknown-hz',
      report.device.userAgent,
    ].join(' | ');
    const group = groups.get(key) ?? [];
    group.push(report);
    groups.set(key, group);
  }
  return {
    schemaVersion: 1,
    inputReportCount: candidates.length,
    questReportCount: quest.length,
    validQuestReportCount: valid.length,
    validationErrors,
    groups: Object.fromEntries([...groups].map(([key, reports]) => [key, summarizeGroup(reports)])),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const filePaths = process.argv.slice(2);
  const inputs = filePaths.length > 0 ? filePaths : ['logs/loadtest-results.jsonl'];
  const result = analyzeQuestTelemetry(inputs);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.questReportCount === 0 || result.validationErrors.length > 0) process.exitCode = 1;
}
