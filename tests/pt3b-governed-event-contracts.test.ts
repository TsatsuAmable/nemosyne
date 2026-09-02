import { describe, expect, it } from 'vitest';
import {
  EMPTY_GOVERNED_EVENT_REGISTRY_V1,
  GOVERNED_DATA_CLASSES,
  GOVERNED_PURPOSES,
  InvalidGovernedEventRegistryError,
  admitGovernedEventEnvelopeV1,
  canonicalGovernedJsonV1,
  computeGovernedEventContentDigestV1,
  computeGovernedPayloadDigestV1,
  createGovernedEventRegistryV1,
  governedPayloadPreimageV1,
  parseBoundedJsonV1,
  validateGovernedEventEnvelopeV1,
  type GovernedEventEnvelopeV1,
  type GovernedEventFamilyDefinitionV1Input,
  type GovernanceAdmissionAuthorityV1,
  type ImmutableReferenceV1,
  type JsonValue,
  type RuntimeComponentReferenceV1,
} from '../src/governance/index.ts';

const digest = (character: string) => ({
  algorithm: 'SHA256' as const,
  value: character.repeat(64),
});

const immutableReference = (
  id: string,
  character: string,
  version = '1'
): ImmutableReferenceV1 => ({
  schemaVersion: '1',
  id,
  version,
  digest: digest(character),
});

const authorityReference = immutableReference('nemosyne-governance-authority', 'a');
const disclosurePolicy = immutableReference('operational-diagnostics-disclosure', 'b');
const retentionPolicy = {
  schemaVersion: '1' as const,
  policy: immutableReference('operational-diagnostics-retention', 'c'),
};

function baseFamily(): GovernedEventFamilyDefinitionV1Input {
  return {
    familyId: 'test.operational.aggregate.v1',
    payloadSchemaVersion: '1',
    purpose: GOVERNED_PURPOSES.OPERATIONAL_DIAGNOSTICS,
    dataClasses: [GOVERNED_DATA_CLASSES.BOUNDED_OPERATIONAL_AGGREGATE],
    identityRequirements: {
      profilePseudonymId: 'FORBIDDEN',
      productSessionId: 'FORBIDDEN',
      investigationId: 'FORBIDDEN',
      discoveryEpisodeId: 'FORBIDDEN',
    },
    datasetRequirement: 'FORBIDDEN',
    runtimeRequirements: {
      applicationBuild: 'REQUIRED',
      deploymentConfiguration: 'REQUIRED',
      wasmKernel: 'FORBIDDEN',
      representationTreatment: 'FORBIDDEN',
      monetaEngine: 'FORBIDDEN',
      fitnessModel: 'FORBIDDEN',
      nil: 'FORBIDDEN',
      perceptionGestureTreatment: 'FORBIDDEN',
      uiTreatment: 'FORBIDDEN',
      platformRuntime: 'REQUIRED',
    },
    requiredSeedNames: [],
    allowedModes: ['PRODUCT'],
    allowedSourceComponents: ['telemetry-aggregate-producer'],
    payloadSchema: {
      type: 'object',
      properties: {
        metric: {
          type: 'string',
          minLength: 1,
          maxLength: 32,
          allowedValues: ['operation-count'],
        },
        count: { type: 'integer', minimum: 0, maximum: 1_000_000 },
        windowMs: { type: 'integer', minimum: 1, maximum: 86_400_000 },
      },
      required: ['metric', 'count', 'windowMs'],
    },
    maxPayloadBytes: 256,
    retentionPolicy,
    authorizationRequirements: [
      {
        basis: 'DEPLOYED_POLICY',
        authority: authorityReference,
        policy: disclosurePolicy,
      },
    ],
    exportVisibility: 'NONE',
    revocationBehavior: 'NOT_APPLICABLE',
    erasureReachability: 'REGISTERED_STORE',
  };
}

function linkedFamily(): GovernedEventFamilyDefinitionV1Input {
  return {
    ...baseFamily(),
    familyId: 'test.operational.aggregate-linked.v1',
    identityRequirements: {
      profilePseudonymId: 'REQUIRED',
      productSessionId: 'REQUIRED',
      investigationId: 'FORBIDDEN',
      discoveryEpisodeId: 'FORBIDDEN',
    },
    authorizationRequirements: [
      {
        basis: 'CONSENT_RECEIPT',
        authority: authorityReference,
        policy: immutableReference('linked-diagnostics-consent-notice', '9'),
      },
      {
        basis: 'DEPLOYED_POLICY',
        authority: authorityReference,
        policy: disclosurePolicy,
      },
    ],
    revocationBehavior: 'DISCARD_QUEUED',
  };
}

function datasetFamily(): GovernedEventFamilyDefinitionV1Input {
  return {
    ...baseFamily(),
    familyId: 'test.product.dataset-action.v1',
    purpose: GOVERNED_PURPOSES.PRODUCT_ANALYTICS,
    dataClasses: [
      GOVERNED_DATA_CLASSES.PRODUCT_INTERACTION_METADATA,
      GOVERNED_DATA_CLASSES.SCIENTIFIC_DATASET_REFERENCE,
    ],
    identityRequirements: {
      profilePseudonymId: 'REQUIRED',
      productSessionId: 'REQUIRED',
      investigationId: 'FORBIDDEN',
      discoveryEpisodeId: 'FORBIDDEN',
    },
    datasetRequirement: 'REQUIRED',
    authorizationRequirements: [
      {
        basis: 'CONSENT_RECEIPT',
        authority: authorityReference,
        policy: immutableReference('product-analytics-notice', '2'),
      },
    ],
    revocationBehavior: 'DISCARD_QUEUED',
  };
}

function humanValidationFamily(): GovernedEventFamilyDefinitionV1Input {
  return {
    ...baseFamily(),
    familyId: 'test.engineering.human-validation.v1',
    purpose: GOVERNED_PURPOSES.ENGINEERING_QUALIFICATION,
    identityRequirements: {
      profilePseudonymId: 'REQUIRED',
      productSessionId: 'FORBIDDEN',
      investigationId: 'FORBIDDEN',
      discoveryEpisodeId: 'FORBIDDEN',
    },
    authorizationRequirements: [
      {
        basis: 'CONSENT_RECEIPT',
        authority: authorityReference,
        policy: immutableReference('human-validation-consent-notice', '7'),
      },
      {
        basis: 'VALIDATION_MANIFEST',
        authority: authorityReference,
        policy: immutableReference('qualification-campaign-policy', '8'),
      },
    ],
    revocationBehavior: 'POLICY_GOVERNED',
  };
}

