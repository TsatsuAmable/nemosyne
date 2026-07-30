import { Dataset, ColumnType } from '../Dataset.js';
import { inferType } from '../Parsers.js';

/**
 * Build a {@link Dataset} from raw row objects.
 *
 * @param {Array<Record<string, any>>} rows
 * @param {string} name
 * @returns {import('../Dataset.js').Dataset}
 */
export function rowsToDataset(rows, name = 'Live Stream') {
  if (!Array.isArray(rows) || rows.length === 0) {
    return new Dataset({ name, columns: [], rows: [] });
  }

  const keys = Object.keys(rows[0]);
  /** @type {import('../Dataset.js').Column[]} */
  const columns = keys.map((key) => {
    const values = rows.map((row) => row[key]);
    return { name: key, type: inferType(values) };
  });

  return new Dataset(name, columns, rows);
}

/**
 * Coerce a live message into a normalized update.
 *
 * Accepts either:
 *  - `{ rows: [...], topology: 'TIME_SERIES' }`
 *  - `{ dataset: Dataset, topology: 'TIME_SERIES' }`
 *
 * @param {any} message
 * @param {string} [defaultTopology]
 * @returns {{ dataset: import('../Dataset.js').Dataset, topology: string } | null}
 */
export function normalizeLiveMessage(message, defaultTopology = 'TIME_SERIES') {
  if (!message || typeof message !== 'object') return null;

  let dataset = null;
  let topology = message.topology || defaultTopology;

  if (message.dataset instanceof Dataset) {
    dataset = message.dataset;
  } else if (message.rows && Array.isArray(message.rows)) {
    dataset = rowsToDataset(message.rows, message.name || 'Live Stream');
  }

  if (!dataset) return null;
  return { dataset, topology };
}
