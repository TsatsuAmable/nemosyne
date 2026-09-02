import {
  GOVERNED_DATA_CLASSES,
  GOVERNED_PURPOSES,
  RUNTIME_COMPONENTS,
  type ClosedPayloadSchemaV1,
  type GovernedDataClass,
  type GovernedEventFamilyDefinitionV1,
  type GovernedEventFamilyDefinitionV1Input,
  type GovernedIdentityKey,
  type GovernedPurpose,
  type GovernedSensitivity,
  type GovernanceValidationIssue,
  type ImmutableReferenceV1,
  type RetentionPolicyReferenceV1,
} from './GovernedEventContracts.ts';
import { PLACEHOLDER } from './GovernedEventValidationSupport.ts';

const IDENTITY_KEYS: readonly GovernedIdentityKey[] = [
  'profilePseudonymId',
  'productSessionId',
  'investigationId',
  'discoveryEpisodeId',
];

const AUTHORIZATION_BASES = [
  'CONSENT_RECEIPT',
  'DEPLOYED_POLICY',
  'FROZEN_STUDY_PROTOCOL',
  'EXPLICIT_USER_ACTION',
  'VALIDATION_MANIFEST',
] as const;

const PAYLOAD_STRING_FORMATS = ['PLAIN', 'UTC_TIMESTAMP', 'SHA256_HEX'] as const;
const EXPORT_VISIBILITIES = ['NONE', 'USER_EXPORT', 'GOVERNED_EXPORT'] as const;
const REVOCATION_BEHAVIORS = ['DISCARD_QUEUED', 'POLICY_GOVERNED', 'NOT_APPLICABLE'] as const;
const ERASURE_REACHABILITIES = [
  'REGISTERED_STORE',
  'LOCAL_CLIENT',
  'OUTSIDE_SERVICE_CONTROL',
] as const;
const STABLE_VERSION = /^[0-9A-Za-z][0-9A-Za-z._+-]{0,63}$/;

const SENSITIVITY_RANK: Readonly<Record<GovernedSensitivity, number>> = {
  LOW: 0,
  PSEUDONYMOUS: 1,
  SENSITIVE: 2,
  HIGHLY_SENSITIVE: 3,
};

export interface GovernedDataClassRuleV1 {
  readonly allowedPurposes: readonly GovernedPurpose[];
  readonly sensitivity: GovernedSensitivity;
}

export const GOVERNED_DATA_CLASS_RULES_V1: Readonly<
  Record<GovernedDataClass, GovernedDataClassRuleV1>