const registry = createGovernedEventRegistryV1([baseFamily()]);

const runtimeReference = (componentId: string, character: string): RuntimeComponentReferenceV1 => ({
  schemaVersion: '1',
  componentId,
  version: '1.0.0+sha.0123456789abcdef',
  artifactDigest: digest(character),
});

function validEnvelope(): GovernedEventEnvelopeV1 {
  const payload = { metric: 'operation-count', count: 7, windowMs: 1_000 } as const;
  const content: Omit<GovernedEventEnvelopeV1, 'contentDigest'> = {
    schemaVersion: '1',
    eventFamilyId: 'test.operational.aggregate.v1',
    payloadSchemaVersion: '1',
    eventId: 'event-01JEXAMPLE00000000000000000',
    streamId: 'stream-01JEXAMPLE0000000000000000',
    producerInstanceId: 'producer-01JEXAMPLE0000000000000',
    streamSequence: 0,
    capturedAt: '2026-09-02T19:00:00.000Z',
    sourceComponent: 'telemetry-aggregate-producer',
    mode: 'PRODUCT',
    purpose: GOVERNED_PURPOSES.OPERATIONAL_DIAGNOSTICS,
    dataClasses: [GOVERNED_DATA_CLASSES.BOUNDED_OPERATIONAL_AGGREGATE],
    effectiveSensitivity: 'LOW',
    identities: {
      profilePseudonymId: null,
      productSessionId: null,
      investigationId: null,
      discoveryEpisodeId: null,
    },
    dataset: null,
    runtime: {
      schemaVersion: '1',
      components: {
        applicationBuild: runtimeReference('nemosyne-app', 'd'),
        deploymentConfiguration: runtimeReference('private-preview-uk', 'e'),
        wasmKernel: null,
        representationTreatment: null,
        monetaEngine: null,
        fitnessModel: null,
        nil: null,
        perceptionGestureTreatment: null,
        uiTreatment: null,
        platformRuntime: runtimeReference('chromium-webxr', 'f'),
      },
      randomSeeds: {},
    },
    authorization: [
      {
        schemaVersion: '1',
        basis: 'DEPLOYED_POLICY',
        purpose: GOVERNED_PURPOSES.OPERATIONAL_DIAGNOSTICS,
        authority: authorityReference,
        evidence: {
          id: 'deployment-policy-decision-001',
          revision: '1',
          digest: digest('1'),
        },
        policy: disclosurePolicy,
      },
    ],
    retention: retentionPolicy,
    payload,
    payloadDigest: computeGovernedPayloadDigestV1(payload),
  };
  return { ...content, contentDigest: computeGovernedEventContentDigestV1(content) };
}

function recalculateDigests(candidate: GovernedEventEnvelopeV1): GovernedEventEnvelopeV1 {
  const withPayload = {
    ...candidate,
    payloadDigest: computeGovernedPayloadDigestV1(candidate.payload),
  };
  const content = { ...withPayload } as GovernedEventEnvelopeV1;
  delete (content as unknown as { contentDigest?: unknown }).contentDigest;
  return {
    ...withPayload,
    contentDigest: computeGovernedEventContentDigestV1(
      content as unknown as Omit<GovernedEventEnvelopeV1, 'contentDigest'>
    ),
  };
}

function recalculateContentDigest(candidate: GovernedEventEnvelopeV1): GovernedEventEnvelopeV1 {
  const content = { ...candidate } as GovernedEventEnvelopeV1;
  delete (content as unknown as { contentDigest?: unknown }).contentDigest;
  return {
    ...candidate,
    contentDigest: computeGovernedEventContentDigestV1(
      content as unknown as Omit<GovernedEventEnvelopeV1, 'contentDigest'>
    ),
  };
}

function envelopeForFamily(
  family: GovernedEventFamilyDefinitionV1Input,
  identities: GovernedEventEnvelopeV1['identities'],
  dataset: GovernedEventEnvelopeV1['dataset'] = null
): GovernedEventEnvelopeV1 {
  const registered = createGovernedEventRegistryV1([family]).get(family.familyId);
  if (!registered) throw new Error('test family was not registered');
  const candidate: GovernedEventEnvelopeV1 = {
    ...structuredClone(validEnvelope()),
    eventFamilyId: registered.familyId,
    payloadSchemaVersion: registered.payloadSchemaVersion,
    purpose: registered.purpose,
    dataClasses: registered.dataClasses,
    effectiveSensitivity: registered.effectiveSensitivity,
    identities,
    dataset,
    authorization: registered.authorizationRequirements.map((requirement, index) => ({
      schemaVersion: '1',
      basis: requirement.basis,
      purpose: registered.purpose,
      authority: requirement.authority,
      evidence: {
        id: `authority-evidence-${index}`,
        revision: '1',
        digest: digest(String(index + 1)),
      },
      policy: requirement.policy,
    })),
    retention: registered.retentionPolicy,
  };
  return recalculateDigests(candidate);
}

function codes(result: ReturnType<typeof validateGovernedEventEnvelopeV1>): string[] {
  return result.ok ? [] : result.issues.map((issue) => issue.code);
}

function expectDeepFrozen(value: unknown, seen = new WeakSet<object>()): void {
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectDeepFrozen(child, seen);
}

describe('PT3B governed-event digest contract', () => {
  it('freezes canonical bytes, domain separation, object ordering, Unicode, and negative zero', () => {
    const first = { z: [true, null], emoji: '😀', a: -0 } as const;
    const second = { a: 0, emoji: '😀', z: [true, null] } as const;

    expect(canonicalGovernedJsonV1(first)).toBe('{"a":0,"emoji":"😀","z":[true,null]}');
    expect(governedPayloadPreimageV1(first)).toBe(
      'nemosyne:governed-payload:v1\n{"a":0,"emoji":"😀","z":[true,null]}'
    );
    expect(computeGovernedPayloadDigestV1(first)).toEqual(computeGovernedPayloadDigestV1(second));
    expect(computeGovernedPayloadDigestV1(first).value).toBe(
      '6649acd18c4080c42a79e0ac3b257e650d8832a570ad1e50e7012b7ac47fc289'
    );
  });

  it('rejects duplicate keys, lone surrogates, excessive depth, nodes, and bytes before admission', () => {
    expect(() =>
      parseBoundedJsonV1('{"key":1,"key":2}', {
        maxUtf8Bytes: 100,
        maxDepth: 4,
        maxNodes: 10,
      })
    ).toThrow(/Duplicate JSON object key/);
    expect(() =>
      parseBoundedJsonV1('{"key":"\\ud800"}', {
        maxUtf8Bytes: 100,
        maxDepth: 4,
        maxNodes: 10,
      })
    ).toThrow(/unpaired/i);
    expect(() =>
      parseBoundedJsonV1('[[[0]]]', { maxUtf8Bytes: 100, maxDepth: 2, maxNodes: 10 })
    ).toThrow(/nesting/i);
    expect(() =>
      parseBoundedJsonV1('[0,1,2]', { maxUtf8Bytes: 100, maxDepth: 4, maxNodes: 3 })
    ).toThrow(/node count/i);
    expect(() =>
      parseBoundedJsonV1('{"long":true}', { maxUtf8Bytes: 5, maxDepth: 4, maxNodes: 10 })
    ).toThrow(/maximum/i);
  });
});

