// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { NemosyneError, SYSTEM_ERROR_REGISTER } from '../src/types/ErrorRegistry.ts';
import { InvestigationBranchManager } from '../src/session/InvestigationBranchManager.ts';

describe('Error Registry & Investigation Branching Engine', () => {
  describe('System Error Register', () => {
    it('provides typed error definitions with domains and recovery guidance', () => {
      const kernelErr = SYSTEM_ERROR_REGISTER['ERR_0101_KERNEL_UNAVAILABLE'];
      expect(kernelErr.domain).toBe('WASM_KERNEL');
      expect(kernelErr.severity).toBe('CRITICAL');
      expect(kernelErr.recoveryGuidance).toContain('WebAssembly');

      const customErr = new NemosyneError('ERR_0501_HAND_TRACKING_LOST');
      expect(customErr.domain).toBe('INTERACTION_FSM');
      expect(customErr.severity).toBe('WARNING');
      expect(customErr.recoveryGuidance).toContain('field-of-view');
    });
  });

  describe('Investigation Branch Manager', () => {
    it('creates branches, appends distinct operations, and compares forks', () => {
      const manager = new InvestigationBranchManager([
        { operation: 'filter', parameters: { column: 'val', min: 10 } },
        { operation: 'sort', parameters: { column: 'val', ascending: true } },
      ]);

      expect(manager.activeBranchId).toBe('main');
      expect(manager.activeBranch.frames.length).toBe(2);

      // Fork branch for alternative hypothesis
      const branchB = manager.branch('branch_cluster_hyp', 'Alternative Cluster Hypothesis', 'Testing DBSCAN eps=0.5');
      expect(manager.activeBranchId).toBe('branch_cluster_hyp');
      expect(branchB.parentBranchId).toBe('main');

      // Append operation to branch B
      manager.appendFrame({ operation: 'cluster', parameters: { method: 'dbscan' } });
      expect(manager.activeBranch.frames.length).toBe(3);

      // Switch back to main and apply a different operation
      manager.switchBranch('main');
      manager.appendFrame({ operation: 'anomaly', parameters: { method: 'iqr' } });

      // Compare the two branches
      const comparison = manager.compareBranches('main', 'branch_cluster_hyp');
      expect(comparison.commonAncestorFrameIndex).toBe(2);
      expect(comparison.operationsOnlyInA).toEqual(['anomaly']);
      expect(comparison.operationsOnlyInB).toEqual(['cluster']);
      expect(comparison.divergenceSummary).toContain('Branches diverged at step 2');
    });
  });
});
