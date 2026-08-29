/**
 * Default onboarding tour for first-time Nemosyne analysts.
 *
 * Steps reference named targets that the GuidedTour resolver maps to live
 * scene objects or UI elements. Audio hints are short text prompts suitable for
 * speech synthesis or subtitles; the app currently uses a confirmation tone per
 * step.
 */

/**
 * Canonical tour types — single source of truth shared by the engine
 * (`GuidedTour`), the controller (`GuidedTourController`), and tour data. Lives
 * in the data layer so the VR layer can depend on it without a layering
 * inversion. `actionHint`/`audio` are optional so the engine stays tolerant of
 * minimal step definitions.
 */
export interface TourStep {
  target: string;
  text: string;
  actionHint?: string;
  audio?: boolean;
  [key: string]: unknown;
}

export interface Tour {
  id: string;
  title?: string;
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
      target: 'wheel-analyse',
      text: 'Hover the Analyse category to preview actions on the outer ring — filter, sort, aggregate, cluster, hierarchy, density, anomaly, time slice. Try Analyse → Filter to narrow the data.',
      actionHint: 'Hover Analyse, then select Filter',
    },
    {
      target: 'gesture-hint',
      text: 'You can also use two-hand gestures: pinch together to filter, scoop up to toggle the statistical lens, or rotate your cupped hands to undo.',
      actionHint: 'Try a gesture when ready',
    },
    {
      target: 'settings-panel',
      text: 'Open the Settings panel from the wheel menu (System → Settings) or with the OK-sign gesture to customize the statistical lens, audio, haptics, and gestures.',
      actionHint: 'Toggle settings',
    },
    {
      target: 'dashboard',
      text: 'Curved panels float in front of you. You can drag them by the title bar or scroll the carousel from the wheel menu.',
      actionHint: 'Drag or scroll a panel',
    },
    {
      target: 'data-loader',
      text: 'LOAD DATA: Switch sample domains or load custom CSV/JSON files using the wheel menu (Data → Next Dataset) or drag-and-drop file loader.',
      actionHint: 'Switch dataset or load file',
    },
    {
      target: 'session-export',
      text: 'SAVE & EXPORT: Analysis sessions auto-save to IndexedDB. Export high-res PNG screenshots or JSON Analysis Story bundles anytime (Study → Export Story / Screenshot).',
      actionHint: 'Export Story or Screenshot from wheel menu',
    },
    {
      target: 'peer-collaboration',
      text: 'SHARE & COLLABORATE: Join multi-user WebRTC rooms to share live 3D avatars, node selections, and peer annotations in real time (Collaborate → Join Room).',
      actionHint: 'Join collaboration room',
    },
    {
      target: 'tda-lens',
      text: 'STATISTICAL LENS: The topological lens reveals persistence, mapper-graph, and betti-curve summary planes. It stays hidden until you request it — toggle it from the View menu (View → Statistical Lens), the scoop-up gesture, or the TechnoCore landmark.',
      actionHint: 'Toggle the Lens from View',
    },
    {
      target: 'comfort-settings',
      text: 'COMFORT: Open Settings (System → Settings) to enable reduced-motion mode, a peripheral locomotion vignette, snap-turn, and panel-distance tuning for longer, lower-strain sessions.',
      actionHint: 'Open Settings → comfort',
    },
    {
      target: 'live-stream',
      text: 'LIVE DATA: Stream real-time data from built-in sources (ticker/trades/earthquakes/aircraft) or your own WebSocket endpoint. Rows flow into the palace and re-solve live (Data → Live Ingest).',
      actionHint: 'Start a live source from Data menu',
    },
    {
      target: 'theme-preset',
      text: 'ATMOSPHERE: Cycle atmospheric themes from the View menu (View → Theme) — including the Low-Strain Comfort and Muted Professional presets, which use dark-slate backdrops and muted neon to reduce visual fatigue.',
      actionHint: 'Cycle the Theme from View',
    },
    {
      target: 'narrative-timeline',
      text: 'TIMELINE: The timeline strip records every analysis step as a chip. Click a chip to seek back to any prior state of the palace — your full analysis history is reversible (Study → Timeline Strip).',
      actionHint: 'Open the Timeline panel',
    },
    {
      target: 'draco-palace',
      text: 'That is the core loop: load, probe, transform, save, and share. Press Next to complete the tour!',
      actionHint: 'Press Next to finish',
    },
  ],
};
