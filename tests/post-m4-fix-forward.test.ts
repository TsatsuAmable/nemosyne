// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountAnalystJourneyControls } from '../src/app/AnalystJourneyControls.ts';
import {
  LoadDatasetUseCase,
  type DatasetLoadAuthority,
} from '../src/app/dataset/LoadDatasetUseCase.ts';
import { Dataset } from '../src/data/Dataset.ts';
import {
  SEMANTIC_EMBODIMENT_STATUS_SURFACE_NAME,
  setSemanticEmbodimentPresentationStatus,
} from '../src/moneta/embodiment/SemanticEmbodimentStatus.ts';
import { WorldEventBus, WorldTopics } from '../src/utils/EventBus.ts';

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('post-M4 independent fix-forward', () => {
  it('keeps semantic status copy bound to the candidate family', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

    const aggregate = new THREE.Group();
    setSemanticEmbodimentPresentationStatus(
      aggregate,
      'UNAVAILABLE',
      undefined,
      'AGGREGATE_VOLUME'
    );
    const aggregateSurface = aggregate.getObjectByName(SEMANTIC_EMBODIMENT_STATUS_SURFACE_NAME);

    expect(aggregate.userData.semanticEmbodimentCandidateId).toBe('AGGREGATE_VOLUME');
    expect(aggregate.userData.semanticEmbodimentStatusMessage).toContain('aggregate');
    expect(aggregate.userData.semanticEmbodimentStatusMessage).not.toContain('distribution');
    expect(aggregateSurface?.userData.semanticEmbodimentCandidateId).toBe('AGGREGATE_VOLUME');

    const distribution = new THREE.Group();
    setSemanticEmbodimentPresentationStatus(
      distribution,
      'PENDING',
      undefined,
      'DISTRIBUTION_FIELD'
    );
    expect(distribution.userData.semanticEmbodimentStatusMessage).toContain(
      'empirical distribution'
    );

    const nodeSource = readFileSync('src/moneta/MonetaTopologyNode.ts', 'utf8');
    expect(nodeSource).toMatch(
      /setSemanticEmbodimentPresentationStatus\([\s\S]*?'UNAVAILABLE'[\s\S]*?candidateId[\s\S]*?\)/
    );
  });

  it('publishes dataset-loaded only for a fresh authoritative dataset transition', () => {
    const bus = new WorldEventBus();
    const original = new Dataset(
      'authoritative-context',
      [{ name: 'value', type: 'NUMERIC' }],
      [{ value: 1 }, { value: 2 }]
    );
    let current = original;
    const events: unknown[] = [];
    bus.on(WorldTopics.DATASET_LOADED, (event) => events.push(event));

    const authority = {
      setOriginalDataset: vi.fn((dataset: Dataset) => {
        current = dataset;
      }),
      setCurrentDataset: vi.fn((dataset: Dataset) => {
        current = dataset;
      }),
      get dataset() {
        return current;
      },
      isReady: () => false,
      inferEncodings: () => null,
      arbitrateRepresentation: vi.fn(),
      computeDatasetSignature: vi.fn(),
      executionPort: null,
      generation: 1,
      datasetVersion: 7,
      datasetFingerprint: 'a'.repeat(64),
      eventBus: bus,
    } as unknown as DatasetLoadAuthority;
    const useCase = new LoadDatasetUseCase(authority);
    const entry = {
      key: 'authoritative-context',
      name: 'Authoritative context',
      topology: 'TABULAR',
      dataset: original,
    };

    useCase.execute(entry);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      key: 'authoritative-context',
      name: 'Authoritative context',
      datasetName: 'authoritative-context',
      datasetVersion: 7,
      datasetFingerprint: 'a'.repeat(64),
    });

    useCase.execute(entry, { preserveAnalyticalState: true });
    expect(events).toHaveLength(1);
  });

  it('refreshes and unsubscribes the task-first dataset context from its injected authority', () => {
    let currentDataset = 'First dataset';
    const subscription: { handler?: () => void } = {};
    let unsubscribed = false;

    const handle = mountAnalystJourneyControls({
      dispatchIntent: (async () => undefined) as never,
      currentDatasetName: () => currentDataset,
      subscribeDatasetContext: (handler) => {
        subscription.handler = handler;
        return () => {
          unsubscribed = true;
        };
      },
      assessRepresentation: (() => ({ kind: 'nil' })) as never,
      analysisResultCount: () => 0,
      markMoment: () => 'observation-1',
      replayPortableInvestigation: async () => ({
        success: true,
        discrepancies: [],
        eventsMatched: 0,
      }),
      exportPortableInvestigation: async () => new Uint8Array(),
    });

    expect(document.getElementById('analyst-workspace-context')?.textContent).toBe(
      'Dataset · First dataset'
    );
    currentDataset = 'Second dataset';
    expect(subscription.handler).toBeTypeOf('function');
    subscription.handler?.();
    expect(document.getElementById('analyst-workspace-context')?.textContent).toBe(
      'Dataset · Second dataset'
    );

    handle.dispose();
    expect(unsubscribed).toBe(true);

    const bootstrapSource = readFileSync('src/app/bootstrap.ts', 'utf8');
    expect(bootstrapSource).toContain('world.eventBus.on(WorldTopics.DATASET_LOADED');
    expect(bootstrapSource).toContain('queueMicrotask(handler)');
  });

  it('pins M4 evidence to the real checkout while retaining the workflow event SHA separately', () => {
    const workflow = readFileSync('.github/workflows/stream-m-m4-distribution-evidence.yml', 'utf8');
    const smoke = readFileSync('tests/smoke/stream-m-m4-distribution-evidence.spec.ts', 'utf8');

    expect(workflow).toContain('checkout_sha="$(git rev-parse HEAD)"');
    expect(workflow).toContain('NEMOSYNE_CHECKOUT_HEAD_SHA');
    expect(workflow).toContain('NEMOSYNE_WORKFLOW_EVENT_SHA=$GITHUB_SHA');
    expect(smoke).toContain('checkoutHeadSha: process.env.NEMOSYNE_CHECKOUT_HEAD_SHA');
    expect(smoke).toContain('workflowEventSha: process.env.NEMOSYNE_WORKFLOW_EVENT_SHA');
    expect(smoke).toContain('expect(report.source.checkoutHeadSha).toBe(report.source.sourceHeadSha)');
    expect(smoke).toContain("locator('#analyst-workspace-context')");
  });
});
