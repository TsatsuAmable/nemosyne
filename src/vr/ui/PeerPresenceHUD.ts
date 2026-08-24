import * as THREE from 'three';

export interface PeerInfo {
  peerId: string;
  name?: string;
  state?: {
    position?: { x?: number; y?: number; z?: number };
    [key: string]: unknown;
  };
}

export interface PeerPresenceHUDOptions {
  followAnchor?: THREE.Object3D;
  getPeers?: () => PeerInfo[];
  getLocalPeerId?: () => string | null;
  position?: [number, number, number];
  size?: number;
  resolution?: number;
  tilt?: number;
}

/**
 * Compact peripheral HUD showing remote collaborators.
 *
 * The HUD is anchored to the analyst so it stays in the user's peripheral
 * vision. Each connected peer is shown as a colored dot + name. If the peer
 * broadcasts a position, a small arrow indicates their direction relative to
 * the local user's forward vector.
 *
 * The panel is intentionally small and non-interactive so it does not compete
 * with the data palace for attention.
 */
export class PeerPresenceHUD {
  cameraGroup: THREE.Group;
  followAnchor: THREE.Object3D;
  getPeers: () => PeerInfo[];
  getLocalPeerId: () => string | null;
  position: THREE.Vector3;
  size: number;
  resolution: number;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  material: THREE.MeshBasicMaterial;
  mesh: THREE.Mesh;

  _peerHash: string;
  private _colors: string[];
  private _camPos: THREE.Vector3;
  private _camDir: THREE.Vector3;
  private _peerPos: THREE.Vector3;
  /** User preference set via setEnabled(); preserved across peer-driven suppression. */
  private _userEnabled = true;
  private _disposed = false;

  constructor(cameraGroup: THREE.Group, options: PeerPresenceHUDOptions = {}) {
    this.cameraGroup = cameraGroup;
    this.followAnchor = options.followAnchor ?? cameraGroup;
    this.getPeers = options.getPeers ?? (() => []);
    this.getLocalPeerId = options.getLocalPeerId ?? (() => null);
    this.position = new THREE.Vector3(...(options.position ?? [-0.85, 1.35, -0.7]));
    this.size = options.size ?? 0.5;
    this.resolution = options.resolution ?? 512;

    this.canvas = document.createElement('canvas');
    this.canvas.width = this.resolution;
    this.canvas.height = this.resolution;
    this.ctx = this.canvas.getContext('2d') ?? this._createMockContext();

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;

    const geom = new THREE.PlaneGeometry(this.size, this.size);
    this.material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(geom, this.material);
    this.mesh.position.copy(this.position);
    this.mesh.rotation.x = -(options.tilt ?? 0.25);
    if (this.followAnchor) this.followAnchor.add(this.mesh);

    this._peerHash = '';
    this._colors = ['#00ffcc', '#ff00cc', '#ccff00', '#00ccff', '#ffcc00', '#cc00ff'];
    this._camPos = new THREE.Vector3();
    this._camDir = new THREE.Vector3();
    this._peerPos = new THREE.Vector3();
  }

