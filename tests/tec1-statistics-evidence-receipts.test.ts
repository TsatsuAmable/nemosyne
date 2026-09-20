import { beforeAll, describe, expect, it } from 'vitest';
import { statisticsEvidenceReceiptAuthority } from '../src/atlas/MonetaEvidenceAuthority.ts';
import { parseEvidenceReceiptBundleV1 } from '../src/data/evidence/EvidenceReceipt.ts';
import * as bridge from '../src/wasm/RuntimeBridge.ts';
import { encodeTypedColumnsPayload } from '../src/wasm/TypedColumnsCodec.ts';

const RECEIPT_COMPUTATION_INDEX = 12;
const call = (name: string, ...args: number[]) => Number(bridge.call(name, ...args)) >>> 0;

function fixture(): number {
  return bridge.loadDatasetJson({
    name: 'tec1-receipts',
    columns: [
      { name: 'x', type: 'NUMERIC' },
      { name: 'y', type: 'NUMERIC' },
    ],
    rows: [
      { x: 1, y: 2 },
      { x: 2, y: 4 },
      { x: null, y: 6 },
    ],
  });
}

describe('TEC1 statistics evidence receipt transport', () => {
  beforeAll(async () => {
    if (!bridge.isReady()) await bridge.initRuntime('/wasm/pkg/nemosyne_wasm_bg.wasm');
  });

  it('transfers one Rust-issued receipt bundle with explicit absent axes', () => {
    const handle = fixture();
    try {
      const before = call('prepared_computation_count', RECEIPT_COMPUTATION_INDEX);
      const raw = bridge.statisticsEvidenceReceiptBundle(handle);
      expect(call('prepared_computation_count', RECEIPT_COMPUTATION_INDEX) - before).toBe(1);
      expect(call('prepared_result_count')).toBe(0);
      expect(call('prepared_result_bytes')).toBe(0);

      const bundle = parseEvidenceReceiptBundleV1(raw);
      expect(bundle.datasetFingerprint).toBe(bridge.datasetFingerprint(handle));
      expect(bundle.kernelVersion).toBe(bridge.kernelVersion());
      const descriptive = bundle.receipts.find((receipt) => receipt.claimId === 'descriptive:x');
      expect(descriptive?.measurementContext).toEqual({ status: 'NOT_ESTABLISHED' });
      expect(descriptive?.uncertainty).toBeNull();
      expect(descriptive?.stability).toBeNull();
      expect(descriptive?.sampleSupport.rowsUsed).toBe(2);
    } finally {
      bridge.destroyDataset(handle);
    }
  });

  it('mints an immutable live resolver and preserves unresolved assumptions', () => {
    const handle = fixture();
    try {
      const authority = statisticsEvidenceReceiptAuthority(handle);
      expect(Object.isFrozen(authority)).toBe(true);
      expect(Object.isFrozen(authority.receiptIds)).toBe(true);
      const pearsonId = authority.receiptIds.find((id) => id.startsWith('pearson:x:y'));
      expect(pearsonId).toBeTruthy();
      const receipt = authority.resolve(pearsonId!);
      expect(receipt).not.toBeNull();
      expect(Object.isFrozen(receipt)).toBe(true);
      expect(Object.isFrozen(receipt?.assumptions)).toBe(true);
      expect(receipt?.assumptions.some((item) => item.status === 'notTestableFromData')).toBe(true);
      expect(receipt?.uncertainty).toBeNull();
      expect(receipt?.stability).toBeNull();
      expect(authority.resolve('missing-receipt')).toBeNull();
    } finally {
      bridge.destroyDataset(handle);
    }
  });

  it('revokes resolution when the originating dataset handle is destroyed', () => {
    const handle = fixture();
    const authority = statisticsEvidenceReceiptAuthority(handle);
    const receiptId = authority.receiptIds[0];
    expect(authority.resolve(receiptId)).not.toBeNull();
    bridge.destroyDataset(handle);
    expect(() => authority.resolve(receiptId)).toThrow('stale');
  });

  it('refuses invalid and columnar-only handles without computing evidence', () => {
    const columnar = bridge.loadTypedColumns(
      encodeTypedColumnsPayload({
        rowCount: 2,
        columns: [{ name: 'x', type: 'numeric', values: [1, 2] }],
      }),
      'columnar-only-receipts'
    );
    const before = call('prepared_computation_count', RECEIPT_COMPUTATION_INDEX);
    try {
      expect(bridge.statisticsEvidenceReceiptBundle(0)).toBeNull();
      expect(bridge.statisticsEvidenceReceiptBundle(columnar)).toBeNull();
      expect(call('prepared_computation_count', RECEIPT_COMPUTATION_INDEX)).toBe(before);
      expect(() => statisticsEvidenceReceiptAuthority(columnar)).toThrow();
    } finally {
      bridge.destroyDataset(columnar);
    }
  });
});
