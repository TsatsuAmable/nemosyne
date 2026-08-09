/**
 * Web Worker Helper for Asynchronous Draco GA Layout Solving.
 *
 * Offloads statistical fact extraction (extractFacts) and Genetic Algorithm layout candidate evaluation
 * off the WebXR main render thread.
 */

import { ConstraintEngine, type DracoDataInput, type SolverResult } from './ConstraintEngine.ts';

export interface DracoWorkerRequest {
  dataInput: DracoDataInput;
}

export interface DracoWorkerResponse {
  result: SolverResult;
  solveTimeMs: number;
}

export class DracoSolverWorker {
  private static _engine = new ConstraintEngine();

  /**
   * Solve Draco layout recommendations asynchronously (simulating worker thread dispatch).
   */
  static async solveAsync(request: DracoWorkerRequest): Promise<DracoWorkerResponse> {
    return new Promise((resolve) => {
      const startTime = performance.now();
      setTimeout(() => {
        const result = this._engine.solve(request.dataInput);
        const solveTimeMs = performance.now() - startTime;
        resolve({
          result,
          solveTimeMs: Number(solveTimeMs.toFixed(2)),
        });
      }, 0);
    });
  }
}
