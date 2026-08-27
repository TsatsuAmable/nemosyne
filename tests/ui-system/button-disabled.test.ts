// @ts-nocheck
// @vitest-environment jsdom
//
// UX-04 / design-system §35: a disabled control must not encode its state
// solely through colour, and its action must not fire. These tests exercise
// the production-path contract that the shared `Button` enforces.

import { describe, it, expect, vi } from 'vitest';
import { Button } from '../../src/vr/ui-system/components/Button.ts';

describe('Button disabled + disabledReason (UX-04 / §35)', () => {
  it('does not fire onClick when disabled, even on a direct click dispatch', () => {
    const onClick = vi.fn();
    const b = new Button({ label: 'Undo', onClick, disabled: true });
    // The production path dispatches `click` to the hit Component (the Button's
    // own mesh). A disabled button must guard inside the listener — it cannot
    // rely on `pointerEvents:'none'` (uikit's `Component.raycast` ignores that
    // signal in the SpatialPanel fallback path).
    b.dispatchEvent({ type: 'click' });
    expect(onClick).not.toHaveBeenCalled();
    expect(b.isDisabled).toBe(true);
  });

  it('fires onClick when enabled', () => {
    const onClick = vi.fn();
    const b = new Button({ label: 'Undo', onClick });
    b.dispatchEvent({ type: 'click' });
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('renders a disabledReason label only when disabled with a reason (not colour alone)', () => {
    const reasonOf = (c: Button): { parent: unknown } =>
      (c as unknown as { _reasonText: { parent: unknown } })._reasonText;

    const b = new Button({ label: 'Undo', disabled: true, disabledReason: 'Kernel unavailable' });
    expect(reasonOf(b).parent).toBe(b);

    const b2 = new Button({ label: 'Undo', disabled: true });
    expect(reasonOf(b2).parent).toBeNull();

    const b3 = new Button({ label: 'Undo', disabledReason: 'Kernel unavailable' });
    expect(reasonOf(b3).parent).toBeNull();
  });

  it('still fires pointerover when disabled (so hover affordance remains)', () => {
    const over = vi.fn();
    const b = new Button({ label: 'Undo', disabled: true });
    b.addEventListener('pointerover', () => over());
    b.dispatchEvent({ type: 'pointerover' });
    expect(over).toHaveBeenCalledOnce();
  });

  it('disabling at runtime toggles the reason label and the action guard', () => {
    const onClick = vi.fn();
    const b = new Button({ label: 'Undo', onClick });
    b.dispatchEvent({ type: 'click' });
    expect(onClick).toHaveBeenCalledOnce();

    b.disabled = true;
    b.dispatchEvent({ type: 'click' });
    expect(onClick).toHaveBeenCalledOnce(); // still once — guarded

    b.disabled = false;
    b.dispatchEvent({ type: 'click' });
    expect(onClick).toHaveBeenCalledTimes(2);
  });
});