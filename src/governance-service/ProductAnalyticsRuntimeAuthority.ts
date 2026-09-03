import {
  PRODUCT_GOVERNED_EVENT_REGISTRY_V1,
  canonicalGovernedJsonV1,
  validateGovernedEventEnvelopeV1,
  type GovernedEventEnvelopeV1,
  type JsonValue,
  type RuntimeComponentReferenceV1,
} from '../governance/index.ts';
import type { ProductAnalyticsEventIngestionPortV1 } from './GovernanceAuthorityPorts.ts';
import type { AuthenticatedPrincipalV1 } from './ProductAnalyticsConsentAuthority.ts';
import type { ProductEventDispositionV1 } from './ProductAnalyticsEventIngestion.ts';

export interface ProductAnalyticsDeploymentManifestV1 {
  readonly schemaVersion: '1';
  readonly applicationBuild: RuntimeComponentReferenceV1;
  readonly deploymentConfiguration: RuntimeComponentReferenceV1;
  readonly uiTreatment: RuntimeComponentReferenceV1;
  readonly allowedPlatformRuntimes: readonly Readonly<{
    componentId: string;
    version: string;
  }>[];
}

export interface ProductAnalyticsRuntimeAuthorityV1 {
  accepts(envelope: GovernedEventEnvelopeV1): boolean;
}

function sameReference(
  actual: RuntimeComponentReferenceV1 | null,
  expected: RuntimeComponentReferenceV1,
): boolean {
  return actual !== null &&
    canonicalGovernedJsonV1(actual as unknown as JsonValue) ===
      canonicalGovernedJsonV1(expected as unknown as JsonValue);
}

export class ReviewedProductAnalyticsRuntimeAuthority implements ProductAnalyticsRuntimeAuthorityV1 {
  private readonly manifest: ProductAnalyticsDeploymentManifestV1;
  private readonly allowedPlatforms: ReadonlySet<string>;

  constructor(manifest: ProductAnalyticsDeploymentManifestV1) {
    if (manifest.schemaVersion !== '1') throw new Error('unsupported deployment manifest schema version');
    if (manifest.allowedPlatformRuntimes.length === 0) throw new Error('deployment manifest requires at least one allowed platform runtime');
    this.manifest = Object.freeze({
      ...manifest,
      allowedPlatformRuntimes: Object.freeze(manifest.allowedPlatformRuntimes.map((value) => Object.freeze({ ...value }))),
    });
    this.allowedPlatforms = new Set(
      this.manifest.allowedPlatformRuntimes.map(({ componentId, version }) => `${componentId}\n${version}`),
    );
  }

  accepts(envelope: GovernedEventEnvelopeV1): boolean {
    const components = envelope.runtime.components;
    if (!sameReference(components.applicationBuild, this.manifest.applicationBuild)) return false;
    if (!sameReference(components.deploymentConfiguration, this.manifest.deploymentConfiguration)) return false;
    if (!sameReference(components.uiTreatment, this.manifest.uiTreatment)) return false;
    const platform = components.platformRuntime;
    if (!platform) return false;
    return this.allowedPlatforms.has(`${platform.componentId}\n${platform.version}`);
  }
}

export interface RuntimePinnedProductAnalyticsEventIngestionOptions {
  readonly runtimeAuthority: ProductAnalyticsRuntimeAuthorityV1;
  readonly delegate: ProductAnalyticsEventIngestionPortV1;
}

/**
 * Production PT4 ingestion seam. Runtime policy is checked independently from
 * the hostile envelope before the persistence-backed consent/replay/storage
 * authority is consulted. The decorator deliberately has no database type.
 */
export class RuntimePinnedProductAnalyticsEventIngestion implements ProductAnalyticsEventIngestionPortV1 {
  private readonly runtimeAuthority: ProductAnalyticsRuntimeAuthorityV1;
  private readonly delegate: ProductAnalyticsEventIngestionPortV1;

  constructor(options: RuntimePinnedProductAnalyticsEventIngestionOptions) {
    this.runtimeAuthority = options.runtimeAuthority;
    this.delegate = options.delegate;
  }

  async ingestLine(
    principal: AuthenticatedPrincipalV1,
    jsonText: string,
  ): Promise<ProductEventDispositionV1> {
    const structural = validateGovernedEventEnvelopeV1(jsonText, PRODUCT_GOVERNED_EVENT_REGISTRY_V1);
    if (!structural.ok || !this.runtimeAuthority.accepts(structural.envelope)) {
      return Object.freeze({
        eventId: structural.ok ? structural.envelope.eventId : null,
        status: 'REFUSED_GOVERNANCE',
        reasonCode: structural.ok ? 'RUNTIME_MANIFEST_MISMATCH' : (structural.issues[0]?.code ?? 'REFUSED_GOVERNANCE'),
      });
    }
    return this.delegate.ingestLine(principal, jsonText);
  }
}
