/**
 * Robust Client-Side CSV / TSV Parser & Schema Auto-Inference Engine.
 *
 * Parses raw CSV/TSV text streams, handles quoted fields and escaped delimiters,
 * automatically infers column data types (NUMERIC, CATEGORICAL, TEMPORAL),
 * and produces valid Nemosyne Dataset instances for WebXR rendering.
 */

import { Dataset, ColumnType, type ColumnTypeValue } from './Dataset.ts';
import type { ColumnSchema } from './types.ts';

export interface CSVParseOptions {
  delimiter?: string;
  hasHeader?: boolean;
  trimWhitespace?: boolean;
}

export interface InferredSchema {
  columns: ColumnSchema[];
  rowCount: number;
}

export class CSVDataParser {
  /**
   * Parse a raw CSV/TSV string into a rows array of string values.
   */
  static parseRawRows(text: string, options: CSVParseOptions = {}): string[][] {
    const delimiter = options.delimiter ?? (text.includes('\t') ? '\t' : ',');
    const trim = options.trimWhitespace ?? true;

    const lines: string[][] = [];
    let currentRow: string[] = [];
    let currentCell = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentCell += '"';
          i++; // Skip escaped quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        currentRow.push(trim ? currentCell.trim() : currentCell);
        currentCell = '';
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++; // Handle CRLF
        }
        currentRow.push(trim ? currentCell.trim() : currentCell);
        if (currentRow.some((c) => c.length > 0)) {
          lines.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += char;
      }
    }

    if (currentCell.length > 0 || currentRow.length > 0) {
      currentRow.push(trim ? currentCell.trim() : currentCell);
      if (currentRow.some((c) => c.length > 0)) {
        lines.push(currentRow);
      }
    }

    return lines;
  }

  /**
   * Infer column data types from sample values.
   */
  static inferColumnType(values: string[]): ColumnTypeValue {
    const nonNulls = values.filter((v) => v != null && v !== '');
    if (nonNulls.length === 0) return ColumnType.UNKNOWN;

    // Check Numeric
    let numericCount = 0;
    for (const val of nonNulls) {
      if (!Number.isNaN(Number(val))) {
        numericCount++;
      }
    }
    if (numericCount / nonNulls.length >= 0.85) {
      return ColumnType.NUMERIC;
    }

    // Check Temporal Date
    let dateCount = 0;
    for (const val of nonNulls) {
      const parsed = Date.parse(val);
      if (!Number.isNaN(parsed) && val.length >= 4 && (val.includes('-') || val.includes('/') || val.includes(':'))) {
        dateCount++;
      }
    }
    if (dateCount / nonNulls.length >= 0.85) {
      return ColumnType.TEMPORAL;
    }

    return ColumnType.CATEGORICAL;
  }

  /**
   * Parse CSV string directly into a Nemosyne Dataset instance.
   */
  static parseToDataset(name: string, csvText: string, options: CSVParseOptions = {}): Dataset {
    const rawRows = this.parseRawRows(csvText, options);
    if (rawRows.length === 0) {
      return new Dataset(name, [], []);
    }

    const hasHeader = options.hasHeader ?? true;
    const header = hasHeader
      ? rawRows[0]
      : rawRows[0].map((_, idx) => `column_${idx + 1}`);

    const dataRows = hasHeader ? rawRows.slice(1) : rawRows;

    // Build column schemas with inferred types
    const columns: ColumnSchema[] = header.map((colName, colIdx) => {
      const sampleVals = dataRows.slice(0, 100).map((r) => r[colIdx] ?? '');
      const inferredType = this.inferColumnType(sampleVals);
      return {
        name: colName,
        type: inferredType,
      };
    });

    // Cast rows according to column schema
    const rows: Record<string, unknown>[] = dataRows.map((r) => {
      const rowObj: Record<string, unknown> = {};
      columns.forEach((col, idx) => {
        const rawVal = r[idx] ?? '';
        if (rawVal === '') {
          rowObj[col.name] = null;
        } else if (col.type === ColumnType.NUMERIC) {
          const num = Number(rawVal);
          rowObj[col.name] = Number.isNaN(num) ? null : num;
        } else {
          rowObj[col.name] = rawVal;
        }
      });
      return rowObj;
    });

    return new Dataset(name, columns, rows);
  }
}
