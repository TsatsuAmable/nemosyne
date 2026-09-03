import {
  GOVERNED_DATA_CLASSES,
  GOVERNED_PURPOSES,
  PRODUCT_ANALYTICS_DATA_SERVICE_AUTHORITY_REFERENCE,
  PRODUCT_ANALYTICS_OPERATION_NOTICE_REFERENCE,
  PRODUCT_ANALYTICS_OPERATION_RETENTION_REFERENCE,
  PRODUCT_GOVERNED_EVENT_REGISTRY_V1,
  PRODUCT_OPERATION_FAMILY_ID,
  PRODUCT_OPERATION_SOURCE_COMPONENT,
  computeGovernedEventContentDigestV1,
  computeGovernedPayloadDigestV1,
  projectProductOperationAppliedV1,
  validateGovernedEventEnvelopeV1,
  type GovernedEventEnvelopeV1,
  type RuntimeComponentReferenceV1,
} from '../../governance/index.ts';
import { sha256 } from '@noble/hashes/sha2.js';

const PKCE_STORAGE_KEY = 'nemosyne:product-analytics:pkce:v1';
const MAX_QUEUE_EVENTS = 16;
const MAX_QUEUE_BYTES = 64 * 1024;
const RETRYABLE_HTTP = new Set([429, 503]);

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
}

function randomToken(bytes = 32): string {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return base64Url(value);
}

function versionedId(prefix: 'psv1' | 'piv1' | 'strv1'): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function exactHttpsUrl(value: string, label: string): URL {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) {
    throw new Error(`${label} must be an absolute HTTPS URL without credentials or fragment`);
  }
  return url;
}

interface OidcMetadata {
  readonly issuer: string;
  readonly authorization_endpoint: string;
  readonly token_endpoint: string;
}

interface PkceTransaction {
  readonly schemaVersion: '1';
  readonly issuer: string;
  readonly state: string;
  readonly nonce: string;
  readonly verifier: string;
  readonly createdAt: number;
}

export interface ProductAnalyticsOidcClientOptions {
  readonly issuer: string;
  readonly clientId: string;
  readonly redirectUri: string;
  readonly scope?: string;
  readonly fetchImpl?: typeof fetch;
  readonly storage?: Storage;
  readonly now?: () => number;
}

/** Browser Authorization Code + PKCE S256 client. Bearer credentials never enter Storage. */
export class ProductAnalyticsOidcClient {
  private readonly issuer: string;
  private readonly clientId: string;
  private readonly redirectUri: string;
  private readonly scope: string;
  private readonly fetchImpl: typeof fetch;
  private readonly storage: Storage;
  private readonly now: () => number;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private expiresAt = 0;

  constructor(options: ProductAnalyticsOidcClientOptions) {
    this.issuer = exactHttpsUrl(options.issuer, 'OIDC issuer').toString().replace(/\/$/u, '');
    this.clientId = options.clientId.trim();
    if (!this.clientId || this.clientId.length > 256) throw new Error('OIDC clientId is invalid');
    this.redirectUri = exactHttpsUrl(options.redirectUri, 'OIDC redirect URI').toString();
    this.scope = options.scope ?? 'openid consent:read consent:write events:capture events:write events:export events:erase';
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.storage = options.storage ?? sessionStorage;
    this.now = options.now ?? Date.now;
  }

  hasUsableAccessToken(): boolean {
    return this.accessToken !== null && this.expiresAt - this.now() > 10_000;
  }

  accessTokenOrNull(): string | null {
    return this.hasUsableAccessToken() ? this.accessToken : null;
  }

  async authorizationUrl(): Promise<string> {
    const metadata = await this.metadata();
    const verifier = randomToken(32);
    const challenge = base64Url(sha256(new TextEncoder().encode(verifier)));
    const transaction: PkceTransaction = Object.freeze({
      schemaVersion: '1',
      issuer: this.issuer,
      state: randomToken(24),
      nonce: randomToken(24),
      verifier,
      createdAt: this.now(),
    });
    this.storage.setItem(PKCE_STORAGE_KEY, JSON.stringify(transaction));
    const url = exactHttpsUrl(metadata.authorization_endpoint, 'OIDC authorization endpoint');
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', this.clientId);
    url.searchParams.set('redirect_uri', this.redirectUri);
    url.searchParams.set('scope', this.scope);
    url.searchParams.set('state', transaction.state);
    url.searchParams.set('nonce', transaction.nonce);
    url.searchParams.set('code_challenge', challenge);
    url.searchParams.set('code_challenge_method', 'S256');
    return url.toString();
  }

