import { Dataset } from './Dataset.ts';
import type { TopologyType } from './types.ts';
import {
  makeSalesTable,
  makeSocialGraph,
  makeWindField,
  makeFinancialSeries,
} from './SyntheticData.ts';

/**
 * Build a synthetic dataset of a given topology and row count for the VR
 * load-test harness. The point is to stress the JS render path at target scale
 * so the command-buffer decision can be made on *measured* frame times, not
 * guesswork.
 *
 * Dispatches to the unbounded generators in `SyntheticData.ts`:
 * - `TABULAR`      → `makeSalesTable(rows)`       (row-per-instance)
 * - `GRAPH`        → `makeSocialGraph(nodes)`     (nodes + ~3× edges)
 * - `VECTOR_FIELD` → `makeWindField(count)`       (vectors)
 * - `TIME_SERIES`  → `makeFinancialSeries(ticks)` (one tick per row)
 *
 * `HIERARCHY` / `GEO` generators are bounded (branching / 20-city seed list) and
 * do not scale to 65k+, so they are not supported here — the staircase profile
 * uses the unbounded topologies. A request for an unsupported topology throws so
 * the driver fails loudly rather than silently measuring the wrong thing.
 *
 * The data is synthetic and deterministic-ish (the generators use Math.random
 * for variety, which is fine — we measure *render* cost, not data correctness).
 */
export function makeStressDataset(topology: TopologyType, rowCount: number): Dataset {
  const n = Math.max(1, Math.floor(rowCount));
  switch (topology) {
    case 'TABULAR':
      return makeSalesTable(n);
    case 'GRAPH':
      return makeSocialGraph(n);
    case 'VECTOR_FIELD':
      return makeWindField(n);
    case 'TIME_SERIES':
      return makeFinancialSeries(n, 'LOAD');
    case 'HIERARCHY':
    case 'GEO':
      throw new Error(
        `makeStressDataset: topology '${topology}' has no unbounded generator; ` +
          `use TABULAR / GRAPH / VECTOR_FIELD / TIME_SERIES for load testing.`
      );
    default:
      throw new Error(`makeStressDataset: unknown topology '${topology as string}'.`);
  }
}