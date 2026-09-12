const encoder = new TextEncoder();

class NonFiniteJsonNumberError extends Error {}

export function encodeJsonAbiInput(input: unknown): Uint8Array | null {
  try {
    const json = JSON.stringify(input, (_key, value) => {
      if (typeof value === 'number' && !Number.isFinite(value)) {
        throw new NonFiniteJsonNumberError();
      }
      return value;
    });
    if (typeof json !== 'string') return null;
    return encoder.encode(json);
  } catch {
    return null;
  }
}
