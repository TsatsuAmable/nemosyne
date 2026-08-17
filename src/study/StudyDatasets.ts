/**
 * Seeded study datasets with verifiable ground-truth targets for controlled experiments.
 *
 * Implements the "Find the Fraud" transaction graph and financial anomaly datasets.
 */

import type { DatasetJSON } from '../data/types.ts';

export const SYNTHETIC_TRANSACTION_FRAUD_DATASET: DatasetJSON = {
  version: '1.0.0',
  schema: {
    fields: [
      { name: 'id', type: 'string' },
      { name: 'account_type', type: 'string' },
      { name: 'amount', type: 'number' },
      { name: 'risk_score', type: 'number' },
      { name: 'cluster', type: 'string' },
      { name: 'is_fraud', type: 'boolean' },
    ],
  },
  nodes: [
    { id: 'acc_001', account_type: 'merchant', amount: 1540.5, risk_score: 0.12, cluster: 'retail', is_fraud: false },
    { id: 'acc_002', account_type: 'personal', amount: 320.0, risk_score: 0.05, cluster: 'personal', is_fraud: false },
    { id: 'acc_003', account_type: 'personal', amount: 450.0, risk_score: 0.08, cluster: 'personal', is_fraud: false },
    { id: 'acc_004', account_type: 'merchant', amount: 2890.0, risk_score: 0.15, cluster: 'retail', is_fraud: false },
    { id: 'acc_005', account_type: 'corporate', amount: 15400.0, risk_score: 0.22, cluster: 'corporate', is_fraud: false },
    // Ground Truth Anomaly / Fraud Ring
    { id: 'acc_fraud_99', account_type: 'shell', amount: 98500.0, risk_score: 0.96, cluster: 'mule_ring', is_fraud: true },
    { id: 'acc_fraud_98', account_type: 'mule', amount: 94200.0, risk_score: 0.91, cluster: 'mule_ring', is_fraud: true },
    { id: 'acc_fraud_97', account_type: 'mule', amount: 89900.0, risk_score: 0.88, cluster: 'mule_ring', is_fraud: true },
    // Legitimate nodes
    { id: 'acc_006', account_type: 'personal', amount: 120.0, risk_score: 0.02, cluster: 'personal', is_fraud: false },
    { id: 'acc_007', account_type: 'merchant', amount: 560.0, risk_score: 0.11, cluster: 'retail', is_fraud: false },
    { id: 'acc_008', account_type: 'corporate', amount: 22000.0, risk_score: 0.19, cluster: 'corporate', is_fraud: false },
    { id: 'acc_009', account_type: 'personal', amount: 840.0, risk_score: 0.07, cluster: 'personal', is_fraud: false },
  ],
  edges: [
    { source: 'acc_001', target: 'acc_002', weight: 1.0 },
    { source: 'acc_002', target: 'acc_003', weight: 1.0 },
    { source: 'acc_004', target: 'acc_001', weight: 2.0 },
    { source: 'acc_005', target: 'acc_004', weight: 3.0 },
    // Coordinated high-velocity transfer loop within the fraud ring
    { source: 'acc_fraud_99', target: 'acc_fraud_98', weight: 10.0 },
    { source: 'acc_fraud_98', target: 'acc_fraud_97', weight: 10.0 },
    { source: 'acc_fraud_97', target: 'acc_fraud_99', weight: 10.0 },
    { source: 'acc_006', target: 'acc_007', weight: 1.0 },
    { source: 'acc_008', target: 'acc_005', weight: 2.0 },
    { source: 'acc_009', target: 'acc_007', weight: 1.0 },
  ],
};

export const GROUND_TRUTH_FRAUD_IDS = ['acc_fraud_99', 'acc_fraud_98', 'acc_fraud_97'];
