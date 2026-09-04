import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { WebSocketServer } from 'ws';
import { createRoomRegistry, WS_MAX_PAYLOAD_BYTES } from './SignallingServerCore.ts';

const DEFAULT_PORT = 8787;
const DEFAULT_HOST = '127.0.0.1';
const HEARTBEAT_INTERVAL_MS = 30_000;
const SHUTDOWN_TIMEOUT_MS = 5_000;
const SIGNAL_PATH = '/__signal';
const HEALTH_PATH = '/healthz';
const READY_PATH = '/readyz';
const SECURITY_PROFILES = new Set(['Development', 'ResearchPreview', 'Production']);
const ROUTING_BASE_URL = 'http://localhost';

function optionValue(args, name) {
  const prefix = `--${name}=`;
  const match = args.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

function splitCsv(value) {
  if (!value) return undefined;
  const values = value.split(',').map((item) => item.trim()).filter(Boolean);
  return values.length > 0 ? values : undefined;
}

function parsePort(value) {
  const port = Number(value ?? DEFAULT_PORT);
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new Error('signalling port must be an integer between 0 and 65535');
  }
  return port;
}

/**
 * Resolve standalone signalling-service configuration.
 *
 * The standalone executable defaults to Production rather than silently
 * falling back to a research/open profile. Development open mode requires an
 * explicit --allow-open flag or NEMOSYNE_SIGNAL_ALLOW_OPEN=1.
 */
export function readSignallingServiceConfig(
  args = process.argv.slice(2),
  env = process.env,
) {
  const allowOpen =
    args.includes('--allow-open') || env.NEMOSYNE_SIGNAL_ALLOW_OPEN === '1';
  const profile =
    optionValue(args, 'profile') ||
    env.NEMOSYNE_SIGNAL_PROFILE ||
    (allowOpen ? 'Development' : 'Production');
  if (!SECURITY_PROFILES.has(profile)) {
    throw new Error(`invalid signalling security profile: ${profile}`);
  }
  if (allowOpen && profile !== 'Development') {
    throw new Error('open signalling mode is permitted only with the Development profile');
  }

  const host = optionValue(args, 'host') || env.NEMOSYNE_SIGNAL_HOST || DEFAULT_HOST;
  const port = parsePort(
    optionValue(args, 'port') || env.NEMOSYNE_SIGNAL_PORT || env.PORT || DEFAULT_PORT,
  );
  const authToken = optionValue(args, 'token') ?? env.NEMOSYNE_SIGNAL_TOKEN ?? '';
  const observerAuthToken =
    optionValue(args, 'observer-token') ?? env.NEMOSYNE_OBSERVER_TOKEN ?? '';
  const allowedOrigins = splitCsv(
    optionValue(args, 'allowed-origins') || env.NEMOSYNE_ALLOWED_ORIGINS,
  );

  return Object.freeze({
    host,
    port,
    authToken,
    observerAuthToken,
    allowedOrigins,
    allowOpen,
    securityProfile: profile,
  });
}

function writeJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  response.end(body);
}

function rejectUpgrade(socket, statusCode, reason) {
  try {
    socket.write(
      `HTTP/1.1 ${statusCode} ${reason}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`,
    );
  } finally {
    socket.destroy();
  }
}

/**
 * Create the production-capable signalling service without starting it.
 * Tests can bind port 0 and exercise the real health/readiness HTTP surface.
 */
