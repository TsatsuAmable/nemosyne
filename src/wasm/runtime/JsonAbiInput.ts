const encoder = new TextEncoder();

class LossyJsonValueError extends Error {}

export function encodeJsonAbiInput(input: unknown): Uint8Array | null {
  try {
    const json = JSON.stringify(input, (_key, value) => {
      if (typeof value === 'number' && !Number.isFinite(value)) {
        throw new LossyJsonValueError();
      }
      if (typeof value === 'undefined' || typeof value === 'function' || typeof value === 'symbol') {
        throw new LossyJsonValueError();
      }
      return value;
    });
    if (typeof json !== 'string') return null;
    return encoder.encode(json);
  } catch {
    return null;
  }
}
