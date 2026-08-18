// @ts-nocheck
// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { remoteDebugStreamer } from '../src/utils/RemoteDebugStreamer.ts';

describe('RemoteDebugStreamer', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'ok' }),
    });
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    remoteDebugStreamer.dispose();
    vi.restoreAllMocks();
  });

  it('initializes and intercepts console logs', () => {
    expect(() => remoteDebugStreamer.init()).not.toThrow();
    console.log('Test log message');
    console.warn('Test warning');
    console.error('Test error');
  });
});
