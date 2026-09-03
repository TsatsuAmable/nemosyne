import { describe, expect, it, vi } from 'vitest';

import {
  ProductAnalyticsOidcClient,
  ProductAnalyticsOperationProducer,
  type ProductAnalyticsClientRuntimeV1,
} from '../src/app/governance/ProductAnalyticsClient.ts';
import type { RuntimeComponentReferenceV1 } from '../src/governance/index.ts';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  dump(): string { return [...this.values.values()].join('\n'); }
}

function runtimeRef(id: string, character: string): RuntimeComponentReferenceV1 {
  return {
    schemaVersion: '1',
    componentId: id,
    version: '1.0.0+sha.0123456789abcdef',
    artifactDigest: { algorithm: 'SHA256', value: character.repeat(64) },
  };
}

const RUNTIME: ProductAnalyticsClientRuntimeV1 = Object.freeze({
  applicationBuild: runtimeRef('nemosyne-app', 'a'),
  deploymentConfiguration: runtimeRef('private-preview', 'b'),
  uiTreatment: runtimeRef('product-ui', 'c'),
  platformRuntime: runtimeRef('browser-runtime', 'd'),
});

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('PT4B8 browser OIDC PKCE client', () => {
  it('uses Authorization Code + PKCE S256 and keeps bearer credentials out of browser storage', async () => {
    const storage = new MemoryStorage();
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.endsWith('/.well-known/openid-configuration')) {
        return jsonResponse({
          issuer: 'https://issuer.example',
          authorization_endpoint: 'https://issuer.example/oauth2/authorize',
          token_endpoint: 'https://issuer.example/oauth2/token',
        });
      }
      if (url.endsWith('/oauth2/token')) {
        const body = String(init?.body ?? '');
        expect(body).toContain('grant_type=authorization_code');
        expect(body).toContain('code_verifier=');
        expect(body).not.toContain('client_secret');
        return jsonResponse({
          token_type: 'Bearer',
          access_token: 'access-secret',
          refresh_token: 'refresh-secret',
          expires_in: 240,
        });
      }
      throw new Error(`unexpected URL ${url}`);
    }) as unknown as typeof fetch;

    const client = new ProductAnalyticsOidcClient({
      issuer: 'https://issuer.example',
      clientId: 'nemosyne-web',
      redirectUri: 'https://app.example/auth/callback',
      storage,
      fetchImpl,
      now: () => 1_000_000,
    });

    const authorizationUrl = new URL(await client.authorizationUrl());
    expect(authorizationUrl.searchParams.get('response_type')).toBe('code');
    expect(authorizationUrl.searchParams.get('code_challenge_method')).toBe('S256');
    expect(authorizationUrl.searchParams.get('code_challenge')).toBeTruthy();
    expect(authorizationUrl.searchParams.has('client_secret')).toBe(false);
    const state = authorizationUrl.searchParams.get('state');
    expect(state).toBeTruthy();
    expect(storage.dump()).not.toContain('access-secret');

    await expect(client.completeAuthorization(`https://app.example/auth/callback?code=abc&state=${encodeURIComponent(state!)}`)).resolves.toBe(true);
    expect(client.accessTokenOrNull()).toBe('access-secret');
    expect(storage.length).toBe(0);
    expect(storage.dump()).not.toContain('access-secret');
    expect(storage.dump()).not.toContain('refresh-secret');
    expect(calls.some((call) => call.url.endsWith('/oauth2/token'))).toBe(true);
  });

  it('consumes and refuses a mismatched callback state', async () => {
    const storage = new MemoryStorage();
    const fetchImpl = vi.fn(async () => jsonResponse({
      issuer: 'https://issuer.example',
      authorization_endpoint: 'https://issuer.example/oauth2/authorize',
      token_endpoint: 'https://issuer.example/oauth2/token',
    })) as unknown as typeof fetch;
    const client = new ProductAnalyticsOidcClient({
      issuer: 'https://issuer.example', clientId: 'nemosyne-web', redirectUri: 'https://app.example/auth/callback', storage, fetchImpl,
    });
    await client.authorizationUrl();
    await expect(client.completeAuthorization('https://app.example/auth/callback?code=abc&state=wrong')).rejects.toThrow(/PKCE transaction validation/u);
    expect(storage.length).toBe(0);
  });
});

