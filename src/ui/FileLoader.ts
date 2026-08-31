import { validateImport, formatValidationResult } from '../data/ImportError.ts';
import { Dataset } from '../data/Dataset.ts';
import type { ColumnSchema, TopologyType } from '../data/types.ts';
import {
  allSampleDatasets,
  getSampleDataset,
  getDefaultEncodings,
  type SampleDatasetEntry,
} from '../data/SampleDatasets.ts';
import {
  NemosyneDataCatalogClient,
  type RemoteDatasetCatalog,
  type RemoteDatasetCatalogEntry,
  type RemoteDatasetProvenance,
} from '../data/catalog/NemosyneDataCatalog.ts';
import { TopologyTypes } from '../moneta/ConstraintEngine.ts';
import type { AtlasCore } from '../atlas/AtlasCore.ts';

/**
 * DOM-based file loader and dataset selector.
 * Provides a small overlay panel for desktop debugging and headset pass-through.
 */
/**
 * Hard cap on uploaded/remote artifact size, checked BEFORE content is accepted.
 * The same policy applies to local and corpus imports so remote loading cannot
 * become a back door around the product import envelope.
 */
const MAX_IMPORT_BYTES = 256 * 1024 * 1024;
const MAX_IMPORT_ROWS = 100_000;
const MAX_IMPORT_COLUMNS = 1_000;

/** Maximum length of a dataset label derived from an untrusted source. */
const MAX_DATASET_NAME_LEN = 128;

/**
 * Neutralize an untrusted upload/catalog label before it becomes a dataset label.
 */
function sanitizeDatasetName(rawName: string): string | null {
  if (typeof rawName !== 'string') return null;
  const trimmed = rawName.trim();
  if (trimmed.length === 0) return 'unnamed_dataset';
  if (trimmed.length > MAX_DATASET_NAME_LEN) return null;
  for (const ch of trimmed) {
    const code = ch.charCodeAt(0);
    if (code === 0 || code < 32 || code === 127 || ch === '/' || ch === '\\') return null;
  }
  return trimmed;
}

export interface FileLoaderLoadEvent {
  name: string;
  topology: TopologyType;
  dataset: Dataset;
  maxDepth?: number;
  encodings: Record<string, string>;
  /** Present only for integrity-verified nemosyne-data imports. */
  remoteProvenance?: RemoteDatasetProvenance;
}

/**
 * The analytical kernel is the ONLY parse/topology/encoding path and is
 * reached through AtlasCore. Remote corpus loading changes only how verified
 * bytes arrive at that boundary; catalog topology labels are never analytical
 * authority.
 */
export interface FileLoaderOptions {
  onLoad: (entry: FileLoaderLoadEvent) => void;
  atlas?: AtlasCore | null;
  remoteCatalog?: NemosyneDataCatalogClient | null;
}

export class FileLoaderUI {
  onLoad: (entry: FileLoaderLoadEvent) => void;
  atlas: AtlasCore | null;
  remoteCatalog: NemosyneDataCatalogClient | null;
  container: HTMLDivElement;
  private _disposed = false;
  private _generation = 0;
  private _remoteAbort: AbortController | null = null;
  private _remoteCatalogValue: RemoteDatasetCatalog | null = null;
  statusEl!: HTMLDivElement;
  schemaEl!: HTMLDivElement;
  topologySelect!: HTMLSelectElement;
  corpusDatasetSelect!: HTMLSelectElement;
  corpusTierSelect!: HTMLSelectElement;
  corpusOpenButton!: HTMLButtonElement;

  constructor({ onLoad, atlas, remoteCatalog }: FileLoaderOptions) {
    this.onLoad = onLoad;
    this.atlas = atlas ?? null;
    this.remoteCatalog =
      remoteCatalog === undefined ? new NemosyneDataCatalogClient({ maxArtifactBytes: MAX_IMPORT_BYTES }) : remoteCatalog;
    this.container = this._buildUI();
    document.body.appendChild(this.container);
  }

