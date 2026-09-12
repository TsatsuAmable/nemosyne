#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { captureAdbQuestDevice } from './quest-adb-device.mjs';

const root = resolve(import.meta.dirname, '..');
const adbBin =
  process.env.ADB_BIN || resolve(process.env.HOME || '', 'Library/Android/sdk/platform-tools/adb');
const cdpPort = Number(process.env.NEMOSYNE_QUEST_CDP_PORT || 9222);
const appPort = Number(process.env.NEMOSYNE_QUEST_APP_PORT || 5173);

function exec(command, args, options = {}) {
  try {
    return {
      ok: true,
      stdout: execFileSync(command, args, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 8000,
        killSignal: 'SIGKILL',
        ...options,
      }),
    };
  } catch (error) {
    return { ok: false, stdout: '', error: error instanceof Error ? error.message : String(error) };
  }
}

function adb(args) {
  return exec(adbBin, args);
}

export function extractServedIdentity(source) {
  const build =
    source.match(/VITE_NEMOSYNE_BUILD_ID["']?\s*:\s*["']([0-9a-f]{40})["']/i)?.[1] ?? null;
  const session =
    source.match(/VITE_NEMOSYNE_VALIDATION_SESSION_LABEL["']?\s*:\s*["']([^"']+)["']/)?.[1] ?? null;
  return { buildId: build, sessionLabel: session };
}
function exactGitHead() {
  const out = exec('git', ['rev-parse', 'HEAD'], { cwd: root });
  return out.ok ? out.stdout.trim() : null;
}

function serverAuthority() {
  const pids = exec('/usr/sbin/lsof', ['-tiTCP:' + appPort, '-sTCP:LISTEN']);
  const pid = pids.ok ? (pids.stdout.trim().split(/\s+/).filter(Boolean)[0] ?? null) : null;
  if (!pid) return { pid: null, cwd: null };
  const cwd = exec('/usr/sbin/lsof', ['-a', '-p', pid, '-d', 'cwd', '-Fn']);
  const line = cwd.stdout.split(/\r?\n/).find((value) => value.startsWith('n'));
  return { pid: Number(pid), cwd: line?.slice(1) ?? null };
}

async function cdpTabs() {
  const response = await fetch(`http://127.0.0.1:${cdpPort}/json`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`CDP target listing failed: ${response.status}`);
  return response.json();
}

async function cdpEvaluate(
  webSocketDebuggerUrl,
  expression,
  { userGesture = false, timeoutMs = 10000 } = {}
) {
  const socket = new WebSocket(webSocketDebuggerUrl);
  try {
    await new Promise((resolveOpen, reject) => {
      const timer = setTimeout(
        () => {
          socket.close();
          reject(new Error('CDP WebSocket open timed out'));
        },
        Math.min(5000, timeoutMs)
      );
      socket.onopen = () => {
        clearTimeout(timer);
        resolveOpen();
      };
      socket.onerror = () => {
        clearTimeout(timer);
        reject(new Error('CDP WebSocket connection failed'));
      };
    });
    const id = 1;
    const message = await new Promise((resolveResponse, reject) => {
      const timer = setTimeout(() => {
        socket.close();
        reject(new Error('CDP evaluation timed out'));
      }, timeoutMs);
      socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.id !== id) return;
        clearTimeout(timer);
        resolveResponse(message);
      };
      socket.send(
        JSON.stringify({
          id,
          method: 'Runtime.evaluate',
          params: { expression, awaitPromise: true, returnByValue: true, userGesture },
        })
      );
    });
    if (message.error) throw new Error(message.error.message || 'CDP evaluation failed');
    return message.result?.result?.value ?? null;
  } finally {
    try {
      socket.close();
    } catch {
      // Best-effort close; the caller already owns the primary error.
    }
  }
}

