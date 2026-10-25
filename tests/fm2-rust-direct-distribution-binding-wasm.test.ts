import { beforeAll, describe, expect, it } from 'vitest';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { ColumnType, Dataset } from '../src/data/Dataset.ts';
import * as bridge from '../src/wasm/RuntimeBridge.ts';
import {
  buildDirectDistributionBindingV1,
  buildDistributionSemanticEmbodimentV1,
} from '../src/wasm/runtime/SemanticEmbodimentBridge.ts';
import {
  DIRECT_DISTRIBUTION_CONSUMER_ID_V1,
  parseDirectDistributionBindingV1,
} from '../src/moneta/representation/DirectDistributionBindingV1.ts';
import {
  DIRECT_EMPIRICAL_DISTRIBUTION_REQUIREMENT_PROFILE_V1,
  evidenceRequirementProfileByIdV1,
} from '../src/data/evidence/EvidenceRequirementProfile.ts';
import { DESCRIPTIVE_STATISTICS_CONSUMER_ID_V1 } from '../src/data/evidence/GovernedConsumerAttestation.ts';
import { governedConsumerPolicyV1 } from '../src/data/evidence/ConsumerPolicyRegistry.ts';

describe('FM2 kernel-issued direct distribution binding v1, real WASM', () => {
  beforeAll(async () => {
    if (!bridge.isReady()) await bridge.initRuntime('/wasm/pkg/nemosyne_wasm_bg.wasm');
    if (!bridge.isReady()) throw new Error('Real WASM runtime required');
  });

  it('mints a source-bound descriptive-only consumer and refuses content/policy laundering', async () => {
    const atlas = new AtlasCore({ kernel: bridge });
    atlas.loadDataset(new Dataset('direct-producer', [
      { name: 'x', type: ColumnType.NUMERIC },
      { name: 'y', type: ColumnType.NUMERIC },
    ], Array.from({ length: 32 }, (_, i) => ({ x: i + 0.5, y: i * 2 }))));
    const handle = atlas.aggregate.analytical.currentHandle;
    try {
      const request = {
        schemaVersion: 1 as const, candidateId: 'DISTRIBUTION_FIELD' as const,
        measureField: 'x', histogramBinCount: 6, ecdfKnotCount: 8,
        quantileProbabilities: [0, 0.25, 0.5, 0.75, 1],
      };
      const first = buildDirectDistributionBindingV1(handle, request);
      const second = buildDirectDistributionBindingV1(handle, request);
      expect(first).not.toBeNull();
      expect(second).toEqual(first);
      expect(first!.source.result.status).toBe('READY');
      expect(first!.sourceDigest).toMatch(/^[a-f0-9]{64}$/);
      expect(first!.receiptId).toBe(`direct-distribution:${first!.sourceDigest}`);
      expect(first!.consumerId).toBe(DIRECT_DISTRIBUTION_CONSUMER_ID_V1);
      expect(first!.consumerId).not.toBe(DESCRIPTIVE_STATISTICS_CONSUMER_ID_V1);
      // RFC0009 V3 archives remain governed only by their original kernel
      // attestation. No stealth extra MISSING_USE has been introduced.
      expect(governedConsumerPolicyV1().has(first!.consumerId)).toBe(false);
      expect(first!.requirementProfileId).toBe(
        DIRECT_EMPIRICAL_DISTRIBUTION_REQUIREMENT_PROFILE_V1.profileId
      );
      expect(evidenceRequirementProfileByIdV1(first!.requirementProfileId))
        .toBe(DIRECT_EMPIRICAL_DISTRIBUTION_REQUIREMENT_PROFILE_V1);
      expect(first!.datasetFingerprint).toBe(atlas.datasetFingerprint);
      expect(first!.kernelVersion).toBe(bridge.kernelVersion());
      expect(first!.source.analyticalMethod.parameters).toMatchObject({
        request,
      });

      // Same Rust dataset, different bounded analytical request. The binding
      // cannot be carried forward onto an alternative geometry.
      const alternative = buildDirectDistributionBindingV1(handle, {
        ...request, histogramBinCount: 7,
      });
      expect(alternative?.sourceDigest).not.toBe(first!.sourceDigest);
      expect(alternative?.receiptId).not.toBe(first!.receiptId);

      const oldSemantic = buildDistributionSemanticEmbodimentV1(handle, request);
      expect(oldSemantic?.result.status).toBe('READY');
      expect(oldSemantic?.datasetFingerprint).toBe(first!.datasetFingerprint);
      expect(first!.source).toEqual(oldSemantic);

      const raw = {
        schemaVersion: '1', consumerId: first!.consumerId,
        requirementProfileId: first!.requirementProfileId,
        claimKind: first!.claimKind,
        datasetFingerprint: first!.datasetFingerprint,
        kernelVersion: first!.kernelVersion,
        sourceJson: JSON.stringify(first!.source),
        sourceDigest: first!.sourceDigest,
        receiptId: first!.receiptId,
      };
      expect(() => parseDirectDistributionBindingV1({
        ...raw, consumerId: DESCRIPTIVE_STATISTICS_CONSUMER_ID_V1,
      }, { datasetFingerprint: first!.datasetFingerprint, kernelVersion: first!.kernelVersion }))
        .toThrow('Consumer/profile/claim');
      expect(() => parseDirectDistributionBindingV1({
        ...raw, receiptId: alternative!.receiptId,
      }, { datasetFingerprint: first!.datasetFingerprint, kernelVersion: first!.kernelVersion }))
        .toThrow('content binding mismatch');
      expect(() => parseDirectDistributionBindingV1(raw, {
        datasetFingerprint: 'replaced-dataset',
        kernelVersion: first!.kernelVersion,
      })).toThrow('Live analytical identity mismatch');

      // Presence of a new producer does not promote the existing Atlas FM2
      // direct compiler or branch ledger until a separate admission/replay path.
      expect(atlas.getActiveDirectCompileResult()).toBeUndefined();
      expect(atlas.getDirectFeedbackLinks()).toHaveLength(0);
    } finally {
      bridge.destroyDataset(handle);
    }
  }, 60000);

  it('does not mint a direct consumer for refused source or invalid handle', () => {
    expect(buildDirectDistributionBindingV1(0, {
      schemaVersion: 1, candidateId: 'DISTRIBUTION_FIELD',
      measureField: 'absent', histogramBinCount: 8,
      ecdfKnotCount: 8, quantileProbabilities: [0, 0.5, 1],
    })).toBeNull();
    const atlas = new AtlasCore({ kernel: bridge });
    atlas.loadDataset(new Dataset('direct-refused', [
      { name: 'x', type: ColumnType.NUMERIC },
    ], [{ x: 1 }, { x: 2 }]));
    const handle = atlas.aggregate.analytical.currentHandle;
    try {
      expect(buildDirectDistributionBindingV1(handle, {
        schemaVersion: 1, candidateId: 'DISTRIBUTION_FIELD',
        measureField: 'missing', histogramBinCount: 8,
        ecdfKnotCount: 8, quantileProbabilities: [0, 0.5, 1],
      })).toBeNull();
    } finally {
      bridge.destroyDataset(handle);
    }
  }, 60000);
});
