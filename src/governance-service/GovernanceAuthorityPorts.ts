import type {
  AuthenticatedPrincipalV1,
  ProductAnalyticsCaptureAuthorizationRequestV1,
  ProductAnalyticsCaptureAuthorizationV1,
  ProductAnalyticsConsentStateV1,
  ProductAnalyticsGrantRequestV1,
  ProductAnalyticsGrantResultV1,
  ProductAnalyticsRevocationRequestV1,
  ProductAnalyticsRevocationResultV1,
} from './ProductAnalyticsConsentAuthority.ts';
import type { ProductEventDispositionV1 } from './ProductAnalyticsEventIngestion.ts';
import type {
  ProductAnalyticsErasureRequestV1,
  ProductAnalyticsErasureResultV1,
  ProductAnalyticsExportRequestV1,
  ProductAnalyticsExportResultV1,
  ProductAnalyticsLifecycleReadinessV1,
} from './ProductAnalyticsLifecycleAuthority.ts';

/**
 * Domain-facing persistence ports for the governed Product Mode data plane.
 *
 * Implementations may be synchronous (the temporary SQLite compatibility
 * adapter) or asynchronous (the PostgreSQL production adapter). Callers must
 * always await results so persistence technology never leaks into HTTP/domain
 * orchestration.
 */
export type Awaitable<T> = T | Promise<T>;

export interface ProductAnalyticsConsentAuthorityPortV1 {
  getCurrent(principal: AuthenticatedPrincipalV1): Awaitable<ProductAnalyticsConsentStateV1>;
  grant(
    principal: AuthenticatedPrincipalV1,
    request: ProductAnalyticsGrantRequestV1,
  ): Awaitable<ProductAnalyticsGrantResultV1>;
  revoke(
    principal: AuthenticatedPrincipalV1,
    request: ProductAnalyticsRevocationRequestV1,
  ): Awaitable<ProductAnalyticsRevocationResultV1>;
  authorizeCapture(
    principal: AuthenticatedPrincipalV1,
    request: ProductAnalyticsCaptureAuthorizationRequestV1,
  ): Awaitable<ProductAnalyticsCaptureAuthorizationV1>;
}

export interface ProductAnalyticsEventIngestionPortV1 {
  ingestLine(
    principal: AuthenticatedPrincipalV1,
    jsonText: string,
  ): Awaitable<ProductEventDispositionV1>;
}

export interface ProductAnalyticsLifecycleAuthorityPortV1 {
  runRetention(): Awaitable<ProductAnalyticsLifecycleReadinessV1>;
  assertReadyForIngestion(): Awaitable<void>;
  exportRecords(
    principal: AuthenticatedPrincipalV1,
    request: ProductAnalyticsExportRequestV1,
  ): Awaitable<ProductAnalyticsExportResultV1>;
  erase(
    principal: AuthenticatedPrincipalV1,
    request: ProductAnalyticsErasureRequestV1,
  ): Awaitable<ProductAnalyticsErasureResultV1>;
}

export interface ProductAnalyticsGovernancePersistenceV1 {
  readonly consentAuthority: ProductAnalyticsConsentAuthorityPortV1;
  readonly eventIngestion: ProductAnalyticsEventIngestionPortV1;
  readonly lifecycleAuthority: ProductAnalyticsLifecycleAuthorityPortV1;
  close(): Awaitable<void>;
}
