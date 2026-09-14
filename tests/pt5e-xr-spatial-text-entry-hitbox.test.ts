// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { InvestigationJourneyController } from '../src/app/investigation/InvestigationJourneyController.ts';
import { InvestigationJourneyPanel } from '../src/vr/ui/InvestigationJourneyPanel.ts';
import { SpatialPanel } from '../src/vr/ui-system/SpatialPanel.ts';

function emptyJourney(): InvestigationJourneyController {
  return {
    snapshot: () => ({
      discoveries: [],
      latestObservation: null,
      latestResult: null,
      latestFinding: null,
      activeGraphNodeId: null,
      activeGraphNode: null,
      branches: [],
    }),
  } as unknown as InvestigationJourneyController;
}

describe('PT5E XR spatial text-entry UIKit dispatch', () => {
  it('uses SpatialPanel/UIKit and dispatches the visible notice action into text entry', async () => {
    const panel = new InvestigationJourneyPanel(new THREE.Group(), emptyJourney());
    const noticeButton = panel.buttons.find((button) => button.id === 'notice');
    expect(panel).toBeInstanceOf(SpatialPanel);
    expect(noticeButton?.enabled).toBe(true);

    await panel.activate('notice');

    expect(panel.isTextEntryActive()).toBe(true);
    panel.dispose();
  });

  it('does not dispatch a disabled question action before an observation exists', async () => {
    const panel = new InvestigationJourneyPanel(new THREE.Group(), emptyJourney());
    const questionButton = panel.buttons.find((button) => button.id === 'question');
    expect(questionButton?.enabled).toBe(false);

    await panel.activate('question');

    expect(panel.isTextEntryActive()).toBe(false);
    panel.dispose();
  });
});
