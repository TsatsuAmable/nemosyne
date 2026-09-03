// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import type { DiscoveryReasoningSnapshot } from '../src/app/investigation/DiscoveryReasoningService.ts';
import type { InvestigationJourneyController } from '../src/app/investigation/InvestigationJourneyController.ts';
import { InvestigationJourneyPanel } from '../src/vr/ui/InvestigationJourneyPanel.ts';

function emptySnapshot(): DiscoveryReasoningSnapshot {
  return {
    discoveries: [],
    latestObservation: null,
    latestResult: null,
    latestFinding: null,
    activeGraphNodeId: null,
    activeGraphNode: null,
    branches: [],
  };
}

describe('PT5C XR investigation presentation', () => {
  afterEach(() => vi.restoreAllMocks());

  it('delegates notice authoring to the shared journey controller', async () => {
    const observe = vi.fn(async () => ({
      id: 'notice-1',
      timestamp: 1,
      notes: 'A boundary looks unstable',
      datasetFingerprint: 'fp-1',
      datasetVersion: 1,
    }));
    const journey = {
      snapshot: () => emptySnapshot(),
      observe,
    } as unknown as InvestigationJourneyController;
    vi.spyOn(window, 'prompt').mockReturnValue('A boundary looks unstable');

    const panel = new InvestigationJourneyPanel(new THREE.Group(), journey);
    await panel.activate('notice');

    expect(observe).toHaveBeenCalledWith('A boundary looks unstable');
    expect(panel.status).toMatch(/notice saved/i);
    panel.dispose();
  });

  it('does not dispatch a semantic action when text entry is cancelled', async () => {
    const observe = vi.fn();
    const journey = {
      snapshot: () => emptySnapshot(),
      observe,
    } as unknown as InvestigationJourneyController;
    vi.spyOn(window, 'prompt').mockReturnValue(null);

    const panel = new InvestigationJourneyPanel(new THREE.Group(), journey);
    await panel.activate('notice');

    expect(observe).not.toHaveBeenCalled();
    panel.dispose();
  });

  it('shows human validation language instead of raw discovery enums', () => {
    const snapshot: DiscoveryReasoningSnapshot = {
      ...emptySnapshot(),
      discoveries: [
        {
          schemaVersion: '1.0.0',
          discoveryId: 'discovery-1',
          investigationId: 'session-1',
          notice: 'A pattern appeared',
          question: 'Is it stable?',
          hypothesis: 'It remains stable.',
          explorationPath: ['notice-1'],
          analyticalTests: [
            { id: 'test-1', method: 'anomaly_zscore', evidenceIds: ['result-1'], outcome: 'SUPPORTS' },
          ],
          evidenceIds: ['notice-1', 'result-1'],
          conclusion: 'The cited evidence preserves the pattern.',
          validationStatus: 'SUPPORTED',
          representationContext: {},
          provenance: {
            datasetFingerprint: 'fp-1',
            datasetVersion: 1,
            kernelVersion: 'kernel-test',
            investigationVersion: 'test/1',
            randomSeeds: {},
          },
        },
      ],
    };
    const journey = { snapshot: () => snapshot } as unknown as InvestigationJourneyController;
    const panel = new InvestigationJourneyPanel(new THREE.Group(), journey);
    const fillText = vi.spyOn(panel.ctx, 'fillText');

    panel.render();
    const rendered = fillText.mock.calls.map(([text]) => String(text)).join(' | ');
    expect(rendered).toContain('Status · Hypothesis supported');
    expect(rendered).not.toContain('SUPPORTED');
    expect(rendered).not.toContain('UNDER_INVESTIGATION');
    panel.dispose();
  });
});
