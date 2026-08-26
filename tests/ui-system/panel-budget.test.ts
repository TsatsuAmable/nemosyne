import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { SpatialPanel } from '../../src/vr/ui-system/SpatialPanel.ts';
import { PanelBudgetController } from '../../src/vr/ui-system/PanelBudgetController.ts';

function makePanel(): SpatialPanel {
  return new SpatialPanel({}, new THREE.Group(), new THREE.Group());
}

describe('PanelBudgetController', () => {
  it('dismisses the previous occupant when a second panel opens in the same role', () => {
    const ctrl = new PanelBudgetController();
    const a = makePanel();
    const b = makePanel();

    expect(ctrl.open(a, 'primary')).toBeNull();
    expect(a.visible).toBe(true);

    const dismissed = ctrl.open(b, 'primary');
    expect(dismissed).toBe(a);
    expect(a.visible).toBe(false);
    expect(b.visible).toBe(true);
    expect(ctrl.getRole(b)).toBe('primary');
    expect(ctrl.getRole(a)).toBeNull();
  });

  it('allows one primary, one inspector and one reference to coexist', () => {
    const ctrl = new PanelBudgetController();
    const primary = makePanel();
    const inspector = makePanel();
    const reference = makePanel();

    ctrl.open(primary, 'primary');
    ctrl.open(inspector, 'inspector');
    ctrl.open(reference, 'reference');

    expect(ctrl.getOpenPanels()).toHaveLength(3);
    expect(ctrl.activeBudgetCount).toBe(3);
    expect(primary.visible && inspector.visible && reference.visible).toBe(true);
  });

  it('replaces the slot occupant when a fourth un-pinned panel opens', () => {
    const ctrl = new PanelBudgetController();
    const primary = makePanel();
    const inspector = makePanel();
    const referenceA = makePanel();
    const referenceB = makePanel();

    ctrl.open(primary, 'primary');
    ctrl.open(inspector, 'inspector');
    ctrl.open(referenceA, 'reference');

    const dismissed = ctrl.open(referenceB, 'reference');
    expect(dismissed).toBe(referenceA);
    expect(referenceA.visible).toBe(false);
    expect(referenceB.visible).toBe(true);
    expect(ctrl.getOpenPanels()).toHaveLength(3);
  });

  it('exempts pinned panels from replacement', () => {
    const ctrl = new PanelBudgetController();
    const a = makePanel();
    const b = makePanel();

    ctrl.open(a, 'primary');
    ctrl.pin(a);
    expect(ctrl.getRole(a)).toBe('pinned');

    // A pinned panel in the primary slot does not get dismissed.
    expect(ctrl.open(b, 'primary')).toBeNull();
    expect(a.visible).toBe(true);
    expect(b.visible).toBe(true);
    expect(ctrl.activeBudgetCount).toBe(1);
  });

  it('unpin restores a panel to its original role and conflicts keep it pinned', () => {
    const ctrl = new PanelBudgetController();
    const pinned = makePanel();
    const replacement = makePanel();

    ctrl.open(pinned, 'primary');
    ctrl.pin(pinned);
    ctrl.open(replacement, 'primary'); // takes the primary slot while pinned is exempt

    expect(ctrl.getRole(replacement)).toBe('primary');

    ctrl.unpin(pinned);
    // Primary slot is now occupied by `replacement`; pinned must stay pinned.
    expect(ctrl.getRole(pinned)).toBe('pinned');
  });

  it('close untracks a panel and unpin is a no-op on a non-pinned panel', () => {
    const ctrl = new PanelBudgetController();
    const a = makePanel();
    ctrl.open(a, 'inspector');
    expect(ctrl.isOpen(a)).toBe(true);

    ctrl.close(a);
    expect(ctrl.isOpen(a)).toBe(false);
    expect(a.visible).toBe(false);

    ctrl.unpin(a);
    expect(ctrl.getRole(a)).toBeNull();
  });

  it('opening an already-tracked panel just reveals it without dismissing', () => {
    const ctrl = new PanelBudgetController();
    const a = makePanel();
    ctrl.open(a, 'primary');
    a.visible = false;
    expect(ctrl.open(a, 'primary')).toBeNull();
    expect(a.visible).toBe(true);
  });
});