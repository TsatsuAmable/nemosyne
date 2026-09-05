import {
  FEATURE_DIM,
  GESTURE_CLASSES,
  TRAJECTORY_CAPACITY,
  type GestureClass,
} from '../../../modules/gesture-intelligence/src/contracts.ts';
import {
  DERIVED_GESTURE_AUTHORITY_REFERENCE,
  DERIVED_GESTURE_FEATURE_SCHEMA_REFERENCE,
  DERIVED_GESTURE_LABEL_CODES,
  DERIVED_GESTURE_NOTICE_REFERENCE,
  DERIVED_GESTURE_OBSERVATION_FAMILY_ID,
  DERIVED_GESTURE_RETENTION_REFERENCE,
  DERIVED_GESTURE_SOURCE_COMPONENT,
  GOVERNED_DATA_CLASSES,
  GOVERNED_PURPOSES,
  RAW_GESTURE_CONSENT_AUTHORITY_REFERENCE,
  RAW_GESTURE_NOTICE_REFERENCE,
  RAW_GESTURE_PROTOCOL_AUTHORITY_REFERENCE,
  RAW_GESTURE_PROTOCOL_POLICY_REFERENCE,
  RAW_GESTURE_RETENTION_REFERENCE,
  RAW_GESTURE_SOURCE_COMPONENT,
  RAW_GESTURE_TRAJECTORY_FAMILY_ID,
  RAW_GESTURE_TRAJECTORY_SCHEMA_ARTIFACT,
  RAW_GESTURE_TRAJECTORY_SCHEMA_REFERENCE,
  computeGovernedEventContentDigestV1,
  computeGovernedPayloadDigestV1,
  type AuthorizationEvidenceV1,
  type GestureLearningCaptureAuthorizationRequestV1,
  type GestureLearningCaptureAuthorizationV1,
  type GestureLearningEventDispositionV1,
  type GovernedEventEnvelopeV1,
  type JsonValue,
  type RuntimeProvenanceV1,
} from '../../governance/index.ts';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRODUCER_PATTERN = /^piv1_[0-9a-f-]{36}$/i;
const STREAM_PATTERN = /^strv1_[0-9a-f-]{36}$/i;
const DERIVED_LABEL_SET = new Set<string>(DERIVED_GESTURE_LABEL_CODES);
const GESTURE_CLASS_SET = new Set<string>(GESTURE_CLASSES);

export interface GestureLearningGovernanceTransportV1 {
  authorizeCapture(request: GestureLearningCaptureAuthorizationRequestV1): Promise<GestureLearningCaptureAuthorizationV1>;
  ingestLine(jsonText: string): Promise<GestureLearningEventDispositionV1>;
}

export interface LegacyRawGesturePointV1 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly pinched: boolean;
  /** Legacy absolute capture timestamp in milliseconds. */
  readonly t: number;
}

export interface GovernedGestureCaptureUploaderOptionsV1 {
  readonly transport: GestureLearningGovernanceTransportV1;
  readonly runtime: RuntimeProvenanceV1;
  readonly producerInstanceId: string;
  readonly derivedStreamId: string;
  readonly rawStreamId: string;
  readonly uuid?: () => string;
}

export interface DerivedGestureUploadV1 {
  readonly features: Float32Array | readonly number[];
  readonly labelCode: string;
  readonly evidenceId: string;
  readonly recordedAt: string;
}

export interface RawGestureUploadV1 {
  readonly left: readonly LegacyRawGesturePointV1[];
  readonly right: readonly LegacyRawGesturePointV1[];
  readonly protocolEvidence: AuthorizationEvidenceV1;
  readonly protocolTargetGesture?: GestureClass;
}

function assertUuid(value: string, label: string): void {
  if (!UUID_PATTERN.test(value)) throw new TypeError(`${label} must be a UUID`);
}

function assertRuntime(runtime: RuntimeProvenanceV1): void {
  if (runtime.schemaVersion !== '1') throw new TypeError('runtime schemaVersion must be 1');
  const required = runtime.components;
  if (!required.applicationBuild || !required.deploymentConfiguration || !required.perceptionGestureTreatment || !required.platformRuntime) {
    throw new TypeError('gesture learning requires application, deployment, perception/gesture and platform runtime provenance');
  }
  if (
    required.wasmKernel || required.representationTreatment || required.monetaEngine || required.fitnessModel ||
    required.nil || required.uiTreatment
  ) {
    throw new TypeError('gesture-learning capture must not attach unrelated analytical/representation/UI runtime authorities');
  }
}

