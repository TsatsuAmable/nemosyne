/**
 * Investigation Graph & Branching Engine (Definitive Vision §2.3, §10, Gate 5).
 *
 * Transforms linear session history into an Investigation DAG (Directed Acyclic Graph)
 * supporting named forks, branch diffing, merge/compare workflows, and non-destructive experimentation.
 */

import { HistoryFrame } from '../data/AnalysisHistory.ts';

export interface InvestigationBranch {
  branchId: string;
  name: string;
  parentBranchId: string | null;
  forkFrameIndex: number;
  frames: HistoryFrame[];
  hypothesisNotes: string;
  createdAt: number;
}

export interface BranchComparisonResult {
  branchAId: string;
  branchBId: string;
  commonAncestorFrameIndex: number;
  operationsOnlyInA: string[];
  operationsOnlyInB: string[];
  divergenceSummary: string;
}

export class InvestigationBranchManager {
  private _branches = new Map<string, InvestigationBranch>();
  private _activeBranchId = 'main';

  constructor(initialFrames: HistoryFrame[] = []) {
    const mainBranch: InvestigationBranch = {
      branchId: 'main',
      name: 'Main Line',
      parentBranchId: null,
      forkFrameIndex: 0,
      frames: [...initialFrames],
      hypothesisNotes: 'Primary investigation line.',
      createdAt: Date.now(),
    };
    this._branches.set('main', mainBranch);
  }

  get activeBranchId(): string {
    return this._activeBranchId;
  }

  get activeBranch(): InvestigationBranch {
    const branch = this._branches.get(this._activeBranchId);
    if (!branch) {
      throw new Error(`Active branch ${this._activeBranchId} not found`);
    }
    return branch;
  }

  appendFrame(frame: HistoryFrame): void {
    this.activeBranch.frames.push(frame);
  }

  branch(newBranchId: string, name: string, hypothesisNotes = ''): InvestigationBranch {
    if (this._branches.has(newBranchId)) {
      throw new Error(`Branch with ID ${newBranchId} already exists`);
    }

    const current = this.activeBranch;
    const forkedBranch: InvestigationBranch = {
      branchId: newBranchId,
      name,
      parentBranchId: current.branchId,
      forkFrameIndex: current.frames.length,
      frames: [...current.frames],
      hypothesisNotes,
      createdAt: Date.now(),
    };

    this._branches.set(newBranchId, forkedBranch);
    this._activeBranchId = newBranchId;
    return forkedBranch;
  }

  switchBranch(branchId: string): InvestigationBranch {
    const target = this._branches.get(branchId);
    if (!target) {
      throw new Error(`Branch ${branchId} does not exist`);
    }
    this._activeBranchId = branchId;
    return target;
  }

  compareBranches(branchAId: string, branchBId: string): BranchComparisonResult {
    const branchA = this._branches.get(branchAId);
    const branchB = this._branches.get(branchBId);

    if (!branchA || !branchB) {
      throw new Error('Both branches must exist for comparison');
    }

    let ancestorIdx = 0;
    const minLen = Math.min(branchA.frames.length, branchB.frames.length);

    while (
      ancestorIdx < minLen &&
      branchA.frames[ancestorIdx].operation === branchB.frames[ancestorIdx].operation
    ) {
      ancestorIdx++;
    }

    const opsA = branchA.frames.slice(ancestorIdx).map((f) => f.operation);
    const opsB = branchB.frames.slice(ancestorIdx).map((f) => f.operation);

    return {
      branchAId,
      branchBId,
      commonAncestorFrameIndex: ancestorIdx,
      operationsOnlyInA: opsA,
      operationsOnlyInB: opsB,
      divergenceSummary: `Branches diverged at step ${ancestorIdx}. Branch A has ${opsA.length} distinct operations; Branch B has ${opsB.length} distinct operations.`,
    };
  }

  getAllBranches(): InvestigationBranch[] {
    return Array.from(this._branches.values());
  }
}
