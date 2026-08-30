// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { World } from '../src/vr/World.ts';
import { getSampleDataset } from '../src/data/SampleDatasets.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.ts';

describe('RF-062C production World wiring', () => {
  it('routes World.loadDataset through the logical use case and representation surface', async () => {
    const world = new World();
    try {
      const bridge = makeKernelMockBridge();
      world.atlas.setKernel(bridge, 0x3c07);

      const baselineDecision = world.atlas.activeRepresentationDecision;
      const baselineResultCount = world.atlas.results.length;
      const previousNode = world.dracoNode;
      const previousDiagnostic = world.diagnostic;
      const execute = world.loadDatasetUseCase.execute.bind(world.loadDatasetUseCase);
      const replace = world.representationSurface.replace.bind(world.representationSurface);
      let useCaseCalls = 0;
      let surfaceCalls = 0;
      world.loadDatasetUseCase.execute = ((...args: Parameters<typeof execute>) => {
        useCaseCalls += 1;
        return execute(...args);
      }) as typeof world.loadDatasetUseCase.execute;
      world.representationSurface.replace = ((...args: Parameters<typeof replace>) => {
        surfaceCalls += 1;
        return replace(...args);
      }) as typeof world.representationSurface.replace;

      const fraud = getSampleDataset('fraud-graph');
      if (!fraud) throw new Error('fraud-graph sample is required');
      world.loadDataset({
        key: fraud.key,
        name: fraud.label,
        label: fraud.label,
        topology: fraud.topology,
        dataset: fraud.dataset,
        maxDepth: fraud.depth,
      });

      expect(useCaseCalls).toBe(1);
      expect(surfaceCalls).toBe(1);
      expect(world.atlas.activeRepresentationDecision).not.toBeNull();
      expect(world.atlas.activeRepresentationDecision).not.toBe(baselineDecision);
      expect(world.atlas.results.length).toBeGreaterThan(baselineResultCount);
      expect(world.representationSurface.currentNode).toBe(world.dracoNode);
      expect(world.representationSurface.diagnostic).toBe(world.diagnostic);
      expect(world.dracoNode).not.toBe(previousNode);
      expect(world.diagnostic).not.toBe(previousDiagnostic);
    } finally {
      await world.dispose();
    }
  });

  it('rebuilds the current representation without re-arbitrating Atlas when preserving state', async () => {
    const world = new World();
    try {
      const bridge = makeKernelMockBridge();
      world.atlas.setKernel(bridge, 0x3c07);
      const fraud = getSampleDataset('fraud-graph');
      if (!fraud) throw new Error('fraud-graph sample is required');
      world.loadDataset({
        key: fraud.key,
        name: fraud.label,
        label: fraud.label,
        topology: fraud.topology,
        dataset: fraud.dataset,
        maxDepth: fraud.depth,
      });
      const decision = world.atlas.activeRepresentationDecision;
      const resultCount = world.atlas.results.length;

      world._rebuildPalaceWithKernelFacts();

      expect(world.atlas.activeRepresentationDecision).toBe(decision);
      expect(world.atlas.results.length).toBe(resultCount);
      expect(world.representationSurface.currentNode).toBe(world.dracoNode);
    } finally {
      await world.dispose();
    }
  });
});