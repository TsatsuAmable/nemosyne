#!/usr/bin/env node
/**
 * quest-auto-trigger.mjs — unattended on-device page-load trigger + smoke capture.
 *
 * What this is: a way to load a Nemosyne route in the attached Quest's real
 * `com.oculus.browser` without a human wearing the headset, and to capture a
 * bounded smoke record (page loaded, title, console errors).
 *
 * What this is NOT (fail-closed honesty bounds):
 * - It never enters an immersive XR session. `requestSession('immersive-vr')`
 *   requires wearer gesture, so no unattended run can exercise XR immersion,
 *   controllers, locomotion, or frame-rate-under-HMD claims.
 * - Its records use evidence class `unattended-device-smoke` with
 *   `promotionEligible: false`. They cannot satisfy governed physical gates
 *   (PERF-04/05, UX-03, RF-029/051, QCA rows). Governed qualification still
 *   requires the wearer-driven `quest-recorded-perf` path.
 * - It never touches another lane's browser tabs: it snapshots the tab list
 *   before and after, navigates only in a tab it created, closes that tab,
 *   and fails the run if any pre-existing tab changed.
 * - Cleanup is unconditional: dev server, `adb reverse`, and `adb forward`
 *   entries created by the run are removed even when the run fails.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { captureAdbQuestDevice, runAdb } from './quest-adb-device.mjs';
import { resolveViteInvocation } from './quest-validation.mjs';

export const EVIDENCE_CLASS = 'unattended-device-smoke';
export const TRIGGER_RECORD_ROOT = path.join('logs', 'validation', 'auto-trigger');
export const DEFAULT_PORT = 5173;
export const MAX_PORT = 5189;
export const DEFAULT_CDP_PORT = 19222;
export const MAX_CDP_PORT = 19232;
export const DEVTOOLS_SOCKET = 'chrome_devtools_remote';
export const HEADSET_BROWSER_PACKAGE = 'com.oculus.browser';
export const MAX_CONSOLE_ENTRIES = 50;
export const CONSOLE_TEXT_LIMIT = 500;

function boundedText(value, max = 1024) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text.length > 0 ? text.slice(0, max) : null;
}

function utcStamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '');
}

export function parseArgs(argv = process.argv) {
  const args = argv.slice(2);
  const options = {
    route: '/',
    port: null,
    timeoutMs: 120000,
    settleMs: 4000,
    allowDirty: false,
    outDir: null,
  };
  for (const arg of args) {
    if (arg.startsWith('--route=')) options.route = arg.slice('--route='.length) || '/';
    else if (arg.startsWith('--port=')) {
      const port = Number(arg.slice('--port='.length));
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error(`invalid --port value '${arg.slice('--port='.length)}'`);
      }
      options.port = port;
    } else if (arg.startsWith('--timeout-ms=')) {
      const timeoutMs = Number(arg.slice('--timeout-ms='.length));
      if (!Number.isInteger(timeoutMs) || timeoutMs < 5000 || timeoutMs > 600000) {
        throw new Error('invalid --timeout-ms value (expected 5000..600000)');
      }
      options.timeoutMs = timeoutMs;
    } else if (arg.startsWith('--settle-ms=')) {
      const settleMs = Number(arg.slice('--settle-ms='.length));
      if (!Number.isInteger(settleMs) || settleMs < 0 || settleMs > 60000) {
        throw new Error('invalid --settle-ms value (expected 0..60000)');
      }
      options.settleMs = settleMs;
    } else if (arg === '--allow-dirty') options.allowDirty = true;
    else if (arg.startsWith('--out-dir=')) options.outDir = arg.slice('--out-dir='.length) || null;
    else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new Error(`unknown argument '${arg}'`);
    }
  }
  if (!options.route.startsWith('/')) throw new Error('--route must start with /');
  return options;
}

/** Pick the first free TCP port in [preferred..max] using the injected probe. */
export async function selectPort(isFree, preferred = DEFAULT_PORT, max = MAX_PORT) {
  for (let port = preferred; port <= max; port += 1) {
     
    if (await isFree(port)) return port;
  }
  return null;
}

export function isLocalPortFree(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port });
    socket.once('connect', () => {
      socket.end();
      resolve(false);
    });
    socket.once('error', () => resolve(true));
  });
}

/**
 * Minimal CDP client over an injected WebSocket constructor (global WebSocket
 * in production, fake in tests). Resolves method calls by id with timeouts.
 */
