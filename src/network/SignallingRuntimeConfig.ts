export interface BrowserSignallingRuntimeConfig {
  readonly url: string;
  readonly source: 'configured' | 'development-default';
}

export type SignallingBrowserEnvironment = Readonly<
  Record<string, string | boolean | undefined>
>;

function developmentDefault(pageHref?: string): BrowserSignallingRuntimeConfig {
  let base: URL;
  try {
    base = pageHref ? new URL(pageHref) : new URL('http://localhost:5173/');
  } catch {
    base = new URL('http://localhost:5173/');
  }
  if (!base.host) base = new URL('http://localhost:5173/');
  const protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
  return Object.freeze({
    url: `${protocol}//${base.host}/__signal`,
    source: 'development-default' as const,
  });
}

/**
 * Resolve the browser collaboration signalling endpoint.
 *
 * Production deliberately has no same-origin fallback: a production build must
 * receive VITE_NEMOSYNE_SIGNALLING_URL or collaboration is unavailable. Local
 * Vite development keeps the historical /__signal convenience endpoint.
 */
export function readSignallingBrowserConfig(
  env: SignallingBrowserEnvironment,
  pageHref?: string,
): BrowserSignallingRuntimeConfig | null {
  const raw = env.VITE_NEMOSYNE_SIGNALLING_URL;
  if (raw === undefined || raw === '') {
    if (env.DEV === true && env.PROD !== true) return developmentDefault(pageHref);
    return null;
  }
  if (typeof raw !== 'string') {
    throw new Error('VITE_NEMOSYNE_SIGNALLING_URL must be a string when configured');
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('VITE_NEMOSYNE_SIGNALLING_URL must be an absolute WebSocket URL');
  }

  if (parsed.protocol !== 'ws:' && parsed.protocol !== 'wss:') {
    throw new Error('VITE_NEMOSYNE_SIGNALLING_URL must use ws: or wss:');
  }
  if (!parsed.hostname) {
    throw new Error('VITE_NEMOSYNE_SIGNALLING_URL must include a hostname');
  }
  if (parsed.username || parsed.password) {
    throw new Error('VITE_NEMOSYNE_SIGNALLING_URL must not contain credentials');
  }
  if (parsed.search || parsed.hash) {
    throw new Error('VITE_NEMOSYNE_SIGNALLING_URL must not contain query parameters or a fragment');
  }
  if (env.PROD === true && parsed.protocol !== 'wss:') {
    throw new Error('production collaboration signalling requires wss:');
  }

  return Object.freeze({
    url: parsed.toString(),
    source: 'configured' as const,
  });
}
