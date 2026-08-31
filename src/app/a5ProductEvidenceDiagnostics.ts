import {
  runAggregateEvidenceScenario,
  type AggregateEvidenceScenarioResult,
} from './aggregateEvidenceDiagnostics.ts';

type AggregateEvidenceWorld = Parameters<typeof runAggregateEvidenceScenario>[0];

export interface A5ProductEvidenceHook {
  readonly schemaVersion: 1;
  runAggregateScenario(input: {
    rowCount: number;
    groupCount: number;
  }): Promise<AggregateEvidenceScenarioResult>;
}

declare global {
  interface Window {
    __NEMOSYNE_A5_PRODUCT_EVIDENCE__?: A5ProductEvidenceHook;
  }
}

/** Evidence-only hook. It delegates to the supplied production Worker/Rust capability. */
export function installA5ProductEvidenceHook(world: AggregateEvidenceWorld): () => void {
  const hook: A5ProductEvidenceHook = {
    schemaVersion: 1,
    runAggregateScenario: (input) => runAggregateEvidenceScenario(world, input),
  };
  window.__NEMOSYNE_A5_PRODUCT_EVIDENCE__ = hook;
  return () => {
    if (window.__NEMOSYNE_A5_PRODUCT_EVIDENCE__ === hook) {
      delete window.__NEMOSYNE_A5_PRODUCT_EVIDENCE__;
    }
  };
}