describe('PT4B8 bounded governed operation producer', () => {
  it('projects only operation, obtains one-use capture authority, and sends one governed NDJSON envelope', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const oidc = { bearer: async () => 'access-token' };
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.endsWith('/capture-authorizations')) {
        const request = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return jsonResponse({
          schemaVersion: '1',
          authorizationId: 'cav1_99999999-9999-4999-8999-999999999999',
          eventId: request.eventId,
          producerInstanceId: request.producerInstanceId,
          streamId: request.streamId,
          streamSequence: request.streamSequence,
          familyId: request.familyId,
          receipt: { id: 'receipt-1', revision: '1', digest: { algorithm: 'SHA256', value: 'e'.repeat(64) } },
          profilePseudonymId: 'ppv1_k1_21c135cf2ec5ade8d7d9483d69ca18a5a59b7475fe8ba4576055f890fa1b65dc',
          authorizedAt: '2026-09-03T07:00:00.000Z',
          expiresAt: '2026-09-03T07:00:30.000Z',
        });
      }
      if (url.endsWith('/v1/governed-events/batches')) {
        return jsonResponse({
          schemaVersion: '1', requestId: 'gerqv1_1',
          dispositions: [{ inputIndex: 0, eventId: '22222222-2222-4222-8222-222222222222', status: 'STORED', reasonCode: null }],
        });
      }
      throw new Error(`unexpected URL ${url}`);
    }) as unknown as typeof fetch;

    const producer = new ProductAnalyticsOperationProducer({
      endpoint: 'https://data.example', oidc, runtime: RUNTIME, fetchImpl,
      now: () => new Date('2026-09-03T07:00:01.000Z'),
      uuid: () => '22222222-2222-4222-8222-222222222222',
    });
    await producer.captureOperation({ operation: 'filter', rowCount: 123, datasetBefore: { secret: 'never-forward' } });
    await producer.flush();

    const capture = calls.find((call) => call.url.endsWith('/capture-authorizations'))!;
    expect(capture.init?.headers).toMatchObject({ authorization: 'Bearer access-token' });
    const batch = calls.find((call) => call.url.endsWith('/v1/governed-events/batches'))!;
    const line = String(batch.init?.body).trim();
    const envelope = JSON.parse(line) as Record<string, any>;
    expect(envelope.payload).toEqual({ operation: 'filter' });
    expect(line).not.toContain('never-forward');
    expect(line).not.toContain('rowCount');
    expect(envelope.dataset).toBeNull();
    expect(producer.queuedCount()).toBe(0);
  });

  it('keeps retryable storage work in memory but discards governance conflicts and starts a new stream', async () => {
    const oidc = { bearer: async () => 'access-token' };
    let batchStatus = 503;
    const captureRequests: Record<string, unknown>[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/capture-authorizations')) {
        const request = JSON.parse(String(init?.body)) as Record<string, unknown>;
        captureRequests.push(request);
        return jsonResponse({
          schemaVersion: '1', authorizationId: `cav1_${crypto.randomUUID()}`,
          eventId: request.eventId, producerInstanceId: request.producerInstanceId,
          streamId: request.streamId, streamSequence: request.streamSequence, familyId: request.familyId,
          receipt: { id: 'receipt-1', revision: '1', digest: { algorithm: 'SHA256', value: 'e'.repeat(64) } },
          profilePseudonymId: 'ppv1_k1_21c135cf2ec5ade8d7d9483d69ca18a5a59b7475fe8ba4576055f890fa1b65dc',
          authorizedAt: '2026-09-03T07:00:00.000Z', expiresAt: '2026-09-03T07:00:30.000Z',
        });
      }
      if (url.endsWith('/v1/governed-events/batches')) {
        if (batchStatus === 503) return jsonResponse({ code: 'busy' }, 503);
        return jsonResponse({ schemaVersion: '1', requestId: 'r', dispositions: [{ inputIndex: 0, eventId: null, status: 'GAP_REFUSED', reasonCode: 'GAP_REFUSED' }] }, 207);
      }
      throw new Error(`unexpected URL ${url}`);
    }) as unknown as typeof fetch;
    let id = 0;
    const producer = new ProductAnalyticsOperationProducer({
      endpoint: 'https://data.example', oidc, runtime: RUNTIME, fetchImpl,
      now: () => new Date('2026-09-03T07:00:01.000Z'),
      uuid: () => `22222222-2222-4222-8222-${String(++id).padStart(12, '0')}`,
    });

    await producer.captureOperation({ operation: 'sort' });
    await producer.flush();
    expect(producer.queuedCount()).toBe(1);
    const firstStream = captureRequests[0].streamId;

    batchStatus = 207;
    await producer.flush();
    expect(producer.queuedCount()).toBe(0);
    await producer.captureOperation({ operation: 'aggregate' });
    expect(captureRequests.at(-1)?.streamId).not.toBe(firstStream);
    expect(captureRequests.at(-1)?.streamSequence).toBe(0);
  });
});