  setEnabled(enabled: boolean): void {
    this._userEnabled = enabled;
    // Peer-driven suppression is resolved in update(); setEnabled only records
    // the user preference so a disabled HUD never performs getPeers() work.
    this.mesh.visible = enabled;
  }

  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;
    this.mesh.parent?.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
    this.canvas.width = 1;
    this.canvas.height = 1;
  }

  update(): void {
    // Respect user preference; when disabled there is nothing to draw.
    if (!this._userEnabled) return;
    const peers = this.getPeers();
    // Suppress rendering entirely when no peers are connected — avoids a
    // permanent empty-state panel and saves the per-frame canvas/draw work.
    if (peers.length === 0) {
      this.mesh.visible = false;
      this._peerHash = '';
      return;
    }
    this.mesh.visible = true;

    const localId = this.getLocalPeerId();
    const hash = peers.map((p) => `${p.peerId}:${p.name}`).join('|');
    // Also redraw if any peer position changed; checking every frame is cheap
    // because the canvas is small.
    const positionHash = peers
      .map((p) => {
        const pos = p.state?.position;
        return pos ? `${pos.x?.toFixed(2) ?? '-'},${pos.z?.toFixed(2) ?? '-'}` : '-';
      })
      .join('|');
    const nextHash = `${hash}::${positionHash}`;
    if (nextHash === this._peerHash) return;
    this._peerHash = nextHash;

    this._draw(peers, localId);
    this.texture.needsUpdate = true;
  }

  private _draw(peers: PeerInfo[], localId: string | null): void {
    const ctx = this.ctx;
    const r = this.resolution;

    ctx.clearRect(0, 0, r, r);
    ctx.fillStyle = 'rgba(4, 12, 24, 0.85)';
    ctx.fillRect(0, 0, r, r);

    ctx.strokeStyle = '#00ffcc';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, r - 4, r - 4);

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.floor(r * 0.06)}px monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('PEERS', r * 0.05, r * 0.04);

    if (peers.length === 0) {
      ctx.font = `${Math.floor(r * 0.05)}px monospace`;
      ctx.fillStyle = '#88aabb';
      ctx.textAlign = 'center';
      ctx.fillText('No peers connected', r / 2, r / 2);
      return;
    }

    this.cameraGroup.getWorldPosition(this._camPos);
    this.cameraGroup.getWorldDirection(this._camDir);
    const forwardAngle = Math.atan2(this._camDir.z, this._camDir.x);

    const rowHeight = r * 0.12;
    const startY = r * 0.18;
    const dotRadius = r * 0.035;

    for (let i = 0; i < peers.length; i++) {
      const peer = peers[i];
      const color = this._colors[i % this._colors.length];
      const y = startY + i * rowHeight;

      // Direction arrow if the peer broadcast a position.
      const pos = peer.state?.position;
      if (pos?.x != null && pos?.z != null) {
        this._peerPos.set(pos.x, pos.y ?? 1.6, pos.z);
        const dx = this._peerPos.x - this._camPos.x;
        const dz = this._peerPos.z - this._camPos.z;
        const peerAngle = Math.atan2(dz, dx);
        const relAngle = peerAngle - forwardAngle;
        const arrowLen = r * 0.05;
        const ax = r * 0.85 + Math.cos(relAngle) * arrowLen;
        const ay = y + Math.sin(relAngle) * arrowLen;

        ctx.beginPath();
        ctx.moveTo(r * 0.85, y);
        ctx.lineTo(ax, ay);
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      // Colored dot.
      ctx.beginPath();
      ctx.arc(r * 0.12, y, dotRadius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Name.
      ctx.fillStyle = '#ffffff';
      ctx.font = `${Math.floor(r * 0.05)}px monospace`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const isLocal = peer.peerId === localId;
      ctx.fillText(`${isLocal ? 'You' : (peer.name ?? 'Peer').slice(0, 10)}`, r * 0.22, y);
    }

    // Peer count pill.
    ctx.fillStyle = 'rgba(0, 255, 204, 0.2)';
    ctx.fillRect(r * 0.68, r * 0.04, r * 0.25, r * 0.08);
    ctx.fillStyle = '#00ffcc';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.floor(r * 0.05)}px monospace`;
    ctx.fillText(String(peers.length), r * 0.805, r * 0.08);
  }

  private _createMockContext(): CanvasRenderingContext2D {
    const noOp = () => {};
    return {
      clearRect: noOp,
      fillRect: noOp,
      strokeRect: noOp,
      fillText: noOp,
      arc: noOp,
      moveTo: noOp,
      lineTo: noOp,
      beginPath: noOp,
      stroke: noOp,
      fill: noOp,
      measureText: () => ({ width: 0 }),
      set fillStyle(_: unknown) {},
      set strokeStyle(_: unknown) {},
      set lineWidth(_: unknown) {},
      set font(_: unknown) {},
      set textAlign(_: unknown) {},
      set textBaseline(_: unknown) {},
    } as unknown as CanvasRenderingContext2D;
  }
}
