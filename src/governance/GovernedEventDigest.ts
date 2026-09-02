import { sha256Hex } from '../security/CryptoHash.ts';
import type {
  GovernedEventContentDigestV1,
  GovernedEventEnvelopeV1,
  GovernedPayloadDigestV1,
  JsonValue,
} from './GovernedEventContracts.ts';

export const GOVERNED_PAYLOAD_DIGEST_DOMAIN_V1 = 'nemosyne:governed-payload:v1\n';
export const GOVERNED_EVENT_CONTENT_DIGEST_DOMAIN_V1 = 'nemosyne:governed-event-content:v1\n';

function hasUnpairedSurrogate(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (index + 1 >= value.length || next < 0xdc00 || next > 0xdfff) return true;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return true;
    }
  }
  return false;
}

/** Canonical JSON for trusted, already-decoded values. Hostile input must use the text parser. */
export function canonicalGovernedJsonV1(value: JsonValue, seen = new WeakSet<object>()): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isFinite(value))
      throw new TypeError('Governed canonical JSON requires finite numbers');
    return Object.is(value, -0) ? '0' : JSON.stringify(value);
  }
  if (typeof value === 'string') {
    if (hasUnpairedSurrogate(value)) {
      throw new TypeError('Governed canonical JSON forbids unpaired UTF-16 surrogates');
    }
    return JSON.stringify(value);
  }
  if (typeof value !== 'object')
    throw new TypeError('Governed canonical JSON received a non-JSON value');
  if (seen.has(value)) throw new TypeError('Governed canonical JSON forbids cyclical values');
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      const keys = Object.keys(value);
      if (keys.length !== value.length || keys.some((key, index) => key !== String(index))) {
        throw new TypeError('Governed canonical JSON forbids sparse or extended arrays');
      }
      return `[${value.map((entry) => canonicalGovernedJsonV1(entry, seen)).join(',')}]`;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError('Governed canonical JSON requires plain objects');
    }
    const record = value as Readonly<Record<string, JsonValue>>;
    const keys = Reflect.ownKeys(record);
    if (keys.some((key) => typeof key === 'symbol')) {
      throw new TypeError('Governed canonical JSON forbids symbol keys');
    }
    for (const key of keys as string[]) {
      if (hasUnpairedSurrogate(key)) {
        throw new TypeError('Governed canonical JSON forbids unpaired UTF-16 surrogates');
      }
      const descriptor = Object.getOwnPropertyDescriptor(record, key);
      if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
        throw new TypeError('Governed canonical JSON requires enumerable data properties');
      }
    }
    return `{${(keys as string[])
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalGovernedJsonV1(record[key], seen)}`)
      .join(',')}}`;
  } finally {
    seen.delete(value);
  }
}

export function governedPayloadPreimageV1(payload: JsonValue): string {
  return `${GOVERNED_PAYLOAD_DIGEST_DOMAIN_V1}${canonicalGovernedJsonV1(payload)}`;
}

export function computeGovernedPayloadDigestV1(payload: JsonValue): GovernedPayloadDigestV1 {
  return {
    algorithm: 'NEMOSYNE_CANONICAL_JSON_SHA256_V1',
    value: sha256Hex(governedPayloadPreimageV1(payload)),
  };
}

export function canonicalGovernedPayloadByteLengthV1(payload: JsonValue): number {
  return new TextEncoder().encode(canonicalGovernedJsonV1(payload)).byteLength;
}

export function governedEventContentPreimageV1(
  content: Omit<GovernedEventEnvelopeV1, 'contentDigest'>
): string {
  return `${GOVERNED_EVENT_CONTENT_DIGEST_DOMAIN_V1}${canonicalGovernedJsonV1(content as unknown as JsonValue)}`;
}

export function computeGovernedEventContentDigestV1(
  content: Omit<GovernedEventEnvelopeV1, 'contentDigest'>
): GovernedEventContentDigestV1 {
  return {
    algorithm: 'NEMOSYNE_GOVERNED_EVENT_SHA256_V1',
    value: sha256Hex(governedEventContentPreimageV1(content)),
  };
}
