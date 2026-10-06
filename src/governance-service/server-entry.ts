import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { createGovernanceHttpRequestListener } from './GovernanceHttpService.ts';

import {
  createPostgresProductAnalyticsGovernanceCompositionV1,
  type ProductAnalyticsGovernanceCompositionV1,
} from './ProductAnalyticsGovernanceComposition.ts';
import type { DataPlaneJwsAlgorithm } from './DataPlaneAccessTokenAuthority.ts';
import { OidcJwksAuthority } from './OidcJwksAuthority.ts';
import {
  PostgresGovernanceConfigurationError,
  parsePostgresGovernanceConnectionProfileV1,
  type PostgresPoolV1,
} from './PostgresGovernanceDatabase.ts';
import type { VersionedSecretKeyV1 } from './ProductAnalyticsConsentAuthority.ts';
import type { ProductAnalyticsDeploymentManifestV1 } from './ProductAnalyticsRuntimeAuthority.ts';

const HEALTH_PATH = '/healthz';
const READY_PATH = '/readyz';
const SHUTDOWN_TIMEOUT_MS = 5_000;
// Drain grace before the shutdown path destroys connections that are still
// open (for example an upload stalled mid-body). Keeps stop() bounded well
// under the forced-shutdown envelope while giving healthy in-flight work a
// brief drain window. RFL-0002.
const SHUTDOWN_DRAIN_GRACE_MS = 1_000;
const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 8788;
const ROUTING_BASE_URL = 'http://governance.local';

export interface GovernanceServiceConfigV1 {
  readonly host: string;
  readonly port: number;
  readonly databaseUrl: string;
  readonly allowedOrigins: readonly string[];
  readonly allowedAlgorithms: readonly DataPlaneJwsAlgorithm[];
  readonly credentialSessionKey: Uint8Array;
  readonly deletionHandleKey: VersionedSecretKeyV1;
  readonly deploymentManifest: ProductAnalyticsDeploymentManifestV1;
  readonly oidcAudience: string;
  readonly oidcIssuer: string;
  readonly purposePseudonymKey: VersionedSecretKeyV1;
}

export interface GovernanceServiceDependencies {
  readonly compositionForTest?: (
    options: Parameters<typeof createPostgresProductAnalyticsGovernanceCompositionV1>[0],
  ) => Promise<ProductAnalyticsGovernanceCompositionV1>;
  readonly oidcJwksAuthorityForTest?: OidcJwksAuthority;
  readonly poolForTest?: PostgresPoolV1;
}

interface PostgresDriverModule {
  Pool?: new (options: { connectionString: string }) => PostgresPoolV1;
  default?: { Pool?: new (options: { connectionString: string }) => PostgresPoolV1 };
}

