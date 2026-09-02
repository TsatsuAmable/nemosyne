import {
  RUNTIME_COMPONENTS,
  type AuthorizationReferenceV1,
  type GovernedEventFamilyDefinitionV1,
  type GovernanceValidationIssue,
  type ImmutableReferenceV1,
  type JsonValue,
} from './GovernedEventContracts.ts';
import {
  exactKeys,
  immutableReferencesEqual,
  isRecord,
  nonEmptyString,
  validateImmutableReference,
  validateSha256Digest,
} from './GovernedEventValidationSupport.ts';

const IDENTITY_KEYS = [
  'profilePseudonymId',
  'productSessionId',
  'investigationId',
  'discoveryEpisodeId',
] as const;

export function validateIdentityReferences(
  value: JsonValue | undefined,
  family: GovernedEventFamilyDefinitionV1 | undefined,
  issues: GovernanceValidationIssue[]
): void {
  if (!isRecord(value)) {
    issues.push({
      code: 'INVALID_IDENTITIES',
      path: 'identities',
      message: 'must be an identity-reference object',
    });
    return;
  }
  exactKeys(value, IDENTITY_KEYS, 'identities', issues);
  const present = new Map<string, string>();
  for (const key of IDENTITY_KEYS) {
    const identity = value[key];
    if (identity !== null && !nonEmptyString(identity, `identities.${key}`, issues, 256)) continue;
    if (typeof identity === 'string') {
      const previous = present.get(identity);
      if (previous) {
        issues.push({
          code: 'COLLAPSED_IDENTITY',
          path: `identities.${key}`,
          message: `must not reuse ${previous}`,
        });
      }
      present.set(identity, key);
    }
    if (family?.identityRequirements[key] === 'REQUIRED' && identity === null) {
      issues.push({
        code: 'MISSING_IDENTITY',
        path: `identities.${key}`,
        message: 'required by event family',
      });
    }
    if (family?.identityRequirements[key] === 'FORBIDDEN' && identity !== null) {
      issues.push({
        code: 'FORBIDDEN_IDENTITY',
        path: `identities.${key}`,
        message: 'forbidden by event family',
      });
    }
  }
}

export function validateDatasetReference(
  value: JsonValue,
  path: string,
  issues: GovernanceValidationIssue[]
): void {
  if (!isRecord(value)) {
    issues.push({
      code: 'INVALID_DATASET_REFERENCE',
      path,
      message: 'must be a dataset reference object',
    });
    return;
  }
  exactKeys(value, ['schemaVersion', 'datasetFingerprint', 'corpus'], path, issues);
  if (value.schemaVersion !== '1') {
    issues.push({
      code: 'INVALID_DATASET_REFERENCE',
      path: `${path}.schemaVersion`,
      message: 'unsupported version',
    });
  }
  validateSha256Digest(value.datasetFingerprint, `${path}.datasetFingerprint`, issues);
  if (value.corpus === null) return;
  if (!isRecord(value.corpus)) {
    issues.push({
      code: 'INVALID_CORPUS_REFERENCE',
      path: `${path}.corpus`,
      message: 'must be null or a complete corpus reference',
    });
    return;
  }
  const corpus = value.corpus;
  exactKeys(
    corpus,
    [
      'repository',
      'revision',
      'catalogueSchemaVersion',
      'corpusVersion',
      'datasetId',
      'datasetVersion',
      'contentDigest',
      'artifactTier',
      'artifactRole',
      'artifactDigest',
    ],
    `${path}.corpus`,
    issues
  );
  nonEmptyString(corpus.repository, `${path}.corpus.repository`, issues, 512, true);
  if (
    typeof corpus.revision !== 'string' ||
    !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(corpus.revision)
  ) {
    issues.push({
      code: 'MUTABLE_CORPUS_REVISION',
      path: `${path}.corpus.revision`,
      message: 'must be an exact lowercase Git object ID',
    });
  }
  for (const key of [
    'catalogueSchemaVersion',
    'corpusVersion',
    'datasetId',
    'datasetVersion',
    'artifactTier',
    'artifactRole',
  ] as const) {
    nonEmptyString(corpus[key], `${path}.corpus.${key}`, issues, 256, key.endsWith('Version'));
  }
  validateSha256Digest(corpus.contentDigest, `${path}.corpus.contentDigest`, issues);
  validateSha256Digest(corpus.artifactDigest, `${path}.corpus.artifactDigest`, issues);
}

