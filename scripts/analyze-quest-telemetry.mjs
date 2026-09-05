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
    return raw
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line, index) => {
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

function validPhysicalIdentityBasis(value) {
  return value === 'adb-system-property' || value === 'investigator-declared';
}

function validateQuestReport(report, source) {
  const issues = [];
  if (!report || typeof report !== 'object' || Array.isArray(report)) issues.push('expected object');
  if (report?.version !== '2') issues.push('version must be 2');
  if (report?.profileName !== 'quest-3s-qualification') issues.push('unexpected profileName');
  if (report?.xrActive !== true) issues.push('xrActive must be true');
  if (report?.device?.declaredDeviceTarget !== 'META_QUEST_3S')
    issues.push('device target must be META_QUEST_3S');
  if (!validPhysicalIdentityBasis(report?.device?.identityBasis))
    issues.push('device identity basis must be adb-system-property or investigator-declared');
  if (!Array.isArray(report?.steps) || report.steps.length === 0) issues.push('steps must be non-empty');
  if (report?.collection?.rawFrameTraceIncluded !== false) issues.push('raw frame trace policy missing');
  if (report?.collection?.datasetRowsIncluded !== false) issues.push('dataset row policy missing');
  if (report?.collection?.cameraPosesIncluded !== false) issues.push('camera pose policy missing');
  return issues.map((issue) => `${source}: ${issue}`);
}

function validateBoundaryReport(report, source) {
  const issues = [];
  if (!report || typeof report !== 'object' || Array.isArray(report)) issues.push('expected object');
  if (report?.version !== '1') issues.push('version must be 1');
  if (report?.profileName !== 'quest-3s-rust-boundary-10m') issues.push('unexpected profileName');
  if (report?.xrActive !== true) issues.push('xrActive must be true');
  if (report?.device?.declaredDeviceTarget !== 'META_QUEST_3S')
    issues.push('device target must be META_QUEST_3S');
  if (!validPhysicalIdentityBasis(report?.device?.identityBasis))
    issues.push('device identity basis must be adb-system-property or investigator-declared');
  if (report?.scenario?.rows !== 10_000_000) issues.push('scenario must contain 10M rows');
  if (!['completed', 'failed', 'aborted'].includes(report?.outcome?.status)) issues.push('outcome status missing');
  if (report?.qualification?.deviceQualifiedAt10m !== false) issues.push('device qualification must remain false');
  if (report?.qualification?.promotionBlockedByAudits !== true) issues.push('pre-P1 audit gate missing');
  if (report?.collection?.rawFrameTraceIncluded !== false) issues.push('raw frame trace policy missing');
  if (report?.collection?.datasetRowsIncluded !== false) issues.push('dataset row policy missing');
  if (report?.collection?.cameraPosesIncluded !== false) issues.push('camera pose policy missing');
  if (report?.outcome?.status === 'completed') {
    if (report?.evidence?.structureProfileRowCount !== 10_000_000) issues.push('10M profile evidence missing');
    if (report?.evidence?.rowMaterialisations !== 0) issues.push('row materialisation detected');
    if (report?.evidence?.checksumParity !== true) issues.push('borrowed-scan checksum parity missing');
  }
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
    maximumSustainedP95DriftPercent: maximum(steps.map((step) => step.sustainedPerformance?.p95DriftPercent)),
    sustainedPerformanceClassifications: thermalClasses,
    minimumGovernorLodScale: minimum(steps.map((step) => step.representation?.governorLodScaleMinimum)),
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

function summarizeBoundaryGroup(reports) {
  return {
    runCount: reports.length,
    completedRunCount: reports.filter((report) => report.outcome?.status === 'completed').length,
    failedRunCount: reports.filter((report) => report.outcome?.status === 'failed').length,
    abortedRunCount: reports.filter((report) => report.outcome?.status === 'aborted').length,
    evidencePathAvailableRunCount: reports.filter(
      (report) => report.qualification?.evidencePathAvailableAt10m === true
    ).length,
    deviceQualifiedAt10m: false,
    promotionBlockedByAudits: true,
    maximumPayloadBuildMs: maximum(reports.map((report) => report.timings?.payloadBuildMs)),
    maximumHostAllocationAndCopyMs: maximum(reports.map((report) => report.timings?.hostAllocationAndCopyMs)),
    maximumRustLoadMs: maximum(reports.map((report) => report.timings?.rustLoadMs)),
    maximumFingerprintMs: maximum(reports.map((report) => report.timings?.fingerprintMs)),
    maximumStructureProfileMs: maximum(reports.map((report) => report.timings?.structureProfileMs)),
    maximumColdBorrowedScanMs: maximum(reports.map((report) => report.timings?.coldBorrowedScanMs)),
    maximumWarmBorrowedScanMs: maximum(reports.map((report) => report.timings?.warmBorrowedScanMs)),
    maximumFrameGapMs: maximum(reports.map((report) => report.maximumFrameGapMs)),
    maximumWasmAfterLoadBytes: maximum(reports.map((report) => report.memory?.wasmAfterLoadBytes)),
    maximumRetainedWasmGrowthBytes: maximum(reports.map((report) => report.memory?.retainedWasmGrowthBytes)),
    maximumJsHeapPeakBytes: maximum(reports.map((report) => report.memory?.jsHeapPeakBytes)),
    totalVisibilityInterruptions: reports.reduce(
      (total, report) => total + (report.visibility?.interruptionCount ?? 0),
      0
    ),
    failurePhases: reports
      .filter((report) => report.outcome?.status !== 'completed')
      .map((report) => report.outcome?.failurePhase ?? 'unknown'),
  };
}

function groupReports(reports, summarize) {
  const groups = new Map();
  for (const { report } of reports) {
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
  return Object.fromEntries([...groups].map(([key, group]) => [key, summarize(group)]));
}

export function analyzeQuestTelemetry(filePaths) {
  const candidates = filePaths.flatMap((filePath) =>
    readReports(filePath).map((report, index) => ({ report, source: `${filePath}#${index + 1}` }))
  );
  const quest = candidates.filter(({ report }) => report?.profileName === 'quest-3s-qualification');
  const boundary = candidates.filter(({ report }) => report?.profileName === 'quest-3s-rust-boundary-10m');
  const validationErrors = [
    ...quest.flatMap(({ report, source }) => validateQuestReport(report, source)),
    ...boundary.flatMap(({ report, source }) => validateBoundaryReport(report, source)),
  ];
  const valid = quest.filter(({ report, source }) => validateQuestReport(report, source).length === 0);
  const validBoundary = boundary.filter(
    ({ report, source }) => validateBoundaryReport(report, source).length === 0
  );
  return {
    schemaVersion: 2,
    inputReportCount: candidates.length,
    questReportCount: quest.length,
    validQuestReportCount: valid.length,
    boundaryReportCount: boundary.length,
    validBoundaryReportCount: validBoundary.length,
    validationErrors,
    groups: groupReports(valid, summarizeGroup),
    boundaryGroups: groupReports(validBoundary, summarizeBoundaryGroup),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const filePaths = process.argv.slice(2);
  const inputs = filePaths.length > 0 ? filePaths : ['logs/loadtest-results.jsonl'];
  const result = analyzeQuestTelemetry(inputs);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.questReportCount + result.boundaryReportCount === 0 || result.validationErrors.length > 0) {
    process.exitCode = 1;
  }
}