function canonicalRecordedAt(value: string): string {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new TypeError('recordedAt must be a canonical UTC timestamp');
  }
  return value;
}

function validateDerivedInput(input: DerivedGestureUploadV1): Readonly<{ features: readonly number[]; recordedAt: string }> {
  const features = Array.from(input.features);
  if (features.length !== FEATURE_DIM || features.some((value) => !Number.isFinite(value) || value < -1 || value > 1)) {
    throw new TypeError(`derived gesture features must contain exactly ${FEATURE_DIM} finite values in [-1,1]`);
  }
  if (!DERIVED_LABEL_SET.has(input.labelCode)) throw new TypeError('derived gesture labelCode is not a reviewed strong-label code');
  const evidenceBytes = new TextEncoder().encode(input.evidenceId).byteLength;
  if (evidenceBytes < 1 || evidenceBytes > 160) throw new TypeError('derived gesture evidenceId must contain 1-160 UTF-8 bytes');
  return Object.freeze({ features: Object.freeze(features), recordedAt: canonicalRecordedAt(input.recordedAt) });
}

function normalizeRawTrajectory(
  left: readonly LegacyRawGesturePointV1[],
  right: readonly LegacyRawGesturePointV1[],
): Readonly<{ left: readonly JsonValue[]; right: readonly JsonValue[] }> {
  if (left.length < 1 || right.length < 1 || left.length > TRAJECTORY_CAPACITY || right.length > TRAJECTORY_CAPACITY) {
    throw new TypeError(`raw trajectories require 1-${TRAJECTORY_CAPACITY} samples per hand`);
  }
  const firstTimes = [left[0]?.t, right[0]?.t].filter((value): value is number => typeof value === 'number');
  const start = Math.min(...firstTimes);
  if (!Number.isFinite(start)) throw new TypeError('raw trajectory timestamps must be finite');

  const normalizeHand = (points: readonly LegacyRawGesturePointV1[]): readonly JsonValue[] => {
    let prior = -Infinity;
    return Object.freeze(points.map((point) => {
      if (
        !Number.isFinite(point.x) || !Number.isFinite(point.y) || !Number.isFinite(point.z) ||
        point.x < -1_000 || point.x > 1_000 || point.y < -1_000 || point.y > 1_000 || point.z < -1_000 || point.z > 1_000 ||
        !Number.isFinite(point.t) || point.t < prior
      ) {
        throw new TypeError('raw trajectory coordinates/timestamps must satisfy the reviewed finite bounds and timestamps must be non-decreasing');
      }
      prior = point.t;
      const dtMs = point.t - start;
      if (dtMs < 0 || dtMs > 60_000) throw new TypeError('raw trajectory timestamps must remain within 60 seconds of capture start');
      return Object.freeze({ x: point.x, y: point.y, z: point.z, pinched: point.pinched, dtMs });
    }));
  };

  return Object.freeze({ left: normalizeHand(left), right: normalizeHand(right) });
}

function buildEnvelope(
  content: Omit<GovernedEventEnvelopeV1, 'contentDigest'>,
): GovernedEventEnvelopeV1 {
  return Object.freeze({ ...content, contentDigest: computeGovernedEventContentDigestV1(content) });
}

function committed(disposition: GestureLearningEventDispositionV1): boolean {
  return disposition.status === 'STORED' || disposition.status === 'EXACT_DUPLICATE';
}

export class GovernedGestureCaptureUploaderV1 {
  private readonly transport: GestureLearningGovernanceTransportV1;
  private readonly runtime: RuntimeProvenanceV1;
  private readonly producerInstanceId: string;
  private readonly derivedStreamId: string;
  private readonly rawStreamId: string;
  private readonly uuid: () => string;
  private derivedSequence = 0;
  private rawSequence = 0;
  private pendingDerivedEnvelope: string | null = null;
  private pendingRawEnvelope: string | null = null;

