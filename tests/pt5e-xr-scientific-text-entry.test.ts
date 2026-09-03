// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import type { DiscoveryReasoningSnapshot } from '../src/app/investigation/DiscoveryReasoningService.ts';
import type { InvestigationJourneyController } from '../src/app/investigation/InvestigationJourneyController.ts';
import { InvestigationJourneyPanel } from '../src/vr/ui/InvestigationJourneyPanel.ts';

function snapshot(): DiscoveryReasoningSnapshot {
  return {
    discoveries: [
      {
        schemaVersion: '1.0.0',
        discoveryId: 'discovery-1',
        investigationId: 'session-1',
        notice: 'The upper tail looks separated',
        question: 'Is the upper tail beyond the expected threshold?',
        explorationPath: ['notice-1'],
        analyticalTests: [],
        evidenceIds: ['notice-1'],
        validationStatus: 'UNTESTED',
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
    latestObservation: null,
    latestResult: null,
    latestFinding: null,
    activeGraphNodeId: null,
    activeGraphNode: null,
    branches: [],
  };
}

async function enter(panel: InvestigationJourneyPanel, value: string): Promise<void> {
  for (const character of value) {
    if (character === ' ') {
      await panel.activateTextKey('space');
    } else {
      await panel.activateTextKey(`char:${character}`);
    }
  }
}

describe('PT5E scientific text entry', () => {
  it('supports numeric thresholds and analytical comparison symbols in a hypothesis', async () => {
    const hypothesise = vi.fn(async () => undefined);
    const journey = {
      snapshot,
      hypothesise,
    } as unknown as InvestigationJourneyController;
    const panel = new InvestigationJourneyPanel(new THREE.Group(), journey);

    await panel.activate('hypothesis');
    await enter(panel, 'value > 10.5');

    expect(hypothesise).not.toHaveBeenCalled();
    await panel.activateTextKey('submit');
    expect(hypothesise).toHaveBeenCalledWith('discovery-1', 'value > 10.5');
    panel.dispose();
  });
});
