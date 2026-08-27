import { Container, Text } from '@pmndrs/uikit';
import { Button } from './Button.ts';
import { COLOR_TOKENS, SPACING_TOKENS } from '../tokens.ts';

export interface ConfirmButtonProperties {
  /** Label for the initial action button. */
  label: string;
  variant?: 'primary' | 'secondary' | 'danger';
  /** Confirmation prompt shown when the action is armed. */
  confirmMessage?: string;
  /** Label for the confirm button (defaults to "CONFIRM"). */
  confirmLabel?: string;
  /** Label for the cancel button (defaults to "CANCEL"). */
  cancelLabel?: string;
  /** Fires when the user confirms. NOT on the initial click — only after the
   * explicit second (confirm) click. */
  onConfirm?: () => void;
  /** Fires when the user cancels the armed confirmation. */
  onCancel?: () => void;
  disabled?: boolean;
  disabledReason?: string;
}

/**
 * Two-step consequential-action button. The first click arms a confirmation
 * state (showing a prompt + confirm/cancel buttons inline); only the second,
 * explicit confirm click fires `onConfirm`. This avoids the destructive
 * single-click apply that `SchemaMappingPanel` had before, and replaces a
 * separate modal dialog: the `PointerEventMachine` returns on the first
 * registered panel that reports a hit and `raycaster.intersectObject` is scoped
 * to a single panel's subtree, so a separate-SpatialPanel modal would not
 * occlude the panel behind it. Keeping the confirm state inside one panel's
 * component tree lets the SpatialPanel fallback's nearest-Component
 * hit-picking route the confirm/cancel clicks correctly.
 */
export class ConfirmButton extends Container {
  private _actionButton: Button;
  private _promptText: Text;
  private _confirmButton: Button;
  private _cancelButton: Button;
  private _armedRow: Container;
  private _onConfirm: (() => void) | undefined;
  private _onCancel: (() => void) | undefined;
  private _armed = false;

  constructor(properties: ConfirmButtonProperties) {
    super({ flexDirection: 'column', gap: SPACING_TOKENS.grid.x4 });

    this._onConfirm = properties.onConfirm;
    this._onCancel = properties.onCancel;

    this._actionButton = new Button({
      label: properties.label,
      variant: properties.variant ?? 'primary',
      disabled: properties.disabled,
      disabledReason: properties.disabledReason,
      onClick: () => this._arm(),
    });
    this.add(this._actionButton);

    this._promptText = new Text({
      text: properties.confirmMessage ?? 'Confirm this action?',
      fontSize: 13,
      color: COLOR_TOKENS.epistemic.uncertain,
    });

    this._confirmButton = new Button({
      label: properties.confirmLabel ?? 'CONFIRM',
      variant: properties.variant ?? 'primary',
      onClick: () => this._confirm(),
    });
    this._cancelButton = new Button({
      label: properties.cancelLabel ?? 'CANCEL',
      variant: 'secondary',
      onClick: () => this._cancel(),
    });

    this._armedRow = new Container({
      flexDirection: 'row',
      gap: SPACING_TOKENS.grid.x8,
      justifyContent: 'center',
    });
    this._armedRow.add(this._confirmButton);
    this._armedRow.add(this._cancelButton);
  }

  private _arm(): void {
    if (this._armed) return;
    this._armed = true;
    this.remove(this._actionButton);
    this.add(this._promptText);
    this.add(this._armedRow);
  }

  private _disarm(): void {
    if (!this._armed) return;
    this._armed = false;
    this.remove(this._promptText);
    this.remove(this._armedRow);
    this.add(this._actionButton);
  }

  private _confirm(): void {
    this._disarm();
    this._onConfirm?.();
  }

  private _cancel(): void {
    this._disarm();
    this._onCancel?.();
  }

  /** Whether the confirmation is currently armed (showing confirm/cancel). */
  get isArmed(): boolean {
    return this._armed;
  }

  /** Reset back to the action button without firing confirm or cancel. */
  reset(): void {
    this._disarm();
  }
}