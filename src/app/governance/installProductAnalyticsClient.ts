import { WorldTopics, type WorldEventBus } from '../../utils/EventBus.ts';
import type { RuntimeComponentReferenceV1 } from '../../governance/index.ts';
import {
  ProductAnalyticsOidcClient,
  ProductAnalyticsOperationProducer,
  bindProductAnalyticsOperationProducer,
  type ProductAnalyticsClientRuntimeV1,
} from './ProductAnalyticsClient.ts';

export interface ProductAnalyticsClientHandle {
  readonly authenticated: () => boolean;
  readonly beginAuthorization: () => Promise<void>;
  readonly clearCredentials: () => void;
  readonly discardQueuedOnRevocation: () => void;
  readonly dispose: () => void;
}

interface ProductAnalyticsBrowserConfig {
  readonly endpoint: string;
  readonly issuer: string;
  readonly clientId: string;
  readonly redirectUri: string;
  readonly runtime: ProductAnalyticsClientRuntimeV1;
}

function runtimeReference(value: unknown, label: string): RuntimeComponentReferenceV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} runtime reference is invalid`);
  const record = value as Record<string, unknown>;
  const digest = record.artifactDigest;
  if (
    record.schemaVersion !== '1' || typeof record.componentId !== 'string' || !record.componentId ||
    typeof record.version !== 'string' || !record.version || !digest || typeof digest !== 'object' ||
    (digest as Record<string, unknown>).algorithm !== 'SHA256' ||
    typeof (digest as Record<string, unknown>).value !== 'string' ||
    !/^[0-9a-f]{64}$/u.test((digest as Record<string, unknown>).value as string)
  ) {
    throw new Error(`${label} runtime reference is invalid`);
  }
  return value as unknown as RuntimeComponentReferenceV1;
}

export function readProductAnalyticsBrowserConfig(
  env: Readonly<Record<string, string | boolean | undefined>>,
): ProductAnalyticsBrowserConfig | null {
  const endpoint = env.VITE_NEMOSYNE_DATA_PLANE_ENDPOINT;
  const issuer = env.VITE_NEMOSYNE_OIDC_ISSUER;
  const clientId = env.VITE_NEMOSYNE_OIDC_CLIENT_ID;
  const redirectUri = env.VITE_NEMOSYNE_OIDC_REDIRECT_URI;
  const runtimeJson = env.VITE_NEMOSYNE_PRODUCT_ANALYTICS_RUNTIME;
  const values = [endpoint, issuer, clientId, redirectUri, runtimeJson];
  if (values.every((value) => value === undefined || value === '')) return null;
  if (values.some((value) => typeof value !== 'string' || value === '')) {
    throw new Error('product analytics browser configuration must be complete or entirely absent');
  }
  const parsed = JSON.parse(runtimeJson as string) as Record<string, unknown>;
  const exactKeys = ['applicationBuild', 'deploymentConfiguration', 'platformRuntime', 'uiTreatment'];
  if (Object.keys(parsed).sort().join('\n') !== [...exactKeys].sort().join('\n')) {
    throw new Error('product analytics runtime configuration must contain exactly the four PT4 runtime references');
  }
  return Object.freeze({
    endpoint: endpoint as string,
    issuer: issuer as string,
    clientId: clientId as string,
    redirectUri: redirectUri as string,
    runtime: Object.freeze({
      applicationBuild: runtimeReference(parsed.applicationBuild, 'applicationBuild'),
      deploymentConfiguration: runtimeReference(parsed.deploymentConfiguration, 'deploymentConfiguration'),
      uiTreatment: runtimeReference(parsed.uiTreatment, 'uiTreatment'),
      platformRuntime: runtimeReference(parsed.platformRuntime, 'platformRuntime'),
    }),
  });
}

export async function installConfiguredProductAnalyticsClient(
  eventBus: Pick<WorldEventBus, 'on'>,
  env: Readonly<Record<string, string | boolean | undefined>> = import.meta.env,
  callbackUrl = window.location.href,
): Promise<ProductAnalyticsClientHandle | null> {
  const config = readProductAnalyticsBrowserConfig(env);
  if (!config) return null;

  const oidc = new ProductAnalyticsOidcClient({
    issuer: config.issuer,
    clientId: config.clientId,
    redirectUri: config.redirectUri,
  });
  const completed = await oidc.completeAuthorization(callbackUrl);
  if (completed) {
    const clean = new URL(callbackUrl);
    clean.searchParams.delete('code');
    clean.searchParams.delete('state');
    clean.searchParams.delete('session_state');
    window.history.replaceState(window.history.state, '', clean.toString());
  }

  const producer = new ProductAnalyticsOperationProducer({
    endpoint: config.endpoint,
    oidc,
    runtime: config.runtime,
  });
  const unsubscribe = bindProductAnalyticsOperationProducer(
    eventBus,
    WorldTopics.OPERATION_APPLIED,
    producer,
  );

  return Object.freeze({
    authenticated: () => oidc.hasUsableAccessToken(),
    beginAuthorization: () => oidc.beginAuthorization(),
    clearCredentials: () => oidc.clearCredentials(),
    discardQueuedOnRevocation: () => producer.discardQueuedOnRevocation(),
    dispose: unsubscribe,
  });
}
