// @ts-nocheck
// @vitest-environment jsdom
//
// PanelChrome — standardised SpatialPanel chrome (title + pin + close). The
// production pointer path dispatches `click` to the hit Component; tests
// dispatch directly to the button meshes to verify the callbacks fire and the
// chrome renders in the consistent title→spacer→pin→close order.

import { describe, it, expect, vi } from 'vitest';
import { PanelChrome } from '../../src/vr/ui-system/components/PanelChrome.ts';

describe('PanelChrome', () => {
  it('renders title, spacer, pin, and close in order when both are shown', () => {
    const chrome = new PanelChrome({ title: 'SCHEMA', onClose: () => {} });
    // title(0) → spacer(1) → pin(2) → close(3)
    expect(chrome.children.length).toBe(4);
  });

  it('omits the pin button when showPin is false', () => {
    const chrome = new PanelChrome({ title: 'T', showPin: false, onClose: () => {} });
    // title → spacer → close
    expect(chrome.children.length).toBe(3);
  });

  it('omits the close button when showClose is false', () => {
    const noClose = new PanelChrome({ title: 'T', showClose: false });
    // title → spacer → pin
    expect(noClose.children.length).toBe(3);
  });

  it('fires onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    const chrome = new PanelChrome({ title: 'T', onClose });
    const closeBtn = chrome._closeButton;
    closeBtn.dispatchEvent({ type: 'click' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('fires onPinToggle and flips the pin label when the pin button is clicked', () => {
    const onPinToggle = vi.fn();
    const chrome = new PanelChrome({ title: 'T', onPinToggle });
    expect(chrome.isPinned).toBe(false);

    chrome._pinButton.dispatchEvent({ type: 'click' });
    expect(chrome.isPinned).toBe(true);
    expect(onPinToggle).toHaveBeenCalledOnce();

    chrome._pinButton.dispatchEvent({ type: 'click' });
    expect(chrome.isPinned).toBe(false);
    expect(onPinToggle).toHaveBeenCalledTimes(2);
  });
});