export class CdpClient {
  constructor(webSocketCtor = globalThis.WebSocket) {
    if (typeof webSocketCtor !== 'function') {
      throw new Error('a WebSocket constructor is required for CDP');
    }
    this.webSocketCtor = webSocketCtor;
    this.socket = null;
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
  }

  connect(url, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error(`CDP connect timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);
      const socket = new this.webSocketCtor(url);
      socket.onopen = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.socket = socket;
        socket.onmessage = (event) => this.handleMessage(event?.data);
        socket.onclose = () => this.failAllPending(new Error('CDP socket closed'));
        socket.onerror = () => this.failAllPending(new Error('CDP socket error'));
        resolve();
      };
      socket.onerror = (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(new Error(`CDP connect failed: ${error?.message ?? 'unknown error'}`));
      };
    });
  }

  handleMessage(data) {
    let message;
    try {
      message = JSON.parse(String(data));
    } catch {
      return;
    }
    if (message?.id != null && this.pending.has(message.id)) {
      const { resolve, reject, timer } = this.pending.get(message.id);
      this.pending.delete(message.id);
      clearTimeout(timer);
      if (message.error) reject(new Error(`CDP error: ${message.error?.message ?? 'unknown'}`));
      else resolve(message.result ?? null);
      return;
    }
    if (message?.method) {
      this.events.push(message);
      if (this.events.length > 500) this.events.splice(0, this.events.length - 500);
    }
  }

  failAllPending(error) {
    for (const [, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.reject(error);
    }
    this.pending.clear();
  }

  send(method, params = {}, timeoutMs = 20000) {
    if (!this.socket) return Promise.reject(new Error('CDP is not connected'));
    const id = this.nextId;
    this.nextId += 1;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP '${method}' timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  waitForEvent(method, timeoutMs = 60000) {
    const existing = this.events.find((event) => event.method === method);
    if (existing) return Promise.resolve(existing.params ?? null);
    // Poll the event buffer: every inbound message flows through handleMessage
    // first, so this works for real and minimal fake sockets alike.
    return new Promise((resolve, reject) => {
      const poll = setInterval(() => {
        const found = this.events.find((event) => event.method === method);
        if (found) {
          clearInterval(poll);
          clearTimeout(timer);
          resolve(found.params ?? null);
        }
      }, 100);
      const timer = setTimeout(() => {
        clearInterval(poll);
        reject(new Error(`timed out waiting for CDP event '${method}'`));
      }, timeoutMs);
    });
  }

  close() {
    try {
      this.socket?.close();
    } catch {
      // ignore close errors during cleanup
    }
    this.socket = null;
    this.failAllPending(new Error('CDP client closed'));
  }
}

function summarizeConsoleCall(params) {
  const args = Array.isArray(params?.args) ? params.args : [];
  const text = args
    .map((arg) => {
      if (typeof arg?.value !== 'undefined') return String(arg.value);
      return boundedText(arg?.description ?? arg?.type ?? 'unknown', 200) ?? 'unknown';
    })
    .join(' ')
    .slice(0, CONSOLE_TEXT_LIMIT);
  return { type: boundedText(params?.type, 64) ?? 'log', text };
}

/**
 * Drive one unattended smoke pass inside an already-connected CDP session:
 * open a fresh tab (never reuse an existing one), navigate, wait for load plus
 * a settle window, then report title/readiness and bounded console output.
 */
export async function collectSmoke(deps) {
  const {
    httpGet,
    cdpBase,
    webSocketCtor,
    routeUrl,
    settleMs = 4000,
    timeoutMs = 120000,
    preExistingTabIds,
  } = deps;
  // Browser-level session: create and close tabs via Target.* so no HTTP-verb
  // quirks apply and no pre-existing tab is ever addressed.
  const version = JSON.parse(String(await httpGet(`${cdpBase}/json/version`)));
  if (!version?.webSocketDebuggerUrl) {
    throw new Error('devtools did not report a browser session');
  }
  const browser = new CdpClient(webSocketCtor);
  let targetId = null;
  const client = new CdpClient(webSocketCtor);
  const consoleEntries = [];
  try {
    await browser.connect(version.webSocketDebuggerUrl, 15000);
    const created = await browser.send('Target.createTarget', { url: 'about:blank' }, 15000);
    targetId = created?.targetId ?? null;
    if (!targetId) throw new Error('devtools refused to create a tab');
    if (preExistingTabIds?.includes(targetId)) {
      throw new Error('devtools recycled a pre-existing tab id; refusing to navigate it');
    }
    const list = JSON.parse(String(await httpGet(`${cdpBase}/json/list`)));
    const tab = Array.isArray(list) ? list.find((entry) => entry?.id === targetId) : null;
    if (!tab?.webSocketDebuggerUrl) {
      throw new Error('created tab has no debugger session');
    }
    await client.connect(tab.webSocketDebuggerUrl, 15000);
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Log.enable');
    await client.send('Page.navigate', { url: routeUrl }, timeoutMs);
    await client.waitForEvent('Page.loadEventFired', timeoutMs);
    await new Promise((resolve) => {
      setTimeout(resolve, settleMs);
    });
    const evaluated = await client.send(
      'Runtime.evaluate',
      { expression: '({title: document.title, readyState: document.readyState})', returnByValue: true },
      15000
    );
    for (const event of client.events) {
      if (consoleEntries.length >= MAX_CONSOLE_ENTRIES) break;
      if (event.method === 'Runtime.consoleAPICalled') {
        consoleEntries.push({ source: 'console', ...summarizeConsoleCall(event.params) });
      } else if (event.method === 'Runtime.exceptionThrown') {
        const detail = event.params?.exceptionDetails;
        consoleEntries.push({
          source: 'exception',
          type: 'error',
          text: boundedText(
            detail?.exception?.description ?? detail?.text ?? 'uncaught exception',
            CONSOLE_TEXT_LIMIT
          ),
        });
      } else if (event.method === 'Log.entryAdded') {
        const entry = event.params?.entry ?? {};
        if (entry.level === 'error' || entry.level === 'warning') {
          consoleEntries.push({
            source: 'log',
            type: entry.level,
            text: boundedText(`${entry.text ?? ''} @ ${entry.url ?? ''}:${entry.lineNumber ?? ''}`, CONSOLE_TEXT_LIMIT),
          });
        }
      }
    }
    const errors = consoleEntries.filter((entry) => entry.type === 'error');
    return {
      tabId: targetId,
      loaded: true,
      title: evaluated?.result?.value?.title ?? null,
      readyState: evaluated?.result?.value?.readyState ?? null,
      consoleEntries,
      errorCount: errors.length,
    };
  } finally {
    client.close();
    try {
      if (targetId) await browser.send('Target.closeTarget', { targetId }, 15000);
    } catch {
      // tab close is best-effort; the post-run tab audit reports leftovers
    }
    browser.close();
  }
}

/**
 * Poll the tab list until our tab disappears (closeTarget is processed
 * asynchronously by the browser). Resolves true when the tab is confirmed
 * gone, false on timeout — the audit then records the leftover honestly.
 */
export async function awaitTabGone(listTabs, ownTabId, timeoutMs = 8000, pollMs = 500) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const ids = await listTabs();
    if (!ids.includes(ownTabId)) return true;
    if (Date.now() > deadline) return false;
    await sleep(pollMs);
  }
}

export function tabAudit(beforeIds, afterIds, ownTabId) {
  const before = new Set(beforeIds);
  const after = new Set(afterIds);
  const missing = [...before].filter((id) => !after.has(id));
  const added = [...after].filter((id) => !before.has(id) && id !== ownTabId);
  const ownRemoved = ownTabId != null && after.has(ownTabId);
  return {
    preExistingIntact: missing.length === 0 && added.length === 0,
    missingPreExisting: missing,
    unexpectedAdded: added,
    ownTabLeftOpen: ownRemoved,
  };
}

export function buildTriggerRecord(input) {
  return {
    tool: 'quest-auto-trigger',
    evidenceClass: EVIDENCE_CLASS,
    promotionEligible: false,
    unattendedBounds:
      'Flat browser-tab page load only. No immersive XR session, no wearer input, ' +
      'no controller/hand interaction, no HMD frame-rate claim. Cannot satisfy governed physical gates.',
    ...input,
  };
}

export async function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Full orchestration with injected boundaries (child-process spawn, adb,
 * http, CDP, clock, fs). Production `main()` wires the real ones.
 */
export async function runAutoTrigger(deps, options) {
  const startedAt = new Date().toISOString();
  const cleanup = [];
  const record = { startedAt };
  try {
    const gitHead = await deps.readGitHead();
    record.gitHead = gitHead.head;
    record.worktreeClean = gitHead.clean;
    if (!gitHead.clean && !options.allowDirty) {
      throw new Error('worktree is dirty; refusing to attribute device smoke (pass --allow-dirty to record it as invalidated)');
    }
    if (!gitHead.clean) record.invalidations = ['worktree-dirty-at-trigger'];

    const capture = await deps.captureDevice();
    if (!capture.ok) throw new Error(`no authorised Quest target: ${capture.error}`);
    record.deviceIdentity = capture.identity;

    const port = options.port ?? (await selectPort(deps.isPortFree, DEFAULT_PORT, MAX_PORT));
    if (!port) throw new Error(`no free port in ${DEFAULT_PORT}..${MAX_PORT}`);
    record.serverPort = port;

    const server = await deps.startServer(port);
    cleanup.push(() => deps.stopServer(server));
    record.serverPid = server.pid ?? null;
    await deps.waitForHttp(`http://127.0.0.1:${port}/`, options.timeoutMs);

    const serial = await deps.deviceSerial();
    await deps.adbReverse(serial, port);
    cleanup.push(() => deps.removeAdbReverse(serial, port));

    const cdpPort = await selectPort(deps.isPortFree, DEFAULT_CDP_PORT, MAX_CDP_PORT);
    if (!cdpPort) throw new Error(`no free CDP port in ${DEFAULT_CDP_PORT}..${MAX_CDP_PORT}`);
    await deps.adbForward(serial, cdpPort);
    cleanup.push(() => deps.removeAdbForward(serial, cdpPort));
    record.cdpPort = cdpPort;

    const beforeTabs = await deps.listTabs(cdpPort);
    const routeUrl = `http://localhost:${port}${options.route}`;
    record.route = options.route;
    const smoke = await collectSmoke({
      httpGet: deps.httpGet,
      cdpBase: `http://127.0.0.1:${cdpPort}`,
      webSocketCtor: deps.webSocketCtor,
      routeUrl,
      settleMs: options.settleMs,
      timeoutMs: options.timeoutMs,
      preExistingTabIds: beforeTabs,
    });
    record.smoke = {
      loaded: smoke.loaded,
      title: smoke.title,
      readyState: smoke.readyState,
      errorCount: smoke.errorCount,
      consoleEntries: smoke.consoleEntries,
    };
    record.closeConfirmed = await awaitTabGone(() => deps.listTabs(cdpPort), smoke.tabId);
    const afterTabs = await deps.listTabs(cdpPort);
    record.tabAudit = tabAudit(beforeTabs, afterTabs, smoke.tabId);
    if (!record.tabAudit.preExistingIntact) {
      record.verdict = 'SMOKE_FAIL';
      record.invalidations = [...(record.invalidations ?? []), 'browser-tab-interference'];
    } else {
      record.verdict = smoke.errorCount === 0 ? 'SMOKE_OK' : 'SMOKE_FAIL';
    }
  } catch (error) {
    record.verdict = record.verdict ?? 'TRIGGER_FAILED';
    record.triggerError = error instanceof Error ? error.message.slice(0, 1000) : String(error).slice(0, 1000);
  } finally {
    for (let i = cleanup.length - 1; i >= 0; i -= 1) {
      try {
         
        await cleanup[i]();
      } catch {
        // cleanup is best-effort; the record keeps the primary verdict
      }
    }
    record.finishedAt = new Date().toISOString();
  }
  const full = buildTriggerRecord(record);
  const outDir = options.outDir ?? path.join(TRIGGER_RECORD_ROOT, utcStamp());
  await deps.writeRecord(outDir, full);
  full.recordDir = outDir;
  return full;
}

function productionDeps(root) {
  const adb = (args) => {
    const serial = process.env.NEMOSYNE_QUEST_ADB_SERIAL ?? null;
    void serial;
    return runAdb(args);
  };
  return {
    async readGitHead() {
      const { execFileSync } = await import('node:child_process');
      const run = (args) => String(execFileSync('git', args, { cwd: root, encoding: 'utf8' })).trim();
      const head = run(['rev-parse', 'HEAD']);
      let clean = true;
      try {
        clean = run(['status', '--porcelain']).length === 0;
      } catch {
        clean = false;
      }
      return { head, clean };
    },
    async captureDevice() {
      return captureAdbQuestDevice({});
    },
    async deviceSerial() {
      const listed = runAdb(['devices', '-l']);
      if (!listed.ok) throw new Error('adb unavailable');
      const { parseAdbDevices } = await import('./quest-adb-device.mjs');
      const devices = parseAdbDevices(listed.stdout).filter((entry) => entry.state === 'device');
      const selected = process.env.NEMOSYNE_QUEST_ADB_SERIAL;
      if (selected) {
        const match = devices.find((entry) => entry.serial === selected);
        if (!match) throw new Error(`selected device '${selected}' is not attached/authorised`);
        return match.serial;
      }
      if (devices.length !== 1) {
        throw new Error(
          devices.length === 0
            ? 'no authorised ADB device is attached'
            : `${devices.length} authorised devices attached; set NEMOSYNE_QUEST_ADB_SERIAL to select one`
        );
      }
      return devices[0].serial;
    },
    isPortFree: isLocalPortFree,
    async startServer(port) {
      const invocation = resolveViteInvocation(root);
      const child = spawn(invocation.command, [...invocation.args, '--port', String(port), '--host'], {
        cwd: root,
        env: { ...process.env, NEMOSYNE_FORCE_HTTP: '1' },
        stdio: 'ignore',
      });
      await new Promise((resolve, reject) => {
        child.once('error', reject);
        child.once('spawn', resolve);
        setTimeout(resolve, 500);
      });
      return child;
    },
    async stopServer(child) {
      try {
        child.kill('SIGTERM');
      } catch {
        // already exited
      }
    },
    async waitForHttp(url, timeoutMs) {
      const deadline = Date.now() + timeoutMs;
      for (;;) {
        try {
          const response = await fetch(url, { redirect: 'manual' });
          await response.arrayBuffer().catch(() => null);
          if (response.status < 500) return;
        } catch {
          // server not up yet
        }
        if (Date.now() > deadline) throw new Error(`server at ${url} did not respond within ${timeoutMs}ms`);
        await sleep(500);
      }
    },
    async adbReverse(serial, port) {
      const result = adb(['-s', serial, 'reverse', `tcp:${port}`, `tcp:${port}`]);
      if (!result.ok) throw new Error(`adb reverse failed: ${result.error?.message ?? 'unknown'}`);
      const list = adb(['-s', serial, 'reverse', '--list']);
      if (!list.ok || !String(list.stdout).includes(`tcp:${port}`)) {
        throw new Error(`adb reverse for tcp:${port} is not established`);
      }
    },
    async removeAdbReverse(serial, port) {
      adb(['-s', serial, 'reverse', '--remove', `tcp:${port}`]);
    },
    async adbForward(serial, cdpPort) {
      const result = adb(['-s', serial, 'forward', `tcp:${cdpPort}`, `localabstract:${DEVTOOLS_SOCKET}`]);
      if (!result.ok) throw new Error(`adb forward failed: ${result.error?.message ?? 'unknown'}`);
    },
    async removeAdbForward(serial, cdpPort) {
      adb(['-s', serial, 'forward', '--remove', `tcp:${cdpPort}`]);
    },
    async listTabs(cdpPort) {
      const response = await fetch(`http://127.0.0.1:${cdpPort}/json/list`);
      const tabs = await response.json();
      return tabs.filter((tab) => tab?.type === 'page').map((tab) => tab.id);
    },
    async httpGet(url) {
      const response = await fetch(url);
      return response.text();
    },
    webSocketCtor: globalThis.WebSocket,
    async writeRecord(outDir, record) {
      const dir = path.isAbsolute(outDir) ? outDir : path.join(root, outDir);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'trigger-record.json'), `${JSON.stringify(record, null, 2)}\n`, 'utf8');
    },
  };
}

