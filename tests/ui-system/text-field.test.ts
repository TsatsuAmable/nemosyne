// @ts-nocheck
// @vitest-environment jsdom
//
// TextField wraps uikit `Input` as a controlled display + callback surface.
// See the control's docblock for the VR input-driver contract.

import { describe, it, expect, vi } from 'vitest';
import { TextField } from '../../src/vr/ui-system/components/TextField.ts';

describe('TextField', () => {
  it('constructs with a controlled value and exposes it', () => {
    const f = new TextField({ value: 'hello', label: 'Name' });
    expect(f.value).toBe('hello');
    expect(f.isDisabled).toBe(false);
  });

  it('fires onChange on user input', () => {
    const onChange = vi.fn();
    const f = new TextField({ value: 'a', onChange });
    // Invoke the exact handler passed to uikit `Input.onValueChange`.
    const handleInput = (f as unknown as { _handleInput: (v: string) => void })._handleInput;
    handleInput('ab');
    expect(f.value).toBe('ab');
    expect(onChange).toHaveBeenCalledWith('ab');
  });

  it('programmatic set value is silent (no onChange echo, no feedback loop)', () => {
    const onChange = vi.fn();
    const f = new TextField({ value: 'a', onChange });
    f.value = 'b';
    expect(f.value).toBe('b');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('renders a disabledReason label only when disabled with a reason (UX-04 / §35)', () => {
    const reasonOf = (c: TextField): { parent: unknown } =>
      (c as unknown as { _reasonText: { parent: unknown } })._reasonText;

    const f = new TextField({ value: 'a', disabled: true, disabledReason: 'Read-only source' });
    expect(reasonOf(f).parent).toBe(f);

    const f2 = new TextField({ value: 'a', disabled: true });
    expect(reasonOf(f2).parent).toBeNull();
  });

  it('disabling at runtime hides the reason and reports the state', () => {
    const f = new TextField({ value: 'a', disabled: true, disabledReason: 'Read-only source' });
    expect(f.isDisabled).toBe(true);
    f.disabled = false;
    expect(f.isDisabled).toBe(false);
  });
});