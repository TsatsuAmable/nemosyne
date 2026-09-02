import { BoundedJsonParseError, parseBoundedJsonV1 } from './BoundedJson.ts';
import { validatePayloadAgainstSchema } from './ClosedPayloadValidation.ts';
import {
  GOVERNED_DATA_CLASSES,
  GOVERNED_EVENT_ENVELOPE_VERSION,
  GOVERNED_PURPOSES,
  type AdmittedGovernedEventV1,
  type GovernedEventEnvelopeV1,
  type GovernedEventFamilyDefinitionV1,
  type GovernanceAdmissionAuthorityV1,
  type GovernanceAuthorityDecisionV1,
  type GovernanceValidationIssue,
  type JsonValue,
} from './GovernedEventContracts.ts';
import {
  validateAuthorization,
  validateDatasetReference,
  validateIdentityReferences,
  validateRetention,
  validateRuntime,
} from './GovernedEventContextValidation.ts';
import {
  canonicalGovernedJsonV1,
  canonicalGovernedPayloadByteLengthV1,
  computeGovernedEventContentDigestV1,
  computeGovernedPayloadDigestV1,
} from './GovernedEventDigest.ts';
import type { GovernedEventRegistryV1 } from './GovernedEventRegistry.ts';
import {
  DIGEST_KEYS,
  SHA256_HEX,
  deepFreeze,
  exactKeys,
  isRecord,
  isValidUtcTimestamp,
  nonEmptyString,
  validTimestamp,
} from './GovernedEventValidationSupport.ts';

const ENVELOPE_KEYS = [
  'schemaVersion',
  'eventFamilyId',
  'payloadSchemaVersion',
  'eventId',
  'streamId',
  'producerInstanceId',
  'streamSequence',
  'capturedAt',
  'sourceComponent',
  'mode',
  'purpose',
  'dataClasses',
  'effectiveSensitivity',
  'identities',
  'dataset',
  'runtime',
  'authorization',
  'retention',
  'payload',
  'payloadDigest',
  'contentDigest',
] as const;

const PURPOSE_VALUES = new Set<string>(Object.values(GOVERNED_PURPOSES));
const DATA_CLASS_VALUES = new Set<string>(Object.values(GOVERNED_DATA_CLASSES));

export type StructuralGovernedEventValidationResultV1 =
  | {
      readonly ok: true;
      readonly envelope: GovernedEventEnvelopeV1;
      readonly family: GovernedEventFamilyDefinitionV1;
    }
  | { readonly ok: false; readonly issues: readonly GovernanceValidationIssue[] };

export type GovernedEventAdmissionResultV1 =
  | { readonly ok: true; readonly value: AdmittedGovernedEventV1 }
  | { readonly ok: false; readonly issues: readonly GovernanceValidationIssue[] };

function createBoundedIssueCollector(maxIssues = 100): GovernanceValidationIssue[] {
  const issues: GovernanceValidationIssue[] = [];
  const append = issues.push.bind(issues);
  Object.defineProperty(issues, 'push', {
    value: (...entries: GovernanceValidationIssue[]) => {
      for (const entry of entries) {
        if (issues.length < maxIssues) append(entry);
        else if (issues.length === maxIssues) {
          append({
            code: 'VALIDATION_ISSUE_LIMIT',
            path: '$',
            message: `validation stopped reporting details after ${maxIssues} issues`,
          });
        }
      }
      return issues.length;
    },
  });
  return issues;
}

function validateFamilyCoordinates(
  record: Readonly<Record<string, JsonValue>>,
  registry: GovernedEventRegistryV1,
  issues: GovernanceValidationIssue[]
): GovernedEventFamilyDefinitionV1 | undefined {
  if (record.schemaVersion !== GOVERNED_EVENT_ENVELOPE_VERSION) {
    issues.push({
      code: 'UNSUPPORTED_ENVELOPE_VERSION',
      path: 'schemaVersion',
      message: 'unsupported governed envelope version',
    });
  }
  const familyId = record.eventFamilyId;
  if (!nonEmptyString(familyId, 'eventFamilyId', issues, 128)) return undefined;
  const family = registry.get(familyId);
  if (!family) {
    issues.push({
      code: 'UNKNOWN_EVENT_FAMILY',
      path: 'eventFamilyId',
      message: 'event family is not registered',
    });
    return undefined;
  }
  if (record.payloadSchemaVersion !== family.payloadSchemaVersion) {
    issues.push({
      code: 'PAYLOAD_VERSION_MISMATCH',
      path: 'payloadSchemaVersion',
      message: 'must match the registered payload schema version',
    });
  }
  return family;
}

