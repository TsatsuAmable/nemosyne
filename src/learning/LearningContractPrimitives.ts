import {
  RUNTIME_COMPONENTS,
  type ImmutableReferenceV1,
  type RuntimeComponentReferenceV1,
  type RuntimeProvenanceV1,
  type Sha256DigestV1,
} from '../governance/GovernedEventContracts.ts';

export const LEARNING_SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:+-]{0,159}$/;
export const LEARNING_STABLE_VERSION = /^[0-9A-Za-z][0-9A-Za-z._+-]{0,63}$/;
export const LEARNING_SHA256_HEX = /^[0-9a-f]{64}$/;
export const LEARNING_UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export function deepFreezeLearning<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreezeLearning(child);
  }
  return value;
}

export function isLearningUtcTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || !LEARNING_UTC_TIMESTAMP.test(value)) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}

export function isSha256DigestV1(value: unknown): value is Sha256DigestV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Readonly<Record<string, unknown>>;
  return candidate.algorithm === 'SHA256' &&
    typeof candidate.value === 'string' &&
    LEARNING_SHA256_HEX.test(candidate.value);
}

export function isImmutableReferenceV1(value: unknown): value is ImmutableReferenceV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Readonly<Record<string, unknown>>;
  return candidate.schemaVersion === '1' &&
    typeof candidate.id === 'string' && LEARNING_SAFE_ID.test(candidate.id) &&
    typeof candidate.version === 'string' && LEARNING_STABLE_VERSION.test(candidate.version) &&
    isSha256DigestV1(candidate.digest);
}

export function cloneImmutableReferenceV1(reference: ImmutableReferenceV1): ImmutableReferenceV1 {
  return {
    schemaVersion: '1',
    id: reference.id,
    version: reference.version,
    digest: { algorithm: 'SHA256', value: reference.digest.value },
  };
}

export function sameImmutableReferenceV1(left: ImmutableReferenceV1, right: ImmutableReferenceV1): boolean {
  return left.schemaVersion === right.schemaVersion &&
    left.id === right.id &&
    left.version === right.version &&
    left.digest.algorithm === right.digest.algorithm &&
    left.digest.value === right.digest.value;
}

export function immutableReferenceKeyV1(reference: ImmutableReferenceV1): string {
  return `${reference.id}@${reference.version}#${reference.digest.value}`;
}

export function exactObjectKeys(value: unknown, expected: readonly string[]): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value as Record<string, unknown>).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length &&
    actual.every((entry, index) => entry === sortedExpected[index]);
}

function isRuntimeComponentReferenceV1(value: unknown): value is RuntimeComponentReferenceV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Readonly<Record<string, unknown>>;
  return candidate.schemaVersion === '1' &&
    typeof candidate.componentId === 'string' && LEARNING_SAFE_ID.test(candidate.componentId) &&
    typeof candidate.version === 'string' && LEARNING_STABLE_VERSION.test(candidate.version) &&
    isSha256DigestV1(candidate.artifactDigest);
}

export function validateRuntimeProvenanceV1(runtime: RuntimeProvenanceV1): readonly string[] {
  const issues: string[] = [];
  if (!runtime || runtime.schemaVersion !== '1') return ['runtime.schemaVersion must equal 1'];
  if (!exactObjectKeys(runtime.components, RUNTIME_COMPONENTS)) {
    issues.push('runtime.components must contain the exact canonical runtime component keys');
  } else {
    for (const component of RUNTIME_COMPONENTS) {
      const reference = runtime.components[component];
      if (reference !== null && !isRuntimeComponentReferenceV1(reference)) {
        issues.push(`runtime.components.${component} must be null or an immutable runtime component reference`);
      }
    }
  }
  if (!runtime.randomSeeds || typeof runtime.randomSeeds !== 'object' || Array.isArray(runtime.randomSeeds)) {
    issues.push('runtime.randomSeeds must be an object');
  } else {
    for (const [name, value] of Object.entries(runtime.randomSeeds)) {
      if (!LEARNING_SAFE_ID.test(name) || !Number.isSafeInteger(value) || value < 0 || value > 0x7fffffff) {
        issues.push(`runtime.randomSeeds.${name} must be a bounded non-negative 31-bit integer`);
      }
    }
  }
  return issues;
}
