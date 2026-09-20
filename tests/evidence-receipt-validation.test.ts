import { describe, expect, it } from 'vitest';
import { parseEvidenceReceiptBundleV1 } from '../src/data/evidence/EvidenceReceipt.ts';

function receipt(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    receiptId: 'descriptive:x',
    claimId: 'descriptive:x',
    estimand: 'descriptive finite-value summary for column x',
    measurementContext: { status: 'NOT_ESTABLISHED' },
    geometry: null,
    assumptions: [],
    sampleSupport: {
      totalRows: 3,
      rowsUsed: 2,
      rowsExcluded: 1,
      columns: ['x'],
      policy: 'completeCase',
      exclusionReasons: [{ reason: 'missing or non-finite numeric value', rowCount: 1 }],
    },
    uncertainty: null,
    stability: null,
    sensitivity: [],
    limitations: ['descriptive only'],
    methodProvenance: {
      method: 'descriptive/finite-numeric',
      methodVersion: 'statistics-v1',
      kernelVersion: 'kernel',
      datasetFingerprint: 'fingerprint',
      parameters: [],
    },
    ...overrides,
  };
}

function bundle(receipts: unknown[] = [receipt()]): Record<string, unknown> {
  return {
    schemaVersion: '1',
    datasetFingerprint: 'fingerprint',
    kernelVersion: 'kernel',
    receipts,
  };
}

describe('EvidenceReceiptBundleV1 validation', () => {
  it('deep-freezes a valid bundle without upgrading absent axes', () => {
    const parsed = parseEvidenceReceiptBundleV1(bundle());
    expect(parsed.receipts[0].measurementContext).toEqual({ status: 'NOT_ESTABLISHED' });
    expect(parsed.receipts[0].uncertainty).toBeNull();
    expect(parsed.receipts[0].stability).toBeNull();
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.receipts)).toBe(true);
    expect(Object.isFrozen(parsed.receipts[0].sampleSupport.columns)).toBe(true);
  });

  it('rejects duplicate receipt identity and bundle/provenance drift', () => {
    expect(() => parseEvidenceReceiptBundleV1(bundle([receipt(), receipt()]))).toThrow('duplicate');
    expect(() =>
      parseEvidenceReceiptBundleV1(
        bundle([
          receipt({
            methodProvenance: {
              method: 'descriptive/finite-numeric',
              methodVersion: 'statistics-v1',
              kernelVersion: 'other',
              datasetFingerprint: 'fingerprint',
              parameters: [],
            },
          }),
        ])
      )
    ).toThrow('provenance');
  });

  it('rejects inconsistent sample support and unsupported extra fields', () => {
    expect(() =>
      parseEvidenceReceiptBundleV1(
        bundle([
          receipt({
            sampleSupport: {
              totalRows: 3,
              rowsUsed: 2,
              rowsExcluded: 0,
              columns: ['x'],
              policy: 'completeCase',
              exclusionReasons: [],
            },
          }),
        ])
      )
    ).toThrow('inconsistent');
    expect(() => parseEvidenceReceiptBundleV1({ ...bundle(), inventedAuthority: true })).toThrow(
      'unsupported shape'
    );
  });

  it('strictly validates established measurement and admission context', () => {
    const measurementContext = {
      status: 'ESTABLISHED',
      records: [
        {
          model: {
            column: 'x',
            scale: 'ratio',
            observationStructure: 'iid',
            compositionalGroup: null,
          },
          status: 'confirmed',
          basis: [{ source: 'manifest', rationale: 'declared domain semantics' }],
        },
      ],
      semanticAdmissionPolicy: 'requireConfirmed',
      analyticalAdmission: { status: 'admitted', issues: [] },
    };
    const parsed = parseEvidenceReceiptBundleV1(bundle([receipt({ measurementContext })]));
    expect(parsed.receipts[0].measurementContext.status).toBe('ESTABLISHED');

    expect(() =>
      parseEvidenceReceiptBundleV1(
        bundle([receipt({ measurementContext: { ...measurementContext, records: [] } })])
      )
    ).toThrow('non-empty');
    expect(() =>
      parseEvidenceReceiptBundleV1(
        bundle([
          receipt({
            measurementContext: {
              ...measurementContext,
              records: [
                {
                  ...measurementContext.records[0],
                  model: { ...measurementContext.records[0].model, scale: 'madeUpScale' },
                },
              ],
            },
          }),
        ])
      )
    ).toThrow('measurement scale');
  });
});
