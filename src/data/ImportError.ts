import type { Dataset } from './Dataset.ts';

export const ImportErrorCode = {
  EMPTY_FILE: 'EMPTY_FILE',
  NO_ROWS: 'NO_ROWS',
  NO_COLUMNS: 'NO_COLUMNS',
  ALL_TEXT_COLUMNS: 'ALL_TEXT_COLUMNS',
  ROW_LENGTH_MISMATCH: 'ROW_LENGTH_MISMATCH',
  MAX_ROWS_EXCEEDED: 'MAX_ROWS_EXCEEDED',
  MAX_COLUMNS_EXCEEDED: 'MAX_COLUMNS_EXCEEDED',
  PARSE_ERROR: 'PARSE_ERROR',
  UNSUPPORTED_FORMAT: 'UNSUPPORTED_FORMAT',
} as const;

export type ImportErrorCodeValue = (typeof ImportErrorCode)[keyof typeof ImportErrorCode];

/**
 * Structured import error with a machine-readable code and a human-readable
 * message. Used by the loader UI to decide whether to block the load or just
 * warn the user.
 */
export class ImportError extends Error {
  code: ImportErrorCodeValue;
  fatal: boolean;

  constructor(code: ImportErrorCodeValue, message: string, fatal: boolean = true) {
    super(message);
    this.code = code;
    this.fatal = fatal;
  }
}

export class ImportWarning extends Error {
  code: ImportErrorCodeValue;

  constructor(code: ImportErrorCodeValue, message: string) {
    super(message);
    this.code = code;
  }
}

export interface ValidationOptions {
  maxRows?: number;
  maxColumns?: number;
  rowLengthMismatchTolerance?: number;
}

export interface ValidationResult {
  ok: boolean;
  errors: ImportError[];
  warnings: ImportWarning[];
}

/**
 * Validate a parsed dataset before it is handed to World.loadDataset.
 */
export function validateImport(
  dataset: Dataset | null | undefined,
  options: ValidationOptions = {}
): ValidationResult {
  const errors: ImportError[] = [];
  const warnings: ImportWarning[] = [];
  const {
    maxRows = Infinity,
    maxColumns = Infinity,
    rowLengthMismatchTolerance = 0.05,
  } = options;

  if (!dataset) {
    errors.push(
      new ImportError(ImportErrorCode.PARSE_ERROR, 'No dataset was produced from the file.', true)
    );
    return { ok: false, errors, warnings };
  }

  if (dataset.columnCount === 0) {
    errors.push(
      new ImportError(
        ImportErrorCode.NO_COLUMNS,
        'The file has no columns. Check that the first line is a header.',
        true
      )
    );
  }

  if (dataset.rowCount === 0) {
    errors.push(
      new ImportError(ImportErrorCode.NO_ROWS, 'The file has a header but no data rows.', true)
    );
  }

  if (dataset.rowCount > maxRows) {
    errors.push(
      new ImportError(
        ImportErrorCode.MAX_ROWS_EXCEEDED,
        `Dataset has ${dataset.rowCount} rows; maximum allowed is ${maxRows}.`,
        true
      )
    );
  }

  if (dataset.columnCount > maxColumns) {
    errors.push(
      new ImportError(
        ImportErrorCode.MAX_COLUMNS_EXCEEDED,
        `Dataset has ${dataset.columnCount} columns; maximum allowed is ${maxColumns}.`,
        true
      )
    );
  }

  const allText = dataset.columns.length > 0 && dataset.columns.every((c) => c.type === 'TEXT');
  if (allText) {
    warnings.push(
      new ImportWarning(
        ImportErrorCode.ALL_TEXT_COLUMNS,
        'All columns were parsed as text. Check for quoted numbers or unusual delimiters.'
      )
    );
  }

  // Row-length mismatch check: compare row key count to header count.
  if (dataset.rows.length > 0) {
    const expected = dataset.columnCount;
    let mismatched = 0;
    for (const row of dataset.rows) {
      if (Object.keys(row).length !== expected) {
        mismatched++;
      }
    }
    const fraction = mismatched / dataset.rows.length;
    if (fraction > rowLengthMismatchTolerance) {
      errors.push(
        new ImportError(
          ImportErrorCode.ROW_LENGTH_MISMATCH,
          `${Math.round(fraction * 100)}% of rows have a different number of columns than the header. Check for embedded newlines or delimiter mismatch.`,
          true
        )
      );
    } else if (mismatched > 0) {
      warnings.push(
        new ImportWarning(
          ImportErrorCode.ROW_LENGTH_MISMATCH,
          `${mismatched} rows have a different number of columns than the header.`
        )
      );
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Format errors and warnings into a single status message suitable for the
 * loader UI.
 */
export function formatValidationResult(result: ValidationResult): string | null {
  if (!result.ok) {
    const first = result.errors[0];
    return `Error: ${first.message}`;
  }
  if (result.warnings.length > 0) {
    return `Loaded with ${result.warnings.length} warning${result.warnings.length === 1 ? '' : 's'}: ${result.warnings.map((w) => w.message).join('; ')}`;
  }
  return null;
}
