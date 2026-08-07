/**
 * Analysis Review Bundle (ARB) builder.
 *
 * Produces a privacy-first, user-initiated export of telemetry, performance
 * violations, and optionally dataset/session metadata. The bundle is returned
 * as a plain JSON object so the caller can download it or let the user review
 * it before sharing. Nothing is transmitted automatically.
 *
 * Privacy levels:
 *   - telemetry-only: frame timings, errors, operation/gesture counts, active
 *     dataset name and topology.
 *   - metadata: above + column names/types, row count, session duration.
 *   - full-session: above + the full session snapshot (dataset rows, history).
 */

import type {
  AnalysisReviewBundle,
  PrivacyLevel,
  ReviewBundleColumnSchema,
  ReviewBundleOptions,
  TelemetryReport,
} from '../vr/coordinators/types.ts';

const VALID_PRIVACY_LEVELS: PrivacyLevel[] = ['telemetry-only', 'metadata', 'full-session'];

interface ErrorSnapshot {
  message: string;
  time: number;
  isWarning?: boolean;
}

interface DatasetLike {
  name?: string;
  columns?: Array<{ name?: string; type?: string } | string>;
  rows?: unknown[];
  rowCount?: number;
}

/**
 * Build an Analysis Review Bundle from the supplied collectors and optional
 * metadata. The bundle is local-only; no network call is made.
 */
export function buildReviewBundle({
  telemetryCollector,
  performanceBudget,
  appVersion = '1.0.0-alpha.1',
  privacyLevel = 'telemetry-only',
  userNotes,
  dataset,
  datasetTopology,
  sessionDurationSeconds,
  sessionSnapshot,
}: ReviewBundleOptions): AnalysisReviewBundle {
  if (!VALID_PRIVACY_LEVELS.includes(privacyLevel)) {
    throw new Error(`Invalid privacyLevel: ${privacyLevel}`);
  }
  if (!telemetryCollector || typeof telemetryCollector.getReport !== 'function') {
    throw new Error('buildReviewBundle requires a telemetryCollector with getReport()');
  }
  if (!performanceBudget || typeof performanceBudget.getViolations !== 'function') {
    throw new Error('buildReviewBundle requires a performanceBudget with getViolations()');
  }

  const rawTelemetry = telemetryCollector.getReport();
  const telemetry: TelemetryReport = {
    ...rawTelemetry,
    errors: {
      ...rawTelemetry.errors,
      last: rawTelemetry.errors.last ? sanitizeError(rawTelemetry.errors.last) : null,
    },
  };

  const bundle: AnalysisReviewBundle = {
    version: 1,
    generatedAt: Date.now(),
    appVersion,
    privacyLevel,
    telemetry,
    performance: performanceBudget.getViolations(),
  };

  if (privacyLevel === 'metadata' || privacyLevel === 'full-session') {
    bundle.metadata = buildMetadata({
      telemetry,
      dataset: dataset as DatasetLike | undefined,
      datasetTopology,
      sessionDurationSeconds,
    });
  }

  if (privacyLevel === 'full-session') {
    if (sessionSnapshot) {
      bundle.session = sessionSnapshot as Record<string, unknown>;
    }
  }

  if (userNotes !== undefined && userNotes !== null && String(userNotes).length > 0) {
    bundle.userNotes = String(userNotes);
  }

  return bundle;
}

/**
 * Strip potentially identifying or sensitive details from an error snapshot.
 * Keeps the message and warning flag, removes stack traces that may contain
 * local file paths or URLs.
 */
function sanitizeError(error: ErrorSnapshot): ErrorSnapshot {
  const message = String(error?.message ?? '');
  // Drop stack traces or any multi-line message that likely contains paths.
  const safeMessage = message.split('\n')[0].slice(0, 500);
  return {
    message: safeMessage,
    time: Number(error?.time ?? Date.now()),
    isWarning: !!error?.isWarning,
  };
}

interface MetadataBuildOptions {
  telemetry: TelemetryReport;
  dataset?: DatasetLike;
  datasetTopology?: string;
  sessionDurationSeconds?: number;
}

function buildMetadata({ telemetry, dataset, datasetTopology, sessionDurationSeconds }: MetadataBuildOptions) {
  const metadata = {
    datasetName: telemetry.session?.datasetName ?? dataset?.name ?? '-',
    datasetTopology: telemetry.session?.datasetTopology ?? datasetTopology ?? '-',
    rowCount: extractRowCount(dataset),
    columnSchema: extractColumnSchema(dataset),
    sessionDurationSeconds: sessionDurationSeconds ?? telemetry.session?.durationSeconds ?? 0,
    operations: { ...telemetry.operations },
    gestures: { ...telemetry.gestures },
  };
  return metadata;
}

function extractRowCount(dataset?: DatasetLike): number {
  if (!dataset) return 0;
  if (typeof dataset.rowCount === 'number') return dataset.rowCount;
  if (Array.isArray(dataset.rows)) return dataset.rows.length;
  return 0;
}

function extractColumnSchema(dataset?: DatasetLike): ReviewBundleColumnSchema[] {
  if (!dataset || !Array.isArray(dataset.columns)) return [];
  return dataset.columns.map((column) => {
    if (typeof column === 'string') return { name: column, type: 'UNKNOWN' };
    return {
      name: String(column?.name ?? ''),
      type: String(column?.type ?? 'UNKNOWN'),
    };
  });
}

/**
 * Format a bundle as an indented JSON string ready for download or review.
 */
export function formatReviewBundle(bundle: AnalysisReviewBundle): string {
  return JSON.stringify(bundle, null, 2);
}

// Re-export the default accessibility constant so callers can use it if they
// embed accessibility settings into a full-session snapshot.
export { DEFAULT_ACCESSIBILITY } from '../vr/coordinators/types.ts';
