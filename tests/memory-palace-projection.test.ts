import { describe, test, expect } from 'vitest';
import * as THREE from 'three';
import {
  MemoryPalaceWorldView,
  MAX_MEMORY_PALACE_OBJECTS,
  type MemoryPalaceProjectionSource,
  type MemoryPalaceWorldViewHost,
} from '../src/vr/presentation/epistemic/MemoryPalaceWorldView.ts';
import type { InvestigationNode } from '../src/atlas/domain/InvestigationGraph.ts';

function stubHost(): MemoryPalaceWorldViewHost {
  return {
    scene: new THREE.Scene(),
    addInteractable: () => {},
    removeInteractable: () => {},
    registerTooltipTarget: () => {},
    unregisterTooltipTarget: () => {},
  };
}

function node(id: string, kind: InvestigationNode['kind'], label: string): InvestigationNode {
  return {
    id,
    kind,
    parentId: null,
    datasetVersion: 1,
    datasetFingerprint: 'fp-test',
    label,
    timestamp: 1,
  };
}

function baseSource(): MemoryPalaceProjectionSource {
  return {
    sessionId: 's1',
    researchQuestion: 'What structures exist?',
    hypothesis: 'Clusters align with regions.',
    nodes: [
      node('n-q', 'question', 'Q node'),
      node('n-op', 'operation', 'Op node'),
      node('n-f', 'finding', 'F node'),
    ],
    edges: [{ id: 'e1', source: 'n-q', target: 'n-op', relationship: 'branches_from' }],
    activeNodeId: 'n-op',
    observations: [
      {
        id: 'o1',
        timestamp: 1,
        notes: 'saw a cluster',
        datasetFingerprint: 'fp-test',
        datasetVersion: 1,
      },
    ],
    findings: [
      {
        id: 'f1',
        timestamp: 1,
        title: 'Cluster confirmed',
        description: 'two groups',
        confidence: 'preliminary',
        observationIds: ['o1'],
        resultIds: [],
        datasetFingerprint: 'fp-test',
        datasetVersion: 1,
      },
    ],
  };
}

describe('memory palace projection (ADR-0012)', () => {
  test('projects aggregate records to epistemic kinds deterministically', () => {
    const view = new MemoryPalaceWorldView(stubHost());
    view.sync(baseSource());
    const first = view.getSnapshot();
    // research question + hypothesis + 1 observation + 1 finding + 3 nodes + 1 branch
    expect(first.objectCount).toBe(8);
    expect(first.objectIds).toContain('research-question:s1');
    expect(first.objectIds).toContain('research-hypothesis:s1');
    expect(first.objectIds).toContain('o1');
    expect(first.objectIds).toContain('f1');
    expect(first.objectIds).toContain('n-op');
    expect(first.objectIds).toContain('branch:e1');
    expect(first.selectedId).toBe('n-op');
    expect(first.visible).toBe(true);

    view.sync(baseSource());
    const second = view.getSnapshot();
    expect(second).toEqual(first);
  });

  test('unknown active node fails closed to null selection', () => {
    const view = new MemoryPalaceWorldView(stubHost());
    view.sync({ ...baseSource(), activeNodeId: 'nope' });
    expect(view.getSnapshot().selectedId).toBeNull();
  });

  test('object cap is enforced on large graphs', () => {
    const view = new MemoryPalaceWorldView(stubHost());
    const nodes = Array.from({ length: 60 }, (_, i) => node(`n${i}`, 'operation', `Op ${i}`));
    view.sync({
      ...baseSource(),
      nodes,
      researchQuestion: undefined,
      hypothesis: undefined,
      observations: [],
      findings: [],
      edges: [],
    });
    expect(view.getSnapshot().objectCount).toBeLessThanOrEqual(MAX_MEMORY_PALACE_OBJECTS);
  });

  test('memory barrel no longer carries a graph authority', async () => {
    const barrel = (await import('../src/memory/index.ts')) as Record<string, unknown>;
    expect('MemoryPalaceGraph' in barrel).toBe(false);
    expect(typeof barrel.EPISTEMIC_OBJECT_SCHEMA_VERSION).toBe('string');
  });
});