function validateEnvelopeMetadata(
  record: Readonly<Record<string, JsonValue>>,
  family: GovernedEventFamilyDefinitionV1 | undefined,
  issues: GovernanceValidationIssue[]
): void {
  nonEmptyString(record.eventId, 'eventId', issues, 256);
  nonEmptyString(record.streamId, 'streamId', issues, 256);
  nonEmptyString(record.producerInstanceId, 'producerInstanceId', issues, 256);
  if (
    typeof record.streamSequence !== 'number' ||
    !Number.isSafeInteger(record.streamSequence) ||
    record.streamSequence < 0
  ) {
    issues.push({
      code: 'INVALID_STREAM_SEQUENCE',
      path: 'streamSequence',
      message: 'must be a non-negative safe integer',
    });
  }
  validTimestamp(record.capturedAt, 'capturedAt', issues);
  const source = record.sourceComponent;
  if (
    nonEmptyString(source, 'sourceComponent', issues, 256, true) &&
    family &&
    !family.allowedSourceComponents.includes(source)
  ) {
    issues.push({
      code: 'SOURCE_COMPONENT_MISMATCH',
      path: 'sourceComponent',
      message: 'source is not registered for this family',
    });
  }
  if (record.mode !== 'PRODUCT' && record.mode !== 'RESEARCH') {
    issues.push({ code: 'UNKNOWN_MODE', path: 'mode', message: 'must be PRODUCT or RESEARCH' });
  } else if (family && !family.allowedModes.includes(record.mode)) {
    issues.push({
      code: 'MODE_MISMATCH',
      path: 'mode',
      message: 'mode is not allowed by this family',
    });
  }
  if (typeof record.purpose !== 'string' || !PURPOSE_VALUES.has(record.purpose)) {
    issues.push({ code: 'UNKNOWN_PURPOSE', path: 'purpose', message: 'unknown governed purpose' });
  } else if (family && record.purpose !== family.purpose) {
    issues.push({
      code: 'PURPOSE_MISMATCH',
      path: 'purpose',
      message: 'must match the event family',
    });
  }
}

function validateClassification(
  record: Readonly<Record<string, JsonValue>>,
  family: GovernedEventFamilyDefinitionV1 | undefined,
  issues: GovernanceValidationIssue[]
): void {
  if (
    !Array.isArray(record.dataClasses) ||
    record.dataClasses.length === 0 ||
    !record.dataClasses.every((value) => typeof value === 'string' && DATA_CLASS_VALUES.has(value))
  ) {
    issues.push({
      code: 'INVALID_DATA_CLASSES',
      path: 'dataClasses',
      message: 'must be a non-empty array of known data classes',
    });
  } else {
    if (new Set(record.dataClasses).size !== record.dataClasses.length) {
      issues.push({
        code: 'DUPLICATE_DATA_CLASS',
        path: 'dataClasses',
        message: 'data classes must be unique',
      });
    }
    if (
      family &&
      canonicalGovernedJsonV1(record.dataClasses) !==
        canonicalGovernedJsonV1(family.dataClasses as JsonValue)
    ) {
      issues.push({
        code: 'DATA_CLASS_MISMATCH',
        path: 'dataClasses',
        message: 'must exactly match the registered family canonical order',
      });
    }
  }
  if (
    !['LOW', 'PSEUDONYMOUS', 'SENSITIVE', 'HIGHLY_SENSITIVE'].includes(
      String(record.effectiveSensitivity)
    )
  ) {
    issues.push({
      code: 'UNKNOWN_SENSITIVITY',
      path: 'effectiveSensitivity',
      message: 'unknown sensitivity',
    });
  } else if (family && record.effectiveSensitivity !== family.effectiveSensitivity) {
    issues.push({
      code: 'SENSITIVITY_MISMATCH',
      path: 'effectiveSensitivity',
      message: 'must equal the family-derived sensitivity',
    });
  }
}

