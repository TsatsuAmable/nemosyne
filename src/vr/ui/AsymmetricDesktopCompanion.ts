/**
 * Asymmetric Desktop Companion View (Sprint 10B.6).
 *
 * Provides a 2D spectator UI overlay for desktop stakeholders observing a live WebXR analysis session.
 * Features view-follow camera syncing, bookmark quick-jumping, peer presence metrics, and spectator text comments.
 */

import type { NetworkManager } from '../../network/NetworkManager.ts';
import type { SharedAnnotationManager, SpatialBookmark } from '../interactions/SharedAnnotationManager.ts';

export interface AsymmetricDesktopCompanionOptions {
  container?: HTMLElement;
  networkManager?: NetworkManager | null;
  annotationManager?: SharedAnnotationManager | null;
  onFollowPeer?: (peerId: string | null) => void;
  onJumpToBookmark?: (bookmark: SpatialBookmark) => void;
}

export class AsymmetricDesktopCompanion {
  container: HTMLElement;
  networkManager: NetworkManager | null;
  annotationManager: SharedAnnotationManager | null;
  onFollowPeer?: (peerId: string | null) => void;
  onJumpToBookmark?: (bookmark: SpatialBookmark) => void;

  element: HTMLDivElement;
  isFollowingVR: boolean = true;
  followingPeerId: string | null = null;
  private _visible = true;

  constructor({
    container = document.body,
    networkManager = null,
    annotationManager = null,
    onFollowPeer,
    onJumpToBookmark,
  }: AsymmetricDesktopCompanionOptions = {}) {
    this.container = container;
    this.networkManager = networkManager;
    this.annotationManager = annotationManager;
    this.onFollowPeer = onFollowPeer;
    this.onJumpToBookmark = onJumpToBookmark;

    this.element = this._createDOM();
    this.container.appendChild(this.element);

    if (this.networkManager) {
      this._wireNetwork();
    }
  }

  get visible(): boolean {
    return this._visible;
  }

  setVisible(visible: boolean): void {
    this._visible = visible;
    this.element.style.display = visible ? 'flex' : 'none';
  }

  toggleVisible(): boolean {
    this.setVisible(!this._visible);
    return this._visible;
  }

  /**
   * Updates spectator status display, peer list, and bookmark items.
   */
  render(): void {
    const peers = this.networkManager?.room?.getPeerIds?.() ?? [];

    // Peer Select Options
    const peerSelect = this.element.querySelector('#nemosyne-spectator-peer-select') as HTMLSelectElement | null;
    if (peerSelect) {
      const current = peerSelect.value;
      peerSelect.innerHTML = `<option value="">Follow Primary Analyst (Default)</option>`;
      peers.forEach((peerId) => {
        const peer = this.networkManager?.room?.peers?.get(peerId);
        const name = peer?.name || peerId;
        const opt = document.createElement('option');
        opt.value = peerId;
        opt.textContent = `Follow ${name}`;
        if (peerId === current) opt.selected = true;
        peerSelect.appendChild(opt);
      });
    }

    // Bookmark List Options
    const bmContainer = this.element.querySelector('#nemosyne-spectator-bookmarks') as HTMLDivElement | null;
    if (bmContainer && this.annotationManager) {
      bmContainer.innerHTML = '';
      const bms = Array.from(this.annotationManager.bookmarks.values());
      if (bms.length === 0) {
        bmContainer.innerHTML = `<span style="opacity: 0.6; font-size: 12px;">No 3D bookmarks saved</span>`;
      } else {
        bms.forEach((bm) => {
          const btn = document.createElement('button');
          btn.className = 'nemosyne-bm-btn';
          btn.style.cssText =
            'background: rgba(40,50,70,0.8); border: 1px solid #4466aa; color: #fff; border-radius: 4px; padding: 4px 8px; margin: 2px; cursor: pointer; font-size: 12px;';
          btn.textContent = `📍 ${bm.title}`;
          btn.addEventListener('click', () => {
            this.onJumpToBookmark?.(bm);
          });
          bmContainer.appendChild(btn);
        });
      }
    }
  }

