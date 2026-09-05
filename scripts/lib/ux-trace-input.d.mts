export const UX_TRACE_EXPORT_SCHEMA_VERSION: 1;
export const UX_TRACE_INTEGRITY_ALGORITHM: 'NEMOSYNE_CANONICAL_JSON_SHA256_V1';
export const UX_TRACE_APP_EXPORT_SCHEMA_VERSION: 2;
export const UX_TRACE_APP_INTEGRITY_ALGORITHM: 'NEMOSYNE_UX_TRACE_ENVELOPE_SHA256_V2';

export class UXTraceInputError extends Error {}

export interface ParsedUXTraceInput {
  records: Array<Record<string, any>>;
  format:
    | 'envelope-v2'
    | 'envelope-v1'
    | 'legacy-envelope'
    | 'json-array'
    | 'json-record'
    | 'jsonl';
  envelope: Record<string, any> | null;
  /** True only when the complete evidence-bearing envelope is authenticated. */
  integrityVerified: boolean;
  /** True when at least the exact emitted record array is authenticated. */
  recordIntegrityVerified: boolean;
  integrityScope: 'none' | 'records' | 'envelope';
}

export function canonicalJsonStringify(value: unknown, seen?: WeakSet<object>): string;
export function canonicalSha256Hex(value: unknown): string;
export function parseUXTraceText(
  text: string,
  options?: { source?: string }
): ParsedUXTraceInput;