  constructor(options: GovernedGestureCaptureUploaderOptionsV1) {
    assertRuntime(options.runtime);
    if (!PRODUCER_PATTERN.test(options.producerInstanceId)) throw new TypeError('producerInstanceId must be piv1_<uuid>');
    if (!STREAM_PATTERN.test(options.derivedStreamId) || !STREAM_PATTERN.test(options.rawStreamId)) {
      throw new TypeError('gesture-learning stream IDs must be strv1_<uuid>');
    }
    assertUuid(options.producerInstanceId.slice(5), 'producerInstanceId');
    assertUuid(options.derivedStreamId.slice(6), 'derivedStreamId');
    assertUuid(options.rawStreamId.slice(6), 'rawStreamId');
    if (options.derivedStreamId === options.rawStreamId) throw new TypeError('derived and raw purposes must use distinct stream IDs');
    this.transport = options.transport;
    this.runtime = options.runtime;
    this.producerInstanceId = options.producerInstanceId;
    this.derivedStreamId = options.derivedStreamId;
    this.rawStreamId = options.rawStreamId;
    this.uuid = options.uuid ?? (() => globalThis.crypto.randomUUID());
  }

  async uploadDerived(input: DerivedGestureUploadV1): Promise<GestureLearningEventDispositionV1> {
    if (this.pendingDerivedEnvelope !== null) return this.flushDerivedPending();
    const validated = validateDerivedInput(input);
    const eventId = this.uuid();
    assertUuid(eventId, 'eventId');
    const request: GestureLearningCaptureAuthorizationRequestV1 = Object.freeze({
      schemaVersion: '1',
      familyId: DERIVED_GESTURE_OBSERVATION_FAMILY_ID,
      eventId,
      producerInstanceId: this.producerInstanceId,
      streamId: this.derivedStreamId,
      streamSequence: this.derivedSequence,
      protocolEvidence: null,
    });
    const authorization = await this.transport.authorizeCapture(request);
    const payload = Object.freeze({
      featureSchemaId: DERIVED_GESTURE_FEATURE_SCHEMA_REFERENCE.id,
      featureSchemaVersion: DERIVED_GESTURE_FEATURE_SCHEMA_REFERENCE.version,
      featureSchemaDigest: DERIVED_GESTURE_FEATURE_SCHEMA_REFERENCE.digest.value,
      features: validated.features,
      labelCode: input.labelCode,
      evidenceId: input.evidenceId,
      recordedAt: validated.recordedAt,
    });
    const content: Omit<GovernedEventEnvelopeV1, 'contentDigest'> = {
      schemaVersion: '1',
      eventFamilyId: DERIVED_GESTURE_OBSERVATION_FAMILY_ID,
      payloadSchemaVersion: '1',
      eventId,
      streamId: this.derivedStreamId,
      producerInstanceId: this.producerInstanceId,
      streamSequence: this.derivedSequence,
      capturedAt: authorization.authorizedAt,
      sourceComponent: DERIVED_GESTURE_SOURCE_COMPONENT,
      mode: 'PRODUCT',
      purpose: GOVERNED_PURPOSES.DERIVED_GESTURE_LEARNING,
      dataClasses: [GOVERNED_DATA_CLASSES.DERIVED_GESTURE_FEATURE],
      effectiveSensitivity: 'SENSITIVE',
      identities: {
        profilePseudonymId: authorization.profilePseudonymId,
        productSessionId: null,
        investigationId: null,
        discoveryEpisodeId: null,
      },
      dataset: null,
      runtime: this.runtime,
      authorization: [{
        schemaVersion: '1',
        basis: 'CONSENT_RECEIPT',
        purpose: GOVERNED_PURPOSES.DERIVED_GESTURE_LEARNING,
        authority: DERIVED_GESTURE_AUTHORITY_REFERENCE,
        evidence: authorization.receipt,
        policy: DERIVED_GESTURE_NOTICE_REFERENCE,
      }],
      retention: { schemaVersion: '1', policy: DERIVED_GESTURE_RETENTION_REFERENCE },
      payload,
      payloadDigest: computeGovernedPayloadDigestV1(payload),
    };
    this.pendingDerivedEnvelope = JSON.stringify(buildEnvelope(content));
    return this.flushDerivedPending();
  }

