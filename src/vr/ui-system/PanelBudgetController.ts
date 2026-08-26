import type { SpatialPanel } from './SpatialPanel.ts';

export type PanelSlotRole = 'primary' | 'inspector' | 'reference' | 'pinned';

interface PanelSlot {
  panel: SpatialPanel;
  role: PanelSlotRole;
  originalRole: PanelSlotRole;
}

/**
 * Enforces the analyst workspace panel budget:
 *   max 1 primary + 1 inspector + 1 reference surface.
 * A fourth un-pinned panel triggers replacement of the oldest panel in its role.
 * Pinned panels are exempt from automatic replacement.
 *
 * This controller governs ONLY SpatialPanel-based surfaces.
 * Legacy MovablePanel instances remain under PanelRolesManager until P1-U8.
 */
export class PanelBudgetController {
  private _slots: Map<SpatialPanel, PanelSlot> = new Map();

  /** Open a panel in the given role slot. Returns the dismissed panel if any. */
  open(panel: SpatialPanel, role: PanelSlotRole): SpatialPanel | null {
    // Already tracked — just update visibility
    const existing = this._slots.get(panel);
    if (existing) {
      panel.visible = true;
      return null;
    }

    let dismissed: SpatialPanel | null = null;

    // If the role is not 'pinned', check if the slot is occupied
    if (role !== 'pinned') {
      const occupant = this._findOccupant(role);
      if (occupant && occupant.panel !== panel) {
        dismissed = occupant.panel;
        this.close(dismissed);
      }
    }

    this._slots.set(panel, { panel, role, originalRole: role });
    panel.visible = true;

    return dismissed;
  }

  /** Close and untrack a panel. */
  close(panel: SpatialPanel): void {
    panel.visible = false;
    this._slots.delete(panel);
  }

  /** Pin a panel — exempts it from automatic replacement. */
  pin(panel: SpatialPanel): void {
    const slot = this._slots.get(panel);
    if (!slot) return;
    slot.role = 'pinned';
  }

  /** Unpin a panel — restores it to its original role slot. */
  unpin(panel: SpatialPanel): void {
    const slot = this._slots.get(panel);
    if (!slot || slot.role !== 'pinned') return;
    slot.role = slot.originalRole;

    // Check if restoring to the original role creates a conflict
    const occupant = this._findOccupant(slot.role, panel);
    if (occupant) {
      // The existing occupant takes priority; keep this one pinned
      slot.role = 'pinned';
    }
  }

  /** Check if a panel is currently tracked and visible. */
  isOpen(panel: SpatialPanel): boolean {
    return this._slots.has(panel);
  }

  /** Get the role of a tracked panel. */
  getRole(panel: SpatialPanel): PanelSlotRole | null {
    return this._slots.get(panel)?.role ?? null;
  }

  /** Get all open panels. */
  getOpenPanels(): SpatialPanel[] {
    return Array.from(this._slots.keys());
  }

  /** Get the count of open non-pinned panels. */
  get activeBudgetCount(): number {
    let count = 0;
    for (const slot of this._slots.values()) {
      if (slot.role !== 'pinned') count++;
    }
    return count;
  }

  private _findOccupant(role: PanelSlotRole, exclude?: SpatialPanel): PanelSlot | null {
    for (const slot of this._slots.values()) {
      if (slot.role === role && slot.panel !== exclude) {
        return slot;
      }
    }
    return null;
  }
}
