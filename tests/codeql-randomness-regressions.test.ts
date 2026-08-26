import { describe, expect, it } from 'vitest';
import {
  makeFinancialSeries,
  makeFlowProcess,
  makeGeoCities,
  makeOrgChart,
  makeSalesTable,
  makeSocialGraph,
  makeWindField,
} from '../src/data/SyntheticData.ts';
import { UXTraceRecorder } from '../src/vr/trace/UXTraceRecorder.ts';

function snapshotDataset(factory: () => { rows: Record<string, unknown>[]; edges?: unknown[] }) {
  const dataset = factory();
  return { rows: dataset.rows, edges: dataset.edges };
}

function makeTraceRecorder(): UXTraceRecorder {
  return new UXTraceRecorder({
    engine: {
      addUpdatable: () => undefined,
      removeUpdatable: () => undefined,
      input: {
        hands: [],
        panels: [],
        interactables: [],
      },
    },
    fetchImpl: async () => ({ ok: true, status: 200 }),
  });
}

describe('CodeQL randomness regressions', () => {
  it('keeps synthetic fixtures deterministic for identical parameters', () => {
    const factories = [
      () => makeSalesTable(12),
      () => makeOrgChart(3, [1, 2, 2, 1]),
      () => makeWindField(8),
      () => makeSocialGraph(10),
      () => makeFinancialSeries(8, 'TEST'),
      () => makeGeoCities(8),
      () => makeFlowProcess(5),
    ];

    for (const factory of factories) {
      expect(snapshotDataset(factory)).toEqual(snapshotDataset(factory));
    }
  });

  it('uses collision-resistant UUIDs for UX trace session identity', () => {
    const first = makeTraceRecorder();
    const second = makeTraceRecorder();

    expect(first.sessionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(second.sessionId).not.toBe(first.sessionId);

    first.dispose();
    second.dispose();
  });
});