async function pageSelectionState(page) {
  try {
    const state = await cdpEvaluate(
      page.webSocketDebuggerUrl,
      `({
        visibilityState: document.visibilityState,
        hasFocus: document.hasFocus(),
        readyState: document.readyState,
        vrButton: document.querySelector('#nemosyne-vr-button')?.textContent?.trim() ?? null,
        href: location.href
      })`,
      { timeoutMs: 1200 }
    );
    return { id: page.id, responsive: true, ...state };
  } catch (error) {
    return {
      id: page.id,
      responsive: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function selectForegroundNemosynePage(pages) {
  const states = await Promise.all(pages.map((page) => pageSelectionState(page)));
  const focused = states.filter(
    (state) => state.responsive && state.visibilityState === 'visible' && state.hasFocus === true
  );
  const selectedState = focused.length === 1 ? focused[0] : null;
  const page = selectedState
    ? (pages.find((candidate) => candidate.id === selectedState.id) ?? null)
    : null;
  return { page, states, focusedCount: focused.length };
}

async function waitForForegroundNemosynePage({ attempts = 6, delayMs = 500 } = {}) {
  let last = { page: null, states: [], focusedCount: 0, pages: [] };
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const tabs = await cdpTabs();
    const pages = tabs.filter(
      (target) => target.type === 'page' && target.url.startsWith(`http://localhost:${appPort}/`)
    );
    const selection = await selectForegroundNemosynePage(pages);
    last = { ...selection, pages };
    const state = selection.states.find((candidate) => candidate.id === selection.page?.id);
    if (selection.page && state?.readyState === 'complete') return last;
    if (attempt + 1 < attempts) {
      await new Promise((resolveWait) => setTimeout(resolveWait, delayMs));
    }
  }
  return last;
}

async function cdpReload(webSocketDebuggerUrl) {
  const socket = new WebSocket(webSocketDebuggerUrl);
  try {
    await new Promise((resolveOpen, reject) => {
      const timer = setTimeout(() => {
        socket.close();
        reject(new Error('CDP WebSocket open timed out'));
      }, 5000);
      socket.onopen = () => {
        clearTimeout(timer);
        resolveOpen();
      };
      socket.onerror = () => {
        clearTimeout(timer);
        reject(new Error('CDP WebSocket connection failed'));
      };
    });
    const id = 2;
    await new Promise((resolveResponse, reject) => {
      const timer = setTimeout(() => {
        socket.close();
        reject(new Error('CDP reload timed out'));
      }, 10000);
      socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.id !== id) return;
        clearTimeout(timer);
        resolveResponse(message);
      };
      socket.send(JSON.stringify({ id, method: 'Page.reload', params: { ignoreCache: true } }));
    });
  } finally {
    try {
      socket.close();
    } catch {
      // Best-effort close.
    }
  }
}

async function loadedScriptIdentity(webSocketDebuggerUrl) {
  const socket = new WebSocket(webSocketDebuggerUrl);
  await new Promise((resolveOpen, reject) => {
    const timer = setTimeout(() => reject(new Error('CDP WebSocket open timed out')), 5000);
    socket.onopen = () => {
      clearTimeout(timer);
      resolveOpen();
    };
    socket.onerror = () => {
      clearTimeout(timer);
      reject(new Error('CDP WebSocket connection failed'));
    };
  });
  const scripts = new Map();
  let nextId = 10;
  const pending = new Map();
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.method === 'Debugger.scriptParsed' && message.params?.url) {
      scripts.set(message.params.url, message.params.scriptId);
    }
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
  };
  const send = (method, params = {}) =>
    new Promise((resolveResponse, reject) => {
      const id = nextId++;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`CDP ${method} timed out`));
      }, 10000);
      pending.set(id, (message) => {
        clearTimeout(timer);
        resolveResponse(message);
      });
      socket.send(JSON.stringify({ id, method, params }));
    });
  await send('Debugger.enable');
  await new Promise((resolveWait) => setTimeout(resolveWait, 150));
  const match = [...scripts.entries()].find(([url]) => url.includes('/src/app/devEvidence.ts'));
  if (!match) {
    socket.close();
    return { buildId: null, sessionLabel: null, scriptUrl: null };
  }
  const source = await send('Debugger.getScriptSource', { scriptId: match[1] });
  socket.close();
  return { ...extractServedIdentity(source.result?.scriptSource ?? ''), scriptUrl: match[0] };
}

function parseThermal(stdout) {
  const status = Number(stdout.match(/Thermal Status:\s*(\d+)/)?.[1] ?? NaN);
  const read = (name) => {
    const match = stdout.match(
      new RegExp(
        `Temperature\\{mValue=([-0-9.]+),[^}]*mName=${name.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')},`
      )
    );
    return match ? Number(match[1]) : null;
  };
  return {
    status: Number.isFinite(status) ? status : null,
    socC: read('soc-usr'),
    gpuC: read('gpuss-0'),
  };
}

function parseMeminfo(stdout) {
  const line = stdout.split(/\r?\n/).find((value) => /^\s*TOTAL\s+\d+/.test(value));
  const pssKb = line ? Number(line.trim().split(/\s+/)[1]) : null;
  return { pssKb: Number.isFinite(pssKb) ? pssKb : null };
}

