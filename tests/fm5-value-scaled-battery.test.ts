import { describe, test, expect } from 'vitest';
import {
  DESKTOP_EXPANSIVE_BUDGET,
  QUEST_CONSTRAINED_BUDGET,
} from '../src/moneta/forma/FormaResolutionBroker.ts';
import {
  runAdviceCaseFull,
  type AdviceBatteryRow,
  type AdviceCaseSpec,
} from './helpers/fm5-advice-battery.ts';

// FM5 Stage 1b exploratory: does advice win room to matter at realistic
// search scales? The frozen 1x4 gate cannot reward exploration because there
// is almost none (1 generation x population 4). This battery varies search
// scale (up to the engine caps 10x24), task, dataset width, and budget, and
// REPORTS the verdict instead of gating on it: structural assertions only
// (finite figures, determinism). Promoting any slice of this to a gate needs
// an explicit owner bar decision. Headless mock kernels: routing evidence,
// never analytical-truth claims.
//
// MEASURED MECHANISM (not just a null): proposer candidates score 0.80-0.94
// on budget-tier fit, so advice IS applied — but every seeded graph loses to
// the deterministic reference (0.85) at every scale. The objective model
// taxes what seeding adds (per-primitive interaction/resource cost,
// CLUSTER-without-clusters and DENSITY-on-tiny-N stability penalties) while
// the proposal scores reward budget-tier matching: the two scorers optimize
// different things, so advice spends a currency the search does not accept.
// Fixing that coupling is a behavior change to analytical machinery and is
// explicitly out of scope here.

const DESKTOP = DESKTOP_EXPANSIVE_BUDGET;
const QUEST = QUEST_CONSTRAINED_BUDGET;

const DISTRIBUTION_INTENT = {
  researchQuestion: 'What is the empirical distribution of dim1?',
  currentTask: 'distribution-analysis',
  variablesOfInterest: ['dim1'],
};

const SCALED_SPECS: AdviceCaseSpec[] = [
  { caseId: 'scale-3x12-desktop', rowCount: 80, budget: DESKTOP, maxGenerations: 3, populationSize: 12 },
  { caseId: 'scale-6x16-desktop', rowCount: 80, budget: DESKTOP, maxGenerations: 6, populationSize: 16 },
  { caseId: 'scale-10x24-desktop', rowCount: 80, budget: DESKTOP, maxGenerations: 10, populationSize: 24 },
  { caseId: 'scale-10x24-quest', rowCount: 80, budget: QUEST, maxGenerations: 10, populationSize: 24 },
  { caseId: 'dist-3x12-desktop', rowCount: 80, budget: DESKTOP, maxGenerations: 3, populationSize: 12, intent: DISTRIBUTION_INTENT },
  { caseId: 'dist-10x24-desktop', rowCount: 80, budget: DESKTOP, maxGenerations: 10, populationSize: 24, intent: DISTRIBUTION_INTENT },
  { caseId: 'wide-3x12-desktop', rowCount: 80, wide: true, budget: DESKTOP, maxGenerations: 3, populationSize: 12 },
  { caseId: 'wide-10x24-desktop', rowCount: 80, wide: true, budget: DESKTOP, maxGenerations: 10, populationSize: 24 },
  { caseId: 'wide-10x24-quest', rowCount: 80, wide: true, budget: QUEST, maxGenerations: 10, populationSize: 24 },
];

function runScaled(): AdviceBatteryRow[] {
  return SCALED_SPECS.map((spec) => runAdviceCaseFull(spec));
}

describe('FM5 Stage 1b exploratory: advice at realistic search scales', () => {
  test('all scaled cases complete with finite figures on both arms', () => {
    const rows = runScaled();
    expect(rows).toHaveLength(SCALED_SPECS.length);
    for (const row of rows) {
      expect(Number.isFinite(row.advisedUtility)).toBe(true);
      expect(Number.isFinite(row.bypassedUtility)).toBe(true);
      expect(Number.isFinite(row.utilityDelta)).toBe(true);
    }
  });

  test('scaled verdict is deterministic and reported against the owner bar', () => {
    const first = runScaled();
    const second = runScaled();
    expect(second).toEqual(first);
    const positive = first.filter((r) => r.utilityDelta > 0);
    const abstains = first.filter((r) => r.adviceStatus === 'ABSTAIN').length;
    const seeded = first.filter((r) => r.advisedSeeded).length;
    console.log(
      `FM5 scaled: ${positive.length}/${first.length} positive, ${abstains}/${first.length} ABSTAIN, ${seeded}/${first.length} seeded -> ${positive.length / first.length >= 0.5 && abstains / first.length <= 0.25 ? 'PASS' : 'FAIL'} vs owner bar`
    );
    for (const row of first) {
      console.log(
        `  ${row.caseId}: status=${row.adviceStatus} advised=${row.advisedUtility.toFixed(4)} bypassed=${row.bypassedUtility.toFixed(4)} delta=${row.utilityDelta.toFixed(4)} seeded=${row.advisedSeeded}`
      );
    }
  });
});
