import * as THREE from 'three';
import { MovablePanel } from './MovablePanel.ts';
import {
  allSampleDatasets,
  getDefaultEncodings,
  type SampleDatasetEntry,
} from '../../data/SampleDatasets.ts';
import { OPEN_DATA_SOURCES, type OpenDataSource } from '../../data/connectors/OpenDataSources.ts';
import {
  xrDatasetLibraryBridge,
  type XRDatasetLibraryEntry,
} from '../../data/catalog/XRDatasetLibraryBridge.ts';
import { COLOR_TOKENS, cssHex } from '../ui-system/tokens.ts';
import type { MovablePanelOptions, VRMenuCallbacks, VisualOperation } from '../coordinators/types.ts';

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
  | {
      type: 'connectStream' | 'disconnectStream';
      label: string;
      x: number;
      y: number;
      w: number;
      h: number;
    }
  | {
      type: 'liveSource';
      source: OpenDataSource;
      label: string;
      x: number;
      y: number;
      w: number;
      h: number;
    }
  | {
      type: 'dataset';
      entry: SampleDatasetEntry;
      label: string;
      x: number;
      y: number;
      w: number;
      h: number;
    }
  | {
      type: 'libraryRefresh';
      label: string;
      x: number;
      y: number;
      w: number;
      h: number;
    }
  | {
      type: 'libraryDataset';
      datasetId: string;
      tierId: string;
      label: string;
      x: number;
      y: number;
      w: number;
      h: number;
    };

