/**
 * Panel Roles Taxonomy & Diagnostic Mode Separation (Sprint 24.4).
 *
 * Enforces UX spatial rules:
 * - Panel roles: workspace | task | context | diagnostic | transient | system.
 * - Max 2 task panels open simultaneously.
 * - Diagnostic panels hidden unless in DEVELOPER mode.
 * - Auto-dismiss and minimize-all support.
 */

export type PanelRole =
  | 'workspace'
  | 'task'
  | 'context'
  | 'diagnostic'
  | 'transient'
  | 'system';

export type UIMode = 'RESEARCH' | 'ANALYST' | 'DEVELOPER';

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
  private _maxTaskPanels = 2;

  constructor(initialMode: UIMode = 'ANALYST') {
    this._uiMode = initialMode;
  }

  get uiMode(): UIMode {
    return this._uiMode;
  }

  setUIMode(mode: UIMode): void {
    this._uiMode = mode;
    if (mode !== 'DEVELOPER') {
      // Automatically close diagnostic panels in research or analyst mode
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

    // Enforce max task panels rule
    if (panel.role === 'task') {
      const openTasks = Array.from(this._panels.values()).filter(
        (p) => p.role === 'task' && p.isOpen && p.id !== id
      );
      if (openTasks.length >= this._maxTaskPanels) {
        // Dismiss the oldest open task panel
        openTasks[0].isOpen = false;
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
      if (panel.role !== 'workspace') {
        panel.isOpen = false;
      }
    }
  }
}