  async beginAuthorization(): Promise<void> {
    window.location.assign(await this.authorizationUrl());
  }

  async completeAuthorization(callbackUrl: string): Promise<boolean> {
    const url = new URL(callbackUrl);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    if (!code && !state) return false;
    const raw = this.storage.getItem(PKCE_STORAGE_KEY);
    this.storage.removeItem(PKCE_STORAGE_KEY);
    if (!raw) throw new Error('OIDC callback has no matching PKCE transaction');
    const transaction = JSON.parse(raw) as PkceTransaction;
    if (
      transaction.schemaVersion !== '1' || transaction.issuer !== this.issuer ||
      !state || state !== transaction.state || !code || this.now() - transaction.createdAt > 10 * 60_000
    ) {
      throw new Error('OIDC callback failed PKCE transaction validation');
    }
    const metadata = await this.metadata();
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      code_verifier: transaction.verifier,
    });
    await this.acceptTokenResponse(await this.fetchImpl(metadata.token_endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body,
      credentials: 'omit',
      redirect: 'error',
    }));
    return true;
  }

  async bearer(): Promise<string | null> {
    if (this.hasUsableAccessToken()) return this.accessToken;
    if (!this.refreshToken) return null;
    const metadata = await this.metadata();
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: this.refreshToken,
      client_id: this.clientId,
    });
    try {
      await this.acceptTokenResponse(await this.fetchImpl(metadata.token_endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
        body,
        credentials: 'omit',
        redirect: 'error',
      }));
      return this.accessToken;
    } catch {
      this.clearCredentials();
      return null;
    }
  }

  clearCredentials(): void {
    this.accessToken = null;
    this.refreshToken = null;
    this.expiresAt = 0;
  }

  private async metadata(): Promise<OidcMetadata> {
    const response = await this.fetchImpl(`${this.issuer}/.well-known/openid-configuration`, {
      headers: { accept: 'application/json' },
      credentials: 'omit',
      redirect: 'error',
    });
    if (!response.ok) throw new Error('OIDC metadata request failed');
    const metadata = await response.json() as Partial<OidcMetadata>;
    if (metadata.issuer !== this.issuer || !metadata.authorization_endpoint || !metadata.token_endpoint) {
      throw new Error('OIDC metadata is incomplete or issuer-mismatched');
    }
    exactHttpsUrl(metadata.authorization_endpoint, 'OIDC authorization endpoint');
    exactHttpsUrl(metadata.token_endpoint, 'OIDC token endpoint');
    return metadata as OidcMetadata;
  }

  private async acceptTokenResponse(response: Response): Promise<void> {
    if (!response.ok) throw new Error('OIDC token request failed');
    const value = await response.json() as Record<string, unknown>;
    if (value.token_type !== 'Bearer' || typeof value.access_token !== 'string' || !value.access_token) {
      throw new Error('OIDC token response is not a Bearer access-token response');
    }
    const expiresIn = Number(value.expires_in);
    if (!Number.isFinite(expiresIn) || expiresIn <= 0 || expiresIn > 300) {
      throw new Error('OIDC access-token lifetime exceeds the PT4 profile');
    }
    this.accessToken = value.access_token;
    this.refreshToken = typeof value.refresh_token === 'string' && value.refresh_token ? value.refresh_token : null;
    this.expiresAt = this.now() + expiresIn * 1000;
  }
}

export interface ProductAnalyticsClientRuntimeV1 {
  readonly applicationBuild: RuntimeComponentReferenceV1;
  readonly deploymentConfiguration: RuntimeComponentReferenceV1;
  readonly uiTreatment: RuntimeComponentReferenceV1;
  readonly platformRuntime: RuntimeComponentReferenceV1;
}

export interface ProductAnalyticsOperationProducerOptions {
  readonly endpoint: string;
  readonly oidc: Pick<ProductAnalyticsOidcClient, 'bearer'>;
  readonly runtime: ProductAnalyticsClientRuntimeV1;
  readonly fetchImpl?: typeof fetch;
  readonly now?: () => Date;
  readonly uuid?: () => string;
  readonly onOverflow?: () => void;
}

interface QueuedEnvelope {
  readonly eventId: string;
  readonly encoded: string;
}