describe('PT3B closed registry mechanics', () => {
  it('enables no production event family by default', () => {
    expect(EMPTY_GOVERNED_EVENT_REGISTRY_V1.list()).toEqual([]);
  });

  it('derives sensitivity and rejects purpose/class and dataset/class contradictions', () => {
    expect(registry.get('test.operational.aggregate.v1')?.effectiveSensitivity).toBe('LOW');
    expect(
      createGovernedEventRegistryV1([linkedFamily()]).get(linkedFamily().familyId)
        ?.effectiveSensitivity
    ).toBe('PSEUDONYMOUS');

    const invalidPurpose = baseFamily();
    (invalidPurpose as unknown as { purpose: string }).purpose =
      GOVERNED_PURPOSES.PRODUCT_ANALYTICS;
    expect(() => createGovernedEventRegistryV1([invalidPurpose])).toThrow(
      InvalidGovernedEventRegistryError
    );

    const invalidDataset = baseFamily();
    (invalidDataset as unknown as { datasetRequirement: string }).datasetRequirement = 'REQUIRED';
    expect(() => createGovernedEventRegistryV1([invalidDataset])).toThrow(
      /SCIENTIFIC_DATASET_REFERENCE/
    );

    const optionalDataset = baseFamily();
    (optionalDataset as unknown as { datasetRequirement: string }).datasetRequirement = 'OPTIONAL';
    expect(() => createGovernedEventRegistryV1([optionalDataset])).toThrow(/datasetRequirement/);

    const rawAsAnalytics = {
      ...baseFamily(),
      purpose: GOVERNED_PURPOSES.PRODUCT_ANALYTICS,
      dataClasses: [GOVERNED_DATA_CLASSES.RAW_SPATIAL_TRAJECTORY],
    };
    expect(() => createGovernedEventRegistryV1([rawAsAnalytics])).toThrow(
      InvalidGovernedEventRegistryError
    );

    const analyticsWithoutConsent = datasetFamily();
    (
      analyticsWithoutConsent as unknown as {
        authorizationRequirements: GovernedEventFamilyDefinitionV1Input['authorizationRequirements'];
      }
    ).authorizationRequirements = baseFamily().authorizationRequirements;
    expect(() => createGovernedEventRegistryV1([analyticsWithoutConsent])).toThrow(
      /CONSENT_RECEIPT/
    );

    const orphanDiscovery = baseFamily();
    (orphanDiscovery.identityRequirements as unknown as Record<string, string>).discoveryEpisodeId =
      'REQUIRED';
    expect(() => createGovernedEventRegistryV1([orphanDiscovery])).toThrow(/ancestry/);

    const missingBuild = baseFamily();
    (missingBuild.runtimeRequirements as unknown as Record<string, string>).applicationBuild =
      'FORBIDDEN';
    expect(() => createGovernedEventRegistryV1([missingBuild])).toThrow(/application.*deployment/i);
  });

  it('rejects unknown schema and lifecycle policy values supplied outside the type system', () => {
    const invalidFormat = baseFamily();
    const metricSchema = (
      invalidFormat.payloadSchema as Extract<
        GovernedEventFamilyDefinitionV1Input['payloadSchema'],
        { type: 'object' }
      >
    ).properties.metric;
    (metricSchema as unknown as { format: string }).format = 'SHA256_HEXX';
    expect(() => createGovernedEventRegistryV1([invalidFormat])).toThrow(/unknown string format/);

    const ignoredSchemaKeyword = baseFamily();
    const ignoredMetricSchema = (
      ignoredSchemaKeyword.payloadSchema as Extract<
        GovernedEventFamilyDefinitionV1Input['payloadSchema'],
        { type: 'object' }
      >
    ).properties.metric;
    (ignoredMetricSchema as unknown as { pattern: string }).pattern = '^trusted$';
    expect(() => createGovernedEventRegistryV1([ignoredSchemaKeyword])).toThrow(
      /unknown payload-schema property/
    );

    const mutablePayloadVersion = baseFamily();
    (
      mutablePayloadVersion as unknown as {
        payloadSchemaVersion: string;
      }
    ).payloadSchemaVersion = 'latest';
    expect(() => createGovernedEventRegistryV1([mutablePayloadVersion])).toThrow(
      /stable non-placeholder version/
    );

    const mutablePolicyVersion = structuredClone(baseFamily());
    (
      mutablePolicyVersion.retentionPolicy.policy as unknown as {
        version: string;
      }
    ).version = 'latest';
    expect(() => createGovernedEventRegistryV1([mutablePolicyVersion])).toThrow(
      /stable non-placeholder version/
    );

    for (const field of [
      'exportVisibility',
      'revocationBehavior',
      'erasureReachability',
    ] as const) {
      const invalid = baseFamily();
      (invalid as unknown as Record<string, unknown>)[field] = 'UNRECOGNIZED';
      expect(() => createGovernedEventRegistryV1([invalid])).toThrow(
        InvalidGovernedEventRegistryError
      );
    }

    const invalidBasis = baseFamily();
    (
      invalidBasis.authorizationRequirements[0] as unknown as {
        basis: string;
      }
    ).basis = 'DEPLOYED_POLICYY';
    expect(() => createGovernedEventRegistryV1([invalidBasis])).toThrow(
      /unknown authorization basis/
    );
  });

  it('requires consent for session-linked operational and human qualification families', () => {
    const sessionLinked = baseFamily();
    (sessionLinked.identityRequirements as unknown as Record<string, string>).productSessionId =
      'REQUIRED';
    expect(() => createGovernedEventRegistryV1([sessionLinked])).toThrow(/CONSENT_RECEIPT/);

    const qualification = humanValidationFamily();
    (qualification.identityRequirements as unknown as Record<string, string>).profilePseudonymId =
      'FORBIDDEN';
    (qualification.identityRequirements as unknown as Record<string, string>).productSessionId =
      'REQUIRED';
    (
      qualification as unknown as {
        authorizationRequirements: GovernedEventFamilyDefinitionV1Input['authorizationRequirements'];
      }
    ).authorizationRequirements = qualification.authorizationRequirements.filter(
      (requirement) => requirement.basis !== 'CONSENT_RECEIPT'
    );
    expect(() => createGovernedEventRegistryV1([qualification])).toThrow(/CONSENT_RECEIPT/);
  });

  it('requires destination-scoped explicit action for optional backup or sharing', () => {
    const backupFamily: GovernedEventFamilyDefinitionV1Input = {
      ...baseFamily(),
      familyId: 'test.optional.backup.v1',
      purpose: GOVERNED_PURPOSES.OPTIONAL_BACKUP_SHARE,
      dataClasses: [GOVERNED_DATA_CLASSES.SCIENTIFIC_SESSION_CONTENT],
    };
    expect(() => createGovernedEventRegistryV1([backupFamily])).toThrow(/EXPLICIT_USER_ACTION/);
  });

  it('pins revocation behavior to consent and study authorization semantics', () => {
    const analyticsWithoutDisposition = datasetFamily();
    (
      analyticsWithoutDisposition as unknown as {
        revocationBehavior: string;
      }
    ).revocationBehavior = 'NOT_APPLICABLE';
    expect(() => createGovernedEventRegistryV1([analyticsWithoutDisposition])).toThrow(
      /DISCARD_QUEUED/
    );

    const studyFamily: GovernedEventFamilyDefinitionV1Input = {
      ...baseFamily(),
      familyId: 'test.governed.study-record.v1',
      purpose: GOVERNED_PURPOSES.GOVERNED_STUDY_COLLECTION,
      dataClasses: [GOVERNED_DATA_CLASSES.GOVERNED_STUDY_RECORD],
      identityRequirements: {
        profilePseudonymId: 'REQUIRED',
        productSessionId: 'FORBIDDEN',
        investigationId: 'FORBIDDEN',
        discoveryEpisodeId: 'FORBIDDEN',
      },
      allowedModes: ['RESEARCH'],
      authorizationRequirements: [
        {
          basis: 'CONSENT_RECEIPT',
          authority: authorityReference,
          policy: immutableReference('study-consent', '4'),
        },
        {
          basis: 'FROZEN_STUDY_PROTOCOL',
          authority: authorityReference,
          policy: immutableReference('study-protocol', '5'),
        },
      ],
      revocationBehavior: 'DISCARD_QUEUED',
    };
    expect(() => createGovernedEventRegistryV1([studyFamily])).toThrow(/POLICY_GOVERNED/);
  });

  it('defensively clones and freezes definitions and public views', () => {
    const source = structuredClone(baseFamily());
    const isolated = createGovernedEventRegistryV1([source]);
    const registered = isolated.get(source.familyId);
    const snapshot = JSON.stringify(registered);

    (source.allowedSourceComponents as string[])[0] = 'mutated-source';
    (source.dataClasses as string[])[0] = 'DIAGNOSTIC_CONTENT';
    (source.identityRequirements as unknown as Record<string, string>).profilePseudonymId =
      'REQUIRED';
    (source.runtimeRequirements as unknown as Record<string, string>).wasmKernel = 'REQUIRED';
    (
      (
        source.payloadSchema as Extract<
          GovernedEventFamilyDefinitionV1Input['payloadSchema'],
          { type: 'object' }
        >
      ).properties.metric as unknown as { allowedValues: string[] }
    ).allowedValues = ['mutated'];
    (source.retentionPolicy.policy as unknown as { id: string }).id = 'mutated-retention';
    (source.authorizationRequirements[0].authority as unknown as { id: string }).id =
      'mutated-authority';
    (source.authorizationRequirements[0].policy as unknown as { id: string }).id = 'mutated-policy';

    expect(JSON.stringify(registered)).toBe(snapshot);
    expectDeepFrozen(registered);
    expectDeepFrozen(isolated.list());
    expect(() => (registered?.dataClasses as string[]).push('DIAGNOSTIC_CONTENT')).toThrow();
    expect(() =>
      (isolated.list() as unknown as GovernedEventFamilyDefinitionV1Input[]).pop()
    ).toThrow();
  });
});