> = Object.freeze({
  BOUNDED_OPERATIONAL_AGGREGATE: Object.freeze({
    allowedPurposes: Object.freeze([
      GOVERNED_PURPOSES.OPERATIONAL_DIAGNOSTICS,
      GOVERNED_PURPOSES.ENGINEERING_QUALIFICATION,
    ]),
    sensitivity: 'LOW',
  }),
  PRODUCT_INTERACTION_METADATA: Object.freeze({
    allowedPurposes: Object.freeze([
      GOVERNED_PURPOSES.PRODUCT_ANALYTICS,
      GOVERNED_PURPOSES.USER_DIRECTED_EXPORT,
    ]),
    sensitivity: 'PSEUDONYMOUS',
  }),
  DIAGNOSTIC_CONTENT: Object.freeze({
    allowedPurposes: Object.freeze([
      GOVERNED_PURPOSES.OPERATIONAL_DIAGNOSTICS,
      GOVERNED_PURPOSES.ENGINEERING_QUALIFICATION,
      GOVERNED_PURPOSES.USER_DIRECTED_EXPORT,
    ]),
    sensitivity: 'SENSITIVE',
  }),
  SCIENTIFIC_DATASET_REFERENCE: Object.freeze({
    allowedPurposes: Object.freeze([
      GOVERNED_PURPOSES.PRODUCT_ANALYTICS,
      GOVERNED_PURPOSES.MONETA_LEARNING_EVIDENCE,
      GOVERNED_PURPOSES.GOVERNED_STUDY_COLLECTION,
      GOVERNED_PURPOSES.ENGINEERING_QUALIFICATION,
      GOVERNED_PURPOSES.USER_DIRECTED_EXPORT,
    ]),
    sensitivity: 'SENSITIVE',
  }),
  DERIVED_GESTURE_FEATURE: Object.freeze({
    allowedPurposes: Object.freeze([GOVERNED_PURPOSES.DERIVED_GESTURE_LEARNING]),
    sensitivity: 'SENSITIVE',
  }),
  RAW_SPATIAL_TRAJECTORY: Object.freeze({
    allowedPurposes: Object.freeze([GOVERNED_PURPOSES.RAW_TRAJECTORY_RESEARCH]),
    sensitivity: 'HIGHLY_SENSITIVE',
  }),
  HUMAN_JUDGEMENT_DISCOVERY_EVIDENCE: Object.freeze({
    allowedPurposes: Object.freeze([
      GOVERNED_PURPOSES.MONETA_LEARNING_EVIDENCE,
      GOVERNED_PURPOSES.LOCAL_PRODUCT_PERSISTENCE,
      GOVERNED_PURPOSES.USER_DIRECTED_EXPORT,
    ]),
    sensitivity: 'SENSITIVE',
  }),
  GOVERNED_STUDY_RECORD: Object.freeze({
    allowedPurposes: Object.freeze([
      GOVERNED_PURPOSES.GOVERNED_STUDY_COLLECTION,
      GOVERNED_PURPOSES.USER_DIRECTED_EXPORT,
    ]),
    sensitivity: 'HIGHLY_SENSITIVE',
  }),
  GOVERNED_VALIDATION_EVIDENCE: Object.freeze({
    allowedPurposes: Object.freeze([GOVERNED_PURPOSES.ENGINEERING_QUALIFICATION]),
    sensitivity: 'SENSITIVE',
  }),
  SCIENTIFIC_SESSION_CONTENT: Object.freeze({
    allowedPurposes: Object.freeze([
      GOVERNED_PURPOSES.LOCAL_PRODUCT_PERSISTENCE,
      GOVERNED_PURPOSES.USER_DIRECTED_EXPORT,
      GOVERNED_PURPOSES.OPTIONAL_BACKUP_SHARE,
    ]),
    sensitivity: 'HIGHLY_SENSITIVE',
  }),
  CONSENT_LIFECYCLE_RECORD: Object.freeze({
    allowedPurposes: Object.freeze([GOVERNED_PURPOSES.CONSENT_LIFECYCLE_ENFORCEMENT]),
    sensitivity: 'HIGHLY_SENSITIVE',
  }),
});

export class InvalidGovernedEventRegistryError extends Error {
  readonly issues: readonly GovernanceValidationIssue[];

  constructor(issues: readonly GovernanceValidationIssue[]) {
    super(
      `Invalid governed event registry: ${issues.map((issue) => `${issue.path}: ${issue.message}`).join('; ')}`
    );
    this.name = 'InvalidGovernedEventRegistryError';
    this.issues = issues;
  }
}

export interface GovernedEventRegistryV1 {
  get(familyId: string): GovernedEventFamilyDefinitionV1 | undefined;
  list(): readonly GovernedEventFamilyDefinitionV1[];
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

function isSha256(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    Object.keys(record).sort().join(',') === 'algorithm,value' &&
    record.algorithm === 'SHA256' &&
    typeof record.value === 'string' &&
    /^[0-9a-f]{64}$/.test(record.value)
  );
}