export function createSignallingService(config) {
  const registry = createRoomRegistry({
    authToken: config.authToken,
    observerAuthToken: config.observerAuthToken,
    allowedOrigins: config.allowedOrigins,
    securityProfile: config.securityProfile,
    allowOpenNoToken: config.allowOpen,
  });
  const diagnostic = registry.getSecurityDiagnostic();
  if (!diagnostic.ok) {
    throw new Error(
      `unsafe signalling configuration for ${diagnostic.profile}: ${diagnostic.warnings.join('; ') || 'security diagnostic failed'}`,
    );
  }

  const httpServer = createServer((request, response) => {
    const url = new URL(request.url || '/', ROUTING_BASE_URL);
    if (request.method === 'GET' && url.pathname === HEALTH_PATH) {
      writeJson(response, 200, { status: 'ok' });
      return;
    }
    if (request.method === 'GET' && url.pathname === READY_PATH) {
      writeJson(response, diagnostic.ok ? 200 : 503, {
        status: diagnostic.ok ? 'ready' : 'not-ready',
        profile: diagnostic.profile,
        originEnforcement: diagnostic.originEnforcement,
        authenticationConfigured:
          diagnostic.authTokenConfigured || diagnostic.tokenValidatorConfigured,
      });
      return;
    }
    writeJson(response, 404, { error: 'not-found' });
  });

  const wss = new WebSocketServer({ noServer: true, maxPayload: WS_MAX_PAYLOAD_BYTES });
  let heartbeatInterval = null;
  let started = false;
  let stopping = null;

  httpServer.on('upgrade', (request, socket, head) => {
    let url;
    try {
      url = new URL(request.url || '/', ROUTING_BASE_URL);
    } catch {
      rejectUpgrade(socket, 400, 'Bad Request');
      return;
    }
    if (url.pathname !== SIGNAL_PATH) {
      rejectUpgrade(socket, 404, 'Not Found');
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', (socket, request) => {
    socket.isAlive = true;
    socket.on('pong', () => {
      socket.isAlive = true;
    });

    const url = new URL(request.url || SIGNAL_PATH, ROUTING_BASE_URL);
    const roomId = url.searchParams.get('room') || 'default';
    const peerId = url.searchParams.get('peer') || `peer-${Date.now()}`;
    // Production never consumes URL credentials. Authentication must arrive
    // in-band so reverse proxies and access logs cannot capture secrets.
    const token =
      config.securityProfile === 'Production'
        ? undefined
        : (url.searchParams.get('token') || undefined);
    const role = url.searchParams.get('role') === 'observer' ? 'observer' : 'participant';
    registry.handleConnection(socket, roomId, peerId, token, role, request);
  });

  async function start() {
    if (started) return httpServer.address();
    await new Promise((resolveStart, rejectStart) => {
      const onError = (error) => {
        httpServer.off('listening', onListening);
        rejectStart(error);
      };
      const onListening = () => {
        httpServer.off('error', onError);
        resolveStart();
      };
      httpServer.once('error', onError);
      httpServer.once('listening', onListening);
      httpServer.listen(config.port, config.host);
    });
    started = true;
    heartbeatInterval = setInterval(() => {
      for (const socket of wss.clients) {
        if (socket.isAlive === false) {
          socket.terminate();
          continue;
        }
        socket.isAlive = false;
        socket.ping();
      }
      registry.cleanupIdleRooms();
    }, HEARTBEAT_INTERVAL_MS);
    heartbeatInterval.unref?.();
    return httpServer.address();
  }

  async function stop() {
    if (stopping) return stopping;
    stopping = (async () => {
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
      for (const socket of wss.clients) socket.terminate();
      if (started) {
        await Promise.all([
          new Promise((resolveClose) => wss.close(() => resolveClose())),
          new Promise((resolveClose) => httpServer.close(() => resolveClose())),
        ]);
      }
      started = false;
    })();
    try {
      await stopping;
    } finally {
      stopping = null;
    }
  }

  return Object.freeze({
    diagnostic,
    httpServer,
    wss,
    start,
    stop,
  });
}

async function main() {
  const config = readSignallingServiceConfig();
  const service = createSignallingService(config);
  const address = await service.start();
  const port = typeof address === 'object' && address ? address.port : config.port;
  console.warn(
    `[SignallingServer] listening on ${config.host}:${port}${SIGNAL_PATH} (${config.securityProfile})`,
  );

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    const forcedExit = setTimeout(() => {
      console.error(`[SignallingServer] forced shutdown after ${SHUTDOWN_TIMEOUT_MS}ms`);
      process.exitCode = 1;
    }, SHUTDOWN_TIMEOUT_MS);
    forcedExit.unref?.();
    try {
      await service.stop();
      clearTimeout(forcedExit);
      console.warn(`[SignallingServer] stopped after ${signal}`);
    } catch (error) {
      console.error('[SignallingServer] shutdown failed:', error);
      process.exitCode = 1;
    }
  };

  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));
}

const invokedAsScript =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invokedAsScript) {
  void main().catch((error) => {
    console.error('[SignallingServer] startup failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