describe('PT3B structural event boundary', () => {
  it('validates the complete test family only through its public JSON-text boundary', () => {
    const candidate = validEnvelope();
    expect(candidate.contentDigest.value).toBe(
      'ce6355255715a5ee536361e0d4e933da7a8f0a6138c10b0da19beebc797522c1'
    );
    const result = validateGovernedEventEnvelopeV1(JSON.stringify(candidate), registry);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.isFrozen(result.envelope)).toBe(true);
    expect(Object.isFrozen(result.envelope.runtime.components)).toBe(true);
    expect(Object.isFrozen(result.envelope.payload)).toBe(true);
  });

  it.each([
    [
      'unknown envelope property',
      (event: Record<string, unknown>) => (event.extra = true),
      'UNKNOWN_PROPERTY',
    ],
    [
      'unknown family',
      (event: Record<string, unknown>) => (event.eventFamilyId = 'unknown.family.v1'),
      'UNKNOWN_EVENT_FAMILY',
    ],
    [
      'unsupported envelope version',
      (event: Record<string, unknown>) => (event.schemaVersion = '2'),
      'UNSUPPORTED_ENVELOPE_VERSION',
    ],
    [
      'payload version',
      (event: Record<string, unknown>) => (event.payloadSchemaVersion = '2'),
      'PAYLOAD_VERSION_MISMATCH',
    ],
    [
      'purpose',
      (event: Record<string, unknown>) => (event.purpose = GOVERNED_PURPOSES.PRODUCT_ANALYTICS),
      'PURPOSE_MISMATCH',
    ],
    [
      'unknown purpose',
      (event: Record<string, unknown>) => (event.purpose = 'generic-analytics'),
      'UNKNOWN_PURPOSE',
    ],
    [
      'unknown mode',
      (event: Record<string, unknown>) => (event.mode = 'EXPERIMENT'),
      'UNKNOWN_MODE',
    ],
    [
      'class',
      (event: Record<string, unknown>) =>
        (event.dataClasses = [GOVERNED_DATA_CLASSES.DIAGNOSTIC_CONTENT]),
      'DATA_CLASS_MISMATCH',
    ],
    [
      'unknown class',
      (event: Record<string, unknown>) => (event.dataClasses = ['UNKNOWN_CLASS']),
      'INVALID_DATA_CLASSES',
    ],
    [
      'sensitivity',
      (event: Record<string, unknown>) => (event.effectiveSensitivity = 'PSEUDONYMOUS'),
      'SENSITIVITY_MISMATCH',
    ],
    [
      'unknown sensitivity',
      (event: Record<string, unknown>) => (event.effectiveSensitivity = 'SECRET'),
      'UNKNOWN_SENSITIVITY',
    ],
    [
      'forbidden identity',
      (event: Record<string, unknown>) =>
        ((event.identities as Record<string, unknown>).profilePseudonymId = 'profile-1'),
      'FORBIDDEN_IDENTITY',
    ],
    [
      'missing runtime',
      (event: Record<string, unknown>) =>
        ((event.runtime as { components: Record<string, unknown> }).components.applicationBuild =
          null),
      'MISSING_RUNTIME_COMPONENT',
    ],
    [
      'forbidden runtime',
      (event: Record<string, unknown>) =>
        ((event.runtime as { components: Record<string, unknown> }).components.wasmKernel =
          runtimeReference('kernel', '9')),
      'FORBIDDEN_RUNTIME_COMPONENT',
    ],
    [
      'authorization purpose',
      (event: Record<string, unknown>) =>
        ((event.authorization as Record<string, unknown>[])[0].purpose =
          GOVERNED_PURPOSES.PRODUCT_ANALYTICS),
      'AUTHORIZATION_PURPOSE_MISMATCH',
    ],
    [
      'authorization policy',
      (event: Record<string, unknown>) =>
        ((event.authorization as { policy: Record<string, unknown> }[])[0].policy.id =
          'other-policy'),
      'AUTHORIZATION_POLICY_MISMATCH',
    ],
    [
      'retention policy',
      (event: Record<string, unknown>) =>
        ((event.retention as { policy: Record<string, unknown> }).policy.id = 'weaker-policy'),
      'RETENTION_POLICY_MISMATCH',
    ],
    [
      'payload extension',
      (event: Record<string, unknown>) =>
        ((event.payload as Record<string, unknown>).raw = 'content'),
      'PAYLOAD_UNKNOWN_PROPERTY',
    ],
  ])(
    'rejects %s even when the attacker recalculates both digests',
    (_label, mutate, expectedCode) => {
      const candidate = structuredClone(validEnvelope()) as unknown as Record<string, unknown>;
      mutate(candidate);
      const resigned = recalculateDigests(candidate as unknown as GovernedEventEnvelopeV1);
      expect(codes(validateGovernedEventEnvelopeV1(JSON.stringify(resigned), registry))).toContain(
        expectedCode
      );
    }
  );

  it('rejects duplicate wire keys rather than accepting JSON last-key-wins behavior', () => {
    const text = JSON.stringify(validEnvelope()).replace(
      '"eventId":',
      '"eventId":"attacker-event","eventId":'
    );
    expect(codes(validateGovernedEventEnvelopeV1(text, registry))).toContain('DUPLICATE_JSON_KEY');
  });

  it('binds identity, runtime, authorization, and retention into the full content digest', () => {
    const linked = linkedFamily();
    const linkedRegistry = createGovernedEventRegistryV1([linked]);
    const identityCandidate = envelopeForFamily(linked, {
      profilePseudonymId: 'profile-before',
      productSessionId: 'session-before',
      investigationId: null,
      discoveryEpisodeId: null,
    });
    (identityCandidate.identities as unknown as { profilePseudonymId: string }).profilePseudonymId =
      'profile-after';

    const runtimeCandidate = structuredClone(validEnvelope());
    (
      runtimeCandidate.runtime.components.applicationBuild as unknown as { version: string }
    ).version = '1.0.1-sha.deadbeef';

    const authorizationCandidate = structuredClone(validEnvelope());
    (authorizationCandidate.authorization[0].evidence as unknown as { id: string }).id =
      'deployment-policy-decision-002';

    const retentionFamily = structuredClone(baseFamily());
    (retentionFamily.retentionPolicy.policy as unknown as { version: string }).version = '2';
    (retentionFamily.retentionPolicy.policy.digest as unknown as { value: string }).value =
      '8'.repeat(64);
    const retentionRegistry = createGovernedEventRegistryV1([retentionFamily]);
    const retentionCandidate = structuredClone(validEnvelope());
    (
      retentionCandidate as unknown as {
        retention: GovernedEventEnvelopeV1['retention'];
      }
    ).retention = retentionFamily.retentionPolicy;

    for (const [candidate, candidateRegistry] of [
      [identityCandidate, linkedRegistry],
      [runtimeCandidate, registry],
      [authorizationCandidate, registry],
      [retentionCandidate, retentionRegistry],
    ] as const) {
      expect(candidate.payloadDigest).toEqual(validEnvelope().payloadDigest);
      expect(
        codes(validateGovernedEventEnvelopeV1(JSON.stringify(candidate), candidateRegistry))
      ).toContain('CONTENT_DIGEST_MISMATCH');
    }
  });

  it('rejects every required and forbidden identity and runtime coordinate', () => {
    const identityKeys = [
      'profilePseudonymId',
      'productSessionId',
      'investigationId',
      'discoveryEpisodeId',
    ] as const;
    for (const [index, key] of identityKeys.entries()) {
      const forbidden = structuredClone(validEnvelope());
      (forbidden.identities as unknown as Record<string, string | null>)[key] = `forbidden-${key}`;
      expect(
        codes(
          validateGovernedEventEnvelopeV1(JSON.stringify(recalculateDigests(forbidden)), registry)
        )
      ).toContain('FORBIDDEN_IDENTITY');

      const family = linkedFamily();
      (family as unknown as { familyId: string }).familyId = `test.identity.${index}.v1`;
      const requirements = family.identityRequirements as unknown as Record<string, string>;
      for (const identityKey of identityKeys) requirements[identityKey] = 'FORBIDDEN';
      requirements[key] = 'REQUIRED';
      if (key === 'discoveryEpisodeId') requirements.investigationId = 'REQUIRED';
      const identities = Object.fromEntries(
        identityKeys.map((identityKey) => [
          identityKey,
          requirements[identityKey] === 'REQUIRED' ? `required-${identityKey}` : null,
        ])
      ) as unknown as GovernedEventEnvelopeV1['identities'];
      const requiredRegistry = createGovernedEventRegistryV1([family]);
      const missing = envelopeForFamily(family, identities);
      (missing.identities as unknown as Record<string, string | null>)[key] = null;
      expect(
        codes(
          validateGovernedEventEnvelopeV1(
            JSON.stringify(recalculateDigests(missing)),
            requiredRegistry
          )
        )
      ).toContain('MISSING_IDENTITY');
    }

    const runtimeRequirements = baseFamily().runtimeRequirements;
    for (const [index, component] of Object.keys(runtimeRequirements).entries()) {
      const candidate = structuredClone(validEnvelope());
      const components = candidate.runtime.components as unknown as Record<
        string,
        RuntimeComponentReferenceV1 | null
      >;
      if (runtimeRequirements[component as keyof typeof runtimeRequirements] === 'REQUIRED') {
        components[component] = null;
        expect(
          codes(
            validateGovernedEventEnvelopeV1(JSON.stringify(recalculateDigests(candidate)), registry)
          )
        ).toContain('MISSING_RUNTIME_COMPONENT');
      } else {
        components[component] = runtimeReference(`forbidden-${component}`, String(index % 10));
        expect(
          codes(
            validateGovernedEventEnvelopeV1(JSON.stringify(recalculateDigests(candidate)), registry)
          )
        ).toContain('FORBIDDEN_RUNTIME_COMPONENT');
      }
    }

    const forbiddenDataset = structuredClone(validEnvelope());
    (forbiddenDataset as unknown as { dataset: GovernedEventEnvelopeV1['dataset'] }).dataset = {
      schemaVersion: '1',
      datasetFingerprint: digest('7'),
      corpus: null,
    };
    expect(
      codes(
        validateGovernedEventEnvelopeV1(
          JSON.stringify(recalculateDigests(forbiddenDataset)),
          registry
        )
      )
    ).toContain('FORBIDDEN_DATASET_REFERENCE');
  });

  it('rejects unknown properties at every nested envelope-object level', () => {
    const mutations: Array<(candidate: Record<string, unknown>) => void> = [
      (candidate) => ((candidate.identities as Record<string, unknown>).extra = true),
      (candidate) => ((candidate.runtime as Record<string, unknown>).extra = true),
      (candidate) =>
        ((candidate.runtime as { components: Record<string, unknown> }).components.extra = true),
      (candidate) =>
        ((
          (candidate.runtime as { components: Record<string, unknown> }).components
            .applicationBuild as Record<string, unknown>
        ).extra = true),
      (candidate) =>
        ((
          (candidate.runtime as { components: Record<string, unknown> }).components
            .applicationBuild as { artifactDigest: Record<string, unknown> }
        ).artifactDigest.extra = true),
      (candidate) =>
        (((candidate.authorization as Record<string, unknown>[])[0] as Record<string, unknown>)[
          'extra'
        ] = true),
      (candidate) =>
        ((candidate.authorization as { authority: Record<string, unknown> }[])[0].authority.extra =
          true),
      (candidate) =>
        ((
          candidate.authorization as { authority: { digest: Record<string, unknown> } }[]
        )[0].authority.digest.extra = true),
      (candidate) =>
        ((candidate.authorization as { evidence: Record<string, unknown> }[])[0].evidence.extra =
          true),
      (candidate) =>
        ((
          candidate.authorization as { evidence: { digest: Record<string, unknown> } }[]
        )[0].evidence.digest.extra = true),
      (candidate) =>
        ((candidate.authorization as { policy: Record<string, unknown> }[])[0].policy.extra = true),
      (candidate) =>
        ((
          candidate.authorization as { policy: { digest: Record<string, unknown> } }[]
        )[0].policy.digest.extra = true),
      (candidate) => ((candidate.retention as Record<string, unknown>).extra = true),
      (candidate) =>
        ((candidate.retention as { policy: Record<string, unknown> }).policy.extra = true),
      (candidate) =>
        ((
          candidate.retention as { policy: { digest: Record<string, unknown> } }
        ).policy.digest.extra = true),
      (candidate) => ((candidate.payloadDigest as Record<string, unknown>).extra = true),
      (candidate) => ((candidate.contentDigest as Record<string, unknown>).extra = true),
    ];
    for (const mutate of mutations) {
      let candidate = structuredClone(validEnvelope()) as unknown as Record<string, unknown>;
      mutate(candidate);
      const contentDigestHadExtra =
        (candidate.contentDigest as Record<string, unknown>).extra === true;
      candidate = recalculateContentDigest(
        candidate as unknown as GovernedEventEnvelopeV1
      ) as unknown as Record<string, unknown>;
      if (contentDigestHadExtra) {
        (candidate.contentDigest as Record<string, unknown>).extra = true;
      }
      expect(
        codes(
          validateGovernedEventEnvelopeV1(
            JSON.stringify(candidate as unknown as GovernedEventEnvelopeV1),
            registry
          )
        )
      ).toContain('UNKNOWN_PROPERTY');
    }
  });

  it('rejects missing and collapsed cross-kind identities for an identity-linked family', () => {
    const linkedRegistry = createGovernedEventRegistryV1([linkedFamily()]);
    const candidate = structuredClone(validEnvelope()) as unknown as Record<string, unknown>;
    candidate.eventFamilyId = linkedFamily().familyId;
    candidate.effectiveSensitivity = 'PSEUDONYMOUS';
    candidate.identities = {
      profilePseudonymId: 'same-convenient-token',
      productSessionId: 'same-convenient-token',
      investigationId: null,
      discoveryEpisodeId: null,
    };
    candidate.authorization = linkedFamily().authorizationRequirements.map(
      (requirement, index) => ({
        schemaVersion: '1',
        basis: requirement.basis,
        purpose: linkedFamily().purpose,
        authority: requirement.authority,
        evidence: {
          id: `linked-evidence-${index}`,
          revision: '1',
          digest: digest(String(index + 1)),
        },
        policy: requirement.policy,
      })
    );
    const collapsed = recalculateDigests(candidate as unknown as GovernedEventEnvelopeV1);
    expect(
      codes(validateGovernedEventEnvelopeV1(JSON.stringify(collapsed), linkedRegistry))
    ).toContain('COLLAPSED_IDENTITY');

    (candidate.identities as Record<string, unknown>).productSessionId = null;
    const missing = recalculateDigests(candidate as unknown as GovernedEventEnvelopeV1);
    expect(
      codes(validateGovernedEventEnvelopeV1(JSON.stringify(missing), linkedRegistry))
    ).toContain('MISSING_IDENTITY');
  });

  it('requires complete commit-pinned dataset evidence for dataset-bearing families', () => {
    const family = datasetFamily();
    const datasetRegistry = createGovernedEventRegistryV1([family]);
    const candidate = structuredClone(validEnvelope()) as unknown as Record<string, unknown>;
    candidate.eventFamilyId = family.familyId;
    candidate.purpose = family.purpose;
    candidate.dataClasses = [...family.dataClasses];
    candidate.effectiveSensitivity = 'SENSITIVE';
    candidate.identities = {
      profilePseudonymId: 'product-analytics-profile-1',
      productSessionId: 'product-session-1',
      investigationId: null,
      discoveryEpisodeId: null,
    };
    candidate.dataset = {
      schemaVersion: '1',
      datasetFingerprint: digest('3'),
      corpus: {
        repository: 'github.com/TsatsuAmable/nemosyne-data',
        revision: '8e6b2dfc74ea1c60283790668cc93030c61423f8',
        catalogueSchemaVersion: '1',
        corpusVersion: '1',
        datasetId: 'known-answer-aggregate',
        datasetVersion: '1',
        contentDigest: digest('4'),
        artifactTier: 'known-answer',
        artifactRole: 'input',
        artifactDigest: digest('5'),
      },
    };
    candidate.authorization = [
      {
        schemaVersion: '1',
        basis: 'CONSENT_RECEIPT',
        purpose: family.purpose,
        authority: authorityReference,
        evidence: { id: 'receipt-1', revision: '1', digest: digest('6') },
        policy: family.authorizationRequirements[0].policy,
      },
    ];
    const complete = recalculateDigests(candidate as unknown as GovernedEventEnvelopeV1);
    expect(validateGovernedEventEnvelopeV1(JSON.stringify(complete), datasetRegistry).ok).toBe(
      true
    );

    const missingDataset = structuredClone(complete);
    (missingDataset as unknown as { dataset: null }).dataset = null;
    expect(
      codes(
        validateGovernedEventEnvelopeV1(
          JSON.stringify(recalculateDigests(missingDataset)),
          datasetRegistry
        )
      )
    ).toContain('MISSING_DATASET_REFERENCE');

    const unknownDatasetProperty = structuredClone(complete);
    (unknownDatasetProperty.dataset as unknown as Record<string, unknown>).extra = true;
    expect(
      codes(
        validateGovernedEventEnvelopeV1(
          JSON.stringify(recalculateContentDigest(unknownDatasetProperty)),
          datasetRegistry
        )
      )
    ).toContain('UNKNOWN_PROPERTY');

    const unknownCorpusProperty = structuredClone(complete);
    (unknownCorpusProperty.dataset as unknown as { corpus: Record<string, unknown> }).corpus.extra =
      true;
    expect(
      codes(
        validateGovernedEventEnvelopeV1(
          JSON.stringify(recalculateContentDigest(unknownCorpusProperty)),
          datasetRegistry
        )
      )
    ).toContain('UNKNOWN_PROPERTY');

    const datasetDigestMutations: Array<(dataset: Record<string, unknown>) => void> = [
      (dataset) => ((dataset.datasetFingerprint as Record<string, unknown>).extra = true),
      (dataset) =>
        ((
          (dataset.corpus as Record<string, unknown>).contentDigest as Record<string, unknown>
        ).extra = true),
      (dataset) =>
        ((
          (dataset.corpus as Record<string, unknown>).artifactDigest as Record<string, unknown>
        ).extra = true),
    ];
    for (const mutate of datasetDigestMutations) {
      const withUnknownDigestProperty = structuredClone(complete);
      mutate(withUnknownDigestProperty.dataset as unknown as Record<string, unknown>);
      expect(
        codes(
          validateGovernedEventEnvelopeV1(
            JSON.stringify(recalculateContentDigest(withUnknownDigestProperty)),
            datasetRegistry
          )
        )
      ).toContain('UNKNOWN_PROPERTY');
    }

    (candidate.dataset as { corpus: Record<string, unknown> }).corpus.revision = 'main';
    const mutable = recalculateDigests(candidate as unknown as GovernedEventEnvelopeV1);
    expect(
      codes(validateGovernedEventEnvelopeV1(JSON.stringify(mutable), datasetRegistry))
    ).toContain('MUTABLE_CORPUS_REVISION');
  });

  it('rejects placeholder runtime identity and impossible timestamps', () => {
    const runtime = structuredClone(validEnvelope()) as unknown as Record<string, unknown>;
    (
      runtime.runtime as { components: { applicationBuild: Record<string, unknown> } }
    ).components.applicationBuild.version = 'unknown';
    const resignedRuntime = recalculateDigests(runtime as unknown as GovernedEventEnvelopeV1);
    expect(
      codes(validateGovernedEventEnvelopeV1(JSON.stringify(resignedRuntime), registry))
    ).toContain('PLACEHOLDER_VALUE');

    const timestamp = structuredClone(validEnvelope()) as unknown as Record<string, unknown>;
    timestamp.capturedAt = '2026-02-30T19:00:00.000Z';
    const resignedTimestamp = recalculateDigests(timestamp as unknown as GovernedEventEnvelopeV1);
    expect(
      codes(validateGovernedEventEnvelopeV1(JSON.stringify(resignedTimestamp), registry))
    ).toContain('INVALID_TIMESTAMP');
  });

  it('requires complete, unique, canonically ordered authorization combinations', () => {
    const family = humanValidationFamily();
    const validationRegistry = createGovernedEventRegistryV1([family]);
    const candidate = structuredClone(validEnvelope()) as unknown as Record<string, unknown>;
    candidate.eventFamilyId = family.familyId;
    candidate.purpose = family.purpose;
    candidate.effectiveSensitivity = 'PSEUDONYMOUS';
    candidate.identities = {
      profilePseudonymId: 'qualification-participant-purpose-pseudonym',
      productSessionId: null,
      investigationId: null,
      discoveryEpisodeId: null,
    };
    candidate.authorization = family.authorizationRequirements.map((requirement, index) => ({
      schemaVersion: '1',
      basis: requirement.basis,
      purpose: family.purpose,
      authority: requirement.authority,
      evidence: { id: `evidence-${index}`, revision: '1', digest: digest(String(index + 1)) },
      policy: requirement.policy,
    }));
    const complete = recalculateDigests(candidate as unknown as GovernedEventEnvelopeV1);
    expect(validateGovernedEventEnvelopeV1(JSON.stringify(complete), validationRegistry).ok).toBe(
      true
    );

    candidate.authorization = (candidate.authorization as unknown[]).slice(1);
    const incomplete = recalculateDigests(candidate as unknown as GovernedEventEnvelopeV1);
    expect(
      codes(validateGovernedEventEnvelopeV1(JSON.stringify(incomplete), validationRegistry))
    ).toEqual(
      expect.arrayContaining(['AUTHORIZATION_COMBINATION_MISMATCH', 'MISSING_AUTHORIZATION_BASIS'])
    );

    candidate.authorization = [...complete.authorization].reverse();
    const reordered = recalculateDigests(candidate as unknown as GovernedEventEnvelopeV1);
    expect(
      codes(validateGovernedEventEnvelopeV1(JSON.stringify(reordered), validationRegistry))
    ).toContain('AUTHORIZATION_ORDER_MISMATCH');

    candidate.authorization = [complete.authorization[0], complete.authorization[0]];
    const duplicate = recalculateDigests(candidate as unknown as GovernedEventEnvelopeV1);
    expect(
      codes(validateGovernedEventEnvelopeV1(JSON.stringify(duplicate), validationRegistry))
    ).toContain('DUPLICATE_AUTHORIZATION_BASIS');

    candidate.authorization = structuredClone(complete.authorization);
    (candidate.authorization as Record<string, unknown>[])[0].basis = 'DEPLOYED_POLICY';
    const wrongBasis = recalculateDigests(candidate as unknown as GovernedEventEnvelopeV1);
    expect(
      codes(validateGovernedEventEnvelopeV1(JSON.stringify(wrongBasis), validationRegistry))
    ).toEqual(
      expect.arrayContaining(['AUTHORIZATION_COMBINATION_MISMATCH', 'MISSING_AUTHORIZATION_BASIS'])
    );
  });

  it('rejects payload digest mismatch and canonical-size overflow', () => {
    const mismatch = structuredClone(validEnvelope());
    (mismatch.payloadDigest as unknown as { value: string }).value = '0'.repeat(64);
    expect(codes(validateGovernedEventEnvelopeV1(JSON.stringify(mismatch), registry))).toContain(
      'PAYLOAD_DIGEST_MISMATCH'
    );

    const smallFamily = baseFamily();
    (smallFamily as unknown as { maxPayloadBytes: number }).maxPayloadBytes = 2;
    const smallRegistry = createGovernedEventRegistryV1([smallFamily]);
    expect(
      codes(validateGovernedEventEnvelopeV1(JSON.stringify(validEnvelope()), smallRegistry))
    ).toContain('PAYLOAD_TOO_LARGE');
  });

  it('bounds validation diagnostics for adversarial extension floods', () => {
    const candidate = structuredClone(validEnvelope()) as unknown as Record<string, unknown>;
    candidate.payload = Object.fromEntries(
      Array.from({ length: 200 }, (_unused, index) => [`unknown-${index}`, index])
    );
    const resigned = recalculateDigests(candidate as unknown as GovernedEventEnvelopeV1);
    const result = validateGovernedEventEnvelopeV1(JSON.stringify(resigned), registry);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toHaveLength(101);
    expect(result.issues.at(-1)?.code).toBe('VALIDATION_ISSUE_LIMIT');
  });
});

