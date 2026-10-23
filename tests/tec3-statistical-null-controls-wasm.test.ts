/**
 * TEC3 real analytical null controls: no fixture kernel, numeric stand-in,
 * claim promotion, or hardware is involved. See
 * docs/work/TEC3_REAL_WASM_STATISTICAL_NULL_CONTROLS.md.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import * as bridge from '../src/wasm/RuntimeBridge.ts';
import { parseEvidenceReceiptBundleV1 } from '../src/data/evidence/EvidenceReceipt.ts';
import { statisticsEvidenceReceiptAuthority } from '../src/atlas/MonetaEvidenceAuthority.ts';
import {
  DESCRIPTIVE_SUMMARY_REQUIREMENT_PROFILE_V1,
  INFERENTIAL_CLAIM_REQUIREMENT_PROFILE_V1,
} from '../src/data/evidence/EvidenceRequirementProfile.ts';

function numericPair(name: string, x: number[], y: number[]): number {
  return bridge.loadDatasetJson({
    name,
    columns: [
      { name: 'x', type: 'NUMERIC' },
      { name: 'y', type: 'NUMERIC' },
    ],
    rows: x.map((value, index) => ({ x: value, y: y[index] })),
  });
}

function categorical(name: string, values: string[]): number {
  return bridge.loadDatasetJson({
    name,
    columns: [{ name: 'group', type: 'CATEGORICAL' }],
    rows: values.map((group) => ({ group })),
  });
}

describe('TEC3 real-WASM null cases remain descriptive rather than inferential', () => {
  beforeAll(async () => {
    if (!bridge.isReady()) await bridge.initRuntime('/wasm/pkg/nemosyne_wasm_bg.wasm');
    if (!bridge.isReady()) throw new Error('Real WASM bridge is required for TEC3 null qualification');
  });

  it.each([
    {
      name: 'exact orthogonal centered pattern',
      x: [-2, -1, 1, 2],
      y: [1, -2, 2, -1],
      expectedPearson: 0,
    },
    {
      name: 'perfect positive relationship control',
      x: [-2, -1, 1, 2],
      y: [-4, -2, 2, 4],
      expectedPearson: 1,
    },
  ])('pins Rust Pearson result and governed evidence for $name', ({
    name, x, y, expectedPearson,
  }) => {
    const handle = numericPair(`tec3-${name}`, x, y);
    try {
      const facts = bridge.statistics(handle);
      expect(facts).not.toBeNull();
      const pair = facts!.correlation.find((item) => item.a === 'x' && item.b === 'y');
      expect(pair, name).toBeDefined();
      expect(pair!.value).toBeCloseTo(expectedPearson, 12);

      const bundle = parseEvidenceReceiptBundleV1(bridge.statisticsEvidenceReceiptBundle(handle));
      expect(bundle.datasetFingerprint).toBe(bridge.datasetFingerprint(handle));
      expect(bundle.kernelVersion).toBe(bridge.kernelVersion());
      const receipt = bundle.receipts.find((item) => item.receiptId === 'pearson:x:y');
      expect(receipt, name).toBeDefined();
      expect(receipt!.methodProvenance.method).toBe('dependency/pearson');
      expect(receipt!.sampleSupport.policy).toBe('pairwiseComplete');
      expect(receipt!.sampleSupport.rowsUsed).toBe(4);
      expect(receipt!.sampleSupport.rowsExcluded).toBe(0);
      expect(receipt!.assumptions).toContainEqual({
        assumption: 'observation independence for inferential interpretation',
        status: 'notTestableFromData',
        detail: 'requires observation-structure or study-design metadata',
      });
      expect(receipt!.uncertainty).toBeNull();
      expect(receipt!.stability).toBeNull();

      const authority = statisticsEvidenceReceiptAuthority(bridge, handle);
      expect(authority.resolveAgainst(
        DESCRIPTIVE_SUMMARY_REQUIREMENT_PROFILE_V1, 'pearson:x:y'
      ).status).toBe('RESOLVED');
      expect(authority.resolveAgainst(
        INFERENTIAL_CLAIM_REQUIREMENT_PROFILE_V1, 'pearson:x:y'
      )).toEqual({
        status: 'UNRESOLVED_ASSUMPTION',
        receiptId: 'pearson:x:y',
        assumption: 'observation independence for inferential interpretation',
      });
    } finally {
      bridge.destroyDataset(handle);
    }
  });

  it.each([
    { name: 'one observed class (entropy null control)', values: ['A', 'A', 'A', 'A'], entropy: 0, cardinality: 1 },
    { name: 'balanced two classes (positive entropy control)', values: ['A', 'B', 'A', 'B'], entropy: 1, cardinality: 2 },
  ])('pins empirical category support and refuses inference for $name', ({
    name, values, entropy, cardinality,
  }) => {
    const handle = categorical(`tec3-${name}`, values);
    try {
      const facts = bridge.statistics(handle);
      expect(facts).not.toBeNull();
      const group = facts!.categorical.find((item) => item.name === 'group');
      expect(group).toBeDefined();
      expect(group!.cardinality).toBe(cardinality);
      expect(group!.entropy).toBeCloseTo(entropy, 12);

      const bundle = parseEvidenceReceiptBundleV1(bridge.statisticsEvidenceReceiptBundle(handle));
      expect(bundle.datasetFingerprint).toBe(bridge.datasetFingerprint(handle));
      expect(bundle.kernelVersion).toBe(bridge.kernelVersion());
      const receipt = bundle.receipts.find((item) => item.receiptId === 'categorical:group');
      expect(receipt).toBeDefined();
      expect(receipt!.methodProvenance.method).toBe('descriptive/categorical-frequency');
      expect(receipt!.sampleSupport.rowsUsed).toBe(values.length);
      expect(receipt!.sampleSupport.rowsExcluded).toBe(0);
      expect(receipt!.uncertainty).toBeNull();
      expect(receipt!.stability).toBeNull();
      expect(receipt!.limitations).toContain(
        'entropy is an empirical descriptive quantity over observed non-null values'
      );

      const authority = statisticsEvidenceReceiptAuthority(bridge, handle);
      expect(authority.resolveAgainst(
        DESCRIPTIVE_SUMMARY_REQUIREMENT_PROFILE_V1, 'categorical:group'
      ).status).toBe('RESOLVED');
      expect(authority.resolveAgainst(
        INFERENTIAL_CLAIM_REQUIREMENT_PROFILE_V1, 'categorical:group'
      )).toEqual({
        status: 'MISSING_REQUIRED_AXIS',
        receiptId: 'categorical:group',
        axis: 'measurementContextEstablished',
      });
    } finally {
      bridge.destroyDataset(handle);
    }
  });
});