function readEnv(env: typeof process.env, key: string): string | undefined {
  const value = env[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function parseInteger(value: string, key: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65_535) {
    throw new Error(`invalid ${key}: expected an integer between 0 and 65535`);
  }
  return parsed;
}

function parseCsv(value: string | undefined, key: string): readonly string[] {
  if (!value) throw new Error(`missing required environment variable: ${key}`);
  const items = value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  if (items.length === 0) throw new Error(`missing required environment variable: ${key}`);
  return items;
}

function decodeHex(value: string | undefined, key: string): Uint8Array {
  if (!value) throw new Error(`missing required environment variable: ${key}`);
  const normalized = value.trim().toLowerCase();
  if (!/^[0-9a-f]+$/.test(normalized) || normalized.length % 2 === 1) {
    throw new Error(`invalid ${key}: expected an even-length hex string`);
  }
  const bytes = new Uint8Array(normalized.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(normalized.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function decodeVersionedKey(
  keyValue: string | undefined,
  versionValue: string | undefined,
  keyName: string,
  versionName: string,
): VersionedSecretKeyV1 {
  if (!keyValue) throw new Error(`missing required environment variable: ${keyName}`);
  if (!versionValue) throw new Error(`missing required environment variable: ${versionName}`);
  return { version: versionValue, key: decodeHex(keyValue, keyName) };
}

function parseAlgorithms(value: string | undefined, key: string): readonly DataPlaneJwsAlgorithm[] {
  const names = parseCsv(value, key);
  const supported: readonly DataPlaneJwsAlgorithm[] = ['RS256', 'ES256', 'EdDSA'];
  for (const name of names) {
    if (!supported.includes(name as DataPlaneJwsAlgorithm)) {
      throw new Error(`invalid ${key}: unsupported algorithm '${name}'`);
    }
  }
  return names as readonly DataPlaneJwsAlgorithm[];
}

function requireEnv(env: typeof process.env, key: string): string {
  const value = readEnv(env, key);
  if (!value) throw new Error(`missing required environment variable: ${key}`);
  return value;
}

function parseDeploymentManifest(text: string): ProductAnalyticsDeploymentManifestV1 {
  const parsed = JSON.parse(text) as ProductAnalyticsDeploymentManifestV1;
  return parsed;
}

/**
 * Fail-closed configuration reader for the governance service runtime entry
 * point. The canonical production composition consumes only validated values;
 * this function deliberately throws rather than defaulting required secrets or
 * silently downgrading security policy.
 */
export function readGovernanceServiceConfig(env: typeof process.env = process.env): GovernanceServiceConfigV1 {
  const databaseUrl = readEnv(env, 'NEMOSYNE_GOVERNANCE_DB_URL');
  if (!databaseUrl) throw new Error('missing required environment variable: NEMOSYNE_GOVERNANCE_DB_URL');

  return {
    host: readEnv(env, 'NEMOSYNE_GOVERNANCE_HOST') ?? DEFAULT_HOST,
    port: parseInteger(readEnv(env, 'NEMOSYNE_GOVERNANCE_PORT') ?? String(DEFAULT_PORT), 'NEMOSYNE_GOVERNANCE_PORT'),
    databaseUrl,
    allowedOrigins: parseCsv(readEnv(env, 'NEMOSYNE_GOVERNANCE_ALLOWED_ORIGINS'), 'NEMOSYNE_GOVERNANCE_ALLOWED_ORIGINS'),
    allowedAlgorithms: parseAlgorithms(readEnv(env, 'NEMOSYNE_GOVERNANCE_OIDC_ALLOWED_ALGORITHMS'), 'NEMOSYNE_GOVERNANCE_OIDC_ALLOWED_ALGORITHMS'),
    credentialSessionKey: decodeHex(readEnv(env, 'NEMOSYNE_GOVERNANCE_CREDENTIAL_SESSION_KEY_HEX'), 'NEMOSYNE_GOVERNANCE_CREDENTIAL_SESSION_KEY_HEX'),
    deletionHandleKey: decodeVersionedKey(
      readEnv(env, 'NEMOSYNE_GOVERNANCE_DELETION_HANDLE_KEY_HEX'),
      readEnv(env, 'NEMOSYNE_GOVERNANCE_DELETION_HANDLE_KEY_VERSION'),
      'NEMOSYNE_GOVERNANCE_DELETION_HANDLE_KEY_HEX',
      'NEMOSYNE_GOVERNANCE_DELETION_HANDLE_KEY_VERSION',
    ),
    deploymentManifest: parseDeploymentManifest(requireEnv(env, 'NEMOSYNE_GOVERNANCE_DEPLOYMENT_MANIFEST_JSON')),
    oidcAudience: requireEnv(env, 'NEMOSYNE_GOVERNANCE_OIDC_AUDIENCE'),
    oidcIssuer: requireEnv(env, 'NEMOSYNE_GOVERNANCE_OIDC_ISSUER'),
    purposePseudonymKey: decodeVersionedKey(
      readEnv(env, 'NEMOSYNE_GOVERNANCE_PURPOSE_PSEUDONYM_KEY_HEX'),
      readEnv(env, 'NEMOSYNE_GOVERNANCE_PURPOSE_PSEUDONYM_KEY_VERSION'),
      'NEMOSYNE_GOVERNANCE_PURPOSE_PSEUDONYM_KEY_HEX',
      'NEMOSYNE_GOVERNANCE_PURPOSE_PSEUDONYM_KEY_VERSION',
    ),
  };
}

/**
 * Lazily load the PostgreSQL driver so merely importing this entry point does
 * not require a live database dependency. The specifier is intentionally
 * non-literal, and the Vite ignore comment mirrors
 * src/wasm/runtime/RuntimeState.ts: neither tsc nor Vite's import analysis may
 * require `pg` to be installed. The import executes only when a production
 * pool is actually constructed; any failure there — including a missing
 * driver — is wrapped in the explicit error below, preserving fail-closed
 * production startup without adding a driver the repository does not need.
 */
async function loadPostgresDriverModule(): Promise<PostgresDriverModule> {
  const specifier = 'pg';
  try {
    return (await import(/* @vite-ignore */ specifier)) as PostgresDriverModule;
  } catch (error) {
    throw new Error('governance service requires the pg PostgreSQL driver', { cause: error });
  }
}

export async function createPostgresPoolFromConfig(config: GovernanceServiceConfigV1): Promise<PostgresPoolV1> {
  const profile = parsePostgresGovernanceConnectionProfileV1(config.databaseUrl, {
    allowInsecureLocalDevelopment: config.host === DEFAULT_HOST,
  });
  const driver = await loadPostgresDriverModule();
  const Pool = driver.Pool ?? driver.default?.Pool;
  if (!Pool) {
    throw new Error('governance service requires the pg Pool constructor');
  }
  return new Pool({ connectionString: profile.databaseUrl });
}

function writePlainJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
    'content-type': 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff',
  });
  response.end(body);
}

export function createGovernanceServiceServer(
  composition: ProductAnalyticsGovernanceCompositionV1,
): Server {
  const dispatch = createGovernanceHttpRequestListener(composition.service);
  const listener = (request: IncomingMessage, response: ServerResponse): void => {
    const url = new URL(request.url ?? '/', ROUTING_BASE_URL);
    if (request.method === 'GET' && url.pathname === HEALTH_PATH) {
      writePlainJson(response, 200, { status: 'ok' });
      return;
    }
    if (request.method === 'GET' && url.pathname === READY_PATH) {
      writePlainJson(response, 200, {
        persistence: 'postgres',
        service: 'governance',
        status: 'ready',
      });
      return;
    }
    dispatch(request, response);
  };
  const server = createServer(listener);
  // Storage belongs to the serving process: releasing it exactly once when the
  // listener closes keeps an unexpected shutdown from leaking the pool. The
  // composition guard makes this idempotent with the explicit shutdown path.
  server.on('close', () => {
    composition.closeStorage().catch((error: unknown) => {
      console.error('[GovernanceService] storage release failed:', error);
    });
  });
  return server;
}

async function listen(server: Server, port: number, host: string): Promise<void> {
  await new Promise<void>((resolveListen, rejectListen) => {
    const onError = (error: Error) => {
      server.off('listening', onListening);
      rejectListen(error);
    };
    const onListening = () => {
      server.off('error', onError);
      resolveListen();
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, host);
  });
}

export async function runGovernanceService(
  env: typeof process.env = process.env,
  dependencies: GovernanceServiceDependencies = {},
): Promise<{ host: string; port: number; stop: () => Promise<void> }> {
  const config = readGovernanceServiceConfig(env);
  const pool = dependencies.poolForTest ?? (await createPostgresPoolFromConfig(config));
  const compositionFactory =
    dependencies.compositionForTest ?? createPostgresProductAnalyticsGovernanceCompositionV1;
  const composition = await compositionFactory({
    allowedAlgorithms: config.allowedAlgorithms,
    allowedOrigins: config.allowedOrigins,
    credentialSessionKey: config.credentialSessionKey,
    deletionHandleKey: config.deletionHandleKey,
    deploymentManifest: config.deploymentManifest,
    oidcAudience: config.oidcAudience,
    oidcIssuer: config.oidcIssuer,
    oidcJwksAuthority: dependencies.oidcJwksAuthorityForTest ?? new OidcJwksAuthority({ issuer: config.oidcIssuer }),
    pool,
    purposePseudonymKey: config.purposePseudonymKey,
  });

  const server = createGovernanceServiceServer(composition);
  await listen(server, config.port, config.host);
  const address = server.address();
  const boundPort = typeof address === 'object' && address ? address.port : config.port;

  let stopping = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (stopping) return;
    stopping = true;
    const forced = setTimeout(() => {
      console.error(`[GovernanceService] forced shutdown after ${SHUTDOWN_TIMEOUT_MS}ms`);
      server.closeAllConnections();
      process.exitCode = 1;
    }, SHUTDOWN_TIMEOUT_MS);
    forced.unref?.();
    // server.close waits for open connections, so idle keep-alive sockets drop
    // immediately and anything still open after the grace is destroyed; the
    // close callback then fires instead of hanging on stalled uploads.
    server.closeIdleConnections();
    const destroyStalled = setTimeout(() => {
      server.closeAllConnections();
    }, SHUTDOWN_DRAIN_GRACE_MS);
    destroyStalled.unref?.();
    try {
      await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
      await composition.closeStorage();
      clearTimeout(destroyStalled);
      clearTimeout(forced);
      console.warn(`[GovernanceService] stopped after ${signal}`);
    } catch (error) {
      clearTimeout(destroyStalled);
      clearTimeout(forced);
      console.error('[GovernanceService] shutdown failed:', error);
      process.exitCode = 1;
    }
  };

  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));

  return { host: config.host, port: boundPort, stop: () => shutdown('stop') };
}

async function main(): Promise<void> {
  const result = await runGovernanceService();
  console.warn(`[GovernanceService] listening on ${result.host}:${result.port}`);
}

const invokedAsScript =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invokedAsScript) {
  void main().catch((error: unknown) => {
    const detail =
      error instanceof PostgresGovernanceConfigurationError
        ? `${error.code}: ${error.message}`
        : error instanceof Error
          ? error.message
          : String(error);
    console.error('[GovernanceService] startup failed:', detail);
    process.exitCode = 1;
  });
}