  async uploadRaw(input: RawGestureUploadV1): Promise<GestureLearningEventDispositionV1> {
    if (this.pendingRawEnvelope !== null) return this.flushRawPending();
    const normalized = normalizeRawTrajectory(input.left, input.right);
    if (input.protocolTargetGesture !== undefined && !GESTURE_CLASS_SET.has(input.protocolTargetGesture)) {
      throw new TypeError('raw protocolTargetGesture is not a reviewed gesture class');
    }
    const eventId = this.uuid();
    assertUuid(eventId, 'eventId');
    const request: GestureLearningCaptureAuthorizationRequestV1 = Object.freeze({
      schemaVersion: '1',
      familyId: RAW_GESTURE_TRAJECTORY_FAMILY_ID,
      eventId,
      producerInstanceId: this.producerInstanceId,
      streamId: this.rawStreamId,
      streamSequence: this.rawSequence,
      protocolEvidence: input.protocolEvidence,
    });
    const authorization = await this.transport.authorizeCapture(request);
    if (!authorization.protocolEvidence) throw new Error('raw capture authority omitted frozen protocol evidence');
    const payloadBase: Record<string, JsonValue> = {
      trajectorySchemaId: RAW_GESTURE_TRAJECTORY_SCHEMA_REFERENCE.id,
      trajectorySchemaVersion: RAW_GESTURE_TRAJECTORY_SCHEMA_REFERENCE.version,
      trajectorySchemaDigest: RAW_GESTURE_TRAJECTORY_SCHEMA_REFERENCE.digest.value,
      coordinateFrame: RAW_GESTURE_TRAJECTORY_SCHEMA_ARTIFACT.coordinateFrame,
      left: normalized.left,
      right: normalized.right,
    };
    if (input.protocolTargetGesture) payloadBase.protocolTargetGesture = input.protocolTargetGesture;
    const payload = Object.freeze(payloadBase);
    const content: Omit<GovernedEventEnvelopeV1, 'contentDigest'> = {
      schemaVersion: '1',
      eventFamilyId: RAW_GESTURE_TRAJECTORY_FAMILY_ID,
      payloadSchemaVersion: '1',
      eventId,
      streamId: this.rawStreamId,
      producerInstanceId: this.producerInstanceId,
      streamSequence: this.rawSequence,
      capturedAt: authorization.authorizedAt,
      sourceComponent: RAW_GESTURE_SOURCE_COMPONENT,
      mode: 'RESEARCH',
      purpose: GOVERNED_PURPOSES.RAW_TRAJECTORY_RESEARCH,
      dataClasses: [GOVERNED_DATA_CLASSES.RAW_SPATIAL_TRAJECTORY],
      effectiveSensitivity: 'HIGHLY_SENSITIVE',
      identities: {
        profilePseudonymId: authorization.profilePseudonymId,
        productSessionId: null,
        investigationId: null,
        discoveryEpisodeId: null,
      },
      dataset: null,
      runtime: this.runtime,
      authorization: [
        {
          schemaVersion: '1',
          basis: 'CONSENT_RECEIPT',
          purpose: GOVERNED_PURPOSES.RAW_TRAJECTORY_RESEARCH,
          authority: RAW_GESTURE_CONSENT_AUTHORITY_REFERENCE,
          evidence: authorization.receipt,
          policy: RAW_GESTURE_NOTICE_REFERENCE,
        },
        {
          schemaVersion: '1',
          basis: 'FROZEN_STUDY_PROTOCOL',
          purpose: GOVERNED_PURPOSES.RAW_TRAJECTORY_RESEARCH,
          authority: RAW_GESTURE_PROTOCOL_AUTHORITY_REFERENCE,
          evidence: authorization.protocolEvidence,
          policy: RAW_GESTURE_PROTOCOL_POLICY_REFERENCE,
        },
      ],
      retention: { schemaVersion: '1', policy: RAW_GESTURE_RETENTION_REFERENCE },
      payload,
      payloadDigest: computeGovernedPayloadDigestV1(payload),
    };
    this.pendingRawEnvelope = JSON.stringify(buildEnvelope(content));
    return this.flushRawPending();
  }

  private async flushDerivedPending(): Promise<GestureLearningEventDispositionV1> {
    const encoded = this.pendingDerivedEnvelope;
    if (encoded === null) throw new Error('no derived gesture envelope is pending');
    const disposition = await this.transport.ingestLine(encoded);
    if (committed(disposition)) {
      this.pendingDerivedEnvelope = null;
      this.derivedSequence += 1;
    } else if (disposition.status !== 'STORAGE_FAILURE') {
      this.pendingDerivedEnvelope = null;
    }
    return disposition;
  }

  private async flushRawPending(): Promise<GestureLearningEventDispositionV1> {
    const encoded = this.pendingRawEnvelope;
    if (encoded === null) throw new Error('no raw gesture envelope is pending');
    const disposition = await this.transport.ingestLine(encoded);
    if (committed(disposition)) {
      this.pendingRawEnvelope = null;
      this.rawSequence += 1;
    } else if (disposition.status !== 'STORAGE_FAILURE') {
      this.pendingRawEnvelope = null;
    }
    return disposition;
  }
}
