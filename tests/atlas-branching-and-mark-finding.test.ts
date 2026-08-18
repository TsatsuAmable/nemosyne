// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { StatusStripController } from '../src/vr/ui/StatusStripController.ts';

describe('Atlas Investigation DAG Branching & Mark Finding Evidence Tool', () => {
  describe('AtlasCore Branching & Finding Integration', () => {
    it('creates named branches and compares forks in AtlasCore', () => {
      const atlas = new AtlasCore();
      expect(atlas.branchManager.activeBranchId).toBe('main');

      const branchB = atlas.branchInvestigation('branch_anomaly', 'Anomaly Exploration', 'Testing IQR thresholds');
      expect(branchB.branchId).toBe('branch_anomaly');
      expect(atlas.branchManager.activeBranchId).toBe('branch_anomaly');

      atlas.switchInvestigationBranch('main');
      expect(atlas.branchManager.activeBranchId).toBe('main');

      const diff = atlas.compareInvestigationBranches('main', 'branch_anomaly');
      expect(diff.commonAncestorFrameIndex).toBe(0);
      expect(diff.divergenceSummary).toContain('Branches diverged at step 0');
    });

    it('records structured finding events into the research ledger', () => {
      const atlas = new AtlasCore();
      const event = atlas.markFinding({
        entityId: 'node-42',
        position: [1.2, 0.5, -2.1],
        note: 'Significant dense sub-cluster isolated',
        tags: ['cluster', 'anomaly'],
      });

      expect(event.kind).toBe('analysis');
      expect(event.observation).toContain('FINDING [node-42]: Significant dense sub-cluster isolated');
      expect(atlas.ledger.length).toBe(1);
    });
  });

  describe('StatusStripController 1-Touch Bookmark', () => {
    it('updates lastAction on evidence bookmark', () => {
      const strip = new StatusStripController();
      strip.bookmarkEvidence('Anomaly cluster identified');

      expect(strip.state.lastAction).toBe('BOOKMARK: Anomaly cluster identified');
      expect(strip.state.nextAffordance).toBe('Resume investigation');
      expect(strip.formatStripText()).toContain('ACTION: BOOKMARK: Anomaly cluster identified');
    });
  });
});