describe('PT3B authority-gated admission', () => {
  it('never invokes authority for structurally invalid wire input', async () => {
    let evaluations = 0;
    const authority: GovernanceAdmissionAuthorityV1 = {
      async evaluate() {
        evaluations += 1;
        return {
          status: 'AUTHORIZED',
          decisionId: 'must-not-run',
          authorityVersion: '1',
          evaluatedAt: '2026-09-02T19:00:01.000Z',
        };
      },
    };
    const invalid = structuredClone(validEnvelope()) as unknown as Record<string, unknown>;
    invalid.extra = true;
    const result = await admitGovernedEventEnvelopeV1(JSON.stringify(invalid), registry, authority);
    expect(result.ok).toBe(false);
    expect(evaluations).toBe(0);
  });

  it('does not promote structural validity when the current authority refuses', async () => {
    const authority: GovernanceAdmissionAuthorityV1 = {
      async evaluate() {
        return {
          status: 'REFUSED',
          reasonCode: 'REVOKED',
          message: 'receipt is no longer current',
        };
      },
    };
    const result = await admitGovernedEventEnvelopeV1(
      JSON.stringify(validEnvelope()),
      registry,
      authority
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.map((issue) => issue.code)).toContain('AUTHORITY_REFUSED');
  });

  it('fails closed when the trusted authority errors or returns malformed authorization', async () => {
    const unavailable: GovernanceAdmissionAuthorityV1 = {
      async evaluate() {
        throw new Error('offline');
      },
    };
    const malformed: GovernanceAdmissionAuthorityV1 = {
      async evaluate() {
        return {
          status: 'AUTHORIZED',
          decisionId: '',
          authorityVersion: '1',
          evaluatedAt: '2026-09-02T19:01:00.000Z',
        };
      },
    };
    const text = JSON.stringify(validEnvelope());
    const first = await admitGovernedEventEnvelopeV1(text, registry, unavailable);
    const second = await admitGovernedEventEnvelopeV1(text, registry, malformed);
    expect(first.ok ? [] : first.issues.map((issue) => issue.code)).toContain(
      'AUTHORITY_UNAVAILABLE'
    );
    expect(second.ok ? [] : second.issues.map((issue) => issue.code)).toContain(
      'INVALID_AUTHORITY_DECISION'
    );
  });

  it('returns a deeply immutable admitted value only after current authority verification', async () => {
    let observedFrozen = false;
    const authority: GovernanceAdmissionAuthorityV1 = {
      async evaluate(context) {
        observedFrozen =
          Object.isFrozen(context.envelope) && Object.isFrozen(context.envelope.authorization[0]);
        return {
          status: 'AUTHORIZED',
          decisionId: 'decision-001',
          authorityVersion: 'governance-authority-v1',
          evaluatedAt: '2026-09-02T19:01:00.000Z',
        };
      },
    };
    const result = await admitGovernedEventEnvelopeV1(
      JSON.stringify(validEnvelope()),
      registry,
      authority
    );
    expect(result.ok).toBe(true);
    expect(observedFrozen).toBe(true);
    if (!result.ok) return;
    expectDeepFrozen(result.value);
    expect(
      () => ((result.value.envelope.payload as Record<string, JsonValue>).count = 99)
    ).toThrow();
    expect(result.value.envelope.payload).toEqual({
      metric: 'operation-count',
      count: 7,
      windowMs: 1_000,
    });
  });
});
