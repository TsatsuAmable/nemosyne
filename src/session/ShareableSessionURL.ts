/**
 * Shareable Session URL & Lightweight State Serializer.
 *
 * Encodes and decodes self-contained, reproducible analytical session states
 * into compact URL-safe parameters for instant sharing, peer review, and observer attachment.
 */

export interface ShareableSessionPayload {
  version: number;
  datasetId: string;
  topology: string;
  selectedEntityId?: string;
  activeLayout: string;
  interactionMode: string;
  focusTarget: string;
  timestamp: number;
}

export class ShareableSessionURL {
  private static readonly CURRENT_VERSION = 1;
  private static readonly MAX_ENCODED_LENGTH = 8192;

  static encode(payload: Omit<ShareableSessionPayload, 'version'>, baseUrl = 'https://nemosyne.ai'): string {
    const fullPayload: ShareableSessionPayload = {
      ...payload,
      version: this.CURRENT_VERSION,
    };

    const jsonStr = JSON.stringify(fullPayload);
    const base64Str = typeof btoa === 'function' ? btoa(jsonStr) : Buffer.from(jsonStr).toString('base64');
    const urlSafe = base64Str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    if (urlSafe.length > this.MAX_ENCODED_LENGTH) {
      throw new Error(`Shareable session payload exceeds maximum safe URL length (${urlSafe.length} > ${this.MAX_ENCODED_LENGTH})`);
    }

    const url = new URL(baseUrl);
    url.searchParams.set('session_state', urlSafe);
    return url.toString();
  }

  static decode(urlString: string): ShareableSessionPayload | null {
    try {
      const url = new URL(urlString);
      const stateParam = url.searchParams.get('session_state');
      if (!stateParam || stateParam.length > this.MAX_ENCODED_LENGTH) return null;

      let base64 = stateParam.replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4 !== 0) {
        base64 += '=';
      }

      const jsonStr = typeof atob === 'function' ? atob(base64) : Buffer.from(base64, 'base64').toString('utf-8');
      const parsed = JSON.parse(jsonStr) as Partial<ShareableSessionPayload>;

      if (
        parsed.version !== this.CURRENT_VERSION ||
        typeof parsed.datasetId !== 'string' ||
        typeof parsed.topology !== 'string' ||
        typeof parsed.activeLayout !== 'string' ||
        typeof parsed.interactionMode !== 'string'
      ) {
        return null;
      }

      return parsed as ShareableSessionPayload;
    } catch {
      return null;
    }
  }
}