  private _createDOM(): HTMLDivElement {
    const root = document.createElement('div');
    root.id = 'nemosyne-desktop-companion';
    root.style.cssText = `
      position: absolute;
      top: 16px;
      right: 16px;
      width: 320px;
      background: rgba(12, 18, 28, 0.92);
      border: 1px solid rgba(80, 130, 220, 0.4);
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.6);
      color: #e0e8ff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 14px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 10px;
      backdrop-filter: blur(8px);
    `;

    root.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 6px;">
        <span style="font-weight: 600; font-size: 14px; color: #60a5fa;">👁️ Desktop Spectator Companion</span>
        <button id="nemosyne-companion-toggle" style="background: none; border: none; color: #a0aec0; cursor: pointer; font-size: 16px;">✕</button>
      </div>

      <div style="display: flex; flex-direction: column; gap: 4px;">
        <label style="font-size: 12px; color: #94a3b8;">Spectator Camera Target:</label>
        <select id="nemosyne-spectator-peer-select" style="background: #1e293b; color: #f8fafc; border: 1px solid #475569; border-radius: 6px; padding: 6px; font-size: 12px;">
          <option value="">Follow Primary Analyst (Default)</option>
        </select>
      </div>

      <div style="display: flex; flex-direction: column; gap: 4px;">
        <label style="font-size: 12px; color: #94a3b8;">Spatial Bookmarks:</label>
        <div id="nemosyne-spectator-bookmarks" style="display: flex; flex-wrap: wrap; gap: 4px; max-height: 80px; overflow-y: auto;">
          <span style="opacity: 0.6; font-size: 12px;">No 3D bookmarks saved</span>
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 4px;">
        <label style="font-size: 12px; color: #94a3b8;">Send Note to VR Space:</label>
        <div style="display: flex; gap: 6px;">
          <input id="nemosyne-spectator-note-input" type="text" placeholder="Type spatial note..." style="flex: 1; background: #1e293b; color: #fff; border: 1px solid #475569; border-radius: 6px; padding: 6px; font-size: 12px;">
          <button id="nemosyne-spectator-send-btn" style="background: #2563eb; color: #fff; border: none; border-radius: 6px; padding: 6px 12px; font-weight: 600; cursor: pointer; font-size: 12px;">Send</button>
        </div>
      </div>
    `;

    // Toggle button
    root.querySelector('#nemosyne-companion-toggle')?.addEventListener('click', () => {
      this.setVisible(false);
    });

    // Peer Select change
    root.querySelector('#nemosyne-spectator-peer-select')?.addEventListener('change', (e) => {
      const peerId = (e.target as HTMLSelectElement).value || null;
      this.followingPeerId = peerId;
      this.onFollowPeer?.(peerId);
    });

    // Send Note button
    root.querySelector('#nemosyne-spectator-send-btn')?.addEventListener('click', () => {
      this._sendSpectatorNote();
    });

    // Send on Enter key
    root.querySelector('#nemosyne-spectator-note-input')?.addEventListener('keydown', (e: Event) => {
      if ((e as KeyboardEvent).key === 'Enter') {
        this._sendSpectatorNote();
      }
    });

    return root;
  }

  private _sendSpectatorNote(): void {
    const input = this.element.querySelector('#nemosyne-spectator-note-input') as HTMLInputElement | null;
    if (!input || !input.value.trim()) return;

    const note = input.value.trim();
    input.value = '';

    if (this.annotationManager) {
      this.annotationManager.addAnnotation([0, 1.6, -1], note, 'desktop-spectator', 'Desktop Spectator', 0x38bdf8);
    }
  }

  private _wireNetwork(): void {
    if (!this.networkManager) return;
    this.networkManager.addEventListener('peerJoined', () => this.render());
    this.networkManager.addEventListener('peerLeft', () => this.render());
  }

  dispose(): void {
    this.element.remove();
  }
}
