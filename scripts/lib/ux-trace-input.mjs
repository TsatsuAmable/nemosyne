import { createHash } from 'node:crypto';

export const UX_TRACE_EXPORT_SCHEMA_VERSION = 1;
export const UX_TRACE_INTEGRITY_ALGORITHM = 'NEMOSYNE_CANONICAL_JSON_SHA256_V1';
export const UX_TRACE_APP_EXPORT_SCHEMA_VERSION = 2;
export const UX_TRACE_APP_INTEGRITY_ALGORITHM = 'NEMOSYNE_UX_TRACE_ENVELOPE_SHA256_V2';

export class UXTraceInputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UXTraceInputError';
  }
}

/** Deterministic JSON serialization matching src/security/CryptoHash.ts. */
export function canonicalJsonStringify(value, seen = new WeakSet()) {
  if (value === undefined || value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return 'null';
    return Object.is(value, -0) ? '0' : JSON.stringify(value);
  }
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'bigint' || typeof value === 'symbol' || typeof value === 'function') {
    throw new TypeError(`Cannot canonically serialize value of type ${typeof value}`);
  }
  if (typeof value === 'object') {
    if (seen.has(value)) throw new TypeError('Cannot canonically serialize cyclical object structure');
    seen.add(value);
    try {
      if (Array.isArray(value)) {
        return `[${value.map((entry) => canonicalJsonStringify(entry, seen)).join(',')}]`;
      }
      const pairs = Object.keys(value)
        .sort()
        .filter(
          (key) =>
            value[key] !== undefined &&
            typeof value[key] !== 'function' &&
            typeof value[key] !== 'symbol'
        )
        .map((key) => `${JSON.stringify(key)}:${canonicalJsonStringify(value[key], seen)}`);
      return `{${pairs.join(',')}}`;
    } finally {
      seen.delete(value);
    }
  }
  return JSON.stringify(value);
}

