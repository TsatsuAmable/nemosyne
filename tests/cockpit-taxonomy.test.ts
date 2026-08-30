// @ts-nocheck
import { describe, it, expect, vi } from 'vitest';
import { HandWheelCategorizer, DEFAULT_CATEGORY_ACTIONS } from '../src/vr/ui/HandWheelCategorization.ts';
import { ContextualTaskSurface } from '../src/vr/ui/ContextualTaskSurface.ts';
import { PanelRolesManager } from '../src/vr/ui/PanelRolesManager.ts';

describe('UX Cockpit & Interaction Hierarchy (Sprints 24.2, 24.3, 24.4)', () => {
  describe('Sprint 24.2 — HandWheel Categorization & Forgiving Confirm', () => {
    it('progresses through REST -> CATEGORY_FOCUS -> ACTION_CONFIRM state machine', () => {
      const actionSpy = vi.fn();
      const wheel = new HandWheelCategorizer({ onActionTriggered: actionSpy });

      expect(wheel.state).toBe('REST');

      wheel.focusCategory('ANALYSE');
      expect(wheel.state).toBe('CATEGORY_FOCUS');
      expect(wheel.activeCategory).toBe('ANALYSE');

      const filterAction = DEFAULT_CATEGORY_ACTIONS.ANALYSE[0];
      wheel.focusAction(filterAction);
      expect(wheel.state).toBe('ACTION_CONFIRM');
      expect(wheel.hoveredAction?.id).toBe('filter');

      // Accidental ray hover without pinch does not fire
      const notFired = wheel.confirmAction(false);
      expect(notFired).toBe(false);
      expect(actionSpy).not.toHaveBeenCalled();

      // Explicit pinch confirms action
      const confirmed = wheel.confirmAction(true);
      expect(confirmed).toBe(true);
      expect(actionSpy).toHaveBeenCalledWith(filterAction);
      expect(wheel.state).toBe('REST');
    });

    it('supports gaze target acquisition + hand intent redundancy', () => {
      const actionSpy = vi.fn();
      const wheel = new HandWheelCategorizer({ onActionTriggered: actionSpy });

      wheel.setGazeCategory('VIEW');
      expect(wheel.state).toBe('CATEGORY_FOCUS');

      // Pinch anywhere confirms default gaze action
      const confirmed = wheel.confirmAction(true);
      expect(confirmed).toBe(true);
      expect(actionSpy).toHaveBeenCalled();
    });
  });

  describe('Sprint 24.3 — Task-Oriented Contextual Surface Decomposition', () => {
    it('filters analytical actions dynamically by dataset topology', () => {
      const surface = new ContextualTaskSurface();

      surface.setTopology('GRAPH');
      surface.setIntent('Analyse');

      const graphActions = surface.getAvailableActions().map((a) => a.id);
      expect(graphActions).toContain('find_communities');
      expect(graphActions).toContain('detect_anomalies');
      expect(graphActions).not.toContain('time_slice'); // Not in graph

      surface.setTopology('TIME_SERIES');
      const timeActions = surface.getAvailableActions().map((a) => a.id);
      expect(timeActions).toContain('time_slice');
      expect(timeActions).not.toContain('find_communities');
    });
  });

  describe('Sprint 24.4 — Panel Roles Taxonomy & Mode Separation', () => {
    it('enforces maximum 3 primary panels rule', () => {
      const manager = new PanelRolesManager('ANALYST');
      manager.registerPanel('p1', 'Dataset Inspector', 'primary');
      manager.registerPanel('p2', 'Recommendation', 'primary');
      manager.registerPanel('p3', 'Cluster Inspector', 'primary');
      manager.registerPanel('p4', 'Vault', 'primary');

      manager.openPanel('p1');
      manager.openPanel('p2');
      manager.openPanel('p3');
      expect(manager.getOpenPanelsByRole('primary').length).toBe(3);

      // Opening 4th closes oldest open primary panel (p1)
      manager.openPanel('p4');
      const open = manager.getOpenPanelsByRole('primary');
      expect(open.length).toBe(3);
      expect(manager.isPanelOpen('p1')).toBe(false);
      expect(manager.isPanelOpen('p2')).toBe(true);
      expect(manager.isPanelOpen('p3')).toBe(true);
      expect(manager.isPanelOpen('p4')).toBe(true);
    });

    it('hides diagnostic panels outside of DEVELOPER mode', () => {
      const manager = new PanelRolesManager('RESEARCH');
      manager.registerPanel('diag-console', 'VR Console', 'diagnostic');

      const openedInResearch = manager.openPanel('diag-console');
      expect(openedInResearch).toBe(false);
      expect(manager.isPanelOpen('diag-console')).toBe(false);

      manager.setUIMode('DEVELOPER');
      const openedInDev = manager.openPanel('diag-console');
      expect(openedInDev).toBe(true);
      expect(manager.isPanelOpen('diag-console')).toBe(true);

      // Switching away from dev automatically hides diagnostic panels
      manager.setUIMode('ANALYST');
      expect(manager.isPanelOpen('diag-console')).toBe(false);
    });
  });
});
