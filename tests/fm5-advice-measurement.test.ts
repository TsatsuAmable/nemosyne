import { describe, test, expect } from 'vitest';
import { runAdviceBattery } from './helpers/fm5-advice-battery.ts';

/**
 * FM5-R5: baseline-vs-advice measurement battery (fixture-relative only).
 *
 * Compares advice-applied vs bypassed synthesis over governed fixtures and
 * reports utility deltas. Assertions are structural: both arms complete with
 * finite utilities and measurements reproduce. Seeding and provenance binding
 * are measured and logged per row but not asserted here (see R6/R7 for the
 * asserted recording and influence-flag evidence). NOTHING here asserts
 * advice wins — a negative delta is a valid measurement, and held-out/device
 * qualification remains open.
 */

describe('FM5-R5: advice-vs-baseline measurement battery', () => {
  test('battery completes with recorded advice on both arms and finite deltas', () => {
    const rows = runAdviceBattery();

    expect(rows).toHaveLength(4);
    for (const row of rows) {
      expect(Number.isFinite(row.advisedUtility)).toBe(true);
      expect(Number.isFinite(row.bypassedUtility)).toBe(true);
      expect(Number.isFinite(row.utilityDelta)).toBe(true);
    }

    console.log(
      ['caseId,adviceStatus,advised,bypassed,delta,seeded']
        .concat(
          rows.map((r) =>
            [
              r.caseId,
              r.adviceStatus,
              r.advisedUtility.toFixed(4),
              r.bypassedUtility.toFixed(4),
              r.utilityDelta.toFixed(4),
              String(r.advisedSeeded),
            ].join(',')
          )
        )
        .join('\n')
    );
  });

  test('measurements reproduce exactly on rerun', () => {
    const first = runAdviceBattery();
    const second = runAdviceBattery();
    expect(second).toEqual(first);
  });
});