function validatePayloadAndDigests(
  record: Readonly<Record<string, JsonValue>>,
  family: GovernedEventFamilyDefinitionV1 | undefined,
  issues: GovernanceValidationIssue[]
): void {
  if (family && Object.hasOwn(record, 'payload')) {
    validatePayloadAgainstSchema(record.payload, family.payloadSchema, 'payload', issues);
    const payloadBytes = canonicalGovernedPayloadByteLengthV1(record.payload);
    if (payloadBytes > family.maxPayloadBytes) {
      issues.push({
        code: 'PAYLOAD_TOO_LARGE',
        path: 'payload',
        message: `${payloadBytes} canonical bytes exceeds family maximum ${family.maxPayloadBytes}`,
      });
    }
  }
  if (!isRecord(record.payloadDigest)) {
    issues.push({
      code: 'INVALID_PAYLOAD_DIGEST',
      path: 'payloadDigest',
      message: 'must be a payload digest object',
    });
  } else {
    exactKeys(record.payloadDigest, DIGEST_KEYS, 'payloadDigest', issues);
    const expected = Object.hasOwn(record, 'payload')
      ? computeGovernedPayloadDigestV1(record.payload)
      : null;
    if (
      record.payloadDigest.algorithm !== 'NEMOSYNE_CANONICAL_JSON_SHA256_V1' ||
      typeof record.payloadDigest.value !== 'string' ||
      !SHA256_HEX.test(record.payloadDigest.value) ||
      record.payloadDigest.value !== expected?.value
    ) {
      issues.push({
        code: 'PAYLOAD_DIGEST_MISMATCH',
        path: 'payloadDigest',
        message: 'must match the domain-separated canonical payload digest',
      });
    }
  }
  if (!isRecord(record.contentDigest)) {
    issues.push({
      code: 'INVALID_CONTENT_DIGEST',
      path: 'contentDigest',
      message: 'must be a content digest object',
    });
  } else {
    exactKeys(record.contentDigest, DIGEST_KEYS, 'contentDigest', issues);
    if (
      record.contentDigest.algorithm !== 'NEMOSYNE_GOVERNED_EVENT_SHA256_V1' ||
      typeof record.contentDigest.value !== 'string' ||
      !SHA256_HEX.test(record.contentDigest.value)
    ) {
      issues.push({
        code: 'INVALID_CONTENT_DIGEST',
        path: 'contentDigest',
        message: 'must use the governed-event content digest algorithm',
      });
    }
  }
}

function validateEnvelopeRecord(
  record: Readonly<Record<string, JsonValue>>,
  registry: GovernedEventRegistryV1
): StructuralGovernedEventValidationResultV1 {
  const issues = createBoundedIssueCollector();
  exactKeys(record, ENVELOPE_KEYS, '', issues);
  const family = validateFamilyCoordinates(record, registry, issues);
  validateEnvelopeMetadata(record, family, issues);
  validateClassification(record, family, issues);
  validateIdentityReferences(record.identities, family, issues);
  if (record.dataset !== null) validateDatasetReference(record.dataset, 'dataset', issues);
  if (family?.datasetRequirement === 'REQUIRED' && record.dataset === null) {
    issues.push({
      code: 'MISSING_DATASET_REFERENCE',
      path: 'dataset',
      message: 'required by event family',
    });
  }
  if (family?.datasetRequirement === 'FORBIDDEN' && record.dataset !== null) {
    issues.push({
      code: 'FORBIDDEN_DATASET_REFERENCE',
      path: 'dataset',
      message: 'forbidden by event family',
    });
  }
  validateRuntime(record.runtime, family, issues);
  validateAuthorization(record.authorization, family, issues);
  validateRetention(record.retention, family, issues);
  validatePayloadAndDigests(record, family, issues);
  if (issues.length > 0 || !family) {
    return deepFreeze({ ok: false, issues: deepFreeze(issues) });
  }

  const envelope = record as unknown as GovernedEventEnvelopeV1;
  const content = { ...(envelope as unknown as Record<string, JsonValue>) };
  delete content.contentDigest;
  const expected = computeGovernedEventContentDigestV1(
    content as unknown as Omit<GovernedEventEnvelopeV1, 'contentDigest'>
  );
  if (envelope.contentDigest.value !== expected.value) {
    return deepFreeze({
      ok: false,
      issues: deepFreeze([
        {
          code: 'CONTENT_DIGEST_MISMATCH',
          path: 'contentDigest',
          message: 'must bind every semantic envelope field',
        },
      ]),
    });
  }
  return deepFreeze({ ok: true, envelope: deepFreeze(envelope), family });
}