function validateReference(
  reference: ImmutableReferenceV1 | undefined,
  path: string,
  issues: GovernanceValidationIssue[]
): void {
  if (!reference || typeof reference !== 'object') {
    issues.push({ code: 'INVALID_REFERENCE', path, message: 'must be an immutable reference' });
    return;
  }
  if (reference.schemaVersion !== '1')
    issues.push({ code: 'INVALID_REFERENCE', path, message: 'unsupported schema version' });
  if (!reference.id?.trim())
    issues.push({ code: 'INVALID_REFERENCE', path: `${path}.id`, message: 'must be non-empty' });
  if (
    !reference.version?.trim() ||
    !STABLE_VERSION.test(reference.version) ||
    PLACEHOLDER.test(reference.version)
  )
    issues.push({
      code: 'INVALID_REFERENCE',
      path: `${path}.version`,
      message: 'must be a stable non-placeholder version',
    });
  if (!isSha256(reference.digest))
    issues.push({
      code: 'INVALID_REFERENCE',
      path: `${path}.digest`,
      message: 'must be an exact SHA-256 digest',
    });
}

function validatePayloadSchema(
  schema: ClosedPayloadSchemaV1,
  path: string,
  issues: GovernanceValidationIssue[],
  depth = 0
): void {
  if (depth > 16) {
    issues.push({ code: 'INVALID_PAYLOAD_SCHEMA', path, message: 'schema nesting exceeds 16' });
    return;
  }
  if (!schema || typeof schema !== 'object') {
    issues.push({ code: 'INVALID_PAYLOAD_SCHEMA', path, message: 'must be an object' });
    return;
  }
  const allowedKeysByType: Readonly<Record<string, readonly string[]>> = {
    object: ['type', 'properties', 'required'],
    array: ['type', 'items', 'minItems', 'maxItems'],
    string: ['type', 'minLength', 'maxLength', 'format', 'allowedValues'],
    number: ['type', 'minimum', 'maximum'],
    integer: ['type', 'minimum', 'maximum'],
    boolean: ['type'],
    null: ['type'],
  };
  const allowedKeys = allowedKeysByType[String(schema.type)];
  if (allowedKeys) {
    for (const key of Object.keys(schema)) {
      if (!allowedKeys.includes(key)) {
        issues.push({
          code: 'INVALID_PAYLOAD_SCHEMA',
          path: `${path}.${key}`,
          message: 'unknown payload-schema property',
        });
      }
    }
  }
  if (schema.type === 'object') {
    const propertyNames = Object.keys(schema.properties);
    const required = new Set(schema.required);
    if (required.size !== schema.required.length) {
      issues.push({
        code: 'INVALID_PAYLOAD_SCHEMA',
        path: `${path}.required`,
        message: 'contains duplicates',
      });
    }
    for (const name of required) {
      if (!Object.hasOwn(schema.properties, name)) {
        issues.push({
          code: 'INVALID_PAYLOAD_SCHEMA',
          path: `${path}.required`,
          message: `unknown property ${name}`,
        });
      }
    }
    for (const name of propertyNames)
      validatePayloadSchema(
        schema.properties[name],
        `${path}.properties.${name}`,
        issues,
        depth + 1
      );
    return;
  }
  if (schema.type === 'array') {
    if (
      !Number.isSafeInteger(schema.minItems) ||
      !Number.isSafeInteger(schema.maxItems) ||
      schema.minItems < 0 ||
      schema.maxItems < schema.minItems
    ) {
      issues.push({ code: 'INVALID_PAYLOAD_SCHEMA', path, message: 'invalid array bounds' });
    }
    validatePayloadSchema(schema.items, `${path}.items`, issues, depth + 1);
    return;
  }
  if (schema.type === 'string') {
    if (
      !Number.isSafeInteger(schema.minLength) ||
      !Number.isSafeInteger(schema.maxLength) ||
      schema.minLength < 0 ||
      schema.maxLength < schema.minLength
    ) {
      issues.push({ code: 'INVALID_PAYLOAD_SCHEMA', path, message: 'invalid string bounds' });
    }
    if (
      schema.allowedValues &&
      new Set(schema.allowedValues).size !== schema.allowedValues.length
    ) {
      issues.push({
        code: 'INVALID_PAYLOAD_SCHEMA',
        path: `${path}.allowedValues`,
        message: 'contains duplicates',
      });
    }
    if (
      schema.format !== undefined &&
      !PAYLOAD_STRING_FORMATS.includes(schema.format as (typeof PAYLOAD_STRING_FORMATS)[number])
    ) {
      issues.push({
        code: 'INVALID_PAYLOAD_SCHEMA',
        path: `${path}.format`,
        message: 'unknown string format',
      });
    }
    return;
  }
  if (schema.type === 'number' || schema.type === 'integer') {
    if (
      !Number.isFinite(schema.minimum) ||
      !Number.isFinite(schema.maximum) ||
      schema.maximum < schema.minimum
    ) {
      issues.push({ code: 'INVALID_PAYLOAD_SCHEMA', path, message: 'invalid numeric bounds' });
    }
    return;
  }
  if (schema.type !== 'boolean' && schema.type !== 'null') {
    issues.push({
      code: 'INVALID_PAYLOAD_SCHEMA',
      path: `${path}.type`,
      message: 'unknown schema type',
    });
  }
}

