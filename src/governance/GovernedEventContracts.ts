export const GOVERNED_EVENT_ENVELOPE_VERSION = '1' as const;
export const GOVERNED_REFERENCE_VERSION = '1' as const;

export const GOVERNED_PURPOSES = {
  OPERATIONAL_DIAGNOSTICS: 'operational-diagnostics',
  ENGINEERING_QUALIFICATION: 'engineering-qualification',
  PRODUCT_ANALYTICS: 'product-analytics',
  DERIVED_GESTURE_LEARNING: 'derived-gesture-learning',
  RAW_TRAJECTORY_RESEARCH: 'raw-trajectory-research',
  MONETA_LEARNING_EVIDENCE: 'moneta-learning-evidence',
  GOVERNED_STUDY_COLLECTION: 'governed-study-collection',
  CONSENT_LIFECYCLE_ENFORCEMENT: 'consent-lifecycle-enforcement',
  LOCAL_PRODUCT_PERSISTENCE: 'local-product-persistence',
  USER_DIRECTED_EXPORT: 'user-directed-export',
  OPTIONAL_BACKUP_SHARE: 'optional-backup-share',
} as const;

export type GovernedPurpose = (typeof GOVERNED_PURPOSES)[keyof typeof GOVERNED_PURPOSES];

export const GOVERNED_DATA_CLASSES = {
  BOUNDED_OPERATIONAL_AGGREGATE: 'BOUNDED_OPERATIONAL_AGGREGATE',
  PRODUCT_INTERACTION_METADATA: 'PRODUCT_INTERACTION_METADATA',
  DIAGNOSTIC_CONTENT: 'DIAGNOSTIC_CONTENT',
  SCIENTIFIC_DATASET_REFERENCE: 'SCIENTIFIC_DATASET_REFERENCE',
  DERIVED_GESTURE_FEATURE: 'DERIVED_GESTURE_FEATURE',
  RAW_SPATIAL_TRAJECTORY: 'RAW_SPATIAL_TRAJECTORY',
  HUMAN_JUDGEMENT_DISCOVERY_EVIDENCE: 'HUMAN_JUDGEMENT_DISCOVERY_EVIDENCE',
  GOVERNED_STUDY_RECORD: 'GOVERNED_STUDY_RECORD',
  GOVERNED_VALIDATION_EVIDENCE: 'GOVERNED_VALIDATION_EVIDENCE',
  SCIENTIFIC_SESSION_CONTENT: 'SCIENTIFIC_SESSION_CONTENT',
  CONSENT_LIFECYCLE_RECORD: 'CONSENT_LIFECYCLE_RECORD',
} as const;

export type GovernedDataClass = (typeof GOVERNED_DATA_CLASSES)[keyof typeof GOVERNED_DATA_CLASSES];
export type GovernedSensitivity = 'LOW' | 'PSEUDONYMOUS' | 'SENSITIVE' | 'HIGHLY_SENSITIVE';
export type GovernedMode = 'PRODUCT' | 'RESEARCH';
export type Requirement = 'REQUIRED' | 'FORBIDDEN';

export type JsonPrimitive = null | boolean | number | string;
export type JsonValue =
  JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };

export interface Sha256DigestV1 {
  readonly algorithm: 'SHA256';
  readonly value: string;
}

export interface ImmutableReferenceV1 {
  readonly schemaVersion: typeof GOVERNED_REFERENCE_VERSION;
  readonly id: string;
  readonly version: string;
  readonly digest: Sha256DigestV1;
}

export type AuthorizationBasis =
  | 'CONSENT_RECEIPT'
  | 'DEPLOYED_POLICY'
  | 'FROZEN_STUDY_PROTOCOL'
  | 'EXPLICIT_USER_ACTION'
  | 'VALIDATION_MANIFEST';

export interface AuthorizationEvidenceV1 {
  readonly id: string;
  readonly revision: string;
  readonly digest: Sha256DigestV1;
}

