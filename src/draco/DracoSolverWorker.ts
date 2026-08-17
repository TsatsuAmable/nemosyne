/**
 * Web Worker Helper for Asynchronous Draco GA Layout Solving.
 *
 * Offloads layout candidate evaluation off the WebXR main render thread. Wave
 * 5: statistical fact extraction is no longer performed inside Draco; the
 * caller supplies a `FactProvider` (e.g. AtlasCore in production, a canned
 * helper in tests) so facts come from `kernel.statistics`.
 */

import { ConstraintEngine } from './ConstraintEngine.ts';
import type { DracoDataInput, FactProvider, SolverResult } from './types.ts';

export interface DracoWorkerRequest {
  dataInput: DracoDataInput;
  /** Wave 5: facts supplier (AtlasCore in production). Required to solve. */
  factProvider?: FactProvider;
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
        const engine = request.factProvider
          ? new ConstraintEngine({ factProvider: request.factProvider })
          : this._engine;
        const result = engine.solve(request.dataInput);
        const solveTimeMs = performance.now() - startTime;
        resolve({
          result,
          solveTimeMs: Number(solveTimeMs.toFixed(2)),
        });
      }, 0);
    });
  }
}