function maxSensitivity(values: readonly GovernedSensitivity[]): GovernedSensitivity {
  return values.reduce(
    (maximum, value) => (SENSITIVITY_RANK[value] > SENSITIVITY_RANK[maximum] ? value : maximum),
    'LOW'
  );
}

function deriveSensitivity(definition: GovernedEventFamilyDefinitionV1Input): GovernedSensitivity {
  const classSensitivities = definition.dataClasses.map(
    (dataClass) => GOVERNED_DATA_CLASS_RULES_V1[dataClass].sensitivity
  );
  const identityLinked = Object.values(definition.identityRequirements).includes('REQUIRED');
  return maxSensitivity(
    identityLinked ? [...classSensitivities, 'PSEUDONYMOUS'] : classSensitivities
  );
}

function validateDefinition(
  definition: GovernedEventFamilyDefinitionV1Input
): GovernanceValidationIssue[] {
  const issues: GovernanceValidationIssue[] = [];
  const path = definition.familyId ? `families.${definition.familyId}` : 'families';
  if (!/^[a-z][a-z0-9.-]{2,127}$/.test(definition.familyId)) {
    issues.push({
      code: 'INVALID_FAMILY',
      path: `${path}.familyId`,
      message: 'must be a stable lowercase machine ID',
    });
  }
  if (
    !definition.payloadSchemaVersion?.trim() ||
    !STABLE_VERSION.test(definition.payloadSchemaVersion) ||
    PLACEHOLDER.test(definition.payloadSchemaVersion)
  ) {
    issues.push({
      code: 'INVALID_FAMILY',
      path: `${path}.payloadSchemaVersion`,
      message: 'must be a stable non-placeholder version',
    });
  }
  if (!Object.values(GOVERNED_PURPOSES).includes(definition.purpose)) {
    issues.push({ code: 'INVALID_FAMILY', path: `${path}.purpose`, message: 'unknown purpose' });
  }
  if (
    definition.datasetRequirement !== 'REQUIRED' &&
    definition.datasetRequirement !== 'FORBIDDEN'
  ) {
    issues.push({
      code: 'INVALID_FAMILY',
      path: `${path}.datasetRequirement`,
      message: 'must be REQUIRED or FORBIDDEN',
    });
  }
  if (
    definition.dataClasses.length === 0 ||
    new Set(definition.dataClasses).size !== definition.dataClasses.length
  ) {
    issues.push({
      code: 'INVALID_FAMILY',
      path: `${path}.dataClasses`,
      message: 'must be non-empty and unique',
    });
  }
  for (const dataClass of definition.dataClasses) {
    const rule = GOVERNED_DATA_CLASS_RULES_V1[dataClass];
    if (!rule) {
      issues.push({
        code: 'INVALID_FAMILY',
        path: `${path}.dataClasses`,
        message: `unknown data class ${String(dataClass)}`,
      });
    } else if (!rule.allowedPurposes.includes(definition.purpose)) {
      issues.push({
        code: 'INVALID_FAMILY',
        path: `${path}.purpose`,
        message: `${definition.purpose} is not allowed for ${dataClass}`,
      });
    }
  }
  if (
    definition.datasetRequirement === 'REQUIRED' &&
    !definition.dataClasses.includes(GOVERNED_DATA_CLASSES.SCIENTIFIC_DATASET_REFERENCE)
  ) {
    issues.push({
      code: 'INVALID_FAMILY',
      path: `${path}.datasetRequirement`,
      message: 'dataset context requires SCIENTIFIC_DATASET_REFERENCE',
    });
  }
  if (
    definition.datasetRequirement === 'FORBIDDEN' &&
    definition.dataClasses.includes(GOVERNED_DATA_CLASSES.SCIENTIFIC_DATASET_REFERENCE)
  ) {
    issues.push({
      code: 'INVALID_FAMILY',
      path: `${path}.datasetRequirement`,
      message: 'SCIENTIFIC_DATASET_REFERENCE requires dataset context',
    });
  }
  for (const key of IDENTITY_KEYS) {
    if (
      definition.identityRequirements[key] !== 'REQUIRED' &&
      definition.identityRequirements[key] !== 'FORBIDDEN'
    ) {
      issues.push({
        code: 'INVALID_FAMILY',
        path: `${path}.identityRequirements.${key}`,
        message: 'must be REQUIRED or FORBIDDEN',
      });
    }
  }
  if (
    definition.identityRequirements.discoveryEpisodeId === 'REQUIRED' &&
    definition.identityRequirements.investigationId !== 'REQUIRED'
  ) {
    issues.push({
      code: 'INVALID_FAMILY',
      path: `${path}.identityRequirements.discoveryEpisodeId`,
      message: 'discovery identity requires its investigation ancestry',
    });
  }
  for (const component of RUNTIME_COMPONENTS) {
    if (
      definition.runtimeRequirements[component] !== 'REQUIRED' &&
      definition.runtimeRequirements[component] !== 'FORBIDDEN'
    ) {
      issues.push({
        code: 'INVALID_FAMILY',
        path: `${path}.runtimeRequirements.${component}`,
        message: 'must be REQUIRED or FORBIDDEN',
      });
    }
  }
  for (const component of [
    'applicationBuild',
    'deploymentConfiguration',
    'platformRuntime',
  ] as const) {
    if (definition.runtimeRequirements[component] !== 'REQUIRED') {
      issues.push({
        code: 'INVALID_FAMILY',
        path: `${path}.runtimeRequirements.${component}`,
        message: 'capture always requires exact application, deployment, and platform identity',
      });
    }
  }
  if (
    definition.allowedModes.length === 0 ||
    new Set(definition.allowedModes).size !== definition.allowedModes.length ||
    definition.allowedModes.some((mode) => mode !== 'PRODUCT' && mode !== 'RESEARCH')
  ) {
    issues.push({
      code: 'INVALID_FAMILY',
      path: `${path}.allowedModes`,
      message: 'must be non-empty and unique',
    });
  }
  if (
    definition.allowedSourceComponents.length === 0 ||
    new Set(definition.allowedSourceComponents).size !==
      definition.allowedSourceComponents.length ||
    definition.allowedSourceComponents.some((source) => !source.trim())
  ) {
    issues.push({
      code: 'INVALID_FAMILY',
      path: `${path}.allowedSourceComponents`,
      message: 'must be non-empty and unique',
    });
  }
  if (new Set(definition.requiredSeedNames).size !== definition.requiredSeedNames.length) {
    issues.push({
      code: 'INVALID_FAMILY',
      path: `${path}.requiredSeedNames`,
      message: 'must be unique',
    });
  }
  if (
    !Number.isSafeInteger(definition.maxPayloadBytes) ||
    definition.maxPayloadBytes < 2 ||
    definition.maxPayloadBytes > 1_000_000
  ) {
    issues.push({
      code: 'INVALID_FAMILY',
      path: `${path}.maxPayloadBytes`,
      message: 'must be an integer from 2 to 1000000',
    });
  }
  if (definition.authorizationRequirements.length === 0) {
    issues.push({
      code: 'INVALID_FAMILY',
      path: `${path}.authorizationRequirements`,
      message: 'must be non-empty',
    });
  }
  const bases = new Set<string>();
  definition.authorizationRequirements.forEach((requirement, index) => {
    if (!AUTHORIZATION_BASES.includes(requirement.basis as (typeof AUTHORIZATION_BASES)[number])) {
      issues.push({
        code: 'INVALID_FAMILY',
        path: `${path}.authorizationRequirements[${index}].basis`,
        message: 'unknown authorization basis',
      });
    }
    if (bases.has(requirement.basis)) {
      issues.push({
        code: 'INVALID_FAMILY',
        path: `${path}.authorizationRequirements[${index}].basis`,
        message: 'duplicate basis',
      });
    }
    bases.add(requirement.basis);
    validateReference(
      requirement.authority,
      `${path}.authorizationRequirements[${index}].authority`,
      issues
    );
    validateReference(
      requirement.policy,
      `${path}.authorizationRequirements[${index}].policy`,
      issues
    );
  });
  const requireBasis = (basis: string, reason: string): void => {
    if (!bases.has(basis)) {
      issues.push({
        code: 'INVALID_FAMILY',
        path: `${path}.authorizationRequirements`,
        message: `${basis} is required for ${reason}`,
      });
    }
  };
  const isIdentityLinked = IDENTITY_KEYS.some(
    (identity) => definition.identityRequirements[identity] === 'REQUIRED'
  );
  if (definition.purpose === GOVERNED_PURPOSES.OPERATIONAL_DIAGNOSTICS) {
    requireBasis('DEPLOYED_POLICY', definition.purpose);
    if (isIdentityLinked) {
      requireBasis('CONSENT_RECEIPT', 'identity-linked operational diagnostics');
    }
  }
  if (definition.purpose === GOVERNED_PURPOSES.ENGINEERING_QUALIFICATION) {
    requireBasis('VALIDATION_MANIFEST', definition.purpose);
    if (isIdentityLinked) {
      requireBasis('CONSENT_RECEIPT', 'human-linked engineering qualification');
    }
  }
  if (
    definition.purpose === GOVERNED_PURPOSES.PRODUCT_ANALYTICS ||
    definition.purpose === GOVERNED_PURPOSES.DERIVED_GESTURE_LEARNING ||
    definition.purpose === GOVERNED_PURPOSES.MONETA_LEARNING_EVIDENCE
  ) {
    requireBasis('CONSENT_RECEIPT', definition.purpose);
  }
  if (
    definition.purpose === GOVERNED_PURPOSES.RAW_TRAJECTORY_RESEARCH ||
    definition.purpose === GOVERNED_PURPOSES.GOVERNED_STUDY_COLLECTION
  ) {
    requireBasis('CONSENT_RECEIPT', definition.purpose);
    requireBasis('FROZEN_STUDY_PROTOCOL', definition.purpose);
  }
  if (
    definition.purpose === GOVERNED_PURPOSES.CONSENT_LIFECYCLE_ENFORCEMENT ||
    definition.purpose === GOVERNED_PURPOSES.LOCAL_PRODUCT_PERSISTENCE
  ) {
    requireBasis('DEPLOYED_POLICY', definition.purpose);
  }
  if (definition.purpose === GOVERNED_PURPOSES.USER_DIRECTED_EXPORT) {
    requireBasis('EXPLICIT_USER_ACTION', definition.purpose);
  }
  if (definition.purpose === GOVERNED_PURPOSES.OPTIONAL_BACKUP_SHARE) {
    requireBasis('EXPLICIT_USER_ACTION', definition.purpose);
  }
  if (definition.allowedModes.includes('RESEARCH')) {
    requireBasis('FROZEN_STUDY_PROTOCOL', 'Research Mode');
  }
  const expectedRevocationBehavior =
    bases.has('FROZEN_STUDY_PROTOCOL') ||
    (bases.has('VALIDATION_MANIFEST') && bases.has('CONSENT_RECEIPT'))
      ? 'POLICY_GOVERNED'
      : bases.has('CONSENT_RECEIPT')
        ? 'DISCARD_QUEUED'
        : null;
  if (
    expectedRevocationBehavior !== null &&
    definition.revocationBehavior !== expectedRevocationBehavior
  ) {
    issues.push({
      code: 'INVALID_FAMILY',
      path: `${path}.revocationBehavior`,
      message: `${expectedRevocationBehavior} is required by the authorization combination`,
    });
  }
  validateReference(
    (definition.retentionPolicy as RetentionPolicyReferenceV1).policy,
    `${path}.retentionPolicy.policy`,
    issues
  );
  if (definition.retentionPolicy.schemaVersion !== '1') {
    issues.push({
      code: 'INVALID_FAMILY',
      path: `${path}.retentionPolicy.schemaVersion`,
      message: 'unsupported version',
    });
  }
  if (
    !EXPORT_VISIBILITIES.includes(
      definition.exportVisibility as (typeof EXPORT_VISIBILITIES)[number]
    )
  ) {
    issues.push({
      code: 'INVALID_FAMILY',
      path: `${path}.exportVisibility`,
      message: 'unknown export visibility',
    });
  }
  if (
    !REVOCATION_BEHAVIORS.includes(
      definition.revocationBehavior as (typeof REVOCATION_BEHAVIORS)[number]
    )
  ) {
    issues.push({
      code: 'INVALID_FAMILY',
      path: `${path}.revocationBehavior`,
      message: 'unknown revocation behavior',
    });
  }
  if (
    !ERASURE_REACHABILITIES.includes(
      definition.erasureReachability as (typeof ERASURE_REACHABILITIES)[number]
    )
  ) {
    issues.push({
      code: 'INVALID_FAMILY',
      path: `${path}.erasureReachability`,
      message: 'unknown erasure reachability',
    });
  }
  validatePayloadSchema(definition.payloadSchema, `${path}.payloadSchema`, issues);
  return issues;
}

