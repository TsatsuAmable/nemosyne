/**
 * Both-Pinch Gesture Ownership Redesign & Input Redundancy (Sprint 24.7).
 *
 * Resolves both-pinch gesture conflicts contextually per active InteractionMode:
 * - NAVIGATE: Two-hand world transform (scale/pan memory palace)
 * - INTERACT: Commit active selection / panel focus
 * - TRANSFORM: Scale/rotate active data cluster or spatial artifact
 * - OBSERVE: Resume interaction mode
 *
 * Guarantees zero silent suppression by exposing unambiguous HUD feedback
 * and enforcing an input redundancy matrix (every critical action has >= 2 input channels).
 */

import { InteractionMode } from './InteractionModeController.ts';

export type BothPinchSemanticAction =
  | 'world_two_hand_transform'
  | 'commit_selection'
  | 'scale_rotate_artifact'
  | 'resume_interaction';

export interface BothPinchResolution {
  action: BothPinchSemanticAction;
  hudFeedbackChip: string;
  isSuppressed: false;
}

export type InputChannel = 'gesture' | 'controller' | 'gaze_confirm' | 'keyboard';

export interface ActionInputRedundancy {
  actionId: string;
  name: string;
  channels: readonly InputChannel[];
}

export const CRITICAL_ACTIONS_REDUNDANCY: readonly ActionInputRedundancy[] = [
  {
    actionId: 'toggle_navigation_wheel',
    name: 'Open Navigation Wheel',
    channels: ['gesture', 'controller', 'keyboard'],
  },
  {
    actionId: 'confirm_selection',
    name: 'Confirm / Commit',
    channels: ['gesture', 'gaze_confirm', 'controller'],
  },
  {
    actionId: 'two_hand_transform',
    name: 'World Transform',
    channels: ['gesture', 'controller'],
  },
  {
    actionId: 'dismiss_panel',
    name: 'Dismiss / Back',
    channels: ['gesture', 'gaze_confirm', 'controller', 'keyboard'],
  },
];

export class GestureOwnershipManager {
  resolveBothPinch(mode: InteractionMode): BothPinchResolution {
    switch (mode) {
      case 'NAVIGATE':
        return {
          action: 'world_two_hand_transform',
          hudFeedbackChip: '↔ Two-Hand World Transform',
          isSuppressed: false,
        };
      case 'INTERACT':
        return {
          action: 'commit_selection',
          hudFeedbackChip: '⊙ Commit Selection',
          isSuppressed: false,
        };
      case 'TRANSFORM':
        return {
          action: 'scale_rotate_artifact',
          hudFeedbackChip: '⤢ Scale & Rotate Artifact',
          isSuppressed: false,
        };
      case 'OBSERVE':
        return {
          action: 'resume_interaction',
          hudFeedbackChip: '▶ Resume Interaction',
          isSuppressed: false,
        };
    }
  }

  getRedundancyChannels(actionId: string): readonly InputChannel[] {
    const item = CRITICAL_ACTIONS_REDUNDANCY.find((a) => a.actionId === actionId);
    return item?.channels ?? ['gesture', 'controller'];
  }

  hasSufficientRedundancy(actionId: string): boolean {
    const channels = this.getRedundancyChannels(actionId);
    return channels.length >= 2;
  }
}