  private _buildUI(): HTMLDivElement {
    const container = document.createElement('div');
    container.id = 'nemosyne-loader';
    container.style.cssText = this._containerStyle();

    const title = document.createElement('div');
    title.textContent = '// NEMOSYNE DATA LOADER';
    title.style.cssText =
      'font-weight: bold; margin-bottom: 10px; color: #00ffcc; text-shadow: 0 0 5px #00ffcc;';
    container.appendChild(title);

    container.appendChild(this._label('Sample datasets'));
    const sampleSelect = document.createElement('select');
    sampleSelect.style.cssText = this._inputStyle();
    sampleSelect.appendChild(new Option('-- select a sample --', ''));
    for (const d of allSampleDatasets) sampleSelect.appendChild(new Option(d.label, d.key));
    sampleSelect.addEventListener('change', (e: Event) => {
      const key = (e.target as HTMLSelectElement).value;
      if (!key) return;
      const entry = getSampleDataset(key);
      if (entry) this._emitSample(entry);
    });
    container.appendChild(sampleSelect);

    if (this.remoteCatalog) {
      container.appendChild(this._divider());
      container.appendChild(this._label('Nemosyne corpus'));
      const refresh = document.createElement('button');
      refresh.id = 'nemosyne-corpus-refresh';
      refresh.type = 'button';
      refresh.textContent = 'Load corpus catalogue';
      refresh.style.cssText = this._inputStyle();
      refresh.addEventListener('click', () => void this._loadRemoteCatalog());
      container.appendChild(refresh);

      const datasetSelect = document.createElement('select');
      datasetSelect.id = 'nemosyne-corpus-dataset';
      datasetSelect.style.cssText = this._inputStyle();
      datasetSelect.disabled = true;
      datasetSelect.appendChild(new Option('-- load catalogue first --', ''));
      datasetSelect.addEventListener('change', () => this._populateCorpusTiers());
      container.appendChild(datasetSelect);

      const tierSelect = document.createElement('select');
      tierSelect.id = 'nemosyne-corpus-tier';
      tierSelect.style.cssText = this._inputStyle();
      tierSelect.disabled = true;
      tierSelect.appendChild(new Option('-- select a dataset --', ''));
      container.appendChild(tierSelect);

      const open = document.createElement('button');
      open.id = 'nemosyne-corpus-open';
      open.type = 'button';
      open.textContent = 'Open dataset';
      open.style.cssText = this._inputStyle();
      open.disabled = true;
      open.addEventListener('click', () => void this._handleRemoteArtifact());
      container.appendChild(open);

      this.corpusDatasetSelect = datasetSelect;
      this.corpusTierSelect = tierSelect;
      this.corpusOpenButton = open;
    }

    container.appendChild(this._divider());
    container.appendChild(this._label('Upload CSV or JSON'));

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.csv,.json,.txt';
    fileInput.style.cssText = this._inputStyle();
    fileInput.addEventListener('change', (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      void this._handleFile(file);
    });
    container.appendChild(fileInput);

    const topologySelect = document.createElement('select');
    topologySelect.style.cssText = this._inputStyle();
    topologySelect.appendChild(new Option('Auto-detect topology', '', true, true));
    for (const [k, v] of Object.entries(TopologyTypes)) topologySelect.appendChild(new Option(k, v));
    container.appendChild(topologySelect);

    const schemaPreview = document.createElement('div');
    schemaPreview.id = 'loader-schema';
    schemaPreview.style.cssText =
      'margin-top: 10px; padding: 8px; background: rgba(0, 30, 40, 0.4); border: 1px solid #005577; border-radius: 3px; color: #88ccff; font-size: 11px; display: none;';
    container.appendChild(schemaPreview);

    const status = document.createElement('div');
    status.id = 'loader-status';
    status.style.cssText = 'margin-top: 10px; color: #88ccff; min-height: 1.2em;';
    container.appendChild(status);

    this.statusEl = status;
    this.schemaEl = schemaPreview;
    this.topologySelect = topologySelect;
    return container;
  }

