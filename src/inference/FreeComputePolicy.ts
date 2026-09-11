export type InferenceCapability = 'chat' | 'embedding';
export type DataClass = 'public' | 'internal' | 'sensitive' | 'prohibited-external';
export type BillingClass = 'free' | 'promotional' | 'paid';
export type ProviderId = 'local' | 'cloudflare-workers-ai' | 'aws-bedrock' | 'google-vertex';

export interface InferenceProviderModel {
  providerId: ProviderId;
  modelId: string;
  capabilities: readonly InferenceCapability[];
  allowedDataClasses: readonly DataClass[];
  billingClass: BillingClass;
  enabled: boolean;
  priority: number;
  verifiedAt: string;
  source: string;
  requiresPaidPlan?: boolean;
}

export interface ProviderQuota {
  providerId: ProviderId;
  unit: 'neurons' | 'requests' | 'tokens' | 'unmetered';
  remaining: number | null;
  resetAt: string | null;
  expiresAt: string | null;
}

export interface InferenceRoutingRequest {
  capability: InferenceCapability;
  dataClass: DataClass;
  estimatedUnits?: number;
  now?: string;
}

export interface InferenceRoute {
  providerId: ProviderId;
  modelId: string;
  billingClass: BillingClass;
  reason: string;
}

export class NoEligibleInferenceProviderError extends Error {
  readonly code = 'NO_ELIGIBLE_INFERENCE_PROVIDER';

  constructor(message: string) {
    super(message);
    this.name = 'NoEligibleInferenceProviderError';
  }
}

function isExpired(expiresAt: string | null, now: Date): boolean {
  if (expiresAt === null) return false;
  const parsed = Date.parse(expiresAt);
  return !Number.isFinite(parsed) || parsed <= now.getTime();
}

function quotaAvailable(quota: ProviderQuota | undefined, estimatedUnits: number, now: Date): boolean {
  if (!quota) return false;
  if (isExpired(quota.expiresAt, now)) return false;
  if (quota.remaining === null) return true;
  return quota.remaining >= estimatedUnits;
}

export function routeFreeInference(
  request: InferenceRoutingRequest,
  models: readonly InferenceProviderModel[],
  quotas: readonly ProviderQuota[]
): InferenceRoute {
  const now = new Date(request.now ?? new Date().toISOString());
  if (Number.isNaN(now.getTime())) throw new Error('routing request now must be a valid ISO timestamp');

  const estimatedUnits = request.estimatedUnits ?? 1;
  if (!Number.isFinite(estimatedUnits) || estimatedUnits <= 0) {
    throw new Error('estimatedUnits must be a positive finite number');
  }

  const quotaByProvider = new Map(quotas.map((quota) => [quota.providerId, quota]));
  const candidates = models
    .filter((model) => model.enabled)
    .filter((model) => model.capabilities.includes(request.capability))
    .filter((model) => model.allowedDataClasses.includes(request.dataClass))
    .filter((model) => !model.requiresPaidPlan)
    .filter((model) => model.billingClass !== 'paid')
    .filter((model) => quotaAvailable(quotaByProvider.get(model.providerId), estimatedUnits, now))
    .sort((a, b) => a.priority - b.priority || a.providerId.localeCompare(b.providerId) || a.modelId.localeCompare(b.modelId));

  const selected = candidates[0];
  if (!selected) {
    throw new NoEligibleInferenceProviderError(
      `No eligible ${request.capability} provider has permitted data handling and available non-paid capacity for ${request.dataClass} data`
    );
  }

  return {
    providerId: selected.providerId,
    modelId: selected.modelId,
    billingClass: selected.billingClass,
    reason: `selected priority ${selected.priority} provider with eligible non-paid capacity`,
  };
}

export const CURRENT_FREE_INFERENCE_MODELS: readonly InferenceProviderModel[] = [
  {
    providerId: 'cloudflare-workers-ai',
    modelId: '@cf/zai-org/glm-4.7-flash',
    capabilities: ['chat'],
    allowedDataClasses: ['public'],
    billingClass: 'free',
    enabled: true,
    priority: 20,
    verifiedAt: '2026-09-11',
    source: 'https://developers.cloudflare.com/changelog/post/2026-07-28-models-require-workers-paid/',
  },
  {
    providerId: 'cloudflare-workers-ai',
    modelId: '@cf/google/gemma-4-26b-a4b-it',
    capabilities: ['chat'],
    allowedDataClasses: ['public'],
    billingClass: 'free',
    enabled: true,
    priority: 21,
    verifiedAt: '2026-09-11',
    source: 'https://developers.cloudflare.com/changelog/post/2026-07-28-models-require-workers-paid/',
  },
  {
    providerId: 'cloudflare-workers-ai',
    modelId: '@cf/nvidia/nemotron-3-120b-a12b',
    capabilities: ['chat'],
    allowedDataClasses: ['public'],
    billingClass: 'free',
    enabled: true,
    priority: 22,
    verifiedAt: '2026-09-11',
    source: 'https://developers.cloudflare.com/changelog/post/2026-07-28-models-require-workers-paid/',
  },
] as const;

export const CLOUDFLARE_FREE_DAILY_QUOTA: ProviderQuota = {
  providerId: 'cloudflare-workers-ai',
  unit: 'neurons',
  remaining: 10_000,
  resetAt: null,
  expiresAt: null,
};