export function validateRuntime(
  value: JsonValue | undefined,
  family: GovernedEventFamilyDefinitionV1 | undefined,
  issues: GovernanceValidationIssue[]
): void {
  if (!isRecord(value)) {
    issues.push({
      code: 'INVALID_RUNTIME',
      path: 'runtime',
      message: 'must be runtime provenance',
    });
    return;
  }
  exactKeys(value, ['schemaVersion', 'components', 'randomSeeds'], 'runtime', issues);
  if (value.schemaVersion !== '1') {
    issues.push({
      code: 'INVALID_RUNTIME',
      path: 'runtime.schemaVersion',
      message: 'unsupported version',
    });
  }
  if (!isRecord(value.components)) {
    issues.push({
      code: 'INVALID_RUNTIME',
      path: 'runtime.components',
      message: 'must contain all named runtime component slots',
    });
  } else {
    exactKeys(value.components, RUNTIME_COMPONENTS, 'runtime.components', issues);
    for (const component of RUNTIME_COMPONENTS) {
      const reference = value.components[component];
      if (reference !== null) {
        if (!isRecord(reference)) {
          issues.push({
            code: 'INVALID_RUNTIME_REFERENCE',
            path: `runtime.components.${component}`,
            message: 'must be null or a reference object',
          });
        } else {
          exactKeys(
            reference,
            ['schemaVersion', 'componentId', 'version', 'artifactDigest'],
            `runtime.components.${component}`,
            issues
          );
          if (reference.schemaVersion !== '1') {
            issues.push({
              code: 'INVALID_RUNTIME_REFERENCE',
              path: `runtime.components.${component}.schemaVersion`,
              message: 'unsupported version',
            });
          }
          nonEmptyString(
            reference.componentId,
            `runtime.components.${component}.componentId`,
            issues,
            256,
            true
          );
          nonEmptyString(
            reference.version,
            `runtime.components.${component}.version`,
            issues,
            128,
            true
          );
          validateSha256Digest(
            reference.artifactDigest,
            `runtime.components.${component}.artifactDigest`,
            issues
          );
        }
      }
      if (family?.runtimeRequirements[component] === 'REQUIRED' && reference === null) {
        issues.push({
          code: 'MISSING_RUNTIME_COMPONENT',
          path: `runtime.components.${component}`,
          message: 'required by event family',
        });
      }
      if (family?.runtimeRequirements[component] === 'FORBIDDEN' && reference !== null) {
        issues.push({
          code: 'FORBIDDEN_RUNTIME_COMPONENT',
          path: `runtime.components.${component}`,
          message: 'forbidden by event family',
        });
      }
    }
  }
  if (!isRecord(value.randomSeeds)) {
    issues.push({
      code: 'INVALID_RUNTIME_SEEDS',
      path: 'runtime.randomSeeds',
      message: 'must be an object',
    });
    return;
  }
  const expectedSeeds = new Set(family?.requiredSeedNames ?? []);
  for (const [name, seed] of Object.entries(value.randomSeeds)) {
    if (!expectedSeeds.has(name)) {
      issues.push({
        code: 'UNKNOWN_RUNTIME_SEED',
        path: `runtime.randomSeeds.${name}`,
        message: 'seed is not declared by event family',
      });
    }
    if (typeof seed !== 'number' || !Number.isSafeInteger(seed) || seed < 0) {
      issues.push({
        code: 'INVALID_RUNTIME_SEED',
        path: `runtime.randomSeeds.${name}`,
        message: 'must be a non-negative safe integer',
      });
    }
  }
  for (const name of expectedSeeds) {
    if (!Object.hasOwn(value.randomSeeds, name)) {
      issues.push({
        code: 'MISSING_RUNTIME_SEED',
        path: `runtime.randomSeeds.${name}`,
        message: 'required by event family',
      });
    }
  }
}

