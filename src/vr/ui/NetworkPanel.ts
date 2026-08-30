import * as THREE from 'three';
import { MovablePanel } from './MovablePanel.ts';
import { COLOR_TOKENS, cssHex } from '../ui-system/tokens.ts';
import type { AccessibilityOptions, MovablePanelOptions } from '../coordinators/types.ts';

interface NetworkPeer {
  peerId: string;
  name?: string;
}

interface NetworkStatus {
  roomId: string;
  connected: boolean;
  peers: NetworkPeer[];
  lastEvent: string | null;
}

interface NetworkPanelOptions extends MovablePanelOptions {
  roomId?: string;
}

/**
 * Lightweight in-VR panel showing collaboration network status: room ID,
 * connection state, and peer list. Intended for Quest debugging and quick
 * confirmation that a session is shared.
 */
export class NetworkPanel extends MovablePanel {
  status: NetworkStatus;

  constructor(cameraGroup: THREE.Group, options: NetworkPanelOptions = {}) {
    super(cameraGroup, {
      title: 'COLLABORATION',
      width: 720,
      height: 480,
      position: options.position ?? [-0.65, 1.55, -1.1],
      worldSize: options.worldSize ?? [0.72, 0.48],
      titleBarHeight: 44,
      tilt: 0.22,
      textScale: options.textScale ?? 1,
      highContrast: options.highContrast ?? false,
      colorblindMode: options.colorblindMode ?? 'none',
    });

    this.status = {
      roomId: options.roomId ?? '-',
      connected: false,
      peers: [],
      lastEvent: null,
    };

    this.render();
  }

  setStatus(status: Partial<NetworkStatus>): void {
    this.status = { ...this.status, ...status };
    this.render();
  }

  applyAccessibility(options: AccessibilityOptions): void {
    super.applyAccessibility(options);
    this.render();
  }

  renderContent(ctx: CanvasRenderingContext2D, _w: number, _contentH: number): void {
    const margin = 28;
    const lineHeight = 34;
    let y = margin;

    ctx.font = this._scaleFont('bold 20px monospace');
    ctx.fillStyle = this.highContrast ? cssHex(COLOR_TOKENS.text.primary) : cssHex(COLOR_TOKENS.interaction.focus);
    ctx.textAlign = 'left';
    ctx.fillText(`Room: ${this.status.roomId}`, margin, y + lineHeight / 2);
    y += lineHeight + 12;

    ctx.fillStyle = this.status.connected
      ? this.highContrast
        ? cssHex(COLOR_TOKENS.text.primary)
        : cssHex(COLOR_TOKENS.status.verified)
      : this.highContrast
        ? cssHex(COLOR_TOKENS.text.primary)
        : cssHex(COLOR_TOKENS.danger.destructive);
    ctx.fillText(
      `State: ${this.status.connected ? 'Connected' : 'Offline'}`,
      margin,
      y + lineHeight / 2
    );
    y += lineHeight + 18;

    ctx.fillStyle = this.highContrast ? cssHex(COLOR_TOKENS.text.primary) : cssHex(COLOR_TOKENS.text.secondary);
    ctx.fillText('Peers:', margin, y + lineHeight / 2);
    y += lineHeight;

    ctx.font = this._scaleFont('18px monospace');
    if (this.status.peers.length === 0) {
      ctx.fillStyle = this.highContrast ? cssHex(COLOR_TOKENS.text.muted) : cssHex(COLOR_TOKENS.text.muted);
      ctx.fillText('  No peers in room', margin, y + lineHeight / 2);
    } else {
      for (const peer of this.status.peers) {
        const label = peer.name
          ? `${peer.name} (${peer.peerId.slice(0, 6)})`
          : peer.peerId.slice(0, 12);
        ctx.fillStyle = this.highContrast ? cssHex(COLOR_TOKENS.text.primary) : cssHex(COLOR_TOKENS.text.secondary);
        ctx.fillText(`  • ${label}`, margin, y + lineHeight / 2);
        y += lineHeight;
      }
    }

    if (this.status.lastEvent) {
      y += 12;
      ctx.font = this._scaleFont('16px monospace');
      ctx.fillStyle = this.highContrast ? cssHex(COLOR_TOKENS.text.muted) : cssHex(COLOR_TOKENS.text.muted);
      ctx.fillText(`Last: ${this.status.lastEvent}`, margin, y + lineHeight / 2);
    }
  }
}
