import * as THREE from 'three';
import { MovablePanel } from './MovablePanel.ts';
import {
  allSampleDatasets,
  getDefaultEncodings,
  type SampleDatasetEntry,
} from '../../data/SampleDatasets.ts';
import { OPEN_DATA_SOURCES, type OpenDataSource } from '../../data/connectors/OpenDataSources.ts';
import type { MovablePanelOptions, VRMenuCallbacks, VisualOperation } from '../coordinators/types.ts';

/**
 * In-VR settings and dataset menu.
 *
 * Lets the user switch sample datasets and toggle scene features (e.g.
 * Farcaster portals) without leaving immersive mode.
 */

interface VRMenuOptions extends MovablePanelOptions, VRMenuCallbacks {
  portalsEnabled?: boolean;
}

type VRMenuButton =
  | {
      type: VisualOperation | 'reset';
      label: string;
      x: number;
      y: number;
      w: number;
      h: number;
    }
  | { type: 'toggle'; label: string; x: number; y: number; w: number; h: number }
  | { type: 'connectStream' | 'disconnectStream'; label: string; x: number; y: number; w: number; h: number }
  | { type: 'liveSource'; source: OpenDataSource; label: string; x: number; y: number; w: number; h: number }
  | { type: 'dataset'; entry: SampleDatasetEntry; label: string; x: number; y: number; w: number; h: number };

export class VRMenu extends MovablePanel {
  onLoadDataset?: VRMenuCallbacks['onLoadDataset'];
  onTogglePortals?: VRMenuCallbacks['onTogglePortals'];
  onConnectStream?: VRMenuCallbacks['onConnectStream'];
  onDisconnectStream?: VRMenuCallbacks['onDisconnectStream'];
  onSelectLiveSource?: VRMenuCallbacks['onSelectLiveSource'];
  onFilter?: VRMenuCallbacks['onFilter'];
  onSort?: VRMenuCallbacks['onSort'];
  onAggregate?: VRMenuCallbacks['onAggregate'];
  onCluster?: VRMenuCallbacks['onCluster'];
  onHierarchicalCluster?: VRMenuCallbacks['onHierarchicalCluster'];
  onDensityCluster?: VRMenuCallbacks['onDensityCluster'];
  onAnomaly?: VRMenuCallbacks['onAnomaly'];
  onTimeSlice?: VRMenuCallbacks['onTimeSlice'];
  onReset?: VRMenuCallbacks['onReset'];

  portalsEnabled: boolean;
  liveConnected: boolean;
  buttons: VRMenuButton[];
  private _clickCooldownMs: number;
  private _lastClickAt: number;

  constructor(cameraGroup: THREE.Group, options: VRMenuOptions = {}) {
    const {
      onLoadDataset,
      onTogglePortals,
      onConnectStream,
      onDisconnectStream,
      onSelectLiveSource,
      onFilter,
      onSort,
      onAggregate,
      onCluster,
      onHierarchicalCluster,
      onDensityCluster,
      onAnomaly,
      onTimeSlice,
      onReset,
      portalsEnabled = true,
    } = options;

    super(cameraGroup, {
      title: 'VR MENU',
      width: 800,
      height: 1200,
      position: [-0.9, 1.5, -1.1],
      worldSize: [0.95, 1.45],
      titleBarHeight: 44,
      contentPadding: 18,
    });

    this.onLoadDataset = onLoadDataset;
    this.onTogglePortals = onTogglePortals;
    this.onConnectStream = onConnectStream;
    this.onDisconnectStream = onDisconnectStream;
    this.onSelectLiveSource = onSelectLiveSource;
    this.onFilter = onFilter;
    this.onSort = onSort;
    this.onAggregate = onAggregate;
    this.onCluster = onCluster;
    this.onHierarchicalCluster = onHierarchicalCluster;
    this.onDensityCluster = onDensityCluster;
    this.onAnomaly = onAnomaly;
    this.onTimeSlice = onTimeSlice;
    this.onReset = onReset;
    this.portalsEnabled = portalsEnabled;
    this.liveConnected = false;

    this.buttons = [];
    this._registerButtons();

    this._clickCooldownMs = 350;
    this._lastClickAt = -this._clickCooldownMs;

    this.render();
  }

