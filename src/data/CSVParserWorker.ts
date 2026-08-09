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
   * Process a CSV parsing request asynchronously off the WebXR main render thread using Blob Worker.
   */
  static async parseAsync(request: CSVWorkerRequest): Promise<CSVWorkerResponse> {
    if (typeof window !== 'undefined' && typeof Worker !== 'undefined' && typeof Blob !== 'undefined') {
      return new Promise((resolve, reject) => {
        try {
          const workerCode = `
            self.onmessage = function(e) {
              const { datasetName, csvText, options } = e.data;
              const lines = csvText.split(/\\r?\\n/).map(l => l.trim()).filter(l => l.length > 0);
              const header = lines[0] ? lines[0].split(',') : [];
              const dataLines = lines.slice(1);
              const rows = dataLines.map(line => {
                const parts = line.split(',');
                const obj = {};
                header.forEach((h, idx) => {
                  const val = parts[idx] || '';
                  const num = Number(val);
                  obj[h] = isNaN(num) ? val : num;
                });
                return obj;
              });
              self.postMessage({
                datasetName,
                columns: header.map(h => ({ name: h, type: 'NUMERIC' })),
                rows
              });
            };
          `;

          const blob = new Blob([workerCode], { type: 'application/javascript' });
          const url = URL.createObjectURL(blob);
          const worker = new Worker(url);

          worker.onmessage = (event) => {
            URL.revokeObjectURL(url);
            worker.terminate();
            resolve(event.data);
          };

          worker.onerror = (err) => {
            URL.revokeObjectURL(url);
            worker.terminate();
            reject(err);
          };

          worker.postMessage(request);
        } catch {
          // Fallback to inline parsing if Blob Worker creation fails
          const dataset = CSVDataParser.parseToDataset(request.datasetName, request.csvText, request.options);
          resolve({
            datasetName: dataset.name,
            columns: dataset.columns.map((c) => ({ name: c.name, type: String(c.type) })),
            rows: dataset.rows,
          });
        }
      });
    }

    const dataset = CSVDataParser.parseToDataset(request.datasetName, request.csvText, request.options);
    return {
      datasetName: dataset.name,
      columns: dataset.columns.map((c) => ({ name: c.name, type: String(c.type) })),
      rows: dataset.rows,
    };
  }
}
