/**
 * Default onboarding tour for first-time Nemosyne analysts.
 *
 * Steps reference named targets that the GuidedTour resolver maps to live
 * scene objects or UI elements. Audio hints are short text prompts suitable for
 * speech synthesis or subtitles; the app currently uses a confirmation tone per
 * step.
 */

export interface TourStep {
  target: string;
  text: string;
  actionHint: string;
  [key: string]: unknown;
}

export interface Tour {
  id: string;
  title: string;
  steps: TourStep[];
}

export const FIRST_DATASET_TOUR: Tour = {
  id: 'first-dataset',
  title: 'Welcome to Nemosyne',
  steps: [
    {
      target: 'datum-plane',
      text: 'You are standing in a memory palace built from data. The floor grid is the datum plane — the ground of every dataset.',
      actionHint: 'Look around',
    },
    {
      target: 'draco-palace',
      text: 'In front of you is the Draco palace: nodes, beams, and volumes chosen by the constraint engine for this dataset.',
      actionHint: 'Point at a node',
    },
    {
      target: 'node-mesh',
      text: 'Point your laser or finger ray at a node and pinch or pull the trigger to inspect it. A holographic slate will appear near your hand.',
      actionHint: 'Pinch or trigger on a node',
    },
    {
      target: 'wheel-menu',
      text: 'Pinch your non-dominant hand or press the controller grip to open the constellation wheel menu. Categories live on the inner ring.',
      actionHint: 'Open the wheel menu',
    },
    {
      target: 'wheel-ops',
      text: 'Hover a category to preview its actions on the outer ring. Try the Ops category to see filter, sort, aggregate, and cluster.',
      actionHint: 'Hover Ops, then select Filter',
    },
    {
      target: 'gesture-hint',
      text: 'You can also use two-hand gestures: pinch together to filter, scoop up to toggle the statistical lens, or rotate your cupped hands to undo.',
      actionHint: 'Try a gesture when ready',
    },
    {
      target: 'settings-panel',
      text: 'Open the Settings panel from the wheel menu or with the OK-sign gesture to customize the statistical lens, audio, haptics, and gestures.',
      actionHint: 'Toggle settings',
    },
    {
      target: 'dashboard',
      text: 'Curved panels float in front of you. You can drag them by the title bar or scroll the carousel from the wheel menu.',
      actionHint: 'Drag or scroll a panel',
    },
    {
      target: 'draco-palace',
      text: 'That is the core loop: orient, probe, query, compare. Press Next when you are ready to explore on your own.',
      actionHint: 'Press Next to finish',
    },
  ],
};
