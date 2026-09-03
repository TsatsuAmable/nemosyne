// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { InvestigationJourneyController } from '../src/app/investigation/InvestigationJourneyController.ts';
import { InvestigationJourneyPanel } from '../src/vr/ui/InvestigationJourneyPanel.ts';

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

function rayForContentPoint(
  panel: InvestigationJourneyPanel,
  contentX: number,
  contentY: number,
): THREE.Raycaster {
  const canvasY = contentY + panel.titleBarHeight + 4;
  const uv = new THREE.Vector2(contentX / panel.width, 1 - canvasY / panel.height);
  return {
    intersectObject: () => [{ uv }],
  } as unknown as THREE.Raycaster;
}

describe('PT5E XR spatial text-entry hit testing', () => {
  it('maps a rendered journey button through the title-bar content transform', () => {
    const panel = new InvestigationJourneyPanel(new THREE.Group(), emptyJourney());
    const noticeButton = panel.buttons.find((button) => button.id === 'notice');
    expect(noticeButton).toBeDefined();

    const hit = panel.handleContentClick(
      rayForContentPoint(
        panel,
        noticeButton!.x + noticeButton!.w / 2,
        noticeButton!.y + noticeButton!.h / 2,
      ),
    );

    expect(hit).toBe(true);
    expect(panel.isTextEntryActive()).toBe(true);
    panel.dispose();
  });
});
