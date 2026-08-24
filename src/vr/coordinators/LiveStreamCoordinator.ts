/**
 * Owns live-stream connection state, buffering, and incremental flushing.
 *
 * This coordinator reduces the surface area of World.js by centralising the
 * WebSocket/polling adapter lifecycle, row buffering, and the periodic re-solve
 * or incremental append decision. World.js still decides how to load a dataset
 * by providing callbacks.
 */

import { TopologyTypes } from '../../moneta/ConstraintEngine.ts';
import { WebSocketAdapter } from '../../data/connectors/WebSocketAdapter.ts';
import { PollingAdapter } from '../../data/connectors/PollingAdapter.ts';
import { getOpenDataSource } from '../../data/connectors/OpenDataSources.ts';
import { rowsToDataset } from '../../data/connectors/normalize.ts';
import { getDefaultEncodings } from '../../data/SampleDatasets.ts';
import type { TopologyType } from '../../data/types.ts';
import type { LiveUpdate } from '../../data/connectors/DataConnector.ts';
import type { ArtifactRef, WorldUIManagerLike } from './types.ts';

export interface LiveStreamOptions {
  topology?: string;
  mode?: 'window' | 'replace' | string;
  windowSize?: number;
}

export interface LiveTopologyNode {
  artifact?: ArtifactRef | null;
  appendRows?(
    rows: Record<string, unknown>[],
    options?: { mode?: string; limit?: number | null }
  ): boolean;
}

export interface LiveConnectorLike {
  topology?: string;
  windowSize?: number;
  isConnected(): boolean;
  connect(): void;
  disconnect(): void;
  onUpdate(fn: (update: LiveUpdate) => void): () => void;
  onStatus(fn: (status: string, detail?: string) => void): () => void;
}

export interface LiveStreamHost {
  dracoNode?: LiveTopologyNode | null;
  currentEntry?: { name?: string; [key: string]: unknown } | null;
  loadDataset(entry: unknown): void;
  uiManager?: Pick<WorldUIManagerLike, 'vrConsole' | 'vrMenu'>;
}

export class LiveStreamCoordinator {
  world: LiveStreamHost;

  liveConnector: LiveConnectorLike | null;
  liveRows: Record<string, unknown>[];
  _pendingRows: Record<string, unknown>[];
  _liveFlushTimer: ReturnType<typeof setTimeout> | null;
  private _liveUpdatePending: boolean;
  private _liveUpdateUnsub: (() => void) | null;
  private _liveStatusUnsub: (() => void) | null;

  constructor({ world }: { world: LiveStreamHost }) {
    this.world = world;

    this.liveConnector = null;
    this.liveRows = [];
    this._pendingRows = [];
    this._liveFlushTimer = null;
    this._liveUpdatePending = false;
    this._liveUpdateUnsub = null;
    this._liveStatusUnsub = null;
  }

