/** Type declarations for `scripts/quest-evidence-status.mjs`. */

export declare const VALIDATION_LOG_ROOT: string;
export declare const GENERIC_SINK_FILE: string;
export declare const SESSION_RESULTS_FILE: string;
export declare const MAX_SESSIONS_SHOWN: number;

export interface EvidenceSessionFile {
  name: string;
  mtimeMs: number | null;
  sizeBytes: number | null;
}

export interface EvidenceSessionSummary {
  label: string;
  manifest: {
    buildId7: string | null;
    validationMode: string | null;
    gates: string[];
  } | null;
  disposition: { status: string | null; reasons: string[] } | null;
  files: EvidenceSessionFile[];
  resultsFile: EvidenceSessionFile | null;
  verdict: 'DELIVERED-TO-DISK' | 'NO-RESULTS' | 'NO-MANIFEST';
}

export interface GenericSinkSummary {
  exists: boolean;
  mtimeMs?: number;
  sizeBytes?: number;
  lastProfile?: string | null;
  lastRecordedAt?: string | null;
}

export interface EvidenceSummary {
  generatedAt: string;
  root: string;
  sessions: EvidenceSessionSummary[];
  generic: GenericSinkSummary;
  guidance: string[];
}

export declare function summarizeEvidence(root?: string): EvidenceSummary;
export declare function formatEvidenceReport(summary: EvidenceSummary): string;
