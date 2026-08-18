// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { ConnectorAuthManager } from '../src/network/ConnectorAuth.ts';
import { StudyDataExporter } from '../src/study/StudyDataExporter.ts';

describe('Connector Auth & Study Data Exporter', () => {
  describe('Connector Auth Manager', () => {
    it('validates tokens, scopes, expiration and enforces rate limits', () => {
      const auth = new ConnectorAuthManager();

      auth.registerCredential({
        connectorId: 'SNOWFLAKE_CONNECTOR_01',
        token: 'TOKEN_SECRET_123',
        scopes: ['READ_DATASET'],
        rateLimitMaxRps: 2,
        expiresAt: 2000000000000,
      });

      // Valid read request
      expect(auth.validateAccess('TOKEN_SECRET_123', 'READ_DATASET', 1000).allowed).toBe(true);

      // Denied write request (missing scope)
      const writeAttempt = auth.validateAccess('TOKEN_SECRET_123', 'WRITE_DATASET', 1000);
      expect(writeAttempt.allowed).toBe(false);
      expect(writeAttempt.reason).toContain('Missing required scope');

      // Rate limit test (max 2 RPS)
      expect(auth.validateAccess('TOKEN_SECRET_123', 'READ_DATASET', 1000).allowed).toBe(true);
      const rateLimitAttempt = auth.validateAccess('TOKEN_SECRET_123', 'READ_DATASET', 1000);
      expect(rateLimitAttempt.allowed).toBe(false);
      expect(rateLimitAttempt.reason).toContain('Rate limit exceeded');

      // Expired token test
      expect(auth.validateAccess('TOKEN_SECRET_123', 'READ_DATASET', 2000000000001).allowed).toBe(false);
    });
  });

  describe('Study Data Exporter', () => {
    it('creates analysis bundle and CSV export from trial records', () => {
      const mockTrials = [
        {
          trialId: 'TRIAL_A',
          datasetId: 'DATA_1',
          taskType: 'anomaly_detection',
          condition: '2D_CONTROL',
          isCorrect: true,
          durationMs: 8000,
          confidenceScore: 5,
          workloadScore: 40,
          interactionEventsCount: 12,
          completedAt: 1723980000000,
        },
        {
          trialId: 'TRIAL_B',
          datasetId: 'DATA_2',
          taskType: 'topology_discovery',
          condition: 'VR_EXPERIMENTAL',
          isCorrect: false,
          durationMs: 4000,
          confidenceScore: 3,
          workloadScore: 60,
          interactionEventsCount: 20,
          completedAt: 1723980010000,
        },
      ];

      const bundle = StudyDataExporter.createBundle('STUDY_ALPHA_01', mockTrials, 1723980020000);
      expect(bundle.totalTrials).toBe(2);
      expect(bundle.accuracyRate).toBe(0.5);
      expect(bundle.averageDurationMs).toBe(6000);
      expect(bundle.averageWorkloadScore).toBe(50);

      const csv = StudyDataExporter.toCSV(mockTrials);
      expect(csv).toContain('trial_id,dataset_id,task_type');
      expect(csv).toContain('TRIAL_A,DATA_1,anomaly_detection,2D_CONTROL,1,8000,5,40,12');
      expect(csv).toContain('TRIAL_B,DATA_2,topology_discovery,VR_EXPERIMENTAL,0,4000,3,60,20');
    });
  });
});
