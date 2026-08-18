// @ts-nocheck
import { describe, it, expect, vi } from 'vitest';
import { TransientContextCardManager } from '../src/vr/ui/TransientContextCards.ts';
import { ProgressiveDisclosureController } from '../src/vr/ui/ProgressiveDisclosure.ts';
import { GestureOwnershipManager, CRITICAL_ACTIONS_REDUNDANCY } from '../src/vr/input/GestureOwnershipManager.ts';

describe('Cockpit Architecture: Sprints 24.5, 24.6, 24.7', () => {
  describe('Sprint 24.5 — Transient Context Cards', () => {
    it('spawns and auto-dismisses ephemeral context cards', () => {
      const onAction = vi.fn();
      const manager = new TransientContextCardManager({ onAction });

      const card = manager.spawnDatasetLoadedCard('SALES_Q4', 18420, 'GRAPH');
      expect(manager.activeCards.length).toBe(1);
      expect(card.title).toContain('SALES_Q4');
      expect(card.actions.map((a) => a.id)).toContain('inspect');

      // Trigger card action
      manager.triggerAction(card.id, 'inspect');
      expect(onAction).toHaveBeenCalledWith(card.id, 'inspect');
      expect(manager.activeCards.length).toBe(0);

      // Auto-dismiss tick
      const recCard = manager.spawnRecommendationCard('Community 7', 'Dense subgroup detected');
      expect(manager.activeCards.length).toBe(1);
      manager.tick(recCard.createdAt + 20000); // Beyond ttl
      expect(manager.activeCards.length).toBe(0);
    });
  });

  describe('Sprint 24.6 — Progressive Disclosure as Architecture', () => {
    it('gates wheel categories and diagnostics based on structural profile', () => {
      const controller = new ProgressiveDisclosureController('NOVICE');

      expect(controller.isCategoryVisible('DATA')).toBe(true);
      expect(controller.isCategoryVisible('ANALYSE')).toBe(false);
      expect(controller.isDiagnosticAllowed()).toBe(false);

      controller.setProfile('DEVELOPER');
      expect(controller.isCategoryVisible('ANALYSE')).toBe(true);
      expect(controller.isDiagnosticAllowed()).toBe(true);
    });

    it('manages structured Experience settings', () => {
      const controller = new ProgressiveDisclosureController();
      expect(controller.settings.comfort.vignette).toBe(true);

      controller.updateSettings('comfort', { vignette: false });
      expect(controller.settings.comfort.vignette).toBe(false);
    });
  });

  describe('Sprint 24.7 — Both-Pinch Ownership & Input Redundancy', () => {
    it('resolves both-pinch contextually with visible HUD feedback and zero suppression', () => {
      const manager = new GestureOwnershipManager();

      const navRes = manager.resolveBothPinch('NAVIGATE');
      expect(navRes.action).toBe('world_two_hand_transform');
      expect(navRes.isSuppressed).toBe(false);
      expect(navRes.hudFeedbackChip).toContain('Two-Hand');

      const interactRes = manager.resolveBothPinch('INTERACT');
      expect(interactRes.action).toBe('commit_selection');
      expect(interactRes.isSuppressed).toBe(false);

      const transformRes = manager.resolveBothPinch('TRANSFORM');
      expect(transformRes.action).toBe('scale_rotate_artifact');
      expect(transformRes.isSuppressed).toBe(false);

      const observeRes = manager.resolveBothPinch('OBSERVE');
      expect(observeRes.action).toBe('resume_interaction');
      expect(observeRes.isSuppressed).toBe(false);
    });

    it('enforces input redundancy matrix (>= 2 channels for all critical operations)', () => {
      const manager = new GestureOwnershipManager();

      for (const action of CRITICAL_ACTIONS_REDUNDANCY) {
        expect(manager.hasSufficientRedundancy(action.actionId)).toBe(true);
        expect(manager.getRedundancyChannels(action.actionId).length).toBeGreaterThanOrEqual(2);
      }
    });
  });
});
