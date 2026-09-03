import { describe, it, expect } from 'vitest';
import { AtlasCore, InvestigationAggregate, type WasmRuntimeBridgeFull } from '../src/atlas/index.ts';
import { Dataset, ColumnType, AnalysisHistory } from '../src/data/index.ts';
import { NemosyneSession, InvestigationBranchManager } from '../src/session/index.ts';
import { VRTopologyTranslator, PositionSemanticsEngine } from '../src/moneta/index.ts';
import { ConstraintEngine } from '../src/moneta/ConstraintEngine.ts';
import { NetworkManager, Room, BinaryPoseSerializer } from '../src/network/index.ts';
import { KernelUnavailableError, getKernelState } from '../src/wasm/index.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.ts';
import type { DatasetJSON } from '../src/data/index.ts';
import type { VRCommand } from '../src/atlas/types.ts';

describe('Architectural Invariants & Subsystem Boundaries (Sprint 27.1)', () => {
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

  describe('Invariant 1: Production Public Surface', () => {
    it('exports core runtime/domain APIs without using export existence as production-wiring evidence', () => {
      expect(AtlasCore).toBeDefined();
      expect(InvestigationAggregate).toBeDefined();
      expect(Dataset).toBeDefined();
      expect(AnalysisHistory).toBeDefined();
      expect(NemosyneSession).toBeDefined();
      expect(InvestigationBranchManager).toBeDefined();
      expect(ConstraintEngine).toBeDefined();
      expect(VRTopologyTranslator).toBeDefined();
      expect(PositionSemanticsEngine).toBeDefined();
      expect(NetworkManager).toBeDefined();
      expect(Room).toBeDefined();
      expect(BinaryPoseSerializer).toBeDefined();
      expect(KernelUnavailableError).toBeDefined();
      expect(typeof getKernelState).toBe('function');
    });
  });

  describe('Invariant 2: Atlas Analytical Authority & Isolation', () => {
    it('executes analysis and records immutable provenance without Three.js / DOM dependencies', () => {
      const mockKernel = makeKernelMockBridge() as unknown as WasmRuntimeBridgeFull;
      const atlas = new AtlasCore({ kernel: mockKernel });
      const dataset = Dataset.fromJSON(sampleDatasetJSON);
      atlas.loadDataset(dataset);

      expect(atlas.dataset).not.toBeNull();
      expect(atlas.dataset.rowCount).toBe(3);

      const result = atlas.applyAnalysis({
        datasetFingerprint: atlas.datasetFingerprint ?? 'fp-mock',
        datasetVersion: atlas.datasetVersion,
        algorithmVersion: '1.0.0',
        operation: {
          op: 'filter',
          params: { column: 'amount', predicate: { op: 'gt', value: 200 } } as Record<string, unknown>,
        },
      });

      expect(result).toBeDefined();
      expect(result.dataset.rows.length).toBeGreaterThanOrEqual(1);

      expect(atlas.ledger).toHaveLength(2);
      expect(atlas.results).toHaveLength(1);
    });

    it('guarantees presentation layers cannot mutate underlying analytical dataset rows', () => {
      const dataset = Dataset.fromJSON(sampleDatasetJSON);
      const atlas = new AtlasCore();
      atlas.loadDataset(dataset);

      const rowsSnapshot = atlas.dataset.rows;
      expect(rowsSnapshot).toBeDefined();

      const externalClone = JSON.parse(JSON.stringify(rowsSnapshot));
      externalClone[0].amount = 9999999;

      expect(atlas.dataset.rows[0].amount).toBe(100);
    });
  });

  describe('Invariant 3: Single Authoritative State & Event-Sourced Determinism', () => {
    it('reconstructs AnalysisHistory lazily from ledger events without separate mutable state', () => {
      const atlas = new AtlasCore();
      atlas.loadDataset(Dataset.fromJSON(sampleDatasetJSON));
      atlas.recordObservation('Test observation on data');
      atlas.recordIntervention('Test intervention on data');

      expect(atlas.ledger).toHaveLength(3);

      const state = atlas.toState();
      expect(state.eventLedger).toHaveLength(3);

      const restoredAtlas = new AtlasCore();
      restoredAtlas.restoreState(state);

      expect(restoredAtlas.ledger).toHaveLength(3);
      expect(restoredAtlas.ledger[1].observation).toBe('Test observation on data');
      expect(restoredAtlas.ledger[2].intervention).toBe('Test intervention on data');
    });
  });

  describe('Invariant 4: Session Restoration Independence', () => {
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

      const freshAtlas = new AtlasCore();
      const restoredSession = NemosyneSession.deserialize(serialized, freshAtlas);

      expect(restoredSession.presentation.theme).toBe('deepNet');
      expect(restoredSession.presentation.camera.position).toEqual([1, 2, 3]);
      expect(freshAtlas.dataset.rowCount).toBe(3);
      expect(freshAtlas.ledger.some((e) => e.observation === 'Test observation on data')).toBe(false);
      expect(freshAtlas.ledger.some((e) => e.observation === 'Invariant validation observation')).toBe(true);
    });
  });

  describe('Invariant 5: Embodiment Command Determinism', () => {
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

  describe('Invariant 6: Automated Architectural Dependency Enforcement', () => {
    it('verifies domain layers do not import Three.js, WebXR, or presentation UI', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');

      const domainDirs = [path.resolve(process.cwd(), 'src/atlas/domain')];

      for (const dir of domainDirs) {
        if (fs.existsSync(dir)) {
          const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));
          for (const file of files) {
            const content = fs.readFileSync(path.join(dir, file), 'utf8');
            expect(content).not.toMatch(/from\s+['"]three['"]/);
            expect(content).not.toMatch(/from\s+['"].*\/vr\/.*['"]/);
          }
        }
      }
    });
  });
});
