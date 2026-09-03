import type { Server } from 'node:http';

import {
  GovernanceHttpService,
  createGovernanceHttpServer,
  type GovernanceAuthenticatorV1,
} from './GovernanceHttpService.ts';
import {
  SqliteProductAnalyticsConsentAuthority,
  type VersionedSecretKeyV1,
} from './ProductAnalyticsConsentAuthority.ts';
import { SqliteProductAnalyticsLifecycleAuthority } from './ProductAnalyticsLifecycleAuthority.ts';
import {
  ReviewedProductAnalyticsRuntimeAuthority,
  RuntimePinnedProductAnalyticsEventIngestion,
  type ProductAnalyticsDeploymentManifestV1,
} from './ProductAnalyticsRuntimeAuthority.ts';

export interface ProductAnalyticsGovernanceCompositionOptionsV1 {
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

export interface ProductAnalyticsGovernanceCompositionV1 {
  readonly consentAuthority: SqliteProductAnalyticsConsentAuthority;
  readonly eventIngestion: RuntimePinnedProductAnalyticsEventIngestion;
  readonly lifecycleAuthority: SqliteProductAnalyticsLifecycleAuthority;
  readonly service: GovernanceHttpService;
  readonly server: Server;
  readonly closeStorage: () => void;
}

/**
 * Canonical PT4 single-node composition. The unpinned base ingestion class is
 * deliberately not an input: every service created here receives the reviewed
 * deployment runtime authority before consent/replay/storage admission.
 *
 * Callers own listening/TLS termination. Storage must be closed only after the
 * returned HTTP server has stopped accepting work.
 */
export function createProductAnalyticsGovernanceCompositionV1(
  options: ProductAnalyticsGovernanceCompositionOptionsV1,
): ProductAnalyticsGovernanceCompositionV1 {
  const consentAuthority = new SqliteProductAnalyticsConsentAuthority({
    dataDirectory: options.dataDirectory,
    purposePseudonymKey: options.purposePseudonymKey,
    deletionHandleKey: options.deletionHandleKey,
    now: options.now,
    uuid: options.uuid,
  });

  const runtimeAuthority = new ReviewedProductAnalyticsRuntimeAuthority(options.deploymentManifest);
  const eventIngestion = new RuntimePinnedProductAnalyticsEventIngestion({
    dataDirectory: options.dataDirectory,
    deletionHandleKey: options.deletionHandleKey,
    runtimeAuthority,
    now: options.now,
    uuid: options.uuid,
  });

  // Lifecycle opens after consent/event schema initialization and immediately
  // runs retention/readiness in its constructor before the service can ingest.
  const lifecycleAuthority = new SqliteProductAnalyticsLifecycleAuthority({
    dataDirectory: options.dataDirectory,
    deletionHandleKey: options.deletionHandleKey,
    now: options.now,
    uuid: options.uuid,
  });
  lifecycleAuthority.assertReadyForIngestion();

  const service = new GovernanceHttpService({
    allowedOrigins: options.allowedOrigins,
    authenticator: options.authenticator,
    consentAuthority,
    eventIngestion,
    lifecycleAuthority,
    now: options.requestNow,
    requestId: options.uuid,
  });
  const server = createGovernanceHttpServer(service);

  let closed = false;
  const closeStorage = (): void => {
    if (closed) return;
    closed = true;
    lifecycleAuthority.close();
    eventIngestion.close();
    consentAuthority.close();
  };

  return Object.freeze({
    consentAuthority,
    eventIngestion,
    lifecycleAuthority,
    service,
    server,
    closeStorage,
  });
}