/** Structurally validate bounded hostile wire JSON; this is not current consent/policy authority. */
export function validateGovernedEventEnvelopeV1(
  jsonText: string,
  registry: GovernedEventRegistryV1
): StructuralGovernedEventValidationResultV1 {
  let parsed: JsonValue;
  try {
    parsed = parseBoundedJsonV1(jsonText, {
      maxUtf8Bytes: 1_250_000,
      maxDepth: 32,
      maxNodes: 50_000,
    });
  } catch (error) {
    if (error instanceof BoundedJsonParseError) {
      return deepFreeze({
        ok: false,
        issues: deepFreeze([
          { code: error.code, path: `$@${error.offset}`, message: error.message },
        ]),
      });
    }
    return deepFreeze({
      ok: false,
      issues: deepFreeze([{ code: 'INVALID_JSON', path: '$', message: 'unable to parse JSON' }]),
    });
  }
  if (!isRecord(parsed)) {
    return deepFreeze({
      ok: false,
      issues: deepFreeze([
        { code: 'INVALID_ENVELOPE', path: '$', message: 'must be a JSON object' },
      ]),
    });
  }
  return validateEnvelopeRecord(parsed, registry);
}

function validateAuthorizedDecision(
  decision: unknown
): Extract<GovernanceAuthorityDecisionV1, { status: 'AUTHORIZED' }> | null {
  if (!decision || typeof decision !== 'object' || Array.isArray(decision)) return null;
  const record = decision as Record<string, unknown>;
  if (record.status !== 'AUTHORIZED') return null;
  if (typeof record.decisionId !== 'string' || !record.decisionId.trim()) return null;
  if (typeof record.authorityVersion !== 'string' || !record.authorityVersion.trim()) return null;
  if (typeof record.evaluatedAt !== 'string' || !isValidUtcTimestamp(record.evaluatedAt))
    return null;
  if (Object.keys(record).sort().join(',') !== 'authorityVersion,decisionId,evaluatedAt,status') {
    return null;
  }
  return record as unknown as Extract<GovernanceAuthorityDecisionV1, { status: 'AUTHORIZED' }>;
}

/** Admit only after a trusted current-state authority verifies the structurally valid event. */
export async function admitGovernedEventEnvelopeV1(
  jsonText: string,
  registry: GovernedEventRegistryV1,
  authority: GovernanceAdmissionAuthorityV1
): Promise<GovernedEventAdmissionResultV1> {
  const structural = validateGovernedEventEnvelopeV1(jsonText, registry);
  if (!structural.ok) return structural;
  let decision: unknown;
  try {
    decision = await authority.evaluate({
      envelope: structural.envelope,
      family: structural.family,
    });
  } catch {
    return deepFreeze({
      ok: false,
      issues: deepFreeze([
        {
          code: 'AUTHORITY_UNAVAILABLE',
          path: 'authorization',
          message: 'trusted governance authority failed closed',
        },
      ]),
    });
  }
  if (
    decision &&
    typeof decision === 'object' &&
    !Array.isArray(decision) &&
    (decision as Record<string, unknown>).status === 'REFUSED'
  ) {
    const refusal = decision as Record<string, unknown>;
    const reason = typeof refusal.reasonCode === 'string' ? refusal.reasonCode : 'INVALID_REFUSAL';
    const message =
      typeof refusal.message === 'string'
        ? refusal.message
        : 'authority refused without a valid message';
    return deepFreeze({
      ok: false,
      issues: deepFreeze([
        { code: 'AUTHORITY_REFUSED', path: 'authorization', message: `${reason}: ${message}` },
      ]),
    });
  }
  const authorized = validateAuthorizedDecision(decision);
  if (!authorized) {
    return deepFreeze({
      ok: false,
      issues: deepFreeze([
        {
          code: 'INVALID_AUTHORITY_DECISION',
          path: 'authorization',
          message: 'trusted authority returned an invalid decision record',
        },
      ]),
    });
  }
  const authorityDecision = deepFreeze(structuredClone(authorized));
  return deepFreeze({
    ok: true,
    value: deepFreeze({
      envelope: structural.envelope,
      family: structural.family,
      authorityDecision,
    }),
  });
}
