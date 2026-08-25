/**
 * Shareable Session URL & Lightweight State Serializer.
 *
 * Encodes and decodes self-contained, reproducible analytical session states
 * into compact URL-safe parameters for instant sharing, peer review, and observer attachment.
 */

import { base64, base64url } from '@scure/base';

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
  private static readonly ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

  private static _bytesToBase64Url(bytes: Uint8Array): string {
    return base64url.encode(bytes);
  }

  private static _base64UrlToBytes(base64Url: string): Uint8Array {
    // Tolerant decoder: accepts padded and unpadded share links (legacy shim
    // emitted unpadded; @scure/base emits padded) and both base64 alphabets.
    const std = base64Url.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
    return base64.decode(std + '='.repeat((4 - (std.length % 4)) % 4));
  }

  static encode(
    payload: Omit<ShareableSessionPayload, 'version'> & Record<string, unknown>,
    baseUrl = 'https://nemosyne.ai'
  ): string {
    const url = new URL(baseUrl);
    if (!this.ALLOWED_PROTOCOLS.has(url.protocol)) {
      throw new Error(`Forbidden URL protocol for shareable session URL: ${url.protocol}`);
    }

    // Strict schema whitelist: strip all undeclared/secret fields like authToken
    const safePayload: ShareableSessionPayload = {
      version: this.CURRENT_VERSION,
      datasetId: String(payload.datasetId ?? ''),
      topology: String(payload.topology ?? ''),
      activeLayout: String(payload.activeLayout ?? ''),
      interactionMode: String(payload.interactionMode ?? ''),
      focusTarget: String(payload.focusTarget ?? ''),
      timestamp: typeof payload.timestamp === 'number' && Number.isFinite(payload.timestamp) ? payload.timestamp : Date.now(),
    };

    if (payload.selectedEntityId !== undefined && payload.selectedEntityId !== null) {
      safePayload.selectedEntityId = String(payload.selectedEntityId);
    }

    const jsonStr = JSON.stringify(safePayload);
    const utf8Bytes = new TextEncoder().encode(jsonStr);
    const urlSafe = this._bytesToBase64Url(utf8Bytes);

    if (urlSafe.length > this.MAX_ENCODED_LENGTH) {
      throw new Error(`Shareable session payload exceeds maximum safe URL length (${urlSafe.length} > ${this.MAX_ENCODED_LENGTH})`);
    }

    url.searchParams.set('session_state', urlSafe);
    return url.toString();
  }

  static decode(urlString: string): ShareableSessionPayload | null {
    try {
      const url = new URL(urlString);
      if (!this.ALLOWED_PROTOCOLS.has(url.protocol)) {
        return null;
      }

      const stateParam = url.searchParams.get('session_state');
      if (!stateParam || stateParam.length > this.MAX_ENCODED_LENGTH) return null;

      const bytes = this._base64UrlToBytes(stateParam);
      const jsonStr = new TextDecoder().decode(bytes);
      const parsed = JSON.parse(jsonStr) as Record<string, unknown>;

      if (
        parsed.version !== this.CURRENT_VERSION ||
        typeof parsed.datasetId !== 'string' ||
        typeof parsed.topology !== 'string' ||
        typeof parsed.activeLayout !== 'string' ||
        typeof parsed.interactionMode !== 'string' ||
        typeof parsed.focusTarget !== 'string' ||
        typeof parsed.timestamp !== 'number' ||
        !Number.isFinite(parsed.timestamp)
      ) {
        return null;
      }

      const sanitized: ShareableSessionPayload = {
        version: this.CURRENT_VERSION,
        datasetId: parsed.datasetId,
        topology: parsed.topology,
        activeLayout: parsed.activeLayout,
        interactionMode: parsed.interactionMode,
        focusTarget: parsed.focusTarget,
        timestamp: parsed.timestamp,
      };

      if (typeof parsed.selectedEntityId === 'string') {
        sanitized.selectedEntityId = parsed.selectedEntityId;
      }

      return sanitized;
    } catch {
      return null;
    }
  }
}
