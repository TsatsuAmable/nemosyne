export const UX_TRACE_EXPORT_SCHEMA_VERSION: 1;
export const UX_TRACE_INTEGRITY_ALGORITHM: 'NEMOSYNE_CANONICAL_JSON_SHA256_V1';

export class UXTraceInputError extends Error {}

export interface ParsedUXTraceInput {
  records: Array<Record<string, any>>;
  format: 'envelope-v1' | 'legacy-envelope' | 'json-array' | 'json-record' | 'jsonl';
  envelope: Record<string, any> | null;
  integrityVerified: boolean;
}

export function canonicalJsonStringify(value: unknown, seen?: WeakSet<object>): string;
export function canonicalSha256Hex(value: unknown): string;
export function parseUXTraceText(
  text: string,
  options?: { source?: string }
): ParsedUXTraceInput;