async function runtimeSnapshot(page) {
  const expression = `(async()=>({
    href: location.href,
    title: document.title,
    readyState: document.readyState,
    visibilityState: document.visibilityState,
    hasFocus: document.hasFocus(),
    vrButton: document.querySelector('#nemosyne-vr-button')?.textContent?.trim() ?? null,
    deviceMemoryGb: navigator.deviceMemory ?? null,
    hardwareConcurrency: navigator.hardwareConcurrency ?? null,
    xrApiPresent: !!navigator.xr,
    immersiveVrSupported: navigator.xr ? await navigator.xr.isSessionSupported('immersive-vr').catch(()=>null) : null,
    usedJsHeapBytes: performance.memory?.usedJSHeapSize ?? null,
    totalJsHeapBytes: performance.memory?.totalJSHeapSize ?? null,
    jsHeapLimitBytes: performance.memory?.jsHeapSizeLimit ?? null,
    resourceCount: performance.getEntriesByType('resource').length,
    navigationDurationMs: performance.getEntriesByType('navigation')[0]?.duration ?? null
  }))()`;
  return cdpEvaluate(page.webSocketDebuggerUrl, expression);
}
async function immersiveSmoke(page, initialRuntime) {
  if (!process.argv.includes('--immersive-smoke')) return null;
  const before = initialRuntime?.vrButton ?? null;
  if (before === 'IN VR') {
    return {
      requested: true,
      attempted: false,
      entered: false,
      before,
      reason: 'preexisting-immersive-state',
    };
  }
  if (initialRuntime?.immersiveVrSupported !== true) {
    return {
      requested: true,
      attempted: false,
      entered: false,
      before,
      reason: 'immersive-vr-unsupported',
    };
  }
  if (initialRuntime?.visibilityState !== 'visible' || initialRuntime?.hasFocus !== true) {
    return {
      requested: true,
      attempted: false,
      entered: false,
      before,
      reason: 'page-not-foreground',
    };
  }
  const click = await cdpEvaluate(
    page.webSocketDebuggerUrl,
    `(()=>{const b=document.querySelector('#nemosyne-vr-button'); if(!b)return {clicked:false}; b.click(); return {clicked:true,text:b.textContent?.trim()};})()`,
    { userGesture: true }
  );
  await new Promise((resolveWait) => setTimeout(resolveWait, 2500));
  const active = await runtimeSnapshot(page);
  const entered = active?.vrButton === 'IN VR';
  return { requested: true, attempted: true, entered, before, click, active };
}

