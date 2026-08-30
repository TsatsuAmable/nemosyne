/**
 * Simplified Panel Roles Taxonomy (P1-UV1).
 *
 * Roles:
 * - primary: Primary analyst actions (load, analyze, record, vault, lens)
 * - secondary: Secondary tools (settings, assess, undo/redo)
 * - diagnostic: Debug/diagnostic panels (telemetry, performance, network, console)
 * - system: System panels (settings - always accessible)
 *
 * UI Modes:
 * - ANALYST: Standard mode (diagnostic panels hidden by default)
 * - DEVELOPER: Diagnostic panels accessible
 */

export type PanelRole = 'primary' | 'secondary' | 'diagnostic' | 'system';

export type UIMode = 'ANALYST' | 'DEVELOPER';

export interface PanelRegistration {
  id: string;
  name: string;
  role: PanelRole;
  isOpen: boolean;
  autoDismissMs?: number;
}

export class PanelRolesManager {
  private _uiMode: UIMode = 'ANALYST';
  private _panels = new Map<string, PanelRegistration>();
  private _maxPrimaryPanels = 3;
  private _maxSecondaryPanels = 2;

  constructor(initialMode: UIMode = 'ANALYST') {
    this._uiMode = initialMode;
  }

  get uiMode(): UIMode {
    return this._uiMode;
  }

  setUIMode(mode: UIMode): void {
    this._uiMode = mode;
    if (mode !== 'DEVELOPER') {
      // Automatically close diagnostic panels in analyst mode
      for (const panel of this._panels.values()) {
        if (panel.role === 'diagnostic') {
          panel.isOpen = false;
        }
      }
    }
  }

  registerPanel(id: string, name: string, role: PanelRole, autoDismissMs?: number): void {
    this._panels.set(id, {
      id,
      name,
      role,
      isOpen: false,
      autoDismissMs,
    });
  }

  openPanel(id: string): boolean {
    const panel = this._panels.get(id);
    if (!panel) return false;

    // Diagnostic panels cannot open unless in DEVELOPER mode
    if (panel.role === 'diagnostic' && this._uiMode !== 'DEVELOPER') {
      return false;
    }

    // Enforce max primary panels rule
    if (panel.role === 'primary') {
      const openPrimary = Array.from(this._panels.values()).filter(
        (p) => p.role === 'primary' && p.isOpen && p.id !== id
      );
      if (openPrimary.length >= this._maxPrimaryPanels) {
        // Dismiss the oldest open primary panel
        openPrimary[0].isOpen = false;
      }
    }

    // Enforce max secondary panels rule
    if (panel.role === 'secondary') {
      const openSecondary = Array.from(this._panels.values()).filter(
        (p) => p.role === 'secondary' && p.isOpen && p.id !== id
      );
      if (openSecondary.length >= this._maxSecondaryPanels) {
        openSecondary[0].isOpen = false;
      }
    }

    panel.isOpen = true;
    return true;
  }

  closePanel(id: string): boolean {
    const panel = this._panels.get(id);
    if (!panel) return false;
    panel.isOpen = false;
    return true;
  }

  isPanelOpen(id: string): boolean {
    return this._panels.get(id)?.isOpen ?? false;
  }

  getOpenPanelsByRole(role: PanelRole): PanelRegistration[] {
    return Array.from(this._panels.values()).filter((p) => p.role === role && p.isOpen);
  }

  minimizeAll(): void {
    for (const panel of this._panels.values()) {
      if (panel.role !== 'system') {
        panel.isOpen = false;
      }
    }
  }

  getAllPanels(): PanelRegistration[] {
    return Array.from(this._panels.values());
  }

  getPanel(id: string): PanelRegistration | undefined {
    return this._panels.get(id);
  }
}