/**
 * Canonical hand-gesture to Meta Quest controller mapping for Nemosyne.
 *
 * Each entry describes what the gesture looks like with hands and the
 * recommended controller fallback so that users wearing controllers can still
 * trigger every analysis intent. This table is consumed by the interaction
 * coach, gesture help panel, and controller gesture mapper.
 */

export const GESTURE_MAP = {
  pinchTogether: {
    label: 'Pinch Together',
    hand: 'Pinch both index fingers, then move hands toward each other.',
    controller: 'Hold both triggers and move controllers toward each other.',
    action: 'Filter',
    icon: '⬅➡',
  },
  pinchApart: {
    label: 'Pinch Apart',
    hand: 'Pinch both index fingers, then move hands apart.',
    controller: 'Hold both triggers and move controllers apart.',
    action: 'Aggregate',
    icon: '➡⬅',
  },
  swipeRight: {
    label: 'Swipe Right',
    hand: 'Open palm, swipe horizontally to the right.',
    controller: 'Flick the right thumbstick to the right.',
    action: 'Next Dataset',
    icon: '➡',
  },
  swipeLeft: {
    label: 'Swipe Left',
    hand: 'Open palm, swipe horizontally to the left.',
    controller: 'Flick the right thumbstick to the left.',
    action: 'Previous Dataset',
    icon: '⬅',
  },
  sliceUp: {
    label: 'Slice Up',
    hand: 'Open palm, slice upward.',
    controller: 'Flick the right thumbstick up.',
    action: 'Sort',
    icon: '⬆',
  },
  sliceDown: {
    label: 'Slice Down',
    hand: 'Open palm, slice downward.',
    controller: 'Flick the right thumbstick down.',
    action: 'Time Slice',
    icon: '⬇',
  },
  scoopUp: {
    label: 'Scoop Up',
    hand: 'Both palms face up, lift hands together.',
    controller: 'Hold both triggers and raise both controllers.',
    action: 'Ascend / Statistical Lens',
    icon: '⬆⬆',
  },
  scoopDown: {
    label: 'Scoop Down',
    hand: 'Both palms face down, lower hands together.',
    controller: 'Hold both triggers and lower both controllers.',
    action: 'Descend',
    icon: '⬇⬇',
  },
  pushForward: {
    label: 'Push Forward',
    hand: 'Both palms face forward, push away from the body. Open hands reset the view; pinched hands reset data operations.',
    controller: 'Hold both triggers and push controllers forward.',
    action: 'Reset',
    icon: '⤴',
  },
  pauseResume: {
    label: 'Pause / Resume Input',
    hand: 'Pinch both index fingers close together and hold for ~1 second.',
    controller: 'Press both grip buttons and hold for ~1 second.',
    action: 'Pause Input',
    icon: '⏸',
  },
  rotateCW: {
    label: 'Rotate Clockwise',
    hand: 'Cupped hands twist clockwise.',
    controller: 'Press the right B button.',
    action: 'Redo',
    icon: '↻',
  },
  rotateCCW: {
    label: 'Rotate Counter-Clockwise',
    hand: 'Cupped hands twist counter-clockwise.',
    controller: 'Press the right A button.',
    action: 'Undo',
    icon: '↺',
  },
  okSign: {
    label: 'OK Sign',
    hand: 'Dominant hand pinch, non-dominant hand open.',
    controller: 'Press the right Y button.',
    action: 'Toggle Settings Panel',
    icon: '👌',
  },
  bothPinched: {
    label: 'Both Pinched',
    hand: 'Pinch both index fingers at the same time.',
    controller: 'Press both grip buttons together.',
    action: 'Toggle Launcher',
    icon: '✌',
  },
};

/**
 * Reverse lookup: which gestures map to a given action label?
 * Used by the interaction coach to annotate logged actions.
 */
export function gesturesForAction(actionLabel) {
  return Object.entries(GESTURE_MAP)
    .filter(([, meta]) => meta.action === actionLabel)
    .map(([name]) => name);
}

export function getGestureMeta(name) {
  return GESTURE_MAP[name] ?? null;
}
