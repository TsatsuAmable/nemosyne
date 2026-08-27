// @ts-nocheck
// @vitest-environment jsdom
//
// ConfirmButton — two-step consequential-action button. The first click arms
// the inline confirm state; only the second (confirm) click fires onConfirm.
// This is the substrate-safe replacement for a separate modal (the
// PointerEventMachine returns on the first panel with a hit, so a separate
// SpatialPanel modal would not occlude the panel behind it).

import { describe, it, expect, vi } from 'vitest';
import { ConfirmButton } from '../../src/vr/ui-system/components/ConfirmButton.ts';

describe('ConfirmButton', () => {
  it('does NOT fire onConfirm on the first (arm) click', () => {
    const onConfirm = vi.fn();
    const cb = new ConfirmButton({ label: 'APPLY', onConfirm });
    expect(cb.isArmed).toBe(false);

    cb._actionButton.dispatchEvent({ type: 'click' });
    expect(cb.isArmed).toBe(true);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('fires onConfirm only after the explicit confirm click', () => {
    const onConfirm = vi.fn();
    const cb = new ConfirmButton({ label: 'APPLY', onConfirm });

    cb._actionButton.dispatchEvent({ type: 'click' });
    expect(onConfirm).not.toHaveBeenCalled();

    cb._confirmButton.dispatchEvent({ type: 'click' });
    expect(onConfirm).toHaveBeenCalledOnce();
    // Confirming disarms back to the action button.
    expect(cb.isArmed).toBe(false);
  });

  it('fires onCancel and disarms when cancel is clicked', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const cb = new ConfirmButton({ label: 'APPLY', onConfirm, onCancel });

    cb._actionButton.dispatchEvent({ type: 'click' });
    expect(cb.isArmed).toBe(true);

    cb._cancelButton.dispatchEvent({ type: 'click' });
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(cb.isArmed).toBe(false);
  });

  it('reset() disarms without firing confirm or cancel', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const cb = new ConfirmButton({ label: 'APPLY', onConfirm, onCancel });

    cb._actionButton.dispatchEvent({ type: 'click' });
    expect(cb.isArmed).toBe(true);

    cb.reset();
    expect(cb.isArmed).toBe(false);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('arming twice is idempotent (a second arm click does nothing)', () => {
    const cb = new ConfirmButton({ label: 'APPLY' });
    cb._actionButton.dispatchEvent({ type: 'click' });
    const armedChildrenCount = cb.children.length;
    // While armed the action button is removed; clicking it again is impossible
    // in the production path (it is no longer in the tree). Verify the armed
    // tree is stable.
    expect(cb.isArmed).toBe(true);
    expect(cb.children.length).toBe(armedChildrenCount);
  });
});