export interface AuthorizationReferenceV1 {
  readonly schemaVersion: typeof GOVERNED_REFERENCE_VERSION;
  readonly basis: AuthorizationBasis;
  readonly purpose: GovernedPurpose;
  readonly authority: ImmutableReferenceV1;
  readonly evidence: AuthorizationEvidenceV1;
  readonly policy: ImmutableReferenceV1;
}

export interface AuthorizationRequirementV1 {
  readonly basis: AuthorizationBasis;
  readonly authority: ImmutableReferenceV1;
  readonly policy: ImmutableReferenceV1;
}

export interface RetentionPolicyReferenceV1 {
  readonly schemaVersion: typeof GOVERNED_REFERENCE_VERSION;
  readonly policy: ImmutableReferenceV1;
}

export interface GovernedIdentityReferencesV1 {
  readonly profilePseudonymId: string | null;
  readonly productSessionId: string | null;
  readonly investigationId: string | null;
  readonly discoveryEpisodeId: string | null;
}

export type GovernedIdentityKey = keyof GovernedIdentityReferencesV1;

export interface GovernedCorpusReferenceV1 {
  readonly repository: string;
  readonly revision: string;
  readonly catalogueSchemaVersion: string;
  readonly corpusVersion: string;
  readonly datasetId: string;
  readonly datasetVersion: string;
  readonly contentDigest: Sha256DigestV1;
  readonly artifactTier: string;
  readonly artifactRole: string;
  readonly artifactDigest: Sha256DigestV1;
}

export interface DatasetEvidenceReferenceV1 {
  readonly schemaVersion: typeof GOVERNED_REFERENCE_VERSION;
  readonly datasetFingerprint: Sha256DigestV1;
  readonly corpus: GovernedCorpusReferenceV1 | null;
}

export const RUNTIME_COMPONENTS = [
  'applicationBuild',
  'deploymentConfiguration',
  'wasmKernel',
  'representationTreatment',
  'monetaEngine',
  'fitnessModel',
  'nil',
  'perceptionGestureTreatment',
  'uiTreatment',
  'platformRuntime',
] as const;

export type RuntimeComponent = (typeof RUNTIME_COMPONENTS)[number];

export interface RuntimeComponentReferenceV1 {
  readonly schemaVersion: typeof GOVERNED_REFERENCE_VERSION;
  readonly componentId: string;
  readonly version: string;
  readonly artifactDigest: Sha256DigestV1;
}

export type RuntimeComponentReferencesV1 = Readonly<
  Record<RuntimeComponent, RuntimeComponentReferenceV1 | null>
>;

export interface RuntimeProvenanceV1 {
  readonly schemaVersion: typeof GOVERNED_REFERENCE_VERSION;
  readonly components: RuntimeComponentReferencesV1;
  readonly randomSeeds: Readonly<Record<string, number>>;
}

export type ClosedPayloadSchemaV1 =
  | {
      readonly type: 'object';
      readonly properties: Readonly<Record<string, ClosedPayloadSchemaV1>>;
      readonly required: readonly string[];
    }
  | {
      readonly type: 'array';
      readonly items: ClosedPayloadSchemaV1;
      readonly minItems: number;
      readonly maxItems: number;
    }
  | {
      readonly type: 'string';
      readonly minLength: number;
      readonly maxLength: number;
      readonly format?: 'PLAIN' | 'UTC_TIMESTAMP' | 'SHA256_HEX';
      readonly allowedValues?: readonly string[];
    }
  | {
      readonly type: 'number' | 'integer';
      readonly minimum: number;
      readonly maximum: number;
    }
  | { readonly type: 'boolean' }
  | { readonly type: 'null' };

