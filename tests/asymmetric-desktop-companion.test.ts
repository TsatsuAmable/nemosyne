// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AsymmetricDesktopCompanion } from '../src/vr/ui/AsymmetricDesktopCompanion.ts';
import { SharedAnnotationManager } from '../src/vr/interactions/SharedAnnotationManager.ts';
import { NetworkManager } from '../src/network/NetworkManager.ts';

describe('Sprint 10B.6: Asymmetric Desktop Companion View', () => {
  let container: HTMLDivElement;
  let companion: AsymmetricDesktopCompanion;
  let annotationManager: SharedAnnotationManager;
  let networkManager: NetworkManager;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    annotationManager = new SharedAnnotationManager();
    networkManager = new NetworkManager();
  });

  afterEach(() => {
    companion?.dispose();
    container?.remove();
  });

  it('renders spectator overlay UI in the DOM', () => {
    companion = new AsymmetricDesktopCompanion({ container, annotationManager, networkManager });
    expect(companion.element).toBeTruthy();
    expect(container.querySelector('#nemosyne-desktop-companion')).toBeTruthy();
    expect(companion.visible).toBe(true);
  });

  it('toggles visibility with setVisible and toggleVisible', () => {
    companion = new AsymmetricDesktopCompanion({ container });
    companion.setVisible(false);
    expect(companion.visible).toBe(false);
    expect(companion.element.style.display).toBe('none');

    companion.toggleVisible();
    expect(companion.visible).toBe(true);
    expect(companion.element.style.display).toBe('flex');
  });

  it('populates bookmarks and triggers jump on button click', () => {
    const onJump = vi.fn();
    annotationManager.addBookmark('Overview', [0, 1.6, 0], [0, 0, 0, 1]);

    companion = new AsymmetricDesktopCompanion({
      container,
      annotationManager,
      networkManager,
      onJumpToBookmark: onJump,
    });

    companion.render();

    const bmBtn = companion.element.querySelector('.nemosyne-bm-btn') as HTMLButtonElement | null;
    expect(bmBtn).toBeTruthy();
    expect(bmBtn?.textContent).toContain('Overview');

    bmBtn?.click();
    expect(onJump).toHaveBeenCalledWith(expect.objectContaining({ title: 'Overview' }));
  });

  it('sends spectator spatial notes into 3D VR space', () => {
    companion = new AsymmetricDesktopCompanion({ container, annotationManager, networkManager });

    const input = companion.element.querySelector('#nemosyne-spectator-note-input') as HTMLInputElement;
    const sendBtn = companion.element.querySelector('#nemosyne-spectator-send-btn') as HTMLButtonElement;

    input.value = 'Check outlier peak';
    sendBtn.click();

    expect(annotationManager.annotations.size).toBe(1);
    const annot = Array.from(annotationManager.annotations.values())[0];
    expect(annot.text).toBe('Check outlier peak');
    expect(annot.authorName).toBe('Desktop Spectator');
  });

  it('handles peer selection change for spectator camera following', () => {
    const onFollow = vi.fn();
    companion = new AsymmetricDesktopCompanion({ container, networkManager, onFollowPeer: onFollow });

    const select = companion.element.querySelector('#nemosyne-spectator-peer-select') as HTMLSelectElement;
    select.value = '';
    select.dispatchEvent(new Event('change'));

    expect(onFollow).toHaveBeenCalled();
  });
});
