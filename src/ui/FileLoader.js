import { parseCSV, parseJSON } from '../data/Parsers.js';
import { inferEncodings } from '../data/Encodings.js';
import { inferTopology, inferEncodingsForTopology } from '../data/TopologyInference.js';
import { validateImport, formatValidationResult } from '../data/ImportError.js';
import {
  allSampleDatasets,
  getSampleDataset,
  getDefaultEncodings,
} from '../data/SampleDatasets.js';
import { TopologyTypes } from '../draco/ConstraintEngine.js';

/**
 * DOM-based file loader and dataset selector.
 * Provides a small overlay panel for desktop debugging and headset pass-through.
 */
export class FileLoaderUI {
  constructor({ onLoad }) {
    this.onLoad = onLoad;
    this.container = this._buildUI();
    document.body.appendChild(this.container);
  }

  _buildUI() {
    const container = document.createElement('div');
    container.id = 'nemosyne-loader';
    container.style.cssText = this._containerStyle();

    const title = document.createElement('div');
    title.textContent = '// NEMOSYNE DATA LOADER';
    title.style.cssText =
      'font-weight: bold; margin-bottom: 10px; color: #00ffcc; text-shadow: 0 0 5px #00ffcc;';
    container.appendChild(title);

    // Quick control reference.
    const help = document.createElement('div');
    help.style.cssText = this._boxStyle();
    const strong = document.createElement('strong');
    strong.textContent = 'Controls';
    help.appendChild(strong);
    const lines = [
      'Point laser / index finger + trigger/pinch to select',
      'Controllers: left stick move, right stick turn',
      'Hands: pinch and drag to pull yourself around',
      'Desktop: WASD move, Q/E turn',
      'Draco HUD floats near your left shoulder',
    ];
    for (const line of lines) {
      help.appendChild(document.createElement('br'));
      help.appendChild(document.createTextNode(`• ${line}`));
    }
    container.appendChild(help);

    // Sample dataset selector.
    container.appendChild(this._label('Sample datasets'));

    const sampleSelect = document.createElement('select');
    sampleSelect.style.cssText = this._inputStyle();
    sampleSelect.appendChild(new Option('-- select a sample --', ''));
    for (const d of allSampleDatasets) {
      sampleSelect.appendChild(new Option(d.label, d.key));
    }
    sampleSelect.addEventListener('change', (e) => {
      const key = e.target.value;
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
    fileInput.addEventListener('change', (e) => this._handleFile(e.target.files[0]));
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

  _containerStyle() {
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

  _boxStyle() {
    return 'margin-bottom: 12px; padding: 8px; background: rgba(0, 30, 40, 0.6); border: 1px solid #005577; border-radius: 3px; color: #88ccff; font-size: 11px; line-height: 1.4;';
  }

  _label(text) {
    const el = document.createElement('div');
    el.textContent = text;
    el.style.cssText = 'margin: 8px 0 4px; color: #88ccff;';
    return el;
  }

  _inputStyle() {
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

  _divider() {
    const el = document.createElement('hr');
    el.style.cssText = 'border: none; border-top: 1px solid #005577; margin: 12px 0;';
    return el;
  }

  _emitSample(entry) {
    this._status(`Loaded sample: ${entry.label}`);
    this.onLoad({
      name: entry.label,
      topology: entry.topology,
      dataset: entry.dataset,
      maxDepth: entry.depth,
      encodings: getDefaultEncodings(entry),
    });
  }

  async _handleFile(file) {
    if (!file) return;
    const text = await file.text();
    let dataset;
    try {
      if (file.name.toLowerCase().endsWith('.csv')) {
        dataset = parseCSV(text, { name: file.name, maxRows: 100_000 });
      } else if (file.name.toLowerCase().endsWith('.json')) {
        dataset = parseJSON(text, { name: file.name, maxRows: 100_000 });
      } else {
        // Try JSON first, then CSV.
        try {
          dataset = parseJSON(text, { name: file.name, maxRows: 100_000 });
        } catch {
          dataset = parseCSV(text, { name: file.name, maxRows: 100_000 });
        }
      }
    } catch (err) {
      this._status(`Error parsing file: ${err.message}`);
      this._clearSchema();
      return;
    }

    const validation = validateImport(dataset, { maxRows: 100_000, maxColumns: 1_000 });
    const message = formatValidationResult(validation);
    if (!validation.ok) {
      this._status(message || 'Import failed.');
      this._clearSchema();
      return;
    }

    const explicitTopology = this.topologySelect.value || null;
    const topology = inferTopology(dataset, explicitTopology);
    const encodings = inferEncodingsForTopology(dataset, topology);

    this._renderSchema(dataset, topology, encodings, validation.warnings);
    this._status(message || `Loaded ${dataset.rowCount} rows from ${file.name} as ${topology}`);
    this.onLoad({
      name: file.name,
      topology,
      dataset,
      encodings,
    });
  }

  _renderSchema(dataset, topology, encodings, warnings) {
    const typeColor = {
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

  _schemaHeader(dataset, topology) {
    const header = document.createElement('div');
    header.style.cssText = 'font-weight:bold;margin-bottom:4px;';
    header.textContent = `${dataset.name} — ${topology} (${dataset.rowCount} rows)`;
    return header;
  }

  _schemaRow(column, usedBy, color) {
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

  _clearSchema() {
    this.schemaEl.innerHTML = '';
    this.schemaEl.style.display = 'none';
  }

  _status(msg) {
    this.statusEl.textContent = msg;
  }

  hide() {
    this.container.style.display = 'none';
  }

  show() {
    this.container.style.display = 'block';
  }
}
