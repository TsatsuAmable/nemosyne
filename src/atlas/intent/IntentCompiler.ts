/**
 * IntentCompiler for Nemosyne Atlas 7.
 *
 * Compiles natural language analytical queries into deterministic, versioned
 * `OperationSpec` and `Predicate` DSL trees against the active dataset schema.
 */

import type { DatasetJSON, Predicate, OperationSpec, AggregatorFn } from '../../data/types.ts';
import type { ParsedIntent, IntentKind } from './types.ts';

export class IntentCompiler {
  /**
   * Compiles a natural language query against a dataset schema into a deterministic ParsedIntent.
   */
  compile(query: string, dataset: DatasetJSON): ParsedIntent {
    const trimmed = query.trim();
    if (!trimmed) {
      return {
        kind: 'unknown',
        rawQuery: query,
        matchedColumns: [],
        description: 'Empty query',
        confidence: 0.0,
        warnings: ['Query cannot be empty'],
      };
    }

    const lowerQuery = trimmed.toLowerCase();
    const columns = dataset.columns.map((c) => c.name);

    // 1. Reset / Clear
    if (/^(reset|clear all|reset filters|clear)$/i.test(trimmed)) {
      return {
        kind: 'reset',
        rawQuery: query,
        matchedColumns: [],
        description: 'Reset all active filters and transformations',
        confidence: 1.0,
      };
    }

    // 2. Anomaly Detection
    const anomalyMatch = lowerQuery.match(/(?:find|show|detect|get)?\s*(?:outliers?|anomal(?:y|ies))\s+(?:in|on|for|by)?\s*([a-zA-Z0-9_]+)/i)
      || lowerQuery.match(/([a-zA-Z0-9_]+)\s*(?:outliers?|anomal(?:y|ies))/i);

    if (anomalyMatch) {
      const colName = this._resolveColumn(anomalyMatch[1], columns);
      if (colName) {
        const isZScore = lowerQuery.includes('zscore') || lowerQuery.includes('z-score');
        const op: OperationSpec = isZScore
          ? { op: 'anomaly_zscore', column: colName, sensitivity: 3.0 }
          : { op: 'anomaly_iqr', column: colName, sensitivity: 1.5 };

        return {
          kind: 'anomaly',
          rawQuery: query,
          matchedColumns: [colName],
          operation: op,
          description: `Detect statistical anomalies on column '${colName}' using ${isZScore ? 'Z-score' : 'IQR'}`,
          confidence: 0.95,
        };
      }
    }

    // 3. Aggregations (e.g. "sum amount by cluster", "mean risk_score grouped by account_type")
    const aggMatch = lowerQuery.match(/(sum|mean|median|min|max|count|average|avg)\s+([a-zA-Z0-9_]+)\s+(?:by|grouped by|per)\s+([a-zA-Z0-9_]+)/i);
    if (aggMatch) {
      let funcName = aggMatch[1].toLowerCase();
      if (funcName === 'average' || funcName === 'avg') funcName = 'mean';
      const measureCol = this._resolveColumn(aggMatch[2], columns);
      const groupCol = this._resolveColumn(aggMatch[3], columns);

      if (measureCol && groupCol) {
        const op: OperationSpec = {
          op: 'aggregate',
          group_by: groupCol,
          aggregators: [{ column: measureCol, function: funcName as AggregatorFn }],
        };

        return {
          kind: 'aggregate',
          rawQuery: query,
          matchedColumns: [measureCol, groupCol],
          operation: op,
          description: `Aggregate '${measureCol}' (${funcName}) grouped by '${groupCol}'`,
          confidence: 0.95,
        };
      }
    }

    // 4. Numeric Range Filter: "between X and Y"
    const betweenMatch = lowerQuery.match(/([a-zA-Z0-9_]+)\s+(?:is\s+)?between\s+([\d.-]+)\s+(?:and|to)\s+([\d.-]+)/i);
    if (betweenMatch) {
      const colName = this._resolveColumn(betweenMatch[1], columns);
      const lo = parseFloat(betweenMatch[2]);
      const hi = parseFloat(betweenMatch[3]);

      if (colName && !isNaN(lo) && !isNaN(hi)) {
        const predicate: Predicate = { op: 'between', column: colName, lo, hi };
        return {
          kind: 'filter',
          rawQuery: query,
          matchedColumns: [colName],
          predicate,
          operation: { op: 'filter', predicate },
          description: `Filter '${colName}' between ${lo} and ${hi}`,
          confidence: 0.95,
        };
      }
    }

    // 5. Numeric Comparison Filters (>, >=, <, <=)
    const compMatch = lowerQuery.match(/([a-zA-Z0-9_]+)\s*(>=|<=|>|<|greater than|less than|at least|at most)\s*([\d.-]+)/i);
    if (compMatch) {
      const colName = this._resolveColumn(compMatch[1], columns);
      const rawOp = compMatch[2].toLowerCase();
      const val = parseFloat(compMatch[3]);

      if (colName && !isNaN(val)) {
        let opKind: 'gt' | 'gte' | 'lt' | 'lte' = 'gt';
        if (rawOp === '>=' || rawOp === 'at least') opKind = 'gte';
        else if (rawOp === '<' || rawOp === 'less than') opKind = 'lt';
        else if (rawOp === '<=' || rawOp === 'at most') opKind = 'lte';

        const predicate: Predicate = { op: opKind, column: colName, value: val };
        return {
          kind: 'filter',
          rawQuery: query,
          matchedColumns: [colName],
          predicate,
          operation: { op: 'filter', predicate },
          description: `Filter '${colName}' ${opKind} ${val}`,
          confidence: 0.95,
        };
      }
    }

    // 6. Categorical / Equality Filters (==, !=, is, is not, in)
    const inMatch = lowerQuery.match(/([a-zA-Z0-9_]+)\s+(?:in|one of)\s*\(([^)]+)\)/i);
    if (inMatch) {
      const colName = this._resolveColumn(inMatch[1], columns);
      if (colName) {
        const values = inMatch[2].split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, ''));
        const predicate: Predicate = { op: 'in', column: colName, values };
        return {
          kind: 'filter',
          rawQuery: query,
          matchedColumns: [colName],
          predicate,
          operation: { op: 'filter', predicate },
          description: `Filter '${colName}' in [${values.join(', ')}]`,
          confidence: 0.9,
        };
      }
    }

    const eqMatch = lowerQuery.match(/([a-zA-Z0-9_]+)\s*(?:==|=|is)\s*['"]?([a-zA-Z0-9_.-]+)['"]?/i);
    if (eqMatch && !lowerQuery.includes('between')) {
      const colName = this._resolveColumn(eqMatch[1], columns);
      if (colName) {
        const rawVal = eqMatch[2].trim();
        const value = !isNaN(Number(rawVal)) ? Number(rawVal) : (rawVal === 'true' ? true : rawVal === 'false' ? false : rawVal);
        const predicate: Predicate = { op: 'eq', column: colName, value };
        return {
          kind: 'filter',
          rawQuery: query,
          matchedColumns: [colName],
          predicate,
          operation: { op: 'filter', predicate },
          description: `Filter '${colName}' == ${JSON.stringify(value)}`,
          confidence: 0.9,
        };
      }
    }

    // 7. Clustering Request
    if (lowerQuery.includes('cluster') || lowerQuery.includes('k-means')) {
      return {
        kind: 'cluster',
        rawQuery: query,
        matchedColumns: [],
        operation: { op: 'k_means', k: 3 },
        description: 'Cluster dataset into topological groupings using K-means',
        confidence: 0.85,
      };
    }

    return {
      kind: 'unknown',
      rawQuery: query,
      matchedColumns: [],
      description: `Unable to compile query into a deterministic analytical operation: "${query}"`,
      confidence: 0.0,
      warnings: ['No matching column or supported analytical syntax pattern found'],
    };
  }

  private _resolveColumn(input: string, columns: string[]): string | null {
    const clean = input.trim().toLowerCase();
    for (const col of columns) {
      if (col.toLowerCase() === clean) return col;
    }
    // Partial substring match if unique
    const partials = columns.filter((col) => col.toLowerCase().includes(clean));
    if (partials.length === 1) return partials[0];
    return null;
  }
}
