/**
 * P1-USIM scenario fixtures (dev/test-only).
 *
 * Maps the useful `WebXR6DoFPoseRig` presets into deterministic scenario
 * fixtures instead of maintaining a separate mock WebXR runtime. A fixture is a
 * bounded ordered list of steps; each step drives the real simulator device and
 * (optionally) asserts an outcome through the real InputRouter.
 */

import { WebXR6DoFPoseRig, type HeadPose6DoF, type HandPose6DoF } from '../spatial-tools/WebXR6DoFPoseRig.ts';

export type ScenarioInputMode = 'controller' | 'hand';

export type ScenarioAssertion = 'select' | 'hover' | 'none';

export interface ScenarioPoseStep {
  kind: 'pose';
  id: string;
  description: string;
  /** Headset world position; null means "leave unchanged". */
  head: { x: number; y: number; z: number } | null;
  /** Controller/hand side to move. */
  side: 'left' | 'right';
  /** World position for the controller/hand. */
  position: { x: number; y: number; z: number };
  /** Pinch state to configure on the hand (hand mode). */
  pinched?: boolean;
}

export interface ScenarioInputStep {
  kind: 'input';
  id: string;
  description: string;
  side: 'left' | 'right';
  /** Controller trigger press/release (controller mode). */
  trigger?: boolean;
  /** Hand pinch configure (hand mode). */
  pinch?: boolean;
}

export interface ScenarioAssertStep {
  kind: 'assert';
  id: string;
  description: string;
  assertion: ScenarioAssertion;
}

export type ScenarioStep = ScenarioPoseStep | ScenarioInputStep | ScenarioAssertStep;

export interface SimulatorScenario {
  id: string;
  mode: ScenarioInputMode;
  description: string;
  steps: ScenarioStep[];
}

/** Convert a WebXR6DoFPoseRig preset hand into a controller/hand world pose. */
export function presetHandToWorld(hand: HandPose6DoF): { x: number; y: number; z: number } {
  return { x: hand.position.x, y: hand.position.y, z: hand.position.z };
}

export function presetHeadToWorld(head: HeadPose6DoF): { x: number; y: number; z: number } {
  return { x: head.position.x, y: head.position.y, z: head.position.z };
}

function standingNaturalSteps(): ScenarioStep[] {
  const standing = WebXR6DoFPoseRig.PRESETS.STANDING_NATURAL();
  const head = presetHeadToWorld(standing.head);
  const right = presetHandToWorld(standing.rightHand);
  return [
    {
      kind: 'pose',
      id: 'pose-standing-head',
      description: 'standing natural headset pose',
      head,
      side: 'right',
      position: right,
    },
    {
      kind: 'pose',
      id: 'pose-standing-right-hand',
      description: 'standing natural right hand pose',
      head: null,
      side: 'right',
      position: right,
    },
  ];
}

function pinchInteractionSteps(): ScenarioStep[] {
  const pinch = WebXR6DoFPoseRig.PRESETS.PINCH_INTERACTION();
  const right = presetHandToWorld(pinch.rightHand);
  return [
    {
      kind: 'pose',
      id: 'pose-pinch-head',
      description: 'pinch-interaction headset pose',
      head: presetHeadToWorld(pinch.head),
      side: 'right',
      position: right,
    },
    {
      kind: 'pose',
      id: 'pose-pinch-right-hand-open',
      description: 'right hand open (not pinching)',
      head: null,
      side: 'right',
      position: right,
      pinched: false,
    },
    {
      kind: 'input',
      id: 'pinch-close',
      description: 'close right-hand pinch',
      side: 'right',
      pinch: true,
    },
    {
      kind: 'assert',
      id: 'assert-pinch-select',
      description: 'pinch activates the target',
      assertion: 'select',
    },
  ];
}

function controllerTriggerSteps(): ScenarioStep[] {
  return [
    {
      kind: 'pose',
      id: 'pose-controller-head',
      description: 'neutral headset pose for controller scenario',
      head: { x: 0, y: 1.6, z: 0 },
      side: 'right',
      position: { x: 0, y: 1.4, z: -0.5 },
    },
    {
      kind: 'pose',
      id: 'pose-controller-aim',
      description: 'aim right controller at the target',
      head: null,
      side: 'right',
      position: { x: 0, y: 1.4, z: -0.5 },
    },
    {
      kind: 'input',
      id: 'controller-press',
      description: 'press right controller trigger',
      side: 'right',
      trigger: true,
    },
    {
      kind: 'assert',
      id: 'assert-controller-select',
      description: 'trigger press activates the target',
      assertion: 'select',
    },
  ];
}

/**
 * The canonical USIM-0 reference scenarios. These are reviewed fixtures, not
 * free-form programs; the simulator runs them deterministically.
 */
export const USIM_SCENARIOS: Record<string, SimulatorScenario> = {
  'usim-0-controller-select': {
    id: 'usim-0-controller-select',
    mode: 'controller',
    description: 'RF-049/reference: a controller trigger press activates one production control through the real InputRouter path.',
    steps: controllerTriggerSteps(),
  },
  'usim-0-hand-pinch-select': {
    id: 'usim-0-hand-pinch-select',
    mode: 'hand',
    description: 'RF-049/reference: a supported hand pinch activates one production control through the real InputRouter path.',
    steps: pinchInteractionSteps(),
  },
  'usim-0-standing-pose': {
    id: 'usim-0-standing-pose',
    mode: 'hand',
    description: 'WebXR6DoFPoseRig standing-natural preset replay for deterministic pose evidence.',
    steps: standingNaturalSteps(),
  },
};

export function scenarioById(id: string): SimulatorScenario | null {
  return USIM_SCENARIOS[id] ?? null;
}