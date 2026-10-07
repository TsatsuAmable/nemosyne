import { describe, test, expect } from 'vitest';
import { runAdviceBattery } from './helpers/fm5-advice-battery.ts';

// FM5 Stage 1 value gate (owner-approved lenient pilot bar, 2026-10-07):
// advised utility beats bypassed on >=50% of the frozen battery with an
// ABSTAIN rate <=25%.
//
// MEASURED OUTCOME (deterministic, pinned below): 0/4 positive deltas, 0/4
// ABSTAIN. The gate therefore FAILS against the owner bar: the FM5 value
// claim stops here and the tranche returns to advisory design. This test
// pins the measured outcome instead of the aspiration so CI stays truthful:
// any future change in either direction (advice starts winning, or the
// figures drift) fails loudly and forces explicit re-baselining. It must
// not be edited to manufacture a pass.
//
// Small-n pilot by design: 4 frozen cases. A null result is valid evidence,
// not a defect in the harness.

function verdict(): { positive: number; abstains: number; total: number; pass: boolean } {
  const rows = runAdviceBattery();
  const positive = rows.filter((r) => r.utilityDelta > 0).length;
  const abstains = rows.filter((r) => r.adviceStatus === 'ABSTAIN').length;
  const total = rows.length;
  return {
    positive,
    abstains,
    total,
    pass: positive / total >= 0.5 && abstains / total <= 0.25,
  };
}

describe('FM5 Stage 1 value gate', () => {
  test('gate verdict is deterministic across runs', () => {
    expect(verdict()).toEqual(verdict());
  });

  test('measured outcome is pinned: 0/4 positive, 0/4 ABSTAIN (gate FAILS vs owner bar)', () => {
    const v = verdict();
    console.log(
      `FM5 gate: ${v.positive}/${v.total} positive deltas, ${v.abstains}/${v.total} ABSTAIN -> ${v.pass ? 'PASS' : 'FAIL'} vs owner bar`
    );
    expect(v.total).toBe(4);
    expect(v.positive).toBe(0);
    expect(v.abstains).toBe(0);
    expect(v.pass).toBe(false);
  });
});
