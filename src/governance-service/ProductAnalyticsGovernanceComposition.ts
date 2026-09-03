import type { Server } from 'node:http';

import {
  DataPlaneAccessTokenAuthority,
  type DataPlaneJwsAlgorithm,
} from './DataPlaneAccessTokenAuthority.ts';
import { PostgresDataPlaneCredentialSessionStoreV1 } from './DataPlaneCredentialSessionStore.ts';
import type { ProductAnalyticsGovernancePersistenceV1 } from './GovernanceAuthorityPorts.ts';
import {
  GovernanceHttpService,
  createGovernanceHttpServer,
  createOidcGovernanceAuthenticator,
  type GovernanceAuthenticatorV1,
} from './GovernanceHttpService.ts';
import { OidcJwksAuthority } from './OidcJwksAuthority.ts';
import {
  PostgresGovernanceMigrationAuthorityV1,
  type PostgresPoolV1,
} from './PostgresGovernanceDatabase.ts';
import { PostgresProductAnalyticsPersistenceV1 } from './PostgresProductAnalyticsPersistence.ts';
import {
  SqliteProductAnalyticsConsentAuthority,
  type VersionedSecretKeyV1,
} from './ProductAnalyticsConsentAuthority.ts';
import { SqliteProductAnalyticsEventIngestion } from './ProductAnalyticsEventIngestion.ts';
import { SqliteProductAnalyticsLifecycleAuthority } from './ProductAnalyticsLifecycleAuthority.ts';
import {
  ReviewedProductAnalyticsRuntimeAuthority,
  RuntimePinnedProductAnalyticsEventIngestion,
  type ProductAnalyticsDeploymentManifestV1,
} from './ProductAnalyticsRuntimeAuthority.ts';

export interface ProductAnalyticsGovernanceCompositionOptionsV1 {
  readonly persistence: ProductAnalyticsGovernancePersistenceV1;
  readonly allowedOrigins: readonly string[];
  readonly authenticator: GovernanceAuthenticatorV1;
  readonly deploymentManifest: ProductAnalyticsDeploymentManifestV1;
  readonly requestNow?: () => number;
  readonly uuid?: () => string;
}

export interface ProductAnalyticsGovernanceCompositionV1 {
  readonly persistence: ProductAnalyticsGovernancePersistenceV1;
  readonly eventIngestion: RuntimePinnedProductAnalyticsEventIngestion;
  readonly service: GovernanceHttpService;
  readonly server: Server;
  readonly closeStorage: () => Promise<void>;
}

/**
 * Database-neutral internal composition seam. Persistence is a required input;
 * there is no implicit SQLite fallback. Production callers should use the
 * PostgreSQL + OIDC constructor below so credential sessions share the same DB.
 */
export async function createProductAnalyticsGovernanceCompositionV1(
  options: ProductAnalyticsGovernanceCompositionOptionsV1,
): Promise<ProductAnalyticsGovernanceCompositionV1> {
  await options.persistence.lifecycleAuthority.runRetention();
  await options.persistence.lifecycleAuthority.assertReadyForIngestion();

  const runtimeAuthority = new ReviewedProductAnalyticsRuntimeAuthority(options.deploymentManifest);
  const eventIngestion = new RuntimePinnedProductAnalyticsEventIngestion({
    runtimeAuthority,
    delegate: options.persistence.eventIngestion,
  });

  const service = new GovernanceHttpService({
    allowedOrigins: options.allowedOrigins,
    authenticator: options.authenticator,
    consentAuthority: options.persistence.consentAuthority,
    eventIngestion,
    lifecycleAuthority: options.persistence.lifecycleAuthority,
    now: options.requestNow,
    requestId: options.uuid,
  });
  const server = createGovernanceHttpServer(service);

  let closed = false;
  const closeStorage = async (): Promise<void> => {
    if (closed) return;
    closed = true;
    await options.persistence.close();
  };

  return Object.freeze({ persistence: options.persistence, eventIngestion, service, server, closeStorage });
}

export interface PostgresProductAnalyticsGovernanceCompositionOptionsV1 {
  readonly pool: PostgresPoolV1;
  readonly allowedOrigins: readonly string[];
  readonly oidcIssuer: string;
  readonly oidcAudience: string;
  readonly oidcJwksAuthority: OidcJwksAuthority;
  readonly allowedAlgorithms: readonly DataPlaneJwsAlgorithm[];
  readonly credentialSessionKey: Uint8Array;
  readonly purposePseudonymKey: VersionedSecretKeyV1;
  readonly deletionHandleKey: VersionedSecretKeyV1;
  readonly deploymentManifest: ProductAnalyticsDeploymentManifestV1;
  readonly now?: () => Date;
  readonly requestNow?: () => number;
  readonly uuid?: () => string;
  readonly captureAuthorizationTtlMs?: number;
  readonly clockSkewSeconds?: number;
}

/**
 * Canonical PT4 production composition. Governed product data and access-token
 * credential-session revocation are forced onto the same PostgreSQL pool.
 */