function rgba(token: number, alpha: number): string {
  const r = (token >> 16) & 0xff;
  const g = (token >> 8) & 0xff;
  const b = token & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

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
  onCompare?: VRMenuCallbacks['onCompare'];
  onReset?: VRMenuCallbacks['onReset'];

  portalsEnabled: boolean;
  liveConnected: boolean;
  buttons: VRMenuButton[];
  libraryEntries: XRDatasetLibraryEntry[] = [];
  libraryStatus = 'Refresh to browse approved datasets';
  private _clickCooldownMs: number;
  private _lastClickAt: number;
  private _libraryBusy = false;

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
      onCompare,
      onReset,
      portalsEnabled = true,
    } = options;

    super(cameraGroup, {
      title: 'DATA & TOOLS',
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
    this.onCompare = onCompare;
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

  async refreshDatasetLibrary(): Promise<void> {
    if (this._libraryBusy) return;
    this._libraryBusy = true;
    this.libraryStatus = 'Refreshing dataset library…';
    this.render();
    try {
      this.libraryEntries = await xrDatasetLibraryBridge.listDatasets();
      this.libraryStatus = this.libraryEntries.length
        ? `${this.libraryEntries.length} approved dataset${this.libraryEntries.length === 1 ? '' : 's'} available`
        : 'No approved datasets are currently available';
      this._registerButtons();
    } catch (error: unknown) {
      this.libraryEntries = [];
      this.libraryStatus = error instanceof Error ? error.message : String(error);
      this._registerButtons();
    } finally {
      this._libraryBusy = false;
      this.render();
    }
  }

  async openLibraryDataset(datasetId: string, tierId: string): Promise<void> {
    if (this._libraryBusy) return;
    this._libraryBusy = true;
    this.libraryStatus = 'Checking and opening dataset…';
    this.render();
    try {
      await xrDatasetLibraryBridge.openDataset(datasetId, tierId);
      const entry = this.libraryEntries.find((candidate) => candidate.id === datasetId);
      this.libraryStatus = entry ? `Opened ${entry.label}` : 'Dataset opened';
    } catch (error: unknown) {
      this.libraryStatus = `Could not open dataset: ${error instanceof Error ? error.message : String(error)}`;
    } finally {
      this._libraryBusy = false;
      this.render();
    }
  }

  _registerButtons(): void {
    this.buttons = [];
    const pad = 18;
    const startY = 70 + pad;
    const rowH = 46;

    const ops: { type: VisualOperation | 'reset'; label: string }[] = [
      { type: 'filter', label: 'Filter above the median' },
      { type: 'sort', label: 'Sort by value' },
      { type: 'aggregate', label: 'Summarise by category' },
      { type: 'cluster', label: 'Group similar values' },
      { type: 'hierarchical', label: 'Build a hierarchy' },
      { type: 'density', label: 'Find dense groups' },
      { type: 'anomaly', label: 'Highlight unusual values' },
      { type: 'timeSlice', label: 'Show the latest half' },
      { type: 'compare', label: 'Compare the first two groups' },
      { type: 'reset', label: 'Reset changes' },
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

    const portalY = startY + ops.length * (rowH + 2) + 24;
    this.buttons.push({
      type: 'toggle',
      label: 'Collaboration portals',
      x: 40,
      y: portalY,
      w: 720,
      h: 44,
    });

    const liveY = portalY + 44 + 34;
    this.buttons.push({
      type: 'connectStream',
      label: 'Connect live data',
      x: 40,
      y: liveY,
      w: 340,
      h: 44,
    });
    this.buttons.push({
      type: 'disconnectStream',
      label: 'Disconnect live data',
      x: 420,
      y: liveY,
      w: 340,
      h: 44,
    });

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

    const datasetY = sourceY + OPEN_DATA_SOURCES.length * (rowH + 2) + 44;
    allSampleDatasets.forEach((entry, idx) => {
      this.buttons.push({
        type: 'dataset',
        entry,
        label: `Example · ${entry.label}`,
        x: 40,
        y: datasetY + idx * rowH,
        w: 720,
        h: 40,
      });
    });

    const libraryY = datasetY + allSampleDatasets.length * rowH + 72;
    this.buttons.push({
      type: 'libraryRefresh',
      label: this._libraryBusy ? 'Refreshing…' : 'Refresh approved datasets',
      x: 40,
      y: libraryY,
      w: 720,
      h: 44,
    });

    let row = 1;
    for (const entry of this.libraryEntries) {
      for (const tier of entry.tiers) {
        this.buttons.push({
          type: 'libraryDataset',
          datasetId: entry.id,
          tierId: tier.id,
          label: `${entry.label} · v${entry.version} · ${tier.label} · ${tier.rows.toLocaleString()} rows`,
          x: 40,
          y: libraryY + row * rowH,
          w: 720,
          h: 40,
        });
        row += 1;
      }
    }
  }

  renderContent(ctx: CanvasRenderingContext2D, _w: number, _contentH: number): void {
    ctx.font = 'bold 20px monospace';
    ctx.fillStyle = cssHex(COLOR_TOKENS.interaction.focus);
    ctx.textAlign = 'left';
    ctx.fillText('ANALYSE', 40, 38);
    ctx.fillText('WORKSPACE', 40, 410);
    ctx.fillText('LIVE DATA', 40, 486);

    const statusText = this.liveConnected ? 'CONNECTED' : 'OFFLINE';
    const statusColor = this.liveConnected
      ? cssHex(COLOR_TOKENS.interaction.commit)
      : cssHex(COLOR_TOKENS.danger.destructive);
    ctx.font = 'bold 14px monospace';
    ctx.fillStyle = statusColor;
    ctx.fillText(statusText, 190, 136);

    const dataSetLabelY = this._datasetLabelY();
    ctx.font = 'bold 20px monospace';
    ctx.fillStyle = cssHex(COLOR_TOKENS.interaction.focus);
    ctx.fillText('BUILT-IN EXAMPLES', 40, dataSetLabelY);

    const libraryLabelY =
      dataSetLabelY + allSampleDatasets.length * 46 + 72;
    ctx.fillText('APPROVED DATASETS', 40, libraryLabelY);
    ctx.font = '14px monospace';
    ctx.fillStyle = cssHex(COLOR_TOKENS.text.secondary);
    ctx.fillText(this.libraryStatus, 40, libraryLabelY + 24, 700);

    ctx.font = 'bold 18px monospace';
    for (const btn of this.buttons) {
      const isToggleOn = btn.type === 'toggle' && this.portalsEnabled;
      const isConnectOn = btn.type === 'connectStream' && this.liveConnected;
      const isDisconnectOn = btn.type === 'disconnectStream' && !this.liveConnected;
      const active = isToggleOn || isConnectOn;
      const bg = active
        ? rgba(COLOR_TOKENS.interaction.focus, 0.18)
        : isDisconnectOn
          ? rgba(COLOR_TOKENS.danger.destructive, 0.16)
          : rgba(COLOR_TOKENS.surface.raised, 0.82);
      const stroke = active
        ? cssHex(COLOR_TOKENS.interaction.focus)
        : isDisconnectOn
          ? cssHex(COLOR_TOKENS.danger.destructive)
          : cssHex(COLOR_TOKENS.surface.border);

      ctx.fillStyle = bg;
      ctx.fillRect(btn.x, btn.y, btn.w, btn.h);
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.strokeRect(btn.x, btn.y, btn.w, btn.h);

      ctx.fillStyle = cssHex(COLOR_TOKENS.text.primary);
      ctx.textAlign = 'left';
      let text = btn.label;
      if (btn.type === 'toggle') text += ` · ${this.portalsEnabled ? 'On' : 'Off'}`;
      ctx.fillText(text, btn.x + 16, btn.y + 27, btn.w - 32);
    }
  }

  handleContentClick(raycaster: THREE.Raycaster): boolean {
    this.mesh.updateMatrixWorld(true);
    const hits = raycaster.intersectObject(this.mesh, false);
    if (hits.length === 0) return false;

    const uv = hits[0].uv;
    if (!uv) return false;
    const canvasX = uv.x * this.width;
    const canvasY = (1 - uv.y) * this.height;
    const contentY = canvasY + this.scrollOffset;

    for (const btn of this.buttons) {
      if (
        canvasX >= btn.x &&
        canvasX <= btn.x + btn.w &&
        ((canvasY >= btn.y && canvasY <= btn.y + btn.h) ||
          (contentY >= btn.y && contentY <= btn.y + btn.h))
      ) {
        const now = performance.now();
        if (now - this._lastClickAt < 100) return true;
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
        if (btn.type === 'libraryRefresh') {
          void this.refreshDatasetLibrary();
          return true;
        }
        if (btn.type === 'libraryDataset') {
          void this.openLibraryDataset(btn.datasetId, btn.tierId);
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
        if (btn.type === 'compare') {
          this.onCompare?.();
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
    const opsCount = 10;
    const portalY = startY + opsCount * (rowH + 2) + 24;
    const liveY = portalY + 44 + 34;
    const sourceY = liveY + 44 + 44;
    return sourceY + OPEN_DATA_SOURCES.length * (rowH + 2) + 14;
  }
}
