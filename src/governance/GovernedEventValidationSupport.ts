import type {
  GovernanceValidationIssue,
  ImmutableReferenceV1,
  JsonValue,
} from './GovernedEventContracts.ts';

export const DIGEST_KEYS = ['algorithm', 'value'] as const;
export const PLACEHOLDER = /^(?:unknown|undefined|null|n\/?a|dev|development|placeholder|latest)$/i;
export const SHA256_HEX = /^[0-9a-f]{64}$/;
export const UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export function isRecord(
  value: JsonValue | undefined
): value is Readonly<Record<string, JsonValue>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

export function exactKeys(
  value: Readonly<Record<string, JsonValue>>,
  expected: readonly string[],
  path: string,
  issues: GovernanceValidationIssue[]
): void {
  const allowed = new Set(expected);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      issues.push({
        code: 'UNKNOWN_PROPERTY',
        path: path ? `${path}.${key}` : key,
        message: 'property is not allowed',
      });
    }
  }
  for (const key of expected) {
    if (!Object.hasOwn(value, key)) {
      issues.push({
        code: 'MISSING_PROPERTY',
        path: path ? `${path}.${key}` : key,
        message: 'property is required',
      });
    }
  }
}

export function nonEmptyString(
  value: JsonValue | undefined,
  path: string,
  issues: GovernanceValidationIssue[],
  maxLength = 256,
  rejectPlaceholder = false
): value is string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > maxLength) {
    issues.push({
      code: 'INVALID_STRING',
      path,
      message: `must be a non-empty string of at most ${maxLength} code units`,
    });
    return false;
  }
  if (rejectPlaceholder && PLACEHOLDER.test(value.trim())) {
    issues.push({ code: 'PLACEHOLDER_VALUE', path, message: 'placeholder values are forbidden' });
    return false;
  }
  return true;
}

export function isValidUtcTimestamp(value: string): boolean {
  if (!UTC_TIMESTAMP.test(value)) return false;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
}

export function validTimestamp(
  value: JsonValue | undefined,
  path: string,
  issues: GovernanceValidationIssue[]
): value is string {
  if (typeof value !== 'string' || !isValidUtcTimestamp(value)) {
    issues.push({
      code: 'INVALID_TIMESTAMP',
      path,
      message: 'must be a valid millisecond-precision UTC timestamp',
    });
    return false;
  }
  return true;
}

export function validateSha256Digest(
  value: JsonValue | undefined,
  path: string,
  issues: GovernanceValidationIssue[]
): boolean {
  if (!isRecord(value)) {
    issues.push({ code: 'INVALID_DIGEST', path, message: 'must be a SHA-256 digest object' });
    return false;
  }
  exactKeys(value, DIGEST_KEYS, path, issues);
  if (value.algorithm !== 'SHA256') {
    issues.push({ code: 'INVALID_DIGEST', path: `${path}.algorithm`, message: 'must be SHA256' });
  }
  if (typeof value.value !== 'string' || !SHA256_HEX.test(value.value)) {
    issues.push({
      code: 'INVALID_DIGEST',
      path: `${path}.value`,
      message: 'must be 64 lowercase hexadecimal characters',
    });
  }
  return (
    value.algorithm === 'SHA256' && typeof value.value === 'string' && SHA256_HEX.test(value.value)
  );
}

export function validateImmutableReference(
  value: JsonValue | undefined,
  path: string,
  issues: GovernanceValidationIssue[]
): boolean {
  if (!isRecord(value)) {
    issues.push({
      code: 'INVALID_REFERENCE',
      path,
      message: 'must be an immutable reference object',
    });
    return false;
  }
  exactKeys(value, ['schemaVersion', 'id', 'version', 'digest'], path, issues);
  if (value.schemaVersion !== '1') {
    issues.push({
      code: 'INVALID_REFERENCE',
      path: `${path}.schemaVersion`,
      message: 'unsupported reference version',
    });
  }
  const idOk = nonEmptyString(value.id, `${path}.id`, issues);
  const versionOk = nonEmptyString(value.version, `${path}.version`, issues, 128, true);
  const digestOk = validateSha256Digest(value.digest, `${path}.digest`, issues);
  return value.schemaVersion === '1' && idOk && versionOk && digestOk;
}

export function immutableReferencesEqual(
  left: ImmutableReferenceV1,
  right: ImmutableReferenceV1
): boolean {
  return (
    left.schemaVersion === right.schemaVersion &&
    left.id === right.id &&
    left.version === right.version &&
    left.digest.algorithm === right.digest.algorithm &&
    left.digest.value === right.digest.value
  );
}
