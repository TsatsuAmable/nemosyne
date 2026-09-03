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

async function enterText(panel: InvestigationJourneyPanel, value: string): Promise<void> {
  for (const character of value) {
    if (character === ' ') {
      await panel.activateTextKey('space');
      continue;
    }
    if (character >= 'A' && character <= 'Z') {
      await panel.activateTextKey('shift');
      await panel.activateTextKey(`char:${character.toLowerCase()}`);
      continue;
    }
    await panel.activateTextKey(`char:${character}`);
  }
}

function investigationSnapshot(): DiscoveryReasoningSnapshot {
  return {
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
        analyticalTests: [],
        evidenceIds: ['notice-1', 'result-1'],
        conclusion: undefined,
        validationStatus: 'UNDER_INVESTIGATION',
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
    latestResult: {
      resultId: 'result-1',
    } as never,
  };
}

describe('PT5C/PT5E XR investigation presentation', () => {
  afterEach(() => vi.restoreAllMocks());

  it('authors a notice in-headset without invoking the browser prompt', async () => {
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
    const prompt = vi.spyOn(window, 'prompt');

    const panel = new InvestigationJourneyPanel(new THREE.Group(), journey);
    await panel.activate('notice');

    expect(panel.isTextEntryActive()).toBe(true);
    expect(observe).not.toHaveBeenCalled();
    await enterText(panel, 'A boundary looks unstable');
    expect(observe).not.toHaveBeenCalled();
    await panel.activateTextKey('submit');

    expect(prompt).not.toHaveBeenCalled();
    expect(observe).toHaveBeenCalledWith('A boundary looks unstable');
    expect(panel.status).toMatch(/notice saved/i);
    panel.dispose();
  });

  it('does not dispatch a semantic action when spatial text entry is cancelled', async () => {
    const observe = vi.fn();
    const journey = {
      snapshot: () => emptySnapshot(),
      observe,
    } as unknown as InvestigationJourneyController;

    const panel = new InvestigationJourneyPanel(new THREE.Group(), journey);
    await panel.activate('notice');
    await enterText(panel, 'discard this');
    await panel.activateTextKey('cancel');

    expect(observe).not.toHaveBeenCalled();
    expect(panel.isTextEntryActive()).toBe(false);
    panel.dispose();
  });

  it('refuses empty submit without leaving text-entry mode', async () => {
    const observe = vi.fn();
    const journey = {
      snapshot: () => emptySnapshot(),
      observe,
    } as unknown as InvestigationJourneyController;

    const panel = new InvestigationJourneyPanel(new THREE.Group(), journey);
    await panel.activate('notice');
    await panel.activateTextKey('submit');

    expect(observe).not.toHaveBeenCalled();
    expect(panel.isTextEntryActive()).toBe(true);
    expect(panel.status).toMatch(/cannot be empty/i);
    panel.dispose();
  });

  it('enforces the bounded notice length before controller dispatch', async () => {
    const observe = vi.fn(async (notes: string) => ({
      id: 'notice-1',
      timestamp: 1,
      notes,
      datasetFingerprint: 'fp-1',
      datasetVersion: 1,
    }));
    const journey = {
      snapshot: () => emptySnapshot(),
      observe,
    } as unknown as InvestigationJourneyController;

    const panel = new InvestigationJourneyPanel(new THREE.Group(), journey);
    await panel.activate('notice');
    for (let index = 0; index < 501; index += 1) {
      await panel.activateTextKey('char:a');
    }
    await panel.activateTextKey('submit');

    expect(observe).toHaveBeenCalledTimes(1);
    expect(observe.mock.calls[0][0]).toHaveLength(500);
    panel.dispose();
  });

  it('collects understanding title and description before one atomic controller call', async () => {
    const recordUnderstanding = vi.fn(async () => ({ id: 'finding-1' }));
    const snapshot = investigationSnapshot();
    const journey = {
      snapshot: () => snapshot,
      recordUnderstanding,
    } as unknown as InvestigationJourneyController;

    const panel = new InvestigationJourneyPanel(new THREE.Group(), journey);
    await panel.activate('understanding');
    await enterText(panel, 'Stable boundary');
    await panel.activateTextKey('submit');

    expect(recordUnderstanding).not.toHaveBeenCalled();
    expect(panel.isTextEntryActive()).toBe(true);

    await enterText(panel, 'The analytical evidence preserves the same boundary');
    await panel.activateTextKey('submit');

    expect(recordUnderstanding).toHaveBeenCalledTimes(1);
    expect(recordUnderstanding).toHaveBeenCalledWith({
      discoveryId: 'discovery-1',
      title: 'Stable boundary',
      description: 'The analytical evidence preserves the same boundary',
      resultId: 'result-1',
    });
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
            {
              id: 'test-1',
              method: 'anomaly_zscore',
              evidenceIds: ['result-1'],
              outcome: 'SUPPORTS',
            },
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
