import { validateImport, formatValidationResult } from '../data/ImportError.ts';
import { Dataset } from '../data/Dataset.ts';
import type { ColumnSchema, TopologyType } from '../data/types.ts';
import {
  allSampleDatasets,
  getSampleDataset,
  getDefaultEncodings,
  type SampleDatasetEntry,
} from '../data/SampleDatasets.ts';
import { TopologyTypes } from '../moneta/ConstraintEngine.ts';
import type { AtlasCore } from '../atlas/AtlasCore.ts';

/**
 * DOM-based file loader and dataset selector.
 * Provides a small overlay panel for desktop debugging and headset pass-through.
 */
/**
 * Hard cap on uploaded file size, checked BEFORE `file.text()` reads the whole
 * file into memory. Without this, a multi-GB upload OOMs the tab before the
 * 100k-row / 1000-column limits (applied during parse) can engage. 256 MB is
 * generous for legitimate analytical datasets while bounding the peak heap
 * (the parse path may transiently hold file → string → bytes → parsed).
 */
const MAX_IMPORT_BYTES = 256 * 1024 * 1024;

export interface FileLoaderLoadEvent {
  name: string;
  topology: TopologyType;
  dataset: Dataset;
  maxDepth?: number;
  encodings: Record<string, string>;
}

/**
 * Wave 6: the analytical kernel is the ONLY parse/topology/encoding path and
 * is reached through {@link AtlasCore} (the single production caller). There
 * is no JS fallback and no capability routing.
 */
export interface FileLoaderOptions {
  onLoad: (entry: FileLoaderLoadEvent) => void;
  atlas?: AtlasCore | null;
}

export class FileLoaderUI {
  onLoad: (entry: FileLoaderLoadEvent) => void;
  atlas: AtlasCore | null;
  container: HTMLDivElement;
  statusEl!: HTMLDivElement;
  schemaEl!: HTMLDivElement;
  topologySelect!: HTMLSelectElement;

  constructor({ onLoad, atlas }: FileLoaderOptions) {
    this.onLoad = onLoad;
    this.atlas = atlas ?? null;
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

    // Sample dataset selector.
    container.appendChild(this._label('Sample datasets'));

    const sampleSelect = document.createElement('select');
    sampleSelect.style.cssText = this._inputStyle();
    sampleSelect.appendChild(new Option('-- select a sample --', ''));
    for (const d of allSampleDatasets) {
      sampleSelect.appendChild(new Option(d.label, d.key));
    }
    sampleSelect.addEventListener('change', (e: Event) => {
      const target = e.target as HTMLSelectElement;
      const key = target.value;
      if (!key) return;
      const entry = getSampleDataset(key);
      if (entry) this._emitSample(entry);
    });
    container.appendChild(sampleSelect);

    container.appendChild(this._divider());

    // File upload.
    container.appendChild(this._label('Upload CSV or JSON'));

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.csv,.json,.txt';
    fileInput.style.cssText = this._inputStyle();
    fileInput.addEventListener('change', (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      this._handleFile(file);
    });
    container.appendChild(fileInput);

    const topologySelect = document.createElement('select');
    topologySelect.style.cssText = this._inputStyle();
    topologySelect.appendChild(new Option('Auto-detect topology', '', true, true));
    for (const [k, v] of Object.entries(TopologyTypes)) {
      topologySelect.appendChild(new Option(k, v));
    }
    container.appendChild(topologySelect);

    // Schema preview panel for imported files.
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
    this._status(`Loaded sample: ${entry.label}`);
    this.onLoad({
      name: entry.label,
      topology: entry.topology,
      dataset: entry.dataset,
      maxDepth: entry.depth,
      encodings: getDefaultEncodings(entry) as Record<string, string>,
    });
  }

  private async _handleFile(file: File | undefined): Promise<void> {
    if (!file) return;
    // Reject oversized files before reading them into memory. `file.size` is
    // present on all evergreen browsers; guard for the rare undefined case.
    if (typeof file.size === 'number' && file.size > MAX_IMPORT_BYTES) {
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      const maxMb = (MAX_IMPORT_BYTES / (1024 * 1024)).toFixed(0);
      this._status(`File too large (${mb} MB); import cap is ${maxMb} MB.`);
      this._clearSchema();
      return;
    }
    const text = await file.text();
    const ext = file.name.toLowerCase().split('.').pop() ?? '';
    const bytes = new TextEncoder().encode(text);

    let parsed: { dataset: Dataset; topology: TopologyType; encodings: Record<string, string> };
    try {
      parsed = this._parseViaKernel(bytes, ext, file.name);
    } catch (err: unknown) {
      this._status(`Error parsing file: ${err instanceof Error ? err.message : String(err)}`);
      this._clearSchema();
      return;
    }

    const { dataset, topology, encodings } = parsed;

    const validation = validateImport(dataset, { maxRows: 100_000, maxColumns: 1_000 });
    const message = formatValidationResult(validation);
    if (!validation.ok) {
      this._status(message || 'Import failed.');
      this._clearSchema();
      return;
    }

    this._renderSchema(dataset, topology, encodings, validation.warnings);
    this._status(message || `Loaded ${dataset.rowCount} rows from ${file.name} as ${topology}`);
    this.onLoad({
      name: file.name,
      topology,
      dataset,
      encodings,
    });
  }

  /**
   * Parse file bytes through the mandatory kernel (via AtlasCore) and derive
   * topology + encodings before releasing the transient handle. There is no JS
   * parse/topology/encoding fallback: if the kernel is unavailable this throws
   * and the caller surfaces the error.
   */
  private _parseViaKernel(
    bytes: Uint8Array,
    ext: string,
    name: string
  ): { dataset: Dataset; topology: TopologyType; encodings: Record<string, string> } {
    if (!this.atlas) {
      throw new Error('Analytical kernel unavailable — cannot parse file');
    }
    if (ext !== 'csv' && ext !== 'json') {
      throw new Error('Unsupported file type; use .csv or .json');
    }
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
}