export class ProductAnalyticsOperationProducer {
  private readonly endpoint: string;
  private readonly oidc: Pick<ProductAnalyticsOidcClient, 'bearer'>;
  private readonly runtime: ProductAnalyticsClientRuntimeV1;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;
  private readonly uuid: () => string;
  private readonly onOverflow: () => void;
  private readonly productSessionId = versionedId('psv1');
  private readonly producerInstanceId = versionedId('piv1');
  private streamId = versionedId('strv1');
  private sequence = 0;
  private queue: QueuedEnvelope[] = [];
  private queueBytes = 0;
  private flushing = false;

  constructor(options: ProductAnalyticsOperationProducerOptions) {
    this.endpoint = exactHttpsUrl(options.endpoint, 'governed data endpoint').toString().replace(/\/$/u, '');
    this.oidc = options.oidc;
    this.runtime = options.runtime;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? (() => new Date());
    this.uuid = options.uuid ?? crypto.randomUUID;
    this.onOverflow = options.onOverflow ?? (() => {});
  }

  async captureOperation(source: unknown): Promise<void> {
    const payload = projectProductOperationAppliedV1(source);
    if (!payload) return;
    const bearer = await this.oidc.bearer();
    if (!bearer) return;
    const eventId = this.uuid();
    const captureResponse = await this.fetchImpl(`${this.endpoint}/v1/governance/consents/product-analytics/capture-authorizations`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${bearer}`,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        schemaVersion: '1',
        familyId: PRODUCT_OPERATION_FAMILY_ID,
        eventId,
        producerInstanceId: this.producerInstanceId,
        streamId: this.streamId,
        streamSequence: this.sequence,
      }),
      credentials: 'omit',
      redirect: 'error',
    });
    if (!captureResponse.ok) {
      if (!RETRYABLE_HTTP.has(captureResponse.status)) this.resetStreamAndDiscard();
      return;
    }
    const authorization = await captureResponse.json() as Record<string, unknown>;
    const envelope = this.buildEnvelope(payload, authorization);
    if (!envelope) {
      this.resetStreamAndDiscard();
      return;
    }
    const encoded = JSON.stringify(envelope);
    const bytes = new TextEncoder().encode(encoded).byteLength;
    if (bytes > MAX_QUEUE_BYTES || this.queue.length + 1 > MAX_QUEUE_EVENTS || this.queueBytes + bytes > MAX_QUEUE_BYTES) {
      this.resetStreamAndDiscard();
      this.onOverflow();
      return;
    }
    this.queue.push({ eventId, encoded });
    this.queueBytes += bytes;
    this.sequence += 1;
    void this.flush();
  }

  discardQueuedOnRevocation(): void {
    this.resetStreamAndDiscard();
  }

  queuedCount(): number {
    return this.queue.length;
  }

  async flush(): Promise<void> {
    if (this.flushing || this.queue.length === 0) return;
    const bearer = await this.oidc.bearer();
    if (!bearer) return;
    this.flushing = true;
    const batch = [...this.queue];
    try {
      const response = await this.fetchImpl(`${this.endpoint}/v1/governed-events/batches`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${bearer}`,
          'content-type': 'application/x-ndjson',
          'content-encoding': 'identity',
          accept: 'application/json',
        },
        body: `${batch.map((item) => item.encoded).join('\n')}\n`,
        credentials: 'omit',
        redirect: 'error',
      });
      if (RETRYABLE_HTTP.has(response.status)) return;
      if (!response.ok && response.status !== 207) {
        this.resetStreamAndDiscard();
        return;
      }
      const result = await response.json() as { dispositions?: readonly { status?: string }[] };
      const dispositions = result.dispositions;
      if (!Array.isArray(dispositions) || dispositions.length !== batch.length) {
        this.resetStreamAndDiscard();
        return;
      }
      const allCommitted = dispositions.every((item) => item.status === 'STORED' || item.status === 'EXACT_DUPLICATE');
      if (!allCommitted) {
        const retryableStorageOnly = dispositions.every((item) =>
          item.status === 'STORED' || item.status === 'EXACT_DUPLICATE' || item.status === 'STORAGE_FAILURE');
        if (retryableStorageOnly) return;
        this.resetStreamAndDiscard();
        return;
      }
      for (let index = 0; index < batch.length; index += 1) {
        const removed = this.queue.shift();
        if (removed) this.queueBytes -= new TextEncoder().encode(removed.encoded).byteLength;
      }
    } catch {
      // Network failure is retryable. The bounded memory-only queue remains intact.
    } finally {
      this.flushing = false;
    }
  }

  private buildEnvelope(
    payload: Readonly<{ operation: string }>,
    authorization: Record<string, unknown>,
  ): GovernedEventEnvelopeV1 | null {
    const authorizedAt = typeof authorization.authorizedAt === 'string' ? authorization.authorizedAt : null;
    const expiresAt = typeof authorization.expiresAt === 'string' ? authorization.expiresAt : null;
    const profilePseudonymId = typeof authorization.profilePseudonymId === 'string' ? authorization.profilePseudonymId : null;
    const receipt = authorization.receipt;
    if (!authorizedAt || !expiresAt || !profilePseudonymId || !receipt || typeof receipt !== 'object') return null;
    const now = this.now();
    if (!Number.isFinite(now.getTime())) return null;
    const capturedAt = now.toISOString();
    if (capturedAt < authorizedAt || capturedAt > expiresAt) return null;
    if (
      authorization.eventId !== this.uuidValueFromCapture(authorization, 'eventId') ||
      authorization.producerInstanceId !== this.producerInstanceId ||
      authorization.streamId !== this.streamId ||
      authorization.streamSequence !== this.sequence ||
      authorization.familyId !== PRODUCT_OPERATION_FAMILY_ID
    ) return null;

    const content: Omit<GovernedEventEnvelopeV1, 'contentDigest'> = {
      schemaVersion: '1',
      eventFamilyId: PRODUCT_OPERATION_FAMILY_ID,
      payloadSchemaVersion: '1',
      eventId: String(authorization.eventId),
      streamId: this.streamId,
      producerInstanceId: this.producerInstanceId,
      streamSequence: this.sequence,
      capturedAt,
      sourceComponent: PRODUCT_OPERATION_SOURCE_COMPONENT,
      mode: 'PRODUCT',
      purpose: GOVERNED_PURPOSES.PRODUCT_ANALYTICS,
      dataClasses: [GOVERNED_DATA_CLASSES.PRODUCT_INTERACTION_METADATA],
      effectiveSensitivity: 'PSEUDONYMOUS',
      identities: {
        profilePseudonymId,
        productSessionId: this.productSessionId,
        investigationId: null,
        discoveryEpisodeId: null,
      },
      dataset: null,
      runtime: {
        schemaVersion: '1',
        components: {
          applicationBuild: this.runtime.applicationBuild,
          deploymentConfiguration: this.runtime.deploymentConfiguration,
          wasmKernel: null,
          representationTreatment: null,
          monetaEngine: null,
          fitnessModel: null,
          nil: null,
          perceptionGestureTreatment: null,
          uiTreatment: this.runtime.uiTreatment,
          platformRuntime: this.runtime.platformRuntime,
        },
        randomSeeds: {},
      },
      authorization: [{
        schemaVersion: '1',
        basis: 'CONSENT_RECEIPT',
        purpose: GOVERNED_PURPOSES.PRODUCT_ANALYTICS,
        authority: PRODUCT_ANALYTICS_DATA_SERVICE_AUTHORITY_REFERENCE,
        evidence: receipt as GovernedEventEnvelopeV1['authorization'][number]['evidence'],
        policy: PRODUCT_ANALYTICS_OPERATION_NOTICE_REFERENCE,
      }],
      retention: { schemaVersion: '1', policy: PRODUCT_ANALYTICS_OPERATION_RETENTION_REFERENCE },
      payload,
      payloadDigest: computeGovernedPayloadDigestV1(payload),
    };
    const envelope: GovernedEventEnvelopeV1 = {
      ...content,
      contentDigest: computeGovernedEventContentDigestV1(content),
    };
    const structural = validateGovernedEventEnvelopeV1(JSON.stringify(envelope), PRODUCT_GOVERNED_EVENT_REGISTRY_V1);
    return structural.ok ? envelope : null;
  }

  private uuidValueFromCapture(authorization: Record<string, unknown>, key: string): string | null {
    const value = authorization[key];
    return typeof value === 'string' ? value : null;
  }

  private resetStreamAndDiscard(): void {
    this.queue = [];
    this.queueBytes = 0;
    this.streamId = versionedId('strv1');
    this.sequence = 0;
  }
}

export interface OperationEventSourceV1 {
  on(topic: string, handler: (payload: unknown) => void): () => void;
}

export function bindProductAnalyticsOperationProducer(
  eventSource: OperationEventSourceV1,
  operationTopic: string,
  producer: ProductAnalyticsOperationProducer,
): () => void {
  return eventSource.on(operationTopic, (payload) => { void producer.captureOperation(payload); });
}
