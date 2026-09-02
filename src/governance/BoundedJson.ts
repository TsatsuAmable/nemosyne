import type { JsonValue } from './GovernedEventContracts.ts';

export interface BoundedJsonLimits {
  readonly maxUtf8Bytes: number;
  readonly maxDepth: number;
  readonly maxNodes: number;
}

export class BoundedJsonParseError extends Error {
  readonly code: string;
  readonly offset: number;

  constructor(code: string, message: string, offset: number) {
    super(message);
    this.name = 'BoundedJsonParseError';
    this.code = code;
    this.offset = offset;
  }
}

function hasUnpairedSurrogate(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (index + 1 >= value.length || next < 0xdc00 || next > 0xdfff) return true;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return true;
    }
  }
  return false;
}

function utf8ByteLengthThroughLimit(value: string, limit: number): number {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (index + 1 < value.length && next >= 0xdc00 && next <= 0xdfff) index += 1;
      bytes += 4;
    } else bytes += 3;
    if (bytes > limit) return bytes;
  }
  return bytes;
}

/** Parse hostile JSON text without silently accepting duplicate object keys. */
export function parseBoundedJsonV1(text: string, limits: BoundedJsonLimits): JsonValue {
  const byteLength = utf8ByteLengthThroughLimit(text, limits.maxUtf8Bytes);
  if (byteLength > limits.maxUtf8Bytes) {
    throw new BoundedJsonParseError(
      'JSON_INPUT_TOO_LARGE',
      `JSON input is ${byteLength} bytes; maximum is ${limits.maxUtf8Bytes}`,
      0
    );
  }

  let offset = 0;
  let nodes = 0;

  const fail = (code: string, message: string): never => {
    throw new BoundedJsonParseError(code, message, offset);
  };

  const skipWhitespace = (): void => {
    while (offset < text.length && /[\t\n\r ]/.test(text[offset])) offset += 1;
  };

  const countNode = (): void => {
    nodes += 1;
    if (nodes > limits.maxNodes) {
      fail('JSON_NODE_LIMIT', `JSON node count exceeds ${limits.maxNodes}`);
    }
  };

  const parseString = (): string => {
    const start = offset;
    offset += 1;
    let escaped = false;
    while (offset < text.length) {
      const code = text.charCodeAt(offset);
      if (!escaped && code === 0x22) {
        offset += 1;
        const value = (() => {
          try {
            return JSON.parse(text.slice(start, offset)) as string;
          } catch {
            return fail('INVALID_JSON_STRING', 'Invalid JSON string escape');
          }
        })();
        if (hasUnpairedSurrogate(value)) {
          fail(
            'UNPAIRED_UNICODE_SURROGATE',
            'JSON strings must not contain unpaired UTF-16 surrogates'
          );
        }
        return value;
      }
      if (!escaped && code < 0x20)
        fail('INVALID_JSON_STRING', 'Unescaped control character in JSON string');
      if (!escaped && code === 0x5c) {
        escaped = true;
      } else {
        escaped = false;
      }
      offset += 1;
    }
    return fail('UNTERMINATED_JSON_STRING', 'Unterminated JSON string');
  };

  const numberPattern = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
  const parseNumber = (): number => {
    numberPattern.lastIndex = offset;
    const match = numberPattern.exec(text);
    if (!match) return fail('INVALID_JSON_NUMBER', 'Invalid JSON number');
    offset += match[0].length;
    const value = Number(match[0]);
    if (!Number.isFinite(value))
      return fail('NON_FINITE_JSON_NUMBER', 'JSON number must be finite');
    return value;
  };

  const parseValue = (depth: number): JsonValue => {
    if (depth > limits.maxDepth) {
      return fail('JSON_DEPTH_LIMIT', `JSON nesting exceeds ${limits.maxDepth}`);
    }
    skipWhitespace();
    countNode();
    const token = text[offset];

    if (token === '"') return parseString();
    if (token === '-' || (token >= '0' && token <= '9')) return parseNumber();
    if (text.startsWith('true', offset)) {
      offset += 4;
      return true;
    }
    if (text.startsWith('false', offset)) {
      offset += 5;
      return false;
    }
    if (text.startsWith('null', offset)) {
      offset += 4;
      return null;
    }

    if (token === '[') {
      offset += 1;
      const result: JsonValue[] = [];
      skipWhitespace();
      if (text[offset] === ']') {
        offset += 1;
        return result;
      }
      while (offset < text.length) {
        result.push(parseValue(depth + 1));
        skipWhitespace();
        if (text[offset] === ']') {
          offset += 1;
          return result;
        }
        if (text[offset] !== ',')
          return fail('INVALID_JSON_ARRAY', 'Expected comma or closing bracket');
        offset += 1;
      }
      return fail('UNTERMINATED_JSON_ARRAY', 'Unterminated JSON array');
    }

    if (token === '{') {
      offset += 1;
      const result: Record<string, JsonValue> = Object.create(null) as Record<string, JsonValue>;
      const keys = new Set<string>();
      skipWhitespace();
      if (text[offset] === '}') {
        offset += 1;
        return result;
      }
      while (offset < text.length) {
        skipWhitespace();
        if (text[offset] !== '"')
          return fail('INVALID_JSON_OBJECT', 'Expected a quoted object key');
        const key = parseString();
        if (keys.has(key)) return fail('DUPLICATE_JSON_KEY', `Duplicate JSON object key: ${key}`);
        keys.add(key);
        skipWhitespace();
        if (text[offset] !== ':')
          return fail('INVALID_JSON_OBJECT', 'Expected colon after object key');
        offset += 1;
        result[key] = parseValue(depth + 1);
        skipWhitespace();
        if (text[offset] === '}') {
          offset += 1;
          return result;
        }
        if (text[offset] !== ',')
          return fail('INVALID_JSON_OBJECT', 'Expected comma or closing brace');
        offset += 1;
      }
      return fail('UNTERMINATED_JSON_OBJECT', 'Unterminated JSON object');
    }

    return fail('INVALID_JSON_TOKEN', 'Invalid JSON token');
  };

  skipWhitespace();
  if (offset >= text.length) fail('EMPTY_JSON_INPUT', 'JSON input is empty');
  const value = parseValue(0);
  skipWhitespace();
  if (offset !== text.length)
    fail('TRAILING_JSON_CONTENT', 'Unexpected content after the JSON value');
  return value;
}
