import type { IncomingMessage, ServerResponse } from 'node:http';

export const MAX_BODY_BYTES = 256 * 1024; // 256 KiB
export const POST_TIMEOUT_MS = 5000;
export const RATE_LIMIT_MAX_REQUESTS = 60;
export const RATE_LIMIT_WINDOW_MS = 60_000;

export interface RateLimiterOptions {
  maxRequests: number;
  windowMs: number;
}

export interface RateLimiter {
  allow(ip?: string): boolean;
}

export function createRateLimiter({ maxRequests, windowMs }: RateLimiterOptions): RateLimiter {
  const hits = new Map<string, number[]>();
  function allow(ip?: string): boolean {
    const now = Date.now();
    const key = ip || 'unknown';
    const times = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (times.length >= maxRequests) {
      hits.set(key, times);
      return false;
    }
    times.push(now);
    hits.set(key, times);
    return true;
  }
  return { allow };
}

export const devPostRateLimiter = createRateLimiter({
  maxRequests: RATE_LIMIT_MAX_REQUESTS,
  windowMs: RATE_LIMIT_WINDOW_MS,
});

/**
 * Read a POST body as JSON with a hard byte cap and a timeout. Calls
 * `onParsed(body, res)` on success. Responds 413 / 408 / 400 and tears down the
 * socket on overflow / timeout / bad JSON. Returns true if it handled the
 * request (so the middleware can stop the chain).
 */
export function handleBoundedJsonPost<T = unknown>(
  req: IncomingMessage,
  res: ServerResponse,
  maxBytes: number,
  onParsed: (body: T, res: ServerResponse) => void
): boolean {
  const ip = req.socket?.remoteAddress;
  if (!devPostRateLimiter.allow(ip)) {
    res.writeHead(429, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'rate limited' }));
    return true;
  }
  let body = '';
  let tooLarge = false;
  const timer = setTimeout(() => {
    try {
      res.writeHead(408, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'request timeout' }));
    } catch {
      // response already gone
    }
    req.destroy();
  }, POST_TIMEOUT_MS);

  req.on('data', (chunk: Buffer | string) => {
    if (tooLarge) return;
    body += chunk;
    if (Buffer.byteLength(body) > maxBytes) {
      tooLarge = true;
      clearTimeout(timer);
      try {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'payload too large' }));
      } catch {
        // response already gone
      }
      req.destroy();
    }
  });

  req.on('end', () => {
    clearTimeout(timer);
    if (tooLarge) return;
    let parsed: T;
    try {
      parsed = JSON.parse(body) as T;
    } catch {
      try {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid json' }));
      } catch {
        // response already gone
      }
      return;
    }
    onParsed(parsed, res);
  });

  req.on('error', () => clearTimeout(timer));
  return true;
}

export function jsonOk(res: ServerResponse, payload: unknown): void {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

export function jsonError(res: ServerResponse, code: number, message: string): void {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: message }));
}

export function isShortString(value: unknown, maxLen: number): value is string {
  return typeof value === 'string' && value.length <= maxLen;
}