export async function createPostgresProductAnalyticsGovernanceCompositionV1(
  options: PostgresProductAnalyticsGovernanceCompositionOptionsV1,
): Promise<ProductAnalyticsGovernanceCompositionV1> {
  const migration = new PostgresGovernanceMigrationAuthorityV1(options.pool);
  await migration.migrate();
  await migration.assertCurrent();

  const persistence = new PostgresProductAnalyticsPersistenceV1({
    pool: options.pool,
    purposePseudonymKey: options.purposePseudonymKey,
    deletionHandleKey: options.deletionHandleKey,
    now: options.now,
    uuid: options.uuid,
    captureAuthorizationTtlMs: options.captureAuthorizationTtlMs,
  });
  const tokenAuthority = new DataPlaneAccessTokenAuthority({
    issuer: options.oidcIssuer,
    audience: options.oidcAudience,
    allowedAlgorithms: options.allowedAlgorithms,
    keyResolver: options.oidcJwksAuthority,
    credentialSessionKey: options.credentialSessionKey,
    credentialSessionStore: new PostgresDataPlaneCredentialSessionStoreV1(options.pool),
    now: options.now,
    clockSkewSeconds: options.clockSkewSeconds,
  });
  const authenticator = createOidcGovernanceAuthenticator(tokenAuthority, options.oidcJwksAuthority);

  return createProductAnalyticsGovernanceCompositionV1({
    persistence,
    allowedOrigins: options.allowedOrigins,
    authenticator,
    deploymentManifest: options.deploymentManifest,
    requestNow: options.requestNow,
    uuid: options.uuid,
  });
}

export interface PostgresProductAnalyticsGovernanceWithAuthenticatorOptionsV1 {
  readonly pool: PostgresPoolV1;
  readonly allowedOrigins: readonly string[];
  readonly authenticator: GovernanceAuthenticatorV1;
  readonly purposePseudonymKey: VersionedSecretKeyV1;
  readonly deletionHandleKey: VersionedSecretKeyV1;
  readonly deploymentManifest: ProductAnalyticsDeploymentManifestV1;
  readonly now?: () => Date;
  readonly requestNow?: () => number;
  readonly uuid?: () => string;
  readonly captureAuthorizationTtlMs?: number;
}

/** Lower-level test/integration seam. It is not the canonical production constructor. */
export async function createPostgresProductAnalyticsGovernanceWithAuthenticatorV1(
  options: PostgresProductAnalyticsGovernanceWithAuthenticatorOptionsV1,
): Promise<ProductAnalyticsGovernanceCompositionV1> {
  const migration = new PostgresGovernanceMigrationAuthorityV1(options.pool);
  await migration.migrate();
  await migration.assertCurrent();
  const persistence = new PostgresProductAnalyticsPersistenceV1({
    pool: options.pool,
    purposePseudonymKey: options.purposePseudonymKey,
    deletionHandleKey: options.deletionHandleKey,
    now: options.now,
    uuid: options.uuid,
    captureAuthorizationTtlMs: options.captureAuthorizationTtlMs,
  });
  return createProductAnalyticsGovernanceCompositionV1({
    persistence,
    allowedOrigins: options.allowedOrigins,
    authenticator: options.authenticator,
    deploymentManifest: options.deploymentManifest,
    requestNow: options.requestNow,
    uuid: options.uuid,
  });
}

export interface SqliteProductAnalyticsGovernanceCompatibilityOptionsV1 {
  readonly dataDirectory: string;
  readonly allowedOrigins: readonly string[];
  readonly authenticator: GovernanceAuthenticatorV1;
  readonly purposePseudonymKey: VersionedSecretKeyV1;
  readonly deletionHandleKey: VersionedSecretKeyV1;
  readonly deploymentManifest: ProductAnalyticsDeploymentManifestV1;
  readonly now?: () => Date;
  readonly requestNow?: () => number;
  readonly uuid?: () => string;
}

/** Temporary compatibility/test composition. SQLite is not a production fallback. */
export async function createSqliteProductAnalyticsGovernanceCompatibilityV1(
  options: SqliteProductAnalyticsGovernanceCompatibilityOptionsV1,
): Promise<ProductAnalyticsGovernanceCompositionV1> {
  const consentAuthority = new SqliteProductAnalyticsConsentAuthority({
    dataDirectory: options.dataDirectory,
    purposePseudonymKey: options.purposePseudonymKey,
    deletionHandleKey: options.deletionHandleKey,
    now: options.now,
    uuid: options.uuid,
  });
  const eventIngestion = new SqliteProductAnalyticsEventIngestion({
    dataDirectory: options.dataDirectory,
    deletionHandleKey: options.deletionHandleKey,
    now: options.now,
    uuid: options.uuid,
  });
  const lifecycleAuthority = new SqliteProductAnalyticsLifecycleAuthority({
    dataDirectory: options.dataDirectory,
    deletionHandleKey: options.deletionHandleKey,
    now: options.now,
    uuid: options.uuid,
  });
  let closed = false;
  const persistence: ProductAnalyticsGovernancePersistenceV1 = Object.freeze({
    consentAuthority,
    eventIngestion,
    lifecycleAuthority,
    close(): void {
      if (closed) return;
      closed = true;
      lifecycleAuthority.close();
      eventIngestion.close();
      consentAuthority.close();
    },
  });
  return createProductAnalyticsGovernanceCompositionV1({
    persistence,
    allowedOrigins: options.allowedOrigins,
    authenticator: options.authenticator,
    deploymentManifest: options.deploymentManifest,
    requestNow: options.requestNow,
    uuid: options.uuid,
  });
}
