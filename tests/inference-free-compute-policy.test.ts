import { describe, expect, it } from 'vitest';
import {
  NoEligibleInferenceProviderError,
  routeFreeInference,
  type InferenceProviderModel,
  type ProviderQuota,
} from '../src/inference/FreeComputePolicy.ts';

const publicCloud: InferenceProviderModel = {
  providerId: 'cloudflare-workers-ai',
  modelId: 'free-chat',
  capabilities: ['chat'],
  allowedDataClasses: ['public'],
  billingClass: 'free',
  enabled: true,
  priority: 20,
  verifiedAt: '2026-09-11',
  source: 'test',
};

const local: InferenceProviderModel = {
  providerId: 'local',
  modelId: 'local-chat',
  capabilities: ['chat'],
  allowedDataClasses: ['public', 'internal', 'sensitive', 'prohibited-external'],
  billingClass: 'free',
  enabled: true,
  priority: 10,
  verifiedAt: '2026-09-11',
  source: 'local',
};

const cloudQuota: ProviderQuota = {
  providerId: 'cloudflare-workers-ai',
  unit: 'neurons',
  remaining: 10_000,
  resetAt: null,
  expiresAt: null,
};

const localQuota: ProviderQuota = {
  providerId: 'local',
  unit: 'unmetered',
  remaining: null,
  resetAt: null,
  expiresAt: null,
};

describe('free compute inference routing', () => {
  it('routes sensitive data only to an explicitly permitted local provider', () => {
    expect(routeFreeInference(
      { capability: 'chat', dataClass: 'sensitive', now: '2026-09-11T00:00:00Z' },
      [publicCloud, local],
      [cloudQuota, localQuota]
    )).toMatchObject({ providerId: 'local', modelId: 'local-chat', billingClass: 'free' });
  });

  it('uses eligible free cloud capacity for public data when local is unavailable', () => {
    expect(routeFreeInference(
      { capability: 'chat', dataClass: 'public', estimatedUnits: 100, now: '2026-09-11T00:00:00Z' },
      [publicCloud],
      [cloudQuota]
    )).toMatchObject({ providerId: 'cloudflare-workers-ai', billingClass: 'free' });
  });

  it('fails closed when free quota is exhausted instead of silently spending money', () => {
    expect(() => routeFreeInference(
      { capability: 'chat', dataClass: 'public', estimatedUnits: 100, now: '2026-09-11T00:00:00Z' },
      [publicCloud],
      [{ ...cloudQuota, remaining: 99 }]
    )).toThrow(NoEligibleInferenceProviderError);
  });

  it('excludes expired promotional capacity', () => {
    const promo: InferenceProviderModel = {
      ...publicCloud,
      providerId: 'aws-bedrock',
      modelId: 'promo-model',
      billingClass: 'promotional',
    };
    expect(() => routeFreeInference(
      { capability: 'chat', dataClass: 'public', now: '2026-09-11T00:00:00Z' },
      [promo],
      [{ providerId: 'aws-bedrock', unit: 'tokens', remaining: 1000, resetAt: null, expiresAt: '2026-09-10T23:59:59Z' }]
    )).toThrow(NoEligibleInferenceProviderError);
  });

  it('requires explicit opt-in before a paid provider can be selected', () => {
    const paid: InferenceProviderModel = {
      ...publicCloud,
      providerId: 'google-vertex',
      modelId: 'paid-model',
      billingClass: 'paid',
    };
    const quota: ProviderQuota = {
      providerId: 'google-vertex',
      unit: 'tokens',
      remaining: 1000,
      resetAt: null,
      expiresAt: null,
    };
    expect(() => routeFreeInference(
      { capability: 'chat', dataClass: 'public', now: '2026-09-11T00:00:00Z' },
      [paid],
      [quota]
    )).toThrow(NoEligibleInferenceProviderError);

    expect(routeFreeInference(
      { capability: 'chat', dataClass: 'public', allowPaidFallback: true, now: '2026-09-11T00:00:00Z' },
      [paid],
      [quota]
    )).toMatchObject({ providerId: 'google-vertex', billingClass: 'paid' });
  });

  it('rejects provider models that require a paid plan even when nominal quota exists', () => {
    const paidPlanModel: InferenceProviderModel = {
      ...publicCloud,
      modelId: 'paid-plan-only',
      requiresPaidPlan: true,
    };
    expect(() => routeFreeInference(
      { capability: 'chat', dataClass: 'public', now: '2026-09-11T00:00:00Z' },
      [paidPlanModel],
      [cloudQuota]
    )).toThrow(NoEligibleInferenceProviderError);
  });
});
