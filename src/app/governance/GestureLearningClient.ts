import type {
  GestureLearningCaptureAuthorizationRequestV1,
  GestureLearningCaptureAuthorizationV1,
  GestureLearningEventDispositionV1,
} from '../../governance/index.ts';
import type { GestureLearningGovernanceTransportV1 } from '../../vr/input/GovernedGestureCaptureUploader.ts';

export interface GestureLearningBearerProviderV1 {
  bearer(): Promise<string | null>;
}

export interface HttpGestureLearningGovernanceTransportOptionsV1 {
  readonly endpoint: string;
  readonly oidc: GestureLearningBearerProviderV1;
  readonly fetchImpl?: typeof fetch;
}

export class GestureLearningTransportError extends Error {
  constructor(readonly code: string, readonly status: number | null = null) {
    super(status === null ? code : `${code} (${status})`);
    this.name = 'GestureLearningTransportError';
  }
}

function exactHttpsEndpoint(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.search) {
    throw new TypeError('gesture-learning endpoint must be an absolute HTTPS URL without credentials, query, or fragment');
  }
  return url.toString().replace(/\/$/u, '');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validCaptureResponse(
  value: unknown,
  request: GestureLearningCaptureAuthorizationRequestV1,
): value is GestureLearningCaptureAuthorizationV1 {
  if (!isRecord(value)) return false;
  const receipt = value.receipt;
  const protocolEvidence = value.protocolEvidence;
  return value.schemaVersion === '1' &&
    typeof value.authorizationId === 'string' && value.authorizationId.length > 0 &&
    value.familyId === request.familyId && value.eventId === request.eventId &&
    value.producerInstanceId === request.producerInstanceId && value.streamId === request.streamId &&
    value.streamSequence === request.streamSequence &&
    typeof value.purpose === 'string' && typeof value.profilePseudonymId === 'string' && value.profilePseudonymId.length > 0 &&
    typeof value.authorizedAt === 'string' && Number.isFinite(Date.parse(value.authorizedAt)) &&
    typeof value.expiresAt === 'string' && Number.isFinite(Date.parse(value.expiresAt)) &&
    isRecord(receipt) &&
    (protocolEvidence === null || isRecord(protocolEvidence));
}

function validDisposition(value: unknown, expectedEventId: string): value is GestureLearningEventDispositionV1 {
  if (!isRecord(value)) return false;
  const statuses = new Set([
    'STORED',
    'EXACT_DUPLICATE',
    'REFUSED_GOVERNANCE',
    'EVENT_ID_CONFLICT',
    'STREAM_OWNERSHIP_CONFLICT',
    'SEQUENCE_CONFLICT',
    'GAP_REFUSED',
    'STORAGE_FAILURE',
  ]);
  return value.eventId === expectedEventId && typeof value.status === 'string' && statuses.has(value.status) &&
    (value.reasonCode === null || typeof value.reasonCode === 'string');
}

/** Browser transport for the PT6C authority. Ambiguous delivery is replayed by the uploader with the exact envelope/event identity. */
export class HttpGestureLearningGovernanceTransportV1 implements GestureLearningGovernanceTransportV1 {
  private readonly endpoint: string;
  private readonly oidc: GestureLearningBearerProviderV1;
  private readonly fetchImpl: typeof fetch;

  constructor(options: HttpGestureLearningGovernanceTransportOptionsV1) {
    this.endpoint = exactHttpsEndpoint(options.endpoint);
    this.oidc = options.oidc;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async authorizeCapture(request: GestureLearningCaptureAuthorizationRequestV1): Promise<GestureLearningCaptureAuthorizationV1> {
    const bearer = await this.requireBearer();
    const response = await this.fetchImpl(`${this.endpoint}/v1/governance/gesture-learning/capture-authorizations`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${bearer}`,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(request),
      credentials: 'omit',
      redirect: 'error',
    });
    if (!response.ok) throw new GestureLearningTransportError('CAPTURE_AUTHORIZATION_REFUSED', response.status);
    const value: unknown = await response.json();
    if (!validCaptureResponse(value, request)) throw new GestureLearningTransportError('INVALID_CAPTURE_AUTHORIZATION_RESPONSE');
    return Object.freeze(value);
  }

  async ingestLine(jsonText: string): Promise<GestureLearningEventDispositionV1> {
    let expectedEventId: string;
    try {
      const envelope = JSON.parse(jsonText) as unknown;
      if (!isRecord(envelope) || typeof envelope.eventId !== 'string' || !envelope.eventId) throw new Error('invalid event');
      expectedEventId = envelope.eventId;
    } catch {
      throw new GestureLearningTransportError('INVALID_LOCAL_ENVELOPE');
    }
    const bearer = await this.requireBearer();
    const response = await this.fetchImpl(`${this.endpoint}/v1/governed-events/gesture-learning/batches`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${bearer}`,
        'content-type': 'application/x-ndjson',
        'content-encoding': 'identity',
        accept: 'application/json',
      },
      body: `${jsonText}\n`,
      credentials: 'omit',
      redirect: 'error',
    });
    if (!response.ok) throw new GestureLearningTransportError('INGESTION_REQUEST_FAILED', response.status);
    const value: unknown = await response.json();
    if (!isRecord(value) || value.schemaVersion !== '1' || !Array.isArray(value.dispositions) || value.dispositions.length !== 1) {
      throw new GestureLearningTransportError('INVALID_INGESTION_RESPONSE');
    }
    const disposition = value.dispositions[0];
    if (!validDisposition(disposition, expectedEventId)) throw new GestureLearningTransportError('INVALID_INGESTION_DISPOSITION');
    return Object.freeze(disposition);
  }

  private async requireBearer(): Promise<string> {
    const bearer = await this.oidc.bearer();
    if (!bearer) throw new GestureLearningTransportError('AUTHENTICATION_REQUIRED');
    return bearer;
  }
}