export function canonicalSha256Hex(value) {
  return createHash('sha256').update(canonicalJsonStringify(value), 'utf8').digest('hex');
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateRecord(record, source, index) {
  if (!isObject(record)) {
    throw new UXTraceInputError(`${source}: record ${index} is not an object`);
  }
  if (typeof record.sid !== 'string' || record.sid.length === 0) {
    throw new UXTraceInputError(`${source}: record ${index} has no valid sid`);
  }
  if (typeof record.t !== 'number' || !Number.isFinite(record.t)) {
    throw new UXTraceInputError(`${source}: record ${index} has no finite numeric t`);
  }
  if (typeof record.type !== 'string' || record.type.length === 0) {
    throw new UXTraceInputError(`${source}: record ${index} has no valid type`);
  }
  if (record.seq !== undefined && (!Number.isInteger(record.seq) || record.seq < 1)) {
    throw new UXTraceInputError(`${source}: record ${index} has invalid seq`);
  }
  return record;
}

function validateRecordStream(records, source, expectedSid = null) {
  const validated = records.map((record, index) => validateRecord(record, source, index));
  const previousSeqBySid = new Map();
  for (let i = 0; i < validated.length; i += 1) {
    const record = validated[i];
    if (expectedSid && record.sid !== expectedSid) {
      throw new UXTraceInputError(
        `${source}: record ${i} sid ${record.sid} does not match envelope sid ${expectedSid}`
      );
    }
    if (typeof record.seq === 'number') {
      const previousSeq = previousSeqBySid.get(record.sid);
      if (previousSeq !== undefined && record.seq <= previousSeq) {
        throw new UXTraceInputError(
          `${source}: record sequence for sid ${record.sid} is not strictly increasing at index ${i}`
        );
      }
      previousSeqBySid.set(record.sid, record.seq);
    }
  }
  return validated;
}

function validateEnvelopeShape(envelope, records, source) {
  if (!Number.isInteger(envelope.recordCount) || envelope.recordCount !== records.length) {
    throw new UXTraceInputError(
      `${source}: recordCount ${String(envelope.recordCount)} does not match records.length ${records.length}`
    );
  }
  if (!Number.isInteger(envelope.droppedCount) || envelope.droppedCount < 0) {
    throw new UXTraceInputError(`${source}: droppedCount must be a non-negative integer`);
  }

  const firstSeq = records.length > 0 && typeof records[0].seq === 'number' ? records[0].seq : null;
  const lastSeq =
    records.length > 0 && typeof records[records.length - 1].seq === 'number'
      ? records[records.length - 1].seq
      : null;
  if (envelope.firstSeq !== firstSeq || envelope.lastSeq !== lastSeq) {
    throw new UXTraceInputError(
      `${source}: envelope sequence range ${String(envelope.firstSeq)}..${String(envelope.lastSeq)} does not match records ${String(firstSeq)}..${String(lastSeq)}`
    );
  }
}

function validateOptionalAttribution(envelope, source) {
  if (envelope.buildHash !== undefined && (typeof envelope.buildHash !== 'string' || envelope.buildHash.length === 0)) {
    throw new UXTraceInputError(`${source}: buildHash must be a non-empty string when present`);
  }
  if (envelope.validationSession !== undefined) {
    if (
      !isObject(envelope.validationSession) ||
      typeof envelope.validationSession.label !== 'string' ||
      envelope.validationSession.label.length === 0 ||
      typeof envelope.validationSession.id !== 'string' ||
      envelope.validationSession.id.length === 0
    ) {
      throw new UXTraceInputError(`${source}: validationSession must contain non-empty label and id strings`);
    }
  }
}

function verifyV1RecordsIntegrity(envelope, records, source) {
  if (!isObject(envelope.integrity)) {
    throw new UXTraceInputError(`${source}: versioned trace envelope requires integrity metadata`);
  }
  if (envelope.integrity.algorithm !== UX_TRACE_INTEGRITY_ALGORITHM) {
    throw new UXTraceInputError(
      `${source}: unsupported v1 integrity algorithm ${String(envelope.integrity.algorithm)}`
    );
  }
  if (!/^[0-9a-f]{64}$/.test(envelope.integrity.recordsSha256 ?? '')) {
    throw new UXTraceInputError(`${source}: integrity.recordsSha256 must be 64 lowercase hex characters`);
  }
  const actualDigest = canonicalSha256Hex(records);
  if (actualDigest !== envelope.integrity.recordsSha256) {
    throw new UXTraceInputError(
      `${source}: trace record digest mismatch (expected ${envelope.integrity.recordsSha256}, computed ${actualDigest})`
    );
  }
}

function verifyV2EnvelopeIntegrity(envelope, source) {
  if (!isObject(envelope.integrity)) {
    throw new UXTraceInputError(`${source}: v2 trace envelope requires integrity metadata`);
  }
  if (envelope.integrity.algorithm !== UX_TRACE_APP_INTEGRITY_ALGORITHM) {
    throw new UXTraceInputError(
      `${source}: unsupported v2 integrity algorithm ${String(envelope.integrity.algorithm)}`
    );
  }
  if (!/^[0-9a-f]{64}$/.test(envelope.integrity.payloadSha256 ?? '')) {
    throw new UXTraceInputError(`${source}: integrity.payloadSha256 must be 64 lowercase hex characters`);
  }

  const { integrity: _integrity, ...payload } = envelope;
  const actualDigest = canonicalSha256Hex(payload);
  if (actualDigest !== envelope.integrity.payloadSha256) {
    throw new UXTraceInputError(
      `${source}: trace envelope digest mismatch (expected ${envelope.integrity.payloadSha256}, computed ${actualDigest})`
    );
  }
}

function normalizeEnvelope(envelope, source) {
  if (!Array.isArray(envelope.records)) {
    throw new UXTraceInputError(`${source}: trace envelope records must be an array`);
  }

  const schemaVersion = envelope.schemaVersion;
  const isVersioned = schemaVersion !== undefined;
  if (
    isVersioned &&
    schemaVersion !== UX_TRACE_EXPORT_SCHEMA_VERSION &&
    schemaVersion !== UX_TRACE_APP_EXPORT_SCHEMA_VERSION
  ) {
    throw new UXTraceInputError(
      `${source}: unsupported trace envelope schemaVersion ${String(schemaVersion)}`
    );
  }

  const expectedSid = typeof envelope.sid === 'string' && envelope.sid.length > 0 ? envelope.sid : null;
  if (isVersioned && !expectedSid) {
    throw new UXTraceInputError(`${source}: versioned trace envelope requires sid`);
  }

  const records = validateRecordStream(envelope.records, source, expectedSid);

  if (!isVersioned) {
    return {
      records,
      format: 'legacy-envelope',
      envelope,
      integrityVerified: false,
      recordIntegrityVerified: false,
      integrityScope: 'none',
    };
  }

  validateEnvelopeShape(envelope, records, source);
  validateOptionalAttribution(envelope, source);

  if (schemaVersion === UX_TRACE_EXPORT_SCHEMA_VERSION) {
    verifyV1RecordsIntegrity(envelope, records, source);
    return {
      records,
      format: 'envelope-v1',
      envelope,
      // V1 authenticates records only. Attribution/build/drop metadata is not
      // covered by the digest and therefore must not be called fully verified.
      integrityVerified: false,
      recordIntegrityVerified: true,
      integrityScope: 'records',
    };
  }

  verifyV2EnvelopeIntegrity(envelope, source);
  return {
    records,
    format: 'envelope-v2',
    envelope,
    integrityVerified: true,
    recordIntegrityVerified: true,
    integrityScope: 'envelope',
  };
}

function unverifiedResult(records, format, envelope = null) {
  return {
    records,
    format,
    envelope,
    integrityVerified: false,
    recordIntegrityVerified: false,
    integrityScope: 'none',
  };
}

function normalizeJsonValue(value, source) {
  if (Array.isArray(value)) {
    return unverifiedResult(validateRecordStream(value, source), 'json-array');
  }
  if (isObject(value) && Array.isArray(value.records)) {
    return normalizeEnvelope(value, source);
  }
  if (isObject(value)) {
    return unverifiedResult(validateRecordStream([value], source), 'json-record');
  }
  throw new UXTraceInputError(`${source}: top-level JSON must be a record, record array, or trace envelope`);
}

/**
 * Parse UX trace input from either:
 * - dev JSONL (one record per line),
 * - JSONL batches/envelopes containing records[],
 * - legacy production export envelopes from PR #674,
 * - v1 records-only integrity envelopes,
 * - v2 whole-envelope integrity exports from application composition.
 *
 * Malformed/truncated input is rejected explicitly. Evidence is never silently
 * repaired by dropping invalid lines or records.
 */
export function parseUXTraceText(text, { source = 'UX trace input' } = {}) {
  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new UXTraceInputError(`${source}: input is empty`);
  }
  const trimmed = text.trim();

  try {
    return normalizeJsonValue(JSON.parse(trimmed), source);
  } catch (error) {
    if (error instanceof UXTraceInputError) throw error;
  }

  const lines = trimmed.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const records = [];
  for (let i = 0; i < lines.length; i += 1) {
    let value;
    try {
      value = JSON.parse(lines[i]);
    } catch (error) {
      throw new UXTraceInputError(
        `${source}: malformed or truncated JSON at line ${i + 1}: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    if (isObject(value) && Array.isArray(value.records)) {
      const normalized = normalizeEnvelope(value, `${source} line ${i + 1}`);
      records.push(...normalized.records);
    } else if (Array.isArray(value)) {
      records.push(...validateRecordStream(value, `${source} line ${i + 1}`));
    } else {
      records.push(validateRecord(value, `${source} line ${i + 1}`, 0));
    }
  }

  return unverifiedResult(validateRecordStream(records, source), 'jsonl');
}