export async function main(argv = process.argv, env = process.env, root = process.cwd()) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    process.stderr.write(`[quest-auto-trigger] ${error instanceof Error ? error.message : String(error)}\n`);
    return 2;
  }
  if (options.help) {
    process.stdout.write(
      [
        'usage: quest-auto-trigger [--route=/] [--port=N] [--timeout-ms=N] [--settle-ms=N] [--allow-dirty] [--out-dir=DIR]',
        '',
        'Unattended Quest page-load trigger. Loads the route in the attached headset browser',
        'over CDP, captures a bounded smoke record, and always cleans up. Never enters XR and',
        `never satisfies governed physical gates (evidence class '${EVIDENCE_CLASS}', promotion-eligible: never).`,
        '',
      ].join('\n')
    );
    return 0;
  }
  void env;
  const record = await runAutoTrigger(productionDeps(root), options);
  process.stdout.write(
    `verdict: ${record.verdict} (errorCount=${record.smoke?.errorCount ?? 'n/a'}, record=${record.recordDir})\n`
  );
  if (record.triggerError) process.stderr.write(`[quest-auto-trigger] ${record.triggerError}\n`);
  if (record.tabAudit && !record.tabAudit.preExistingIntact) {
    process.stderr.write('[quest-auto-trigger] pre-existing browser tabs were disturbed; run is invalid\n');
  }
  return record.verdict === 'SMOKE_OK' ? 0 : 1;
}

if (typeof process !== 'undefined' && process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      process.stderr.write(`[quest-auto-trigger] fatal: ${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 2;
    }
  );
}