  private _containerStyle(): string {
    return `
      position: absolute;
      top: 12px;
      right: 12px;
      width: 320px;
      max-height: 90vh;
      overflow-y: auto;
      background: rgba(4, 10, 20, 0.92);
      border: 2px solid #00ffcc;
      border-radius: 6px;
      color: #00ffcc;
      font-family: 'Courier New', Courier, monospace;
      font-size: 13px;
      z-index: 20;
      padding: 12px;
      box-shadow: 0 0 12px rgba(0, 255, 204, 0.25);
      user-select: none;
    `;
  }

  private _label(text: string): HTMLDivElement {
    const el = document.createElement('div');
    el.textContent = text;
    el.style.cssText = 'margin: 8px 0 4px; color: #88ccff;';
    return el;
  }

  private _inputStyle(): string {
    return `
      width: 100%;
      margin: 4px 0;
      background: rgba(0, 20, 30, 0.8);
      color: #00ffcc;
      border: 1px solid #00ffcc;
      border-radius: 3px;
      padding: 6px;
      font-family: inherit;
      font-size: 12px;
      box-sizing: border-box;
    `;
  }

  private _divider(): HTMLHRElement {
    const el = document.createElement('hr');
    el.style.cssText = 'border: none; border-top: 1px solid #005577; margin: 12px 0;';
    return el;
  }

  private _emitSample(entry: SampleDatasetEntry): void {
    if (this._disposed) return;
    this._cancelRemote();
    this._generation += 1;
    this._status(`Loaded sample: ${entry.label}`);
    this.onLoad({
      name: entry.label,
      topology: entry.topology,
      dataset: entry.dataset,
      maxDepth: entry.depth,
      encodings: getDefaultEncodings(entry) as Record<string, string>,
    });
  }

