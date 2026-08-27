import { Container, Text } from '@pmndrs/uikit';
import { Button } from './Button.ts';
import { COLOR_TOKENS, SPACING_TOKENS, TYPOGRAPHY_TOKENS } from '../tokens.ts';

export interface PanelChromeProperties {
  title: string;
  /** When true (default) a pin button is shown. */
  showPin?: boolean;
  /** When true (default) a close button is shown. */
  showClose?: boolean;
  /** Fires when the pin button is clicked. The host toggles
   * `PanelBudgetController.pin/unpin`. */
  onPinToggle?: () => void;
  /** Fires when the close button is clicked. The host calls
   * `PanelBudgetController.close` (or `panel.hide()`). */
  onClose?: () => void;
  /** Accent colour for the title. */
  color?: number;
}

/**
 * Standard SpatialPanel chrome — title + optional pin + close — used across
 * SpatialPanel-based precision surfaces so placement, pin/follow, dismissal
 * and focus order are consistent.
 *
 * Contract (P1-U3 / P1-U8):
 *  - **Placement**: panels are parented to the torso anchor (BODY_LOCKED) per
 *    `panelLayout.ts`; this chrome does not position the panel.
 *  - **Pin/follow**: the pin button toggles `PanelBudgetController.pin`/
 *    `unpin`; pinned panels are exempt from automatic replacement.
 *  - **Dismissal**: the close button calls `onClose`, which the host maps to
 *    `PanelBudgetController.close` (untrack + hide).
 *  - **Focus order**: chrome renders left-to-right (title → spacer → pin →
 *    close) consistently across panels. There is no DOM tab-order in this
 *    substrate (THREE `EventDispatcher` does not bubble); the SpatialPanel
 *    fallback's pointer capture serialises interaction.
 *  - **Replacement**: governed by `PanelBudgetController` (max 1 primary + 1
 *    inspector + 1 reference; a fourth replaces the oldest non-pinned).
 *
 * Legacy `MovablePanel` chrome standardisation is deferred to P1-U8.
 */
export class PanelChrome extends Container {
  private _titleText: Text;
  private _pinButton: Button | null = null;
  private _closeButton: Button | null = null;
  private _pinned = false;
  private _onPinToggle: (() => void) | undefined;

  constructor(properties: PanelChromeProperties) {
    super({
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING_TOKENS.grid.x8,
      paddingBottom: SPACING_TOKENS.grid.x8,
      borderBottomWidth: 1,
      borderColor: COLOR_TOKENS.surface.border,
    });

    this._onPinToggle = properties.onPinToggle;

    this._titleText = new Text({
      text: `// ${properties.title}`,
      fontSize: TYPOGRAPHY_TOKENS.scale.heading,
      color: properties.color ?? COLOR_TOKENS.interaction.focus,
      fontWeight: 'bold',
    });
    this.add(this._titleText);

    // Spacer pushing pin/close to the trailing edge.
    this.add(new Container({ flexGrow: 1 }));

    if (properties.showPin !== false) {
      this._pinButton = new Button({
        label: 'PIN',
        variant: 'secondary',
        onClick: () => this._togglePin(),
      });
      this.add(this._pinButton);
    }

    if (properties.showClose !== false) {
      this._closeButton = new Button({
        label: 'CLOSE',
        variant: 'secondary',
        onClick: () => properties.onClose?.(),
      });
      this.add(this._closeButton);
    }
  }

  private _togglePin(): void {
    this._pinned = !this._pinned;
    if (this._pinButton) this._pinButton.label = this._pinned ? 'UNPIN' : 'PIN';
    this._onPinToggle?.();
  }

  get isPinned(): boolean {
    return this._pinned;
  }

  set title(value: string) {
    this._titleText.setProperties({ text: `// ${value}` });
  }
}