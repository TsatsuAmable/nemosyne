import {
  canonicalGovernedJsonV1,
  type GovernedEventEnvelopeV1,
  type RuntimeComponentReferenceV1,
} from '../governance/index.ts';

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
  return actual !== null && canonicalGovernedJsonV1(actual) === canonicalGovernedJsonV1(expected);
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
