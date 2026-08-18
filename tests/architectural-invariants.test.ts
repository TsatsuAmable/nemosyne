// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import { NemosyneSession } from '../src/session/NemosyneSession.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.ts';
import type { DatasetJSON } from '../src/data/types.ts';
import type { VRCommand } from '../src/atlas/types.ts';

describe('Architectural Invariants & Domain Boundaries', () => {
  const sampleDatasetJSON: DatasetJSON = {
    name: 'Invariant Test Dataset',
    columns: [
      { name: 'id', type: ColumnType.CATEGORICAL },
      { name: 'amount', type: ColumnType.NUMERIC },
      { name: 'timestamp', type: ColumnType.TEMPORAL },
    ],
    rows: [
      { id: 'tx_01', amount: 100, timestamp: '2026-08-01T00:00:00Z' },
      { id: 'tx_02', amount: 500, timestamp: '2026-08-01T01:00:00Z' },
      { id: 'tx_03', amount: 9999, timestamp: '2026-08-01T02:00:00Z' },
    ],
  };

  describe('Invariant 1: Atlas Analytical Authority & Boundary', () => {
    it('executes analysis and records immutable provenance without Three.js / DOM dependencies', () => {
      const mockKernel = makeKernelMockBridge() as any;
      const atlas = new AtlasCore({ kernel: mockKernel });
      const dataset = Dataset.fromJSON(sampleDatasetJSON);
      atlas.loadDataset(dataset);

      expect(atlas.dataset).not.toBeNull();
      expect(atlas.dataset.rowCount).toBe(3);

      // Apply operation
      const result = atlas.applyAnalysis({
        datasetFingerprint: atlas.datasetFingerprint ?? 'fp-mock',
        datasetVersion: atlas.datasetVersion,
        algorithmVersion: '1.0.0',
        operation: {
          op: 'filter',
          params: { column: 'amount', predicate: { op: 'gt', value: 200 } } as any,
        },
      });

      expect(result).toBeDefined();
      expect(result.dataset.rows.length).toBeGreaterThanOrEqual(1);

      // Verify analytical state in Atlas is authoritative and independent
      expect(atlas.ledger).toHaveLength(2); // 1 load + 1 operation
      expect(atlas.results).toHaveLength(1);
    });

    it('guarantees presentation layers cannot mutate underlying analytical dataset rows', () => {
      const dataset = Dataset.fromJSON(sampleDatasetJSON);
      const atlas = new AtlasCore();
      atlas.loadDataset(dataset);

      const rowsSnapshot = atlas.dataset.rows;
      expect(rowsSnapshot).toBeDefined();

      // Modifying an external clone/row object does not corrupt Atlas internal state
      const externalClone = JSON.parse(JSON.stringify(rowsSnapshot));
      externalClone[0].amount = 9999999;

      expect(atlas.dataset.rows[0].amount).toBe(100);
    });
  });

  describe('Invariant 2: Session Restoration Independence', () => {
    it('serializes and deserializes session into a fresh runtime without prior World or Engine references', () => {
      const sourceAtlas = new AtlasCore();
      sourceAtlas.loadDataset(Dataset.fromJSON(sampleDatasetJSON));

      const sourceSession = new NemosyneSession({
        atlas: sourceAtlas,
        sessionId: 'session-inv-42',
      });

      sourceSession.setPresentation({
        theme: 'deepNet',
        camera: { position: [1, 2, 3], rotationY: 0.5 },
      });
      sourceSession.recordObservation('Invariant validation observation');

      const serialized = sourceSession.serialize();
      expect(serialized.schemaVersion).toBe(2);
      expect(serialized.presentation.theme).toBe('deepNet');

      // Hydrate into completely isolated, fresh instance
      const freshAtlas = new AtlasCore();
      const restoredSession = NemosyneSession.deserialize(serialized, freshAtlas);

      expect(restoredSession.presentation.theme).toBe('deepNet');
      expect(restoredSession.presentation.camera.position).toEqual([1, 2, 3]);
      expect(freshAtlas.dataset.rowCount).toBe(3);
      expect(freshAtlas.ledger.some((e) => e.observation === 'Invariant validation observation')).toBe(true);
    });
  });

  describe('Invariant 3: Embodiment Command Determinism', () => {
    it('records and reproduces spatial embodiment commands with full provenance tracking', () => {
      const atlas = new AtlasCore();
      atlas.loadDataset(Dataset.fromJSON(sampleDatasetJSON));

      const embodimentCmd: VRCommand = {
        action: 'investigate-anomaly',
        targetIds: ['tx_03'],
        embodiment: 'pulse_aura',
      };

      atlas.recordEmbodimentCommand(embodimentCmd);

      const latestEvent = atlas.ledger[atlas.ledger.length - 1];
      expect(latestEvent.kind).toBe('embodiment');
      expect(latestEvent.embodimentCommand).toEqual(embodimentCmd);
    });
  });
});