  setLiveConnected(connected: boolean): void {
    this.liveConnected = connected;
    this.render();
  }

  setPortalsEnabled(enabled: boolean): void {
    this.portalsEnabled = enabled;
    this.render();
  }

  _registerButtons(): void {
    this.buttons = [];
    const pad = 18;
    const startY = 70 + pad;
    const rowH = 46;

    // Data operation buttons.
    const ops: { type: VisualOperation | 'reset'; label: string }[] = [
      { type: 'filter', label: 'Filter: value > median' },
      { type: 'sort', label: 'Sort by value' },
      { type: 'aggregate', label: 'Aggregate by category' },
      { type: 'cluster', label: 'Cluster (k=3)' },
      { type: 'hierarchical', label: 'Hierarchical cluster' },
      { type: 'density', label: 'Density cluster (DBSCAN)' },
      { type: 'anomaly', label: 'Highlight outliers' },
      { type: 'timeSlice', label: 'Time slice: last 50%' },
      { type: 'reset', label: 'Reset transforms' },
    ];
    ops.forEach((op, idx) => {
      this.buttons.push({
        type: op.type,
        label: op.label,
        x: 40,
        y: startY + idx * (rowH + 2),
        w: 720,
        h: rowH,
      });
    });

    // Portal toggle.
    const portalY = startY + ops.length * (rowH + 2) + 24;
    this.buttons.push({
      type: 'toggle',
      label: 'Farcaster Portals',
      x: 40,
      y: portalY,
      w: 720,
      h: 44,
    });

    // Live stream controls.
    const liveY = portalY + 44 + 34;
    this.buttons.push({
      type: 'connectStream',
      label: 'Connect Live Stream',
      x: 40,
      y: liveY,
      w: 340,
      h: 44,
    });
    this.buttons.push({
      type: 'disconnectStream',
      label: 'Disconnect Stream',
      x: 420,
      y: liveY,
      w: 340,
      h: 44,
    });

    // Open live data sources.
    const sourceY = liveY + 44 + 44;
    OPEN_DATA_SOURCES.forEach((source, idx) => {
      this.buttons.push({
        type: 'liveSource',
        source,
        label: source.label,
        x: 40,
        y: sourceY + idx * (rowH + 2),
        w: 720,
        h: rowH,
      });
    });

    // Dataset buttons.
    const datasetY = sourceY + OPEN_DATA_SOURCES.length * (rowH + 2) + 44;
    allSampleDatasets.forEach((entry, idx) => {
      this.buttons.push({
        type: 'dataset',
        entry,
        label: entry.label,
        x: 40,
        y: datasetY + idx * rowH,
        w: 720,
        h: 40,
      });
    });
  }

