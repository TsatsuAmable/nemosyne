import { Dataset } from '../Dataset.ts';
import { inferType } from '../Parsers.ts';

/**
 * Build a {@link Dataset} from raw row objects.
 */
export function rowsToDataset(rows: Record<string, unknown>[], name: string = 'Live Stream'): Dataset {
  if (!Array.isArray(rows) || rows.length === 0) {
    return new Dataset(name, [], []);
  }

  const rawKeys = Object.keys(rows[0]);
  const keys = rawKeys.filter((key) => key !== '__proto__' && key !== 'constructor' && key !== 'prototype');
  const columns = keys.map((key) => {
    const values = rows.map((row) => row[key]);
    return { name: key, type: inferType(values) };
  });

  return new Dataset(name, columns, rows);
}

export interface LiveMessage {
  dataset?: Dataset;
  rows?: Record<string, unknown>[];
  name?: string;
  topology?: string;
}

export interface NormalizedLiveUpdate {
  dataset: Dataset;
  topology: string;
}

/**
 * Coerce a live message into a normalized update.
 */
export function normalizeLiveMessage(
  message: LiveMessage | unknown,
  defaultTopology: string = 'TIME_SERIES'
): NormalizedLiveUpdate | null {
  if (!message || typeof message !== 'object') return null;

  const msg = message as LiveMessage;
  let dataset: Dataset | null = null;
  const topology = msg.topology || defaultTopology;

  if (msg.dataset instanceof Dataset) {
    dataset = msg.dataset;
  } else if (msg.rows && Array.isArray(msg.rows)) {
    dataset = rowsToDataset(msg.rows, msg.name || 'Live Stream');
  }

  if (!dataset) return null;
  return { dataset, topology };
}
