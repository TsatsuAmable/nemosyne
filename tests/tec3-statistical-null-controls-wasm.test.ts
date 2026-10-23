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
      // A legitimate exact-zero Pearson coefficient is definitionally valid.
      // A blanket 'value === 0 means invalid' policy would fail this control.
      expect(receipt!.assumptions.some((a) => a.status === 'violated')).toBe(false);

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
    {
      name: 'constant numeric input with four pairwise observations',
      x: [5, 5, 5, 5],
      y: [0, 1, 2, 3],
      used: 4,
      detail: 'the pairwise variance denominator is below the kernel definition threshold',
    },
    {
      name: 'only one pairwise-complete observation despite varying columns',
      x: [1, 2, null, null],
      y: [null, 4, 5, null],
      used: 1,
      detail: 'fewer than two pairwise-complete finite observations',
    },
    {
      name: 'no pairwise-complete observations',
      x: [null, null, null],
      y: [1, 2, 3],
      used: 0,
      detail: 'fewer than two pairwise-complete finite observations',
    },
    {
      name: 'numerically degenerate but nonconstant finite scale',
      x: [0, 1e-15, 2e-15, 3e-15],
      y: [-4, -2, 2, 4],
      used: 4,
      detail: 'the pairwise variance denominator is below the kernel definition threshold',
    },
  ])('refuses an undefined Rust Pearson result despite compatibility-zero for $name', ({
    name, x, y, used, detail,
  }) => {
    const handle = bridge.loadDatasetJson({
      name: `tec3-pearson-degenerate-${name}`,
      columns: [{ name: 'x', type: 'NUMERIC' }, { name: 'y', type: 'NUMERIC' }],
      rows: x.map((value, index) => ({ x: value, y: y[index] })),
    });
    try {
      // Facts is historical numerical ABI and retains its zero sentinel.
      const facts = bridge.statistics(handle);
      expect(facts).not.toBeNull();
      expect(facts!.correlation.find((pair) => pair.a === 'x' && pair.b === 'y')?.value).toBe(0);

      // The actual Rust-issued receipt must explicitly refuse scientific use
      // rather than silently reinterpreting that zero as a valid association.
      const raw = bridge.statisticsEvidenceReceiptBundle(handle);
      const bundle = parseEvidenceReceiptBundleV1(raw);
      expect(bundle.datasetFingerprint).toBe(bridge.datasetFingerprint(handle));
      expect(bundle.kernelVersion).toBe(bridge.kernelVersion());
      const receipt = bundle.receipts.find((item) => item.receiptId === 'pearson:x:y');
      expect(receipt, name).toBeDefined();
      expect(receipt!.sampleSupport.policy).toBe('pairwiseComplete');
      expect(receipt!.sampleSupport.rowsUsed).toBe(used);
      expect(receipt!.assumptions[0]).toEqual({
        assumption: 'Pearson coefficient must be defined for this pair',
        status: 'violated',
        detail,
      });
      expect(receipt!.limitations).toContain(
        'legacy Facts returns 0 for an undefined Pearson coefficient; this is not evidence of zero association'
      );
      expect(receipt!.uncertainty).toBeNull();
      expect(receipt!.stability).toBeNull();

      const authority = statisticsEvidenceReceiptAuthority(bridge, handle);
      for (const profile of [
        DESCRIPTIVE_SUMMARY_REQUIREMENT_PROFILE_V1,
        INFERENTIAL_CLAIM_REQUIREMENT_PROFILE_V1,
      ]) {
        expect(authority.resolveAgainst(profile, 'pearson:x:y')).toEqual({
          status: 'VIOLATED_ASSUMPTION',
          receiptId: 'pearson:x:y',
          assumption: 'Pearson coefficient must be defined for this pair',
        });
      }
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