  renderContent(ctx: CanvasRenderingContext2D, _w: number, _contentH: number): void {
    ctx.font = 'bold 20px monospace';
    ctx.fillStyle = '#00ffcc';
    ctx.textAlign = 'left';
    ctx.fillText('OPERATIONS', 40, 38);
    ctx.fillText('SETTINGS', 40, 410);
    ctx.fillText('LIVE STREAM', 40, 486);

    // Connection status pill under the live-stream label.
    const statusText = this.liveConnected ? 'CONNECTED' : 'OFFLINE';
    const statusColor = this.liveConnected ? '#00ff66' : '#ff5577';
    ctx.font = 'bold 14px monospace';
    ctx.fillStyle = statusColor;
    ctx.fillText(statusText, 190, 136);

    const dataSetLabelY = this._datasetLabelY();
    ctx.font = 'bold 20px monospace';
    ctx.fillText('DATASETS', 40, dataSetLabelY);

    ctx.font = 'bold 18px monospace';
    for (const btn of this.buttons) {
      const isToggleOn = btn.type === 'toggle' && this.portalsEnabled;
      const isConnectOn = btn.type === 'connectStream' && this.liveConnected;
      const isDisconnectOn = btn.type === 'disconnectStream' && !this.liveConnected;
      const bg =
        isToggleOn || isConnectOn
          ? 'rgba(0, 255, 204, 0.25)'
          : isDisconnectOn
            ? 'rgba(255, 85, 119, 0.25)'
            : 'rgba(0, 60, 80, 0.7)';
      const stroke = isToggleOn || isConnectOn ? '#00ffcc' : '#88ccff';

      ctx.fillStyle = bg;
      ctx.fillRect(btn.x, btn.y, btn.w, btn.h);
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.strokeRect(btn.x, btn.y, btn.w, btn.h);

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      let text = btn.label;
      if (btn.type === 'toggle') {
        text += ` : ${this.portalsEnabled ? 'ON' : 'OFF'}`;
      }
      ctx.fillText(text, btn.x + 16, btn.y + 27, btn.w - 32);
    }
  }

  handleContentClick(raycaster: THREE.Raycaster): boolean {
    const hits = raycaster.intersectObject(this.mesh, false);
    if (hits.length === 0) return false;

    const uv = hits[0].uv;
    if (!uv) return false;
    const canvasX = uv.x * this.width;
    const canvasY = (1 - uv.y) * this.height;

    for (const btn of this.buttons) {
      if (
        canvasX >= btn.x &&
        canvasX <= btn.x + btn.w &&
        canvasY >= btn.y &&
        canvasY <= btn.y + btn.h
      ) {
        const now = performance.now();
        if (now - this._lastClickAt < this._clickCooldownMs) {
          return true;
        }
        this._lastClickAt = now;

        if (btn.type === 'toggle') {
          this.portalsEnabled = !this.portalsEnabled;
          this.onTogglePortals?.(this.portalsEnabled);
          this.render();
          return true;
        }
        if (btn.type === 'dataset') {
          this.onLoadDataset?.({
            name: btn.entry.label,
            topology: btn.entry.topology,
            dataset: btn.entry.dataset,
            maxDepth: btn.entry.depth,
            encodings: getDefaultEncodings(btn.entry),
          });
          return true;
        }

        if (btn.type === 'connectStream') {
          this.onConnectStream?.();
          return true;
        }

        if (btn.type === 'disconnectStream') {
          this.onDisconnectStream?.();
          return true;
        }

        if (btn.type === 'liveSource') {
          this.onSelectLiveSource?.(btn.source.key);
          return true;
        }

        if (btn.type === 'filter') {
          this.onFilter?.();
          return true;
        }
        if (btn.type === 'sort') {
          this.onSort?.();
          return true;
        }
        if (btn.type === 'aggregate') {
          this.onAggregate?.();
          return true;
        }
        if (btn.type === 'cluster') {
          this.onCluster?.();
          return true;
        }
        if (btn.type === 'hierarchical') {
          this.onHierarchicalCluster?.();
          return true;
        }
        if (btn.type === 'density') {
          this.onDensityCluster?.();
          return true;
        }
        if (btn.type === 'anomaly') {
          this.onAnomaly?.();
          return true;
        }
        if (btn.type === 'timeSlice') {
          this.onTimeSlice?.();
          return true;
        }
        if (btn.type === 'reset') {
          this.onReset?.();
          return true;
        }
      }
    }
    return false;
  }

  _datasetLabelY(): number {
    const rowH = 46;
    const pad = 18;
    const startY = 70 + pad;
    const opsCount = 9;
    const portalY = startY + opsCount * (rowH + 2) + 24;
    const liveY = portalY + 44 + 34;
    const sourceY = liveY + 44 + 44;
    return sourceY + OPEN_DATA_SOURCES.length * (rowH + 2) + 14;
  }
}