async function main() {
  const listed = adb(['devices', '-l']);
  const devices = listed.stdout
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean);
  const authorised = devices.filter((line) => line.split(/\s+/)[1] === 'device');
  if (authorised.length !== 1)
    throw new Error(`expected exactly one authorised ADB device, found ${authorised.length}`);
  const serial = authorised[0].split(/\s+/)[0];

  adb(['-s', serial, 'forward', `tcp:${cdpPort}`, 'localabstract:chrome_devtools_remote']);
  const reverse = adb(['-s', serial, 'reverse', '--list']).stdout;
  const reverseOk = reverse.includes(`tcp:${appPort} tcp:${appPort}`);
  const identity = captureAdbQuestDevice({ adb, selectedSerial: serial });

  const servedSource = await (
    await fetch(`http://127.0.0.1:${appPort}/src/app/devEvidence.ts?physical-probe=${Date.now()}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })
  ).text();
  const served = extractServedIdentity(servedSource);
  const manifestPath = served.sessionLabel
    ? resolve(root, 'logs/validation', served.sessionLabel, 'manifest.json')
    : null;
  let manifest = null;
  try {
    manifest = manifestPath ? JSON.parse(readFileSync(manifestPath, 'utf8')) : null;
  } catch {
    manifest = null;
  }

  let tabs = await cdpTabs();
  let pages = tabs.filter(
    (target) => target.type === 'page' && target.url.startsWith(`http://localhost:${appPort}/`)
  );
  let selection = await selectForegroundNemosynePage(pages);
  const smokeRequested = process.argv.includes('--immersive-smoke');
  const webVrBeforeSmoke = adb([
    '-s',
    serial,
    'shell',
    'dumpsys',
    'activity',
    'activities',
  ]).stdout.includes('com.oculus.browser/.WebVRActivity');
  const shouldRefreshPage =
    process.argv.includes('--reload') || (smokeRequested && !webVrBeforeSmoke);
  if (shouldRefreshPage && selection.page) {
    await cdpReload(selection.page.webSocketDebuggerUrl);
    const refreshed = await waitForForegroundNemosynePage();
    pages = refreshed.pages;
    selection = refreshed;
  }
  const selectedPage = selection.page;
  const runtime = selectedPage ? await runtimeSnapshot(selectedPage) : null;
  const immersive = selectedPage ? await immersiveSmoke(selectedPage, runtime) : null;
  const loaded = selectedPage
    ? await loadedScriptIdentity(selectedPage.webSocketDebuggerUrl)
    : { buildId: null, sessionLabel: null, scriptUrl: null };
  const authority = serverAuthority();
  const gitHead = exactGitHead();
  const clean = exec('git', ['status', '--porcelain'], { cwd: root });
  const browserPid =
    adb(['-s', serial, 'shell', 'pidof', 'com.oculus.browser']).stdout.trim() || null;
  const meminfo = browserPid
    ? parseMeminfo(adb(['-s', serial, 'shell', 'dumpsys', 'meminfo', browserPid]).stdout)
    : { pssKb: null };
  const thermal = parseThermal(adb(['-s', serial, 'shell', 'dumpsys', 'thermalservice']).stdout);
  if (immersive?.entered && immersive?.attempted && selectedPage) {
    const exitClick = await cdpEvaluate(
      selectedPage.webSocketDebuggerUrl,
      `(()=>{const b=document.querySelector('#nemosyne-vr-button'); if(!b)return {clicked:false}; b.click(); return {clicked:true,text:b.textContent?.trim()};})()`,
      { userGesture: true }
    );
    immersive.exitSignal = 'nemosyne-vr-button';
    immersive.exitClick = exitClick;
    await new Promise((resolveWait) => setTimeout(resolveWait, 1200));
    const cleanupSelection = await waitForForegroundNemosynePage({ attempts: 8, delayMs: 400 });
    const cleanupPage = cleanupSelection.page;
    immersive.cleanupPageId = cleanupPage?.id ?? null;
    immersive.cleanup = cleanupPage ? await runtimeSnapshot(cleanupPage) : null;
    immersive.cleanedUp =
      exitClick?.clicked === true &&
      immersive.cleanup?.readyState === 'complete' &&
      immersive.cleanup?.vrButton === 'ENTER VR';
  }
  const reasons = [];
  if (!reverseOk) reasons.push('ADB reverse tcp:5173 is missing');
  if (!identity.ok) reasons.push(`Quest identity unavailable: ${identity.error ?? 'unknown'}`);
  if (!served.buildId) reasons.push('served build identity is missing');
  if (served.buildId && served.buildId !== gitHead)
    reasons.push('served build does not match worktree HEAD');
  if (!served.sessionLabel) reasons.push('served validation session label is missing');
  if (!loaded.buildId) reasons.push('running Quest page build identity is missing');
  if (loaded.buildId && loaded.buildId !== served.buildId)
    reasons.push('running Quest page build does not match served build');
  if (!loaded.sessionLabel) reasons.push('running Quest page session label is missing');
  if (loaded.sessionLabel && loaded.sessionLabel !== served.sessionLabel)
    reasons.push('running Quest page session does not match served session');
  if (!manifest) reasons.push('launcher manifest is missing');
  if (manifest && manifest.buildId !== served.buildId)
    reasons.push('manifest build does not match served build');
  if (manifest && manifest.sessionLabel !== served.sessionLabel)
    reasons.push('manifest session does not match served session');
  if (authority.cwd !== root)
    reasons.push(`port ${appPort} listener is not owned by the expected worktree`);
  if (!clean.ok || clean.stdout.trim() !== '')
    reasons.push('physical validation worktree is not clean');
  if (pages.length === 0) reasons.push('Quest Browser has no Nemosyne localhost page');
  if (pages.length > 0 && !selectedPage) {
    reasons.push(
      selection.focusedCount === 0
        ? 'Quest Browser has no foreground focused Nemosyne page'
        : 'Quest Browser has multiple foreground focused Nemosyne pages'
    );
  }

  const result = {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    attribution: {
      ok: reasons.length === 0,
      reasons,
      buildId: served.buildId,
      sessionLabel: served.sessionLabel,
      gitHead,
      serverPid: authority.pid,
      serverCwd: authority.cwd,
      reverseOk,
      pageCount: pages.length,
      selectedPageId: selectedPage?.id ?? null,
      focusedPageCount: selection.focusedCount,
      pageStates: selection.states,
      evidenceClass: manifest?.evidenceClass ?? null,
      validationMode: manifest?.validationMode ?? null,
      webVrActivityBeforeSmoke: webVrBeforeSmoke,
      loadedBuildId: loaded.buildId,
      loadedSessionLabel: loaded.sessionLabel,
      loadedScriptUrl: loaded.scriptUrl,
    },
    device: identity.ok ? identity.identity : null,
    browser: { pidPresent: Boolean(browserPid), ...meminfo, ...thermal },
    runtime,
    immersive,
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  const immersiveRequested = process.argv.includes('--immersive-smoke');
  const immersiveOk =
    !immersiveRequested ||
    (immersive?.entered === true &&
      (immersive?.attempted === false || immersive?.cleanedUp === true));
  process.exitCode = result.attribution.ok && immersiveOk ? 0 : 2;
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`
    );
    process.exitCode = 1;
  });
}
