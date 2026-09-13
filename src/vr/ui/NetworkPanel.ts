import * as THREE from 'three';
import { Text } from '@pmndrs/uikit';
import { SpatialPanel } from '../ui-system/SpatialPanel.ts';
import { COLOR_TOKENS, SPACING_TOKENS } from '../ui-system/tokens.ts';
import { getTheme } from '../ui-system/theme.ts';
import { remapColor } from '../../utils/Accessibility.ts';
import type { AccessibilityOptions } from '../coordinators/types.ts';

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

export interface NetworkPanelOptions {
  roomId?: string;
  position?: [number, number, number];
  worldSize?: [number, number];
  textScale?: number;
  highContrast?: boolean;
  colorblindMode?: string;
}

const PANEL_WIDTH = 720;
const PANEL_HEIGHT = 480;
const BASE_FONT_SIZE = 20;

/**
 * Collaboration status surface.
 *
 * UXR1 migrates this passive diagnostic surface from the legacy
 * CanvasTexture/MovablePanel renderer to SpatialPanel + UIKit. It remains
 * presentation-only: collaboration state continues to be owned by the
 * collaboration coordinator and semantic commands remain outside UIKit.
 */
export class NetworkPanel extends SpatialPanel {
  readonly title = 'COLLABORATION';
  readonly defaultPosition: THREE.Vector3;
  readonly tilt = 0.22;
  isMinimized = false;
  onHide: (() => void) | null = null;
  onDragDelta: ((delta: THREE.Vector3) => void) | null = null;
  onDragEnd: (() => void) | null = null;

  status: NetworkStatus;

  private readonly _roomText: Text;
  private readonly _stateText: Text;
  private readonly _peersText: Text;
  private readonly _lastEventText: Text;
  private _textScale: number;
  private _highContrast: boolean;
  private _colorblindMode: string;

  constructor(analystAnchor: THREE.Object3D, options: NetworkPanelOptions = {}) {
    const highContrast = options.highContrast ?? false;
    const theme = getTheme(highContrast);
    super(
      {
        width: PANEL_WIDTH,
        height: PANEL_HEIGHT,
        flexDirection: 'column',
        gap: SPACING_TOKENS.grid.x8,
        padding: SPACING_TOKENS.grid.x16,
        backgroundColor: Number(theme.backgroundColor),
        borderColor: Number(theme.borderColor),
        borderWidth: 2,
        borderRadius: 8,
      },
      analystAnchor,
      null
    );

    this.name = 'network-panel';
    this._textScale = options.textScale ?? 1;
    this._highContrast = highContrast;
    this._colorblindMode = options.colorblindMode ?? 'none';
    this.status = {
      roomId: options.roomId ?? '-',
      connected: false,
      peers: [],
      lastEvent: null,
    };

    const worldWidth = options.worldSize?.[0] ?? 0.72;
    this.scale.setScalar(worldWidth / PANEL_WIDTH);
    this.defaultPosition = new THREE.Vector3(...(options.position ?? [-0.65, 1.55, -1.1]));
    this.position.copy(this.defaultPosition);

    this._roomText = this._makeText('bold');
    this._stateText = this._makeText('bold');
    this._peersText = this._makeText('medium');
    this._lastEventText = this._makeText('medium', 16);
    this.add(this._roomText, this._stateText, this._peersText, this._lastEventText);

    this._syncPresentation();
  }

  setStatus(status: Partial<NetworkStatus>): void {
    this.status = { ...this.status, ...status };
    this._syncPresentation();
  }

  applyAccessibility(options: AccessibilityOptions): void {
    this._textScale = options.textScale;
    this._highContrast = options.highContrast;
    this._colorblindMode = String(options.colorblindMode);
    const theme = getTheme(this._highContrast);
    this.setProperties({
      backgroundColor: Number(theme.backgroundColor),
      borderColor: Number(theme.borderColor),
    });
    this._syncPresentation();
  }

  show(): void {
    this.visible = true;
    this.isMinimized = false;
  }

  hide(): void {
    const changed = this.visible;
    this.visible = false;
    if (changed) this.onHide?.();
  }

  render(): void {
    this._syncPresentation();
  }

  update(delta = 0): void {
    super.update(delta);
  }

  private _makeText(fontWeight: 'bold' | 'medium', fontSize = BASE_FONT_SIZE): Text {
    return new Text({
      text: '',
      fontSize: fontSize * this._textScale,
      fontWeight,
      color: Number(getTheme(this._highContrast).textPrimary),
    });
  }

  private _syncPresentation(): void {
    const theme = getTheme(this._highContrast);
    const primary = Number(theme.textPrimary);
    const muted = Number(theme.textMuted);
    const focus = this._highContrast
      ? primary
      : (remapColor(COLOR_TOKENS.interaction.focus, this._colorblindMode) as number);
    const stateColor = this._highContrast
      ? primary
      : this.status.connected
        ? Number(COLOR_TOKENS.status.verified)
        : Number(COLOR_TOKENS.danger.destructive);

    this._roomText.setProperties({
      text: 'Room: ' + this.status.roomId,
      fontSize: BASE_FONT_SIZE * this._textScale,
      color: focus,
    });
    this._stateText.setProperties({
      text: 'State: ' + (this.status.connected ? 'Connected' : 'Offline'),
      fontSize: BASE_FONT_SIZE * this._textScale,
      color: stateColor,
    });

    const peers =
      this.status.peers.length === 0
        ? 'Peers:\n  No peers in room'
        : 'Peers:\n' +
          this.status.peers
            .map((peer) =>
              peer.name
                ? '  • ' + peer.name + ' (' + peer.peerId.slice(0, 6) + ')'
                : '  • ' + peer.peerId.slice(0, 12)
            )
            .join('\n');
    this._peersText.setProperties({
      text: peers,
      fontSize: 18 * this._textScale,
      color: primary,
    });
    this._lastEventText.setProperties({
      text: this.status.lastEvent ? 'Last: ' + this.status.lastEvent : '',
      fontSize: 16 * this._textScale,
      color: muted,
    });
  }
}