export interface GovernedEventFamilyDefinitionV1Input {
  readonly familyId: string;
  readonly payloadSchemaVersion: string;
  readonly purpose: GovernedPurpose;
  readonly dataClasses: readonly GovernedDataClass[];
  readonly identityRequirements: Readonly<Record<GovernedIdentityKey, Requirement>>;
  readonly datasetRequirement: Requirement;
  readonly runtimeRequirements: Readonly<Record<RuntimeComponent, Requirement>>;
  readonly requiredSeedNames: readonly string[];
  readonly allowedModes: readonly GovernedMode[];
  readonly allowedSourceComponents: readonly string[];
  readonly payloadSchema: ClosedPayloadSchemaV1;
  readonly maxPayloadBytes: number;
  readonly retentionPolicy: RetentionPolicyReferenceV1;
  readonly authorizationRequirements: readonly AuthorizationRequirementV1[];
  readonly exportVisibility: 'NONE' | 'USER_EXPORT' | 'GOVERNED_EXPORT';
  readonly revocationBehavior: 'DISCARD_QUEUED' | 'POLICY_GOVERNED' | 'NOT_APPLICABLE';
  readonly erasureReachability: 'REGISTERED_STORE' | 'LOCAL_CLIENT' | 'OUTSIDE_SERVICE_CONTROL';
}

export interface GovernedEventFamilyDefinitionV1 extends GovernedEventFamilyDefinitionV1Input {
  readonly effectiveSensitivity: GovernedSensitivity;
}

export interface GovernedPayloadDigestV1 {
  readonly algorithm: 'NEMOSYNE_CANONICAL_JSON_SHA256_V1';
  readonly value: string;
}

export interface GovernedEventContentDigestV1 {
  readonly algorithm: 'NEMOSYNE_GOVERNED_EVENT_SHA256_V1';
  readonly value: string;
}

export interface GovernedEventEnvelopeV1 {
  readonly schemaVersion: typeof GOVERNED_EVENT_ENVELOPE_VERSION;
  readonly eventFamilyId: string;
  readonly payloadSchemaVersion: string;
  readonly eventId: string;
  readonly streamId: string;
  readonly producerInstanceId: string;
  readonly streamSequence: number;
  readonly capturedAt: string;
  readonly sourceComponent: string;
  readonly mode: GovernedMode;
  readonly purpose: GovernedPurpose;
  readonly dataClasses: readonly GovernedDataClass[];
  readonly effectiveSensitivity: GovernedSensitivity;
  readonly identities: GovernedIdentityReferencesV1;
  readonly dataset: DatasetEvidenceReferenceV1 | null;
  readonly runtime: RuntimeProvenanceV1;
  readonly authorization: readonly AuthorizationReferenceV1[];
  readonly retention: RetentionPolicyReferenceV1;
  readonly payload: JsonValue;
  readonly payloadDigest: GovernedPayloadDigestV1;
  readonly contentDigest: GovernedEventContentDigestV1;
}

export interface GovernanceValidationIssue {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

export interface GovernanceAuthorityContextV1 {
  readonly envelope: GovernedEventEnvelopeV1;
  readonly family: GovernedEventFamilyDefinitionV1;
}

export type GovernanceAuthorityDecisionV1 =
  | {
      readonly status: 'AUTHORIZED';
      readonly decisionId: string;
      readonly authorityVersion: string;
      readonly evaluatedAt: string;
    }
  | { readonly status: 'REFUSED'; readonly reasonCode: string; readonly message: string };

/** Trusted composition capability; never deserialize this interface from event input. */
export interface GovernanceAdmissionAuthorityV1 {
  evaluate(context: GovernanceAuthorityContextV1): Promise<GovernanceAuthorityDecisionV1>;
}

export interface AdmittedGovernedEventV1 {
  readonly envelope: GovernedEventEnvelopeV1;
  readonly family: GovernedEventFamilyDefinitionV1;
  readonly authorityDecision: Extract<GovernanceAuthorityDecisionV1, { status: 'AUTHORIZED' }>;
}