  _demoStreamUrl(): string {
    if (typeof location === 'undefined') return 'wss://localhost:5173/__demo-stream';
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${location.host}/__demo-stream`;
  }

  /**
   * Connect to a curated open live data source by key.
   */
  connectLiveSource(sourceKey: string): boolean {
    const source = getOpenDataSource(sourceKey);
    if (!source) {
      console.warn('[LiveStreamCoordinator] unknown live source:', sourceKey);
      return false;
    }

    this.disconnectLiveStream();
    this.liveRows = [];

    const url = source.url ?? this._demoStreamUrl();

    if (source.transport === 'websocket') {
      if (typeof WebSocket === 'undefined') {
        console.warn('[LiveStreamCoordinator] WebSocket not available in this environment');
        return false;
      }
      this.liveConnector = new WebSocketAdapter({
        url,
        topology: source.topology ?? TopologyTypes.TIME_SERIES,
        mode: source.mode ?? 'window',
        windowSize: source.windowSize ?? 50,
        subscriptions: source.subscriptions ?? [],
        parseMessage: source.parseMessage,
        reconnect: true,
      });
    } else if (source.transport === 'polling') {
      if (typeof fetch === 'undefined') {
        console.warn('[LiveStreamCoordinator] fetch not available in this environment');
        return false;
      }
      if (!source.parseResponse) {
        console.warn('[LiveStreamCoordinator] polling source requires parseResponse:', sourceKey);
        return false;
      }
      this.liveConnector = new PollingAdapter({
        url,
        topology: source.topology ?? TopologyTypes.GEO,
        mode: source.mode ?? 'replace',
        intervalMs: source.intervalMs ?? 10000,
        fetchOptions: source.fetchOptions ?? {},
        parseResponse: source.parseResponse as (json: unknown) => {
          rows: Record<string, unknown>[];
          topology?: string;
          name?: string;
        } | null,
      });
    } else {
      console.warn(
        '[LiveStreamCoordinator] unsupported transport:',
        (source as { transport?: string }).transport
      );
      return false;
    }

    this._wireLiveConnector();
    this.liveConnector.connect();
    return true;
  }

  /**
   * Connect to a raw WebSocket data stream.
   * If no URL is supplied, the bundled demo endpoint is used.
   */
  connectLiveStream(
    url = this._demoStreamUrl(),
    {
      topology = TopologyTypes.TIME_SERIES,
      mode = 'window',
      windowSize = 50,
    }: LiveStreamOptions = {}
  ): boolean {
    if (typeof WebSocket === 'undefined') {
      console.warn('[LiveStreamCoordinator] WebSocket not available in this environment');
      return false;
    }

    this.disconnectLiveStream();
    this.liveRows = [];

    this.liveConnector = new WebSocketAdapter({
      url,
      topology,
      mode,
      windowSize,
      reconnect: true,
    });

    this._wireLiveConnector();
    this.liveConnector.connect();
    return true;
  }

  _wireLiveConnector(): void {
    this._liveUpdateUnsub = this.liveConnector!.onUpdate((update: LiveUpdate) =>
      this._onLiveUpdate(update)
    );
    this._liveStatusUnsub = this.liveConnector!.onStatus((status: string, detail?: string) => {
      console.warn(`[LiveStreamCoordinator] live stream ${status}`, detail || '');
      this.world.uiManager?.vrMenu?.setLiveConnected?.(
        this.liveConnector?.isConnected?.() ?? false
      );
      if (status === 'connected')
        this.world.uiManager?.vrConsole?.log?.('log', ['Live stream connected']);
      if (status === 'disconnected')
        this.world.uiManager?.vrConsole?.log?.('log', ['Live stream disconnected']);
      if (status === 'error')
        this.world.uiManager?.vrConsole?.warn?.('warn', [`Live stream error: ${detail}`]);
    });
  }

  disconnectLiveStream(): void {
    this._cancelLiveFlush();
    this.liveRows = [];
    this._pendingRows = [];
    if (this._liveUpdateUnsub) {
      this._liveUpdateUnsub();
      this._liveUpdateUnsub = null;
    }
    if (this._liveStatusUnsub) {
      this._liveStatusUnsub();
      this._liveStatusUnsub = null;
    }
    if (this.liveConnector) {
      this.liveConnector.disconnect();
      this.liveConnector = null;
    }
  }

  isLiveConnected(): boolean {
    return this.liveConnector?.isConnected?.() ?? false;
  }

  _onLiveUpdate(update: LiveUpdate): void {
    const rows = update.dataset?.rows ?? [];
    if (rows.length === 0) return;

    if (update.mode === 'replace') {
      this.liveRows = [...rows];
      this._pendingRows = [...rows];
    } else if (update.mode === 'window') {
      this._pendingRows.push(...rows);
      const merged = [...this.liveRows, ...rows];
      const limit = this.liveConnector?.windowSize ?? 50;
      this.liveRows = merged.slice(-limit);
    } else {
      this._pendingRows.push(...rows);
      this.liveRows = [...this.liveRows, ...rows];
    }

    this._liveUpdatePending = true;
    if (!this._liveFlushTimer) {
      this._liveFlushTimer = setTimeout(() => this._flushLiveUpdate(), 1000);
    }
  }

  _flushLiveUpdate(): void {
    this._liveFlushTimer = null;
    if (!this._liveUpdatePending || this.liveRows.length === 0) return;
    this._liveUpdatePending = false;

    const topology = (this.liveConnector?.topology || TopologyTypes.TIME_SERIES) as TopologyType;

    // Try incremental append for time-series if the current dataset matches.
    if (
      topology === TopologyTypes.TIME_SERIES &&
      this.world.dracoNode &&
      this.world.currentEntry?.name === 'Live Stream' &&
      this._pendingRows.length > 0
    ) {
      const incremental = this.world.dracoNode.appendRows?.(this._pendingRows, {
        mode: 'append',
        limit: this.liveConnector?.windowSize ?? 50,
      });
      if (incremental) {
        this._pendingRows = [];
        return;
      }
    }

    // Fallback: full re-solve.
    const dataset = rowsToDataset(this.liveRows, 'Live Stream');
    this.world.loadDataset({
      name: 'Live Stream',
      topology,
      dataset,
      maxDepth: 1,
      encodings: getDefaultEncodings({ dataset, topology }),
    });
    this._pendingRows = [];
  }

  _cancelLiveFlush(): void {
    if (this._liveFlushTimer) {
      clearTimeout(this._liveFlushTimer);
      this._liveFlushTimer = null;
    }
    this._liveUpdatePending = false;
  }
}
