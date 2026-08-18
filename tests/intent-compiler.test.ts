// @ts-nocheck
 
import { describe, it, expect } from 'vitest';
import { IntentCompiler, StructureExplainer } from '../src/atlas/intent/index.ts';
import type { DatasetJSON } from '../src/data/types.ts';
import type { AnalysisResult } from '../src/atlas/types.ts';
import type { StructureSet } from '../src/atlas/structures.ts';

const SAMPLE_DATASET: DatasetJSON = {
  name: 'transactions',
  columns: [
    { name: 'account_id', type: 'CATEGORICAL' },
    { name: 'amount', type: 'NUMERIC' },
    { name: 'risk_score', type: 'NUMERIC' },
    { name: 'cluster', type: 'CATEGORICAL' },
  ],
  rows: [
    { account_id: 'A1', amount: 100, risk_score: 0.1, cluster: 'retail' },
    { account_id: 'A2', amount: 5000, risk_score: 0.85, cluster: 'mule' },
  ],
};

describe('Atlas 7: IntentCompiler & Deterministic Explanation Layer', () => {
  const compiler = new IntentCompiler();
  const explainer = new StructureExplainer();

  describe('Natural Language Query Compilation', () => {
    it('compiles numeric greater-than filter into deterministic Predicate', () => {
      const parsed = compiler.compile('amount > 1000', SAMPLE_DATASET);

      expect(parsed.kind).toBe('filter');
      expect(parsed.matchedColumns).toEqual(['amount']);
      expect(parsed.predicate).toEqual({
        op: 'gt',
        column: 'amount',
        value: 1000,
      });
      expect(parsed.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('compiles between range filter into deterministic Predicate', () => {
      const parsed = compiler.compile('amount between 100 and 5000', SAMPLE_DATASET);

      expect(parsed.kind).toBe('filter');
      expect(parsed.matchedColumns).toEqual(['amount']);
      expect(parsed.predicate).toEqual({
        op: 'between',
        column: 'amount',
        lo: 100,
        hi: 5000,
      });
    });

    it('compiles categorical in membership into Predicate', () => {
      const parsed = compiler.compile('cluster in (retail, mule)', SAMPLE_DATASET);

      expect(parsed.kind).toBe('filter');
      expect(parsed.matchedColumns).toEqual(['cluster']);
      expect(parsed.predicate).toEqual({
        op: 'in',
        column: 'cluster',
        values: ['retail', 'mule'],
      });
    });

    it('compiles categorical equality filter', () => {
      const parsed = compiler.compile('cluster == "mule"', SAMPLE_DATASET);

      expect(parsed.kind).toBe('filter');
      expect(parsed.matchedColumns).toEqual(['cluster']);
      expect(parsed.predicate).toEqual({
        op: 'eq',
        column: 'cluster',
        value: 'mule',
      });
    });

    it('compiles anomaly detection query on numeric column', () => {
      const parsed = compiler.compile('find outliers on amount', SAMPLE_DATASET);

      expect(parsed.kind).toBe('anomaly');
      expect(parsed.matchedColumns).toEqual(['amount']);
      expect(parsed.operation).toEqual({
        op: 'anomaly_iqr',
        column: 'amount',
        sensitivity: 1.5,
      });
    });

    it('compiles Z-score anomaly detection query', () => {
      const parsed = compiler.compile('z-score anomalies on risk_score', SAMPLE_DATASET);

      expect(parsed.kind).toBe('anomaly');
      expect(parsed.matchedColumns).toEqual(['risk_score']);
      expect(parsed.operation).toEqual({
        op: 'anomaly_zscore',
        column: 'risk_score',
        sensitivity: 3.0,
      });
    });

    it('compiles aggregation query with measure and group_by', () => {
      const parsed = compiler.compile('sum amount by cluster', SAMPLE_DATASET);

      expect(parsed.kind).toBe('aggregate');
      expect(parsed.matchedColumns).toEqual(['amount', 'cluster']);
      expect(parsed.operation).toEqual({
        op: 'aggregate',
        group_by: 'cluster',
        aggregators: [{ column: 'amount', function: 'sum' }],
      });
    });

    it('compiles reset command', () => {
      const parsed = compiler.compile('reset filters', SAMPLE_DATASET);

      expect(parsed.kind).toBe('reset');
      expect(parsed.confidence).toBe(1.0);
    });

    it('gracefully handles non-existent columns with warning', () => {
      const parsed = compiler.compile('non_existent_column > 500', SAMPLE_DATASET);

      expect(parsed.kind).toBe('unknown');
      expect(parsed.confidence).toBe(0.0);
      expect(parsed.warnings).toBeDefined();
    });
  });

  describe('Grounded Structure Explanations', () => {
    it('generates grounded narrative explanation for an AnalysisResult', () => {
      const mockResult: AnalysisResult = {
        resultId: 'res-1',
        datasetFingerprint: 'fp-abc',
        datasetVersion: 1,
        spec: {
          datasetFingerprint: 'fp-abc',
          datasetVersion: 1,
          operation: { op: 'anomaly_iqr', column: 'amount' },
          algorithmVersion: '0.2.0',
        },
        dataset: SAMPLE_DATASET,
        provenance: {
          kernel: 'nemosyne-wasm',
          kernelVersion: '0.2.0',
          operation: 'anomaly_iqr',
          parameters: null,
          inputFingerprint: 'fp-abc',
          outputFingerprint: 'out-456',
          timestamp: Date.now(),
        },
        implementationVersion: '0.2.0',
        outputHash: 'out-456',
        evidenceStatus: 'exploratory',
      };

      const explanation = explainer.explainAnalysisResult(mockResult);

      expect(explanation.title).toContain('Anomaly Detection on \'amount\'');
      expect(explanation.summary).toContain('2 statistical outlier nodes');
      expect(explanation.groundedMetrics.rowCount).toBe(2);
      expect(explanation.provenanceHash).toBe('out-456');
      expect(explanation.sourceDatasetFingerprint).toBe('fp-abc');
    });

    it('generates grounded explanation for a StructureSet', () => {
      const mockStructures: StructureSet = {
        id: 'struct-set-1',
        datasetFingerprint: 'fp-xyz',
        datasetVersion: 1,
        algorithmVersion: '0.2.0',
        provenance: null,
        structures: [
          {
            id: 's1',
            kind: 'cluster',
            rowIndices: [0, 1],
            datumIds: ['A1', 'A2'],
            evidence: { method: 'cluster', parameters: {}, rank: 1 },
          },
          {
            id: 's2',
            kind: 'persistent-component',
            rowIndices: [0],
            datumIds: ['A1'],
            evidence: { method: 'persistence', parameters: {}, rank: 1 },
          },
        ],
      };

      const explanation = explainer.explainStructures(mockStructures);

      expect(explanation.title).toBe('Topological Structure Summary');
      expect(explanation.summary).toContain('1 clusters');
      expect(explanation.summary).toContain('1 persistent components');
      expect(explanation.groundedMetrics.clusterCount).toBe(1);
      expect(explanation.groundedMetrics.persistentComponentCount).toBe(1);
      expect(explanation.sourceDatasetFingerprint).toBe('fp-xyz');
    });
  });
});
