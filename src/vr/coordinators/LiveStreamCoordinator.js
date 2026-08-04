import { TopologyTypes } from '../../draco/ConstraintEngine.js';
import { WebSocketAdapter } from '../../data/connectors/WebSocketAdapter.ts';
import { PollingAdapter } from '../../data/connectors/PollingAdapter.ts';
import { getOpenDataSource } from '../../data/connectors/OpenDataSources.ts';
import { rowsToDataset } from '../../data/connectors/normalize.ts';
import { getDefaultEncodings } from '../../data/SampleDatasets.ts';

/**
 * Owns live-stream connection state, buffering, and incremental flushing.
 *
 * This coordinator reduces the surface area of World.js by centralising the
 * WebSocket/polling adapter lifecycle, row buffering, and the periodic re-solve
 * or incremental append decision. World.js still decides how to load a dataset
 * by providing callbacks.
 */
export class LiveStreamCoordinator {
  constructor({ world }) {
    this.world = world;

    this.liveConnector = null;
    this.liveRows = [];
    this._pendingRows = [];
    this._liveFlushTimer = null;
    this._liveUpdatePending = false;
    this._liveUpdateUnsub = null;
    this._liveStatusUnsub = null;
  }

  _demoStreamUrl() {
    if (typeof location === 'undefined') return 'wss://localhost:5173/__demo-stream';
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${location.host}/__demo-stream`;
  }

  /**
   * Connect to a curated open live data source by key.
   * @param {string} sourceKey
   * @returns {boolean}
   */
  connectLiveSource(sourceKey) {
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
      this.liveConnector = new PollingAdapter({
        url,
        topology: source.topology ?? TopologyTypes.GEO,
        mode: source.mode ?? 'replace',
        intervalMs: source.intervalMs ?? 10000,
        fetchOptions: source.fetchOptions ?? {},
        parseResponse: source.parseResponse,
      });
    } else {
      console.warn('[LiveStreamCoordinator] unsupported transport:', source.transport);
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
    { topology = TopologyTypes.TIME_SERIES, mode = 'window', windowSize = 50 } = {}
  ) {
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

  _wireLiveConnector() {
    this._liveUpdateUnsub = this.liveConnector.onUpdate((update) => this._onLiveUpdate(update));
    this._liveStatusUnsub = this.liveConnector.onStatus((status, detail) => {
      console.log(`[LiveStreamCoordinator] live stream ${status}`, detail || '');
      this.world.vrMenu?.setLiveConnected?.(this.liveConnector?.isConnected?.() ?? false);
      if (status === 'connected') this.world.vrConsole?.log?.('log', ['Live stream connected']);
      if (status === 'disconnected')
        this.world.vrConsole?.log?.('log', ['Live stream disconnected']);
      if (status === 'error')
        this.world.vrConsole?.warn?.('warn', [`Live stream error: ${detail}`]);
    });
  }

  disconnectLiveStream() {
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

  isLiveConnected() {
    return this.liveConnector?.isConnected?.() ?? false;
  }

  _onLiveUpdate(update) {
    const rows = update.dataset?.rows ?? [];
    if (rows.length === 0) return;

    this._pendingRows.push(...rows);
    const merged = [...this.liveRows, ...rows];
    const limit = this.liveConnector?.windowSize ?? 50;
    this.liveRows = update.mode === 'window' ? merged.slice(-limit) : merged;

    this._liveUpdatePending = true;
    if (!this._liveFlushTimer) {
      this._liveFlushTimer = setTimeout(() => this._flushLiveUpdate(), 1000);
    }
  }

  _flushLiveUpdate() {
    this._liveFlushTimer = null;
    if (!this._liveUpdatePending || this.liveRows.length === 0) return;
    this._liveUpdatePending = false;

    const topology = this.liveConnector?.topology || TopologyTypes.TIME_SERIES;

    // Try incremental append for time-series if the current dataset matches.
    if (
      topology === TopologyTypes.TIME_SERIES &&
      this.world.dracoNode &&
      this.world.currentEntry?.name === 'Live Stream' &&
      this._pendingRows.length > 0
    ) {
      const incremental = this.world.dracoNode.appendRows(this._pendingRows, {
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

  _cancelLiveFlush() {
    if (this._liveFlushTimer) {
      clearTimeout(this._liveFlushTimer);
      this._liveFlushTimer = null;
    }
    this._liveUpdatePending = false;
  }
}
