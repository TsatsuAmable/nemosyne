/**
 * Upload Sanitizer & Adversarial Input Hardening.
 *
 * Enforces file size limits, row count limits, path traversal filtering,
 * and recursive prototype pollution neutralization for untrusted input data.
 */

export interface SanitizationOptions {
  maxSizeBytes?: number;
  maxRowCount?: number;
  maxColumnCount?: number;
}

export interface SanitizedUploadResult {
  valid: boolean;
  cleanFileName: string;
  error?: string;
}

const DEFAULT_MAX_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB
const DEFAULT_MAX_ROW_COUNT = 500_000;
const DEFAULT_MAX_COLUMN_COUNT = 1_000;

const DANGEROUS_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export class UploadSanitizer {
  /**
   * Sanitize a file name against path traversal, control chars, and null bytes.
   */
  static sanitizeFileName(rawName: string): string {
    if (!rawName || typeof rawName !== 'string') {
      return 'unnamed_dataset';
    }
    // Strip directory traversal, null bytes, and non-printable control characters
    const printable = Array.from(rawName)
      .filter((ch) => {
        const code = ch.charCodeAt(0);
        return code >= 32 && code !== 127;
      })
      .join('');

    const clean = printable
      .replace(/[\\/]/g, '_')
      .replace(/\.{2,}/g, '.')
      .trim();

    return clean.length > 0 ? clean : 'sanitized_dataset';
  }

  /**
   * Validate raw uploaded byte buffer before parsing into memory.
   */
  static validateUploadBytes(
    bytes: Uint8Array,
    rawFileName: string,
    options: SanitizationOptions = {}
  ): SanitizedUploadResult {
    const maxBytes = options.maxSizeBytes ?? DEFAULT_MAX_SIZE_BYTES;
    const cleanFileName = this.sanitizeFileName(rawFileName);

    if (!bytes || bytes.byteLength === 0) {
      return { valid: false, cleanFileName, error: 'Upload payload is empty' };
    }

    if (bytes.byteLength > maxBytes) {
      return {
        valid: false,
        cleanFileName,
        error: `Upload size ${bytes.byteLength} bytes exceeds maximum allowed limit of ${maxBytes} bytes`,
      };
    }

    return { valid: true, cleanFileName };
  }

  /**
   * Recursively neutralize dangerous keys to eliminate prototype pollution.
   */
  static neutralizeObject<T>(input: T): T {
    if (!input || typeof input !== 'object') {
      return input;
    }

    if (Array.isArray(input)) {
      return input.map((item) => this.neutralizeObject(item)) as unknown as T;
    }

    const clean: Record<string, unknown> = Object.create(null);
    for (const key of Object.keys(input as Record<string, unknown>)) {
      if (DANGEROUS_OBJECT_KEYS.has(key)) {
        continue;
      }
      clean[key] = this.neutralizeObject((input as Record<string, unknown>)[key]);
    }
    return clean as T;
  }

  /**
   * Validate row and column metrics after structural parsing.
   */
  static validateDatasetMetrics(
    rowCount: number,
    columnCount: number,
    options: SanitizationOptions = {}
  ): { valid: boolean; error?: string } {
    const maxRows = options.maxRowCount ?? DEFAULT_MAX_ROW_COUNT;
    const maxCols = options.maxColumnCount ?? DEFAULT_MAX_COLUMN_COUNT;

    if (rowCount > maxRows) {
      return {
        valid: false,
        error: `Row count ${rowCount} exceeds maximum allowed limit of ${maxRows}`,
      };
    }

    if (columnCount > maxCols) {
      return {
        valid: false,
        error: `Column count ${columnCount} exceeds maximum allowed limit of ${maxCols}`,
      };
    }

    return { valid: true };
  }
}
