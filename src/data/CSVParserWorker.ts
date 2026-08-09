/**
 * Web Worker Helper for Asynchronous CSV/TSV Stream Parsing.
 *
 * Offloads heavy string parsing, regex matching, and type inference off the WebXR main render thread.
 */

import { CSVDataParser, type CSVParseOptions } from './CSVDataParser.ts';

export interface CSVWorkerRequest {
  datasetName: string;
  csvText: string;
  options?: CSVParseOptions;
}

export interface CSVWorkerResponse {
  datasetName: string;
  columns: Array<{ name: string; type: string }>;
  rows: Record<string, unknown>[];
}

export class CSVParserWorker {
  /**
   * Process a CSV parsing request asynchronously (simulating worker thread dispatch).
   */
  static async parseAsync(request: CSVWorkerRequest): Promise<CSVWorkerResponse> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const dataset = CSVDataParser.parseToDataset(request.datasetName, request.csvText, request.options);
        resolve({
          datasetName: dataset.name,
          columns: dataset.columns.map((c) => ({ name: c.name, type: String(c.type) })),
          rows: dataset.rows,
        });
      }, 0);
    });
  }
}