  private async _loadRemoteCatalog(): Promise<void> {
    if (!this.remoteCatalog || this._disposed) return;
    const generation = ++this._generation;
    this._cancelRemote();
    this._remoteAbort = new AbortController();
    this._status('Loading pinned nemosyne-data catalogue…');
    try {
      const catalog = await this.remoteCatalog.loadCatalog(this._remoteAbort.signal);
      if (!this._isCurrent(generation)) return;
      this._remoteCatalogValue = catalog;
      this.corpusDatasetSelect.innerHTML = '';
      this.corpusDatasetSelect.appendChild(new Option('-- select corpus dataset --', ''));
      for (const entry of catalog.datasets) {
        if (entry.artifacts.length === 0) continue;
        this.corpusDatasetSelect.appendChild(new Option(entry.label, entry.id));
      }
      this.corpusDatasetSelect.disabled = false;
      this._status(`Corpus ${catalog.corpusVersion} ready (${this.corpusDatasetSelect.options.length - 1} datasets)`);
    } catch (error: unknown) {
      if (!this._isCurrent(generation) || (error instanceof DOMException && error.name === 'AbortError')) return;
      this._status(`Corpus error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private _selectedCorpusDataset(): RemoteDatasetCatalogEntry | null {
    const id = this.corpusDatasetSelect?.value;
    if (!id || !this._remoteCatalogValue) return null;
    return this._remoteCatalogValue.datasets.find((entry) => entry.id === id) ?? null;
  }

  private _populateCorpusTiers(): void {
    const entry = this._selectedCorpusDataset();
    this.corpusTierSelect.innerHTML = '';
    this.corpusTierSelect.appendChild(new Option('-- select tier --', ''));
    this.corpusTierSelect.disabled = !entry;
    this.corpusOpenButton.disabled = true;
    if (!entry) return;

    const byTier = new Map(entry.artifacts.filter((artifact) => artifact.role === 'primary').map((artifact) => [artifact.tier, artifact]));
    for (const tier of entry.plannedTiers) {
      const artifact = byTier.get(tier);
      const supported = Boolean(
        artifact &&
          artifact.bytes <= MAX_IMPORT_BYTES &&
          artifact.rows <= MAX_IMPORT_ROWS &&
          (artifact.format === 'csv' || artifact.format === 'json')
      );
      const label = artifact
        ? `${tier} — ${artifact.rows.toLocaleString()} rows${supported ? '' : ' (unsupported)'}`
        : `${tier} — unavailable`;
      const option = new Option(label, supported ? tier : '');
      option.disabled = !supported;
      this.corpusTierSelect.appendChild(option);
    }
    this.corpusTierSelect.addEventListener('change', () => {
      this.corpusOpenButton.disabled = !this.corpusTierSelect.value;
    }, { once: true });
  }

  private async _handleRemoteArtifact(): Promise<void> {
    if (!this.remoteCatalog || this._disposed) return;
    const entry = this._selectedCorpusDataset();
    const tier = this.corpusTierSelect.value;
    if (!entry || !tier) return;
    const safeName = sanitizeDatasetName(entry.label);
    if (!safeName) {
      this._status('Corpus dataset label rejected.');
      return;
    }

    const generation = ++this._generation;
    this._cancelRemote();
    this._remoteAbort = new AbortController();
    this.corpusOpenButton.disabled = true;
    this._status(`Verifying ${entry.label} / ${tier}…`);
    try {
      const loaded = await this.remoteCatalog.loadArtifact(entry.id, tier, this._remoteAbort.signal);
      if (!this._isCurrent(generation)) return;
      const parsed = this._parseViaKernel(loaded.bytes, loaded.artifact.format, safeName);
      if (!this._isCurrent(generation)) return;
      const validation = validateImport(parsed.dataset, {
        maxRows: MAX_IMPORT_ROWS,
        maxColumns: MAX_IMPORT_COLUMNS,
      });
      const message = formatValidationResult(validation);
      if (!validation.ok) {
        this._status(message || 'Import failed.');
        this._clearSchema();
        return;
      }
      this._renderSchema(parsed.dataset, parsed.topology, parsed.encodings, validation.warnings);
      this._status(
        message ||
          `Loaded ${parsed.dataset.rowCount} rows from ${entry.label} / ${tier} as ${parsed.topology}`
      );
      if (!this._isCurrent(generation)) return;
      this.onLoad({
        name: safeName,
        topology: parsed.topology,
        dataset: parsed.dataset,
        encodings: parsed.encodings,
        remoteProvenance: loaded.provenance,
      });
    } catch (error: unknown) {
      if (!this._isCurrent(generation) || (error instanceof DOMException && error.name === 'AbortError')) return;
      this._status(`Corpus error: ${error instanceof Error ? error.message : String(error)}`);
      this._clearSchema();
    } finally {
      if (this._isCurrent(generation)) this.corpusOpenButton.disabled = !this.corpusTierSelect.value;
    }
  }

  private async _handleFile(file: File | undefined): Promise<void> {
    if (!file || this._disposed) return;
    this._cancelRemote();
    const generation = ++this._generation;
    const safeName = sanitizeDatasetName(file.name);
    if (safeName === null) {
      this._status('File name rejected: contains unsafe characters or is too long.');
      this._clearSchema();
      return;
    }
    if (typeof file.size === 'number' && file.size > MAX_IMPORT_BYTES) {
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      const maxMb = (MAX_IMPORT_BYTES / (1024 * 1024)).toFixed(0);
      this._status(`File too large (${mb} MB); import cap is ${maxMb} MB.`);
      this._clearSchema();
      return;
    }
    let text: string;
    try {
      text = await file.text();
    } catch (err: unknown) {
      if (!this._isCurrent(generation)) return;
      this._status(`Error reading file: ${err instanceof Error ? err.message : String(err)}`);
      this._clearSchema();
      return;
    }
    if (!this._isCurrent(generation)) return;
    const ext = safeName.toLowerCase().split('.').pop() ?? '';
    const bytes = new TextEncoder().encode(text);

    let parsed: { dataset: Dataset; topology: TopologyType; encodings: Record<string, string> };
    try {
      parsed = this._parseViaKernel(bytes, ext, safeName);
    } catch (err: unknown) {
      if (!this._isCurrent(generation)) return;
      this._status(`Error parsing file: ${err instanceof Error ? err.message : String(err)}`);
      this._clearSchema();
      return;
    }
    if (!this._isCurrent(generation)) return;

    const { dataset, topology, encodings } = parsed;
    const validation = validateImport(dataset, {
      maxRows: MAX_IMPORT_ROWS,
      maxColumns: MAX_IMPORT_COLUMNS,
    });
    const message = formatValidationResult(validation);
    if (!validation.ok) {
      if (!this._isCurrent(generation)) return;
      this._status(message || 'Import failed.');
      this._clearSchema();
      return;
    }

    if (!this._isCurrent(generation)) return;
    this._renderSchema(dataset, topology, encodings, validation.warnings);
    this._status(message || `Loaded ${dataset.rowCount} rows from ${safeName} as ${topology}`);
    if (!this._isCurrent(generation)) return;
    this.onLoad({ name: safeName, topology, dataset, encodings });
  }

  /** Parse bytes only through the mandatory kernel/Atlas authority. */
  private _parseViaKernel(
    bytes: Uint8Array,
    ext: string,
    name: string
  ): { dataset: Dataset; topology: TopologyType; encodings: Record<string, string> } {
    if (!this.atlas) throw new Error('Analytical kernel unavailable — cannot parse file');
    if (ext !== 'csv' && ext !== 'json') throw new Error('Unsupported file type; use .csv or .json');
    const explicitTopology = (this.topologySelect.value as TopologyType) || null;
    const { dataset, topology, encodings } = this.atlas.parseBytes(
      bytes,
      ext as 'csv' | 'json',
      explicitTopology
    );
    dataset.name = name;
    return { dataset, topology, encodings };
  }

  private _renderSchema(
    dataset: Dataset,
    topology: TopologyType,
    encodings: Record<string, string>,
    warnings: Array<{ message: string }>
  ): void {
    const typeColor: Record<string, string> = {
      NUMERIC: '#ffaa00',
      CATEGORICAL: '#00ffcc',
      TEMPORAL: '#ff00ff',
      TEXT: '#88aaff',
    };
    this.schemaEl.innerHTML = '';
    this.schemaEl.appendChild(this._schemaHeader(dataset, topology));
    for (const c of dataset.columns) {
      const usedBy = Object.entries(encodings)
        .filter(([, name]) => name === c.name)
        .map(([channel]) => channel)
        .join(', ');
      this.schemaEl.appendChild(this._schemaRow(c, usedBy, typeColor[c.type] || '#fff'));
    }
    if (warnings.length) {
      const warningEl = document.createElement('div');
      warningEl.style.cssText = 'margin-top:6px;color:#ffaa00;';
      warningEl.textContent = `⚠ ${warnings.map((w) => w.message).join('; ')}`;
      this.schemaEl.appendChild(warningEl);
    }
    this.schemaEl.style.display = 'block';
  }

  private _schemaHeader(dataset: Dataset, topology: TopologyType): HTMLDivElement {
    const header = document.createElement('div');
    header.style.cssText = 'font-weight:bold;margin-bottom:4px;';
    header.textContent = `${dataset.name} — ${topology} (${dataset.rowCount} rows)`;
    return header;
  }

  private _schemaRow(column: ColumnSchema, usedBy: string, color: string): HTMLDivElement {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:space-between;';
    const name = document.createElement('span');
    name.textContent = column.name;
    row.appendChild(name);
    const type = document.createElement('span');
    type.style.color = color;
    type.textContent = `${column.type}${usedBy ? ` → ${usedBy}` : ''}`;
    row.appendChild(type);
    return row;
  }

  private _clearSchema(): void {
    this.schemaEl.innerHTML = '';
    this.schemaEl.style.display = 'none';
  }

  _status(msg: string): void {
    this.statusEl.textContent = msg;
  }

  hide(): void {
    this.container.style.display = 'none';
  }

  show(): void {
    this.container.style.display = 'block';
  }

  private _cancelRemote(): void {
    this._remoteAbort?.abort();
    this._remoteAbort = null;
  }

  private _isCurrent(generation: number): boolean {
    return !this._disposed && generation === this._generation;
  }

  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;
    this._generation += 1;
    this._cancelRemote();
    this.atlas = null;
    this.remoteCatalog = null;
    this.container.remove();
  }
}