/** Build a closed immutable registry from trusted code-owned definitions. */
export function createGovernedEventRegistryV1(
  definitions: readonly GovernedEventFamilyDefinitionV1Input[]
): GovernedEventRegistryV1 {
  const issues = definitions.flatMap(validateDefinition);
  const ids = new Set<string>();
  for (const definition of definitions) {
    if (ids.has(definition.familyId)) {
      issues.push({
        code: 'INVALID_FAMILY',
        path: `families.${definition.familyId}`,
        message: 'duplicate family ID',
      });
    }
    ids.add(definition.familyId);
  }
  if (issues.length > 0) throw new InvalidGovernedEventRegistryError(deepFreeze(issues));

  const entries = definitions.map((definition) => {
    const clone = structuredClone(definition) as GovernedEventFamilyDefinitionV1Input;
    const normalized: GovernedEventFamilyDefinitionV1Input = {
      ...clone,
      dataClasses: [...clone.dataClasses].sort(),
      requiredSeedNames: [...clone.requiredSeedNames].sort(),
      allowedModes: [...clone.allowedModes].sort(),
      allowedSourceComponents: [...clone.allowedSourceComponents].sort(),
      authorizationRequirements: [...clone.authorizationRequirements].sort((left, right) =>
        left.basis < right.basis ? -1 : left.basis > right.basis ? 1 : 0
      ),
    };
    return deepFreeze({ ...normalized, effectiveSensitivity: deriveSensitivity(normalized) });
  });
  const byId = new Map(entries.map((definition) => [definition.familyId, definition]));
  const listed = deepFreeze([...entries]);

  return Object.freeze({
    get(familyId: string) {
      return byId.get(familyId);
    },
    list() {
      return listed;
    },
  });
}

/** No event family is production-enabled by PT3B. */
export const EMPTY_GOVERNED_EVENT_REGISTRY_V1 = createGovernedEventRegistryV1([]);
