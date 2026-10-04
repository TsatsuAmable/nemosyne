// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { World } from '../src/vr/World.ts';
import { REPRESENTATION_RESOURCE_POLICY_V1 } from '../src/vr/scalability/ResourceLifecycleGovernor.ts';
import { LoadTestDriver } from '../src/vr/scalability/LoadTestDriver.ts';
import { getSampleDataset } from '../src/data/SampleDatasets.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.ts';
import { WorldTopics } from '../src/utils/EventBus.ts';

describe('RF-062C production World path', () => {
  let world: World | null = null;

  afterEach(async () => {
    if (world) {
      await world.dispose();
      world.loader?.container?.remove?.();
      world = null;
    }
    for (const canvas of Array.from(document.querySelectorAll('canvas'))) {
      canvas.remove();
    }
    vi.restoreAllMocks();
  });

  it('routes a real dataset load through LoadDatasetUseCase and RepresentationSurface exactly once', async () => {
    world = new World();
    const bridge = makeKernelMockBridge();
    world.atlas.setKernel(bridge, 0x3c07);

    const execute = vi.spyOn(world.loadDatasetUseCase, 'execute');
    const replace = vi.spyOn(world.representationSurface, 'replace');
    const sample = getSampleDataset('sales-table');
    if (!sample) throw new Error('sales-table sample is required');

    await world.loadDataset({
      name: sample.label,
      topology: sample.topology,
      dataset: sample.dataset,
      maxDepth: sample.depth,
    });

    expect(execute).toHaveBeenCalledOnce();
    expect(replace).toHaveBeenCalledOnce();
    expect(world.dracoNode).toBe(world.representationSurface.currentNode);
    expect(world.diagnostic).toBe(world.representationSurface.diagnostic);
    expect(world.currentEntry?.dataset).toBe(sample.dataset);
    expect(world.atlas.dataset).not.toBe(sample.dataset);
  });

  it('fails closed when the real World load boundary supersedes a queued stress dataset', async () => {
    world = new World();
    world.atlas.setKernel(makeKernelMockBridge(), 0x3c07);
    const summaries: unknown[] = [];
    const stepPhases: string[] = [];
    const offComplete = world.eventBus.on(WorldTopics.LOADTEST_COMPLETE, (payload) =>
      summaries.push(payload)
    );
    const offStep = world.eventBus.on(WorldTopics.LOADTEST_STEP, (payload) =>
      stepPhases.push((payload as { phase?: string }).phase ?? '')
    );
    const driver = new LoadTestDriver(world, world.engine);
    const competing = getSampleDataset('sales-table');
    if (!competing) throw new Error('sales-table sample is required');

    driver.run({
      name: 'real-world-supersession',
      settleSec: 0,
      steps: [{ topology: 'TABULAR', rowCount: 10, durationSec: 0 }],
    });
    const competingLoad = world.loadDataset({
      name: competing.label,
      topology: competing.topology,
      dataset: competing.dataset,
      maxDepth: competing.depth,
    });

    await competingLoad;
    await Promise.resolve();

    expect(driver.phase).toBe('COMPLETE');
    expect(stepPhases).not.toContain('SETTLING');
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      aborted: true,
      failure: { phase: 'dataset-load', message: expect.stringMatching(/superseded/i) },
      steps: [],
    });
    expect(world.currentEntry?.name).toBe(competing.label);

    driver.dispose();
    offComplete();
    offStep();
  });

  it('delegates representation teardown to the surface owner', async () => {
    world = new World();
    const bridge = makeKernelMockBridge();
    world.atlas.setKernel(bridge, 0x3c07);

    const sample = getSampleDataset('sales-table');
    if (!sample) throw new Error('sales-table sample is required');
    await world.loadDataset({
      name: sample.label,
      topology: sample.topology,
      dataset: sample.dataset,
      maxDepth: sample.depth,
    });

    const disposeSurface = vi.spyOn(world.representationSurface, 'dispose');
    await world.dispose();

    expect(disposeSurface).toHaveBeenCalledOnce();
    expect(world.dracoNode).toBeNull();
    expect(world.diagnostic).toBeNull();
    world = null;
  });

  it('clears the production surface when the authoritative load result abstains', async () => {
    world = new World();
    world.atlas.setKernel(makeKernelMockBridge(), 0x3c07);
    const sample = getSampleDataset('sales-table');
    if (!sample) throw new Error('sales-table sample is required');

    const abstainDecision = {
      decisionStatus: 'ABSTAIN',
      decisionId: 'decision-abstain',
      policyId: 'policy',
      policyVersion: '1',
      datasetSignatureHash: 'dataset',
      requirementsHash: 'requirements',
      chosenCandidateId: undefined,
      chosenLayout: undefined,
      embodiment: {
        spatialStrategy: null,
        representationType: 'NONE',
      },
      rankedCandidates: [],
      rejectedAlternatives: [],
      timestamp: 0,
    };
    const execute = vi.spyOn(world.loadDatasetUseCase, 'execute').mockReturnValue({
      entry: {
        name: sample.label,
        topology: sample.topology,
        dataset: sample.dataset,
        maxDepth: sample.depth,
      },
      embodiedDataset: sample.dataset,
      dataInput: { topology: sample.topology, dataset: sample.dataset },
      requirements: {} as never,
      representationDecision: abstainDecision as never,
      outcome: { kind: 'ABSTAIN' } as never,
    });
    const clear = vi.spyOn(world.representationSurface, 'clear');
    const replace = vi.spyOn(world.representationSurface, 'replace');

    await world.loadDataset({
      name: sample.label,
      topology: sample.topology,
      dataset: sample.dataset,
      maxDepth: sample.depth,
    });

    expect(execute).toHaveBeenCalledOnce();
    expect(clear).toHaveBeenCalledOnce();
    expect(replace).not.toHaveBeenCalled();
    expect(world.dracoNode).toBeNull();
    expect(world.representationSurface.currentNode).toBeNull();
  });

  it('owns one lifecycle governor with the representation-resource/v1 policy', () => {
    world = new World();
    expect(world.resourceLifecycleGovernor).toBeDefined();
    const snapshot = world.resourceLifecycleGovernor.getSnapshot();
    expect(snapshot.policyVersion).toBe(REPRESENTATION_RESOURCE_POLICY_V1.policyVersion);
  });

  it('records one ACTIVE representation record after a successful dataset load', async () => {
    world = new World();
    world.atlas.setKernel(makeKernelMockBridge(), 0x3c07);
    const sample = getSampleDataset('sales-table');
    if (!sample) throw new Error('sales-table sample is required');

    await world.loadDataset({
      name: sample.label,
      topology: sample.topology,
      dataset: sample.dataset,
      maxDepth: sample.depth,
    });

    const snapshot = world.resourceLifecycleGovernor.getSnapshot();
    expect(snapshot.counts.ACTIVE).toBe(1);
    expect(snapshot.counts.WARM).toBe(0);
    expect(snapshot.counts.COLD).toBe(0);
  });

  it('queues cleanup for the previous projection when replacing datasets', async () => {
    world = new World();
    world.atlas.setKernel(makeKernelMockBridge(), 0x3c07);
    const first = getSampleDataset('sales-table');
    if (!first) throw new Error('sales-table sample is required');
    const second = getSampleDataset('fraud-graph');
    if (!second) throw new Error('fraud-graph sample is required');

    await world.loadDataset({
      name: first.label,
      topology: first.topology,
      dataset: first.dataset,
      maxDepth: first.depth,
    });
    expect(world.resourceLifecycleGovernor.getSnapshot().counts.ACTIVE).toBe(1);

    await world.loadDataset({
      name: second.label,
      topology: second.topology,
      dataset: second.dataset,
      maxDepth: second.depth,
    });

    const snapshot = world.resourceLifecycleGovernor.getSnapshot();
    expect(snapshot.counts.ACTIVE).toBe(1);
    expect(snapshot.queuedCleanupCount).toBeGreaterThan(0);
  });

  it('tick advances cleanup and final disposal empties the lifecycle registry', async () => {
    world = new World();
    world.atlas.setKernel(makeKernelMockBridge(), 0x3c07);
    const first = getSampleDataset('sales-table');
    if (!first) throw new Error('sales-table sample is required');
    const second = getSampleDataset('fraud-graph');
    if (!second) throw new Error('fraud-graph sample is required');

    await world.loadDataset({
      name: first.label,
      topology: first.topology,
      dataset: first.dataset,
      maxDepth: first.depth,
    });

    await world.loadDataset({
      name: second.label,
      topology: second.topology,
      dataset: second.dataset,
      maxDepth: second.depth,
    });

    const beforeTick = world.resourceLifecycleGovernor.getSnapshot();
    expect(beforeTick.queuedCleanupCount).toBeGreaterThan(0);

    world.resourceLifecycleGovernor.tick();

    await world.dispose();

    const afterDispose = world.resourceLifecycleGovernor.getSnapshot();
    expect(afterDispose.counts.ACTIVE).toBe(0);
    expect(afterDispose.counts.WARM).toBe(0);
    expect(afterDispose.counts.COLD).toBe(0);
    expect(afterDispose.queuedCleanupCount).toBe(0);
    world = null;
  });
});