export function validateAuthorization(
  value: JsonValue | undefined,
  family: GovernedEventFamilyDefinitionV1 | undefined,
  issues: GovernanceValidationIssue[]
): void {
  if (!Array.isArray(value) || value.length === 0) {
    issues.push({
      code: 'INVALID_AUTHORIZATION',
      path: 'authorization',
      message: 'must be a non-empty array',
    });
    return;
  }
  const byBasis = new Map<string, AuthorizationReferenceV1>();
  value.forEach((entry, index) => {
    const path = `authorization[${index}]`;
    if (!isRecord(entry)) {
      issues.push({ code: 'INVALID_AUTHORIZATION', path, message: 'must be a reference object' });
      return;
    }
    exactKeys(
      entry,
      ['schemaVersion', 'basis', 'purpose', 'authority', 'evidence', 'policy'],
      path,
      issues
    );
    if (entry.schemaVersion !== '1') {
      issues.push({
        code: 'INVALID_AUTHORIZATION',
        path: `${path}.schemaVersion`,
        message: 'unsupported version',
      });
    }
    if (
      typeof entry.basis !== 'string' ||
      ![
        'CONSENT_RECEIPT',
        'DEPLOYED_POLICY',
        'FROZEN_STUDY_PROTOCOL',
        'EXPLICIT_USER_ACTION',
        'VALIDATION_MANIFEST',
      ].includes(entry.basis)
    ) {
      issues.push({
        code: 'INVALID_AUTHORIZATION',
        path: `${path}.basis`,
        message: 'unknown authorization basis',
      });
    } else if (byBasis.has(entry.basis)) {
      issues.push({
        code: 'DUPLICATE_AUTHORIZATION_BASIS',
        path: `${path}.basis`,
        message: 'basis may appear only once',
      });
    }
    if (family && entry.purpose !== family.purpose) {
      issues.push({
        code: 'AUTHORIZATION_PURPOSE_MISMATCH',
        path: `${path}.purpose`,
        message: 'must match event-family purpose',
      });
    }
    const authorityOk = validateImmutableReference(entry.authority, `${path}.authority`, issues);
    const policyOk = validateImmutableReference(entry.policy, `${path}.policy`, issues);
    if (!isRecord(entry.evidence)) {
      issues.push({
        code: 'INVALID_AUTHORIZATION',
        path: `${path}.evidence`,
        message: 'must be an evidence reference',
      });
    } else {
      exactKeys(entry.evidence, ['id', 'revision', 'digest'], `${path}.evidence`, issues);
      nonEmptyString(entry.evidence.id, `${path}.evidence.id`, issues);
      nonEmptyString(entry.evidence.revision, `${path}.evidence.revision`, issues, 128, true);
      validateSha256Digest(entry.evidence.digest, `${path}.evidence.digest`, issues);
    }
    if (typeof entry.basis === 'string' && authorityOk && policyOk) {
      byBasis.set(entry.basis, entry as unknown as AuthorizationReferenceV1);
    }
  });
  if (!family) return;
  const expectedBases = new Set<string>(
    family.authorizationRequirements.map((requirement) => requirement.basis)
  );
  if (
    byBasis.size !== expectedBases.size ||
    [...byBasis.keys()].some((basis) => !expectedBases.has(basis))
  ) {
    issues.push({
      code: 'AUTHORIZATION_COMBINATION_MISMATCH',
      path: 'authorization',
      message: 'must contain exactly the bases required by the event family',
    });
  }
  family.authorizationRequirements.forEach((requirement, index) => {
    const reference = byBasis.get(requirement.basis);
    if (!reference) {
      issues.push({
        code: 'MISSING_AUTHORIZATION_BASIS',
        path: 'authorization',
        message: `missing ${requirement.basis}`,
      });
    } else {
      if (!immutableReferencesEqual(reference.authority, requirement.authority)) {
        issues.push({
          code: 'AUTHORIZATION_AUTHORITY_MISMATCH',
          path: 'authorization',
          message: `${requirement.basis} authority does not match the registry pin`,
        });
      }
      if (!immutableReferencesEqual(reference.policy, requirement.policy)) {
        issues.push({
          code: 'AUTHORIZATION_POLICY_MISMATCH',
          path: 'authorization',
          message: `${requirement.basis} policy does not match the registry pin`,
        });
      }
    }
    const entry = value[index];
    if (!isRecord(entry) || entry.basis !== requirement.basis) {
      issues.push({
        code: 'AUTHORIZATION_ORDER_MISMATCH',
        path: `authorization[${index}].basis`,
        message: 'authorization bases must use the registry canonical order',
      });
    }
  });
}

export function validateRetention(
  value: JsonValue | undefined,
  family: GovernedEventFamilyDefinitionV1 | undefined,
  issues: GovernanceValidationIssue[]
): void {
  if (!isRecord(value)) {
    issues.push({
      code: 'INVALID_RETENTION',
      path: 'retention',
      message: 'must be a retention-policy reference',
    });
    return;
  }
  exactKeys(value, ['schemaVersion', 'policy'], 'retention', issues);
  if (value.schemaVersion !== '1') {
    issues.push({
      code: 'INVALID_RETENTION',
      path: 'retention.schemaVersion',
      message: 'unsupported version',
    });
  }
  const valid = validateImmutableReference(value.policy, 'retention.policy', issues);
  if (
    family &&
    valid &&
    !immutableReferencesEqual(
      value.policy as unknown as ImmutableReferenceV1,
      family.retentionPolicy.policy
    )
  ) {
    issues.push({
      code: 'RETENTION_POLICY_MISMATCH',
      path: 'retention',
      message: 'must exactly match the event-family policy pin',
    });
  }
}
