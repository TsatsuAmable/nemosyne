import type {
  ClosedPayloadSchemaV1,
  GovernanceValidationIssue,
  JsonValue,
} from './GovernedEventContracts.ts';
import { SHA256_HEX, isRecord, isValidUtcTimestamp } from './GovernedEventValidationSupport.ts';

export function validatePayloadAgainstSchema(
  value: JsonValue,
  schema: ClosedPayloadSchemaV1,
  path: string,
  issues: GovernanceValidationIssue[]
): void {
  if (schema.type === 'object') {
    if (!isRecord(value)) {
      issues.push({ code: 'PAYLOAD_SCHEMA_MISMATCH', path, message: 'must be an object' });
      return;
    }
    for (const key of Object.keys(value)) {
      if (!Object.hasOwn(schema.properties, key)) {
        issues.push({
          code: 'PAYLOAD_UNKNOWN_PROPERTY',
          path: `${path}.${key}`,
          message: 'property is not declared by the closed payload schema',
        });
      } else {
        validatePayloadAgainstSchema(value[key], schema.properties[key], `${path}.${key}`, issues);
      }
    }
    for (const key of schema.required) {
      if (!Object.hasOwn(value, key)) {
        issues.push({
          code: 'PAYLOAD_MISSING_PROPERTY',
          path: `${path}.${key}`,
          message: 'property is required',
        });
      }
    }
    return;
  }
  if (schema.type === 'array') {
    if (!Array.isArray(value)) {
      issues.push({ code: 'PAYLOAD_SCHEMA_MISMATCH', path, message: 'must be an array' });
      return;
    }
    if (value.length < schema.minItems || value.length > schema.maxItems) {
      issues.push({
        code: 'PAYLOAD_ARRAY_BOUNDS',
        path,
        message: `must contain ${schema.minItems} to ${schema.maxItems} items`,
      });
    }
    value.forEach((entry, index) =>
      validatePayloadAgainstSchema(entry, schema.items, `${path}[${index}]`, issues)
    );
    return;
  }
  if (schema.type === 'string') {
    if (typeof value !== 'string') {
      issues.push({ code: 'PAYLOAD_SCHEMA_MISMATCH', path, message: 'must be a string' });
      return;
    }
    if (value.length < schema.minLength || value.length > schema.maxLength) {
      issues.push({
        code: 'PAYLOAD_STRING_BOUNDS',
        path,
        message: `must contain ${schema.minLength} to ${schema.maxLength} code units`,
      });
    }
    if (schema.allowedValues && !schema.allowedValues.includes(value)) {
      issues.push({
        code: 'PAYLOAD_ENUM_MISMATCH',
        path,
        message: 'value is not in the closed enumeration',
      });
    }
    if (schema.format === 'UTC_TIMESTAMP' && !isValidUtcTimestamp(value)) {
      issues.push({
        code: 'PAYLOAD_FORMAT_MISMATCH',
        path,
        message: 'must be a valid millisecond-precision UTC timestamp',
      });
    }
    if (schema.format === 'SHA256_HEX' && !SHA256_HEX.test(value)) {
      issues.push({
        code: 'PAYLOAD_FORMAT_MISMATCH',
        path,
        message: 'must be lowercase SHA-256 hexadecimal',
      });
    }
    return;
  }
  if (schema.type === 'number' || schema.type === 'integer') {
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      (schema.type === 'integer' && !Number.isSafeInteger(value)) ||
      value < schema.minimum ||
      value > schema.maximum
    ) {
      issues.push({
        code: 'PAYLOAD_NUMBER_BOUNDS',
        path,
        message: `must be a ${schema.type} from ${schema.minimum} to ${schema.maximum}`,
      });
    }
    return;
  }
  if (schema.type === 'boolean' && typeof value !== 'boolean') {
    issues.push({ code: 'PAYLOAD_SCHEMA_MISMATCH', path, message: 'must be boolean' });
  }
  if (schema.type === 'null' && value !== null) {
    issues.push({ code: 'PAYLOAD_SCHEMA_MISMATCH', path, message: 'must be null' });
  }
}
