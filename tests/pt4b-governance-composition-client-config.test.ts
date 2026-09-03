import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { readProductAnalyticsBrowserConfig } from '../src/app/governance/installProductAnalyticsClient.ts';
import type { RuntimeComponentReferenceV1 } from '../src/governance/index.ts';
import { createProductAnalyticsGovernanceCompositionV1 } from '../src/governance-service/ProductAnalyticsGovernanceComposition.ts';
import { RuntimePinnedProductAnalyticsEventIngestion } from '../src/governance-service/ProductAnalyticsRuntimeAuthority.ts';

const directories: string[] = [];
afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });

function ref(componentId: string, version: string, character: string): RuntimeComponentReferenceV1 {
  return {
    schemaVersion: '1', componentId, version,
    artifactDigest: { algorithm: 'SHA256', value: character.repeat(64) },
  };
}

const APP = ref('nemosyne-app', '1.0.0+sha.0123456789abcdef', 'a');
const DEPLOYMENT = ref('private-preview', '1.0.0+sha.0123456789abcdef', 'b');
const UI = ref('product-ui', '1.0.0+sha.0123456789abcdef', 'c');
const PLATFORM = ref('browser-runtime', 'chromium-140', 'd');

describe('PT4B8 canonical governed service composition', () => {
  it('cannot compose the PT4 service without runtime-pinned ingestion', () => {
    const dataDirectory = mkdtempSync(join(tmpdir(), 'nemosyne-pt4b8-composition-'));
    directories.push(dataDirectory);
    const composition = createProductAnalyticsGovernanceCompositionV1({
      dataDirectory,
      allowedOrigins: ['https://app.example'],
      authenticator: { async authenticate() { throw new Error('not exercised'); } },
      purposePseudonymKey: { version: 'p1', key: new Uint8Array(32).fill(7) },
      deletionHandleKey: { version: 'd1', key: new Uint8Array(32).fill(9) },
      deploymentManifest: {
        schemaVersion: '1',
        applicationBuild: APP,
        deploymentConfiguration: DEPLOYMENT,
        uiTreatment: UI,
        allowedPlatformRuntimes: [{ componentId: PLATFORM.componentId, version: PLATFORM.version }],
      },
      now: () => new Date('2026-09-03T07:00:00.000Z'),
      requestNow: () => Date.parse('2026-09-03T07:00:00.000Z'),
    });
    expect(composition.eventIngestion).toBeInstanceOf(RuntimePinnedProductAnalyticsEventIngestion);
    expect(composition.server.maxConnections).toBe(128);
    composition.closeStorage();
    composition.closeStorage();
  });
});

describe('PT4B8 browser product-analytics configuration', () => {
  it('is a true no-op when every product-data setting is absent and fails closed on partial configuration', () => {
    expect(readProductAnalyticsBrowserConfig({})).toBeNull();
    expect(() => readProductAnalyticsBrowserConfig({
      VITE_NEMOSYNE_DATA_PLANE_ENDPOINT: 'https://data.example',
    })).toThrow(/complete or entirely absent/u);
  });

  it('accepts only the closed four-reference runtime configuration', () => {
    const runtime = JSON.stringify({
      applicationBuild: APP,
      deploymentConfiguration: DEPLOYMENT,
      uiTreatment: UI,
      platformRuntime: PLATFORM,
    });
    const config = readProductAnalyticsBrowserConfig({
      VITE_NEMOSYNE_DATA_PLANE_ENDPOINT: 'https://data.example',
      VITE_NEMOSYNE_OIDC_ISSUER: 'https://issuer.example',
      VITE_NEMOSYNE_OIDC_CLIENT_ID: 'nemosyne-web',
      VITE_NEMOSYNE_OIDC_REDIRECT_URI: 'https://app.example/auth/callback',
      VITE_NEMOSYNE_PRODUCT_ANALYTICS_RUNTIME: runtime,
    });
    expect(config?.runtime).toEqual({
      applicationBuild: APP,
      deploymentConfiguration: DEPLOYMENT,
      uiTreatment: UI,
      platformRuntime: PLATFORM,
    });
    expect(() => readProductAnalyticsBrowserConfig({
      VITE_NEMOSYNE_DATA_PLANE_ENDPOINT: 'https://data.example',
      VITE_NEMOSYNE_OIDC_ISSUER: 'https://issuer.example',
      VITE_NEMOSYNE_OIDC_CLIENT_ID: 'nemosyne-web',
      VITE_NEMOSYNE_OIDC_REDIRECT_URI: 'https://app.example/auth/callback',
      VITE_NEMOSYNE_PRODUCT_ANALYTICS_RUNTIME: JSON.stringify({ ...JSON.parse(runtime), extra: true }),
    })).toThrow(/exactly the four PT4 runtime references/u);
  });
});
