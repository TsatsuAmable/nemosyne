import { describe, expect, it } from 'vitest';
import {
  awaitTabGone,
  CdpClient,
  EVIDENCE_CLASS,
  collectSmoke,
  parseArgs,
  runAutoTrigger,
  selectPort,
  tabAudit,
  type AutoTriggerDeps,
  type AutoTriggerOptions,
} from '../scripts/quest-auto-trigger.mjs';

function baseOptions(overrides: Partial<AutoTriggerOptions> = {}): AutoTriggerOptions {
  return {
    route: '/',
    port: null,
    timeoutMs: 5000,
    settleMs: 10,
    allowDirty: false,
    outDir: null,
    ...overrides,
  };
}

/** Minimal fake WebSocket: opens async, records sends, receives harness replies. */
class FakeSocket {
  static instances: FakeSocket[] = [];
  static sentLog: string[] = [];
  url: string;
  onopen: ((event?: unknown) => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  sent: string[] = [];
  closed = false;

  constructor(url: string) {
    this.url = url;
    FakeSocket.instances.push(this);
    queueMicrotask(() => this.onopen?.({}));
  }

  send(data: string): void {
    this.sent.push(data);
    FakeSocket.sentLog.push(data);
  }

  close(): void {
    this.closed = true;
  }

  receive(message: unknown): void {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
}

function resetSockets(): void {
  FakeSocket.instances = [];
  FakeSocket.sentLog = [];
  fakeCreatedTargetId = 'tab-NEW';
}

function lastSocket(): FakeSocket {
  const socket = FakeSocket.instances[FakeSocket.instances.length - 1];
  if (!socket) throw new Error('no CDP socket was opened');
  return socket;
}

async function tick(times = 20): Promise<void> {
  for (let i = 0; i < times; i += 1) {
     
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

/** Tab id the fake browser session hands out for Target.createTarget. */
let fakeCreatedTargetId = 'tab-NEW';

/** Answer every pending CDP send with canned results; optionally inject events. */
function answerCdp(socket: FakeSocket, events: unknown[] = [], title = 'Smoke Page'): void {
  for (const raw of socket.sent.splice(0)) {
    const message = JSON.parse(raw) as { id: number; method: string };
    if (message.method === 'Target.createTarget') {
      socket.receive({ id: message.id, result: { targetId: fakeCreatedTargetId } });
    } else if (message.method === 'Runtime.evaluate') {
      socket.receive({
        id: message.id,
        result: { result: { value: { title, readyState: 'complete' } } },
      });
    } else {
      socket.receive({ id: message.id, result: {} });
    }
  }
  for (const event of events) socket.receive(event);
}

/** Drive every open fake CDP socket (browser session plus page session). */
function driveSockets(pageEvents: (navigated: boolean) => unknown[] = () => []): void {
  for (const socket of FakeSocket.instances) {
    const navigated =
      socket.url !== 'ws://fake/browser' &&
      socket.sent.some((raw) => JSON.parse(raw).method === 'Page.navigate');
    answerCdp(socket, socket.url === 'ws://fake/browser' ? [] : pageEvents(navigated));
  }
}

function fakeHttpGet(calls: string[]) {
  return async (url: string): Promise<string> => {
    calls.push(url);
    if (url.includes('/json/version')) {
      return JSON.stringify({ webSocketDebuggerUrl: 'ws://fake/browser' });
    }
    if (url.includes('/json/list')) {
      return JSON.stringify([
        { id: 'tab-A', type: 'page' },
        { id: 'tab-NEW', type: 'page', webSocketDebuggerUrl: 'ws://fake/tab-NEW' },
      ]);
    }
    throw new Error(`unexpected httpGet: ${url}`);
  };
}

function fakeDeps(calls: string[], overrides: Partial<AutoTriggerDeps> = {}): AutoTriggerDeps {
  return {
    readGitHead: async () => ({ head: 'abc123', clean: true }),
    captureDevice: async () => ({
      ok: true,
      identity: {
        captureBasis: 'adb-system-property',
        model: 'Quest_3S',
        manufacturer: 'Meta',
        buildIncremental: '1',
        buildDisplayId: 'd',
        buildFingerprint: 'f',
        securityPatch: null,
      },
    }),
    deviceSerial: async () => 'SERIAL-1',
    isPortFree: async () => true,
    startServer: async (port: number) => {
      calls.push(`startServer:${port}`);
      return { pid: 4242, kill: () => {} };
    },
    stopServer: async () => {
      calls.push('stopServer');
    },
    waitForHttp: async (url: string) => {
      calls.push(`waitForHttp:${url}`);
    },
    adbReverse: async (_serial: string, port: number) => {
      calls.push(`adbReverse:${port}`);
    },
    removeAdbReverse: async (_serial: string, port: number) => {
      calls.push(`removeAdbReverse:${port}`);
    },
    adbForward: async (_serial: string, port: number) => {
      calls.push(`adbForward:${port}`);
    },
    removeAdbForward: async (_serial: string, port: number) => {
      calls.push(`removeAdbForward:${port}`);
    },
    listTabs: async () => ['tab-A'],
    httpGet: fakeHttpGet(calls),
    webSocketCtor: FakeSocket as unknown as WebSocket,
    writeRecord: async (outDir: string) => {
      calls.push(`writeRecord:${outDir}`);
    },
    ...overrides,
  };
}

describe('quest-auto-trigger arg parsing and port selection', () => {
  it('defaults to / with no fixed port', () => {
    expect(parseArgs(['node', 'quest-auto-trigger.mjs'])).toMatchObject({ route: '/', port: null });
  });

  it('rejects routes that do not start with /', () => {
    expect(() => parseArgs(['node', 'x', '--route=abc'])).toThrow('--route must start with /');
  });

  it('rejects invalid ports and unknown flags', () => {
    expect(() => parseArgs(['node', 'x', '--port=abc'])).toThrow();
    expect(() => parseArgs(['node', 'x', '--bogus'])).toThrow("unknown argument '--bogus'");
  });

  it('parses --settle-ms within bounds', () => {
    expect(parseArgs(['node', 'x', '--settle-ms=5000']).settleMs).toBe(5000);
    expect(() => parseArgs(['node', 'x', '--settle-ms=-1'])).toThrow('invalid --settle-ms value');
  });

  it('skips busy ports and returns null when the range is exhausted', async () => {
    expect(await selectPort(async (port) => port !== 5173, 5173, 5174)).toBe(5174);
    expect(await selectPort(async () => false, 5173, 5174)).toBeNull();
  });
});

describe('quest-auto-trigger tab audit', () => {
  it('passes when only the owned tab was added and removed', () => {
    expect(tabAudit(['tab-A'], ['tab-A'], 'tab-NEW')).toMatchObject({ preExistingIntact: true });
  });

  it('fails when a pre-existing tab disappears or a stranger appears', () => {
    expect(tabAudit(['tab-A'], [], 'tab-NEW').preExistingIntact).toBe(false);
    expect(tabAudit(['tab-A'], ['tab-A', 'tab-X'], 'tab-NEW')).toMatchObject({
      preExistingIntact: false,
      unexpectedAdded: ['tab-X'],
    });
  });

  it('fails when the owned tab is left open', () => {
    expect(tabAudit(['tab-A'], ['tab-A', 'tab-NEW'], 'tab-NEW').ownTabLeftOpen).toBe(true);
  });

  it('confirms tab closure once the tab disappears, and times out otherwise', async () => {
    let calls = 0;
    const flaky = async (): Promise<string[]> => {
      calls += 1;
      return calls < 3 ? ['tab-A', 'tab-NEW'] : ['tab-A'];
    };
    expect(await awaitTabGone(flaky, 'tab-NEW', 5000, 1)).toBe(true);
    expect(await awaitTabGone(async () => ['tab-A', 'tab-NEW'], 'tab-NEW', 50, 1)).toBe(false);
  });
});

describe('quest-auto-trigger CDP client', () => {
  it('resolves method calls by id', async () => {
    resetSockets();
    const client = new CdpClient(FakeSocket as unknown as WebSocket);
    await client.connect('ws://fake/x', 1000);
    const pending = client.send('Page.enable');
    await tick();
    lastSocket().receive({ id: 1, result: { ok: true } });
    expect(await pending).toEqual({ ok: true });
    client.close();
  });

  it('times out a call that never answers', async () => {
    resetSockets();
    const client = new CdpClient(FakeSocket as unknown as WebSocket);
    await client.connect('ws://fake/x', 1000);
    await expect(client.send('Page.enable', {}, 50)).rejects.toThrow("CDP 'Page.enable' timed out");
    client.close();
  });
});

describe('quest-auto-trigger smoke collection', () => {
  it('navigates only a freshly created tab and never touches pre-existing tabs', async () => {
    resetSockets();
    const calls: string[] = [];
    const smokePromise = collectSmoke({
      httpGet: fakeHttpGet(calls),
      cdpBase: 'http://127.0.0.1:19222',
      webSocketCtor: FakeSocket as unknown as WebSocket,
      routeUrl: 'http://localhost:5174/',
      settleMs: 5,
      timeoutMs: 2000,
      preExistingTabIds: ['tab-A'],
    });
    // Drive the fake CDP sessions until the smoke pass finishes.
    for (let i = 0; i < 200; i += 1) {
      await tick(5);
      driveSockets((navigated) => (navigated ? [{ method: 'Page.loadEventFired', params: {} }] : []));
      const browserSocket = FakeSocket.instances[0];
      const closed =
        browserSocket?.sent.some((raw) => JSON.parse(raw).method === 'Target.closeTarget') ?? false;
      if (closed) break;
    }
    const smoke = await smokePromise;
    expect(smoke.loaded).toBe(true);
    expect(smoke.title).toBe('Smoke Page');
    // The pre-existing tab is never navigated and never closed: no CDP send
    // addresses it and no HTTP call names it.
    const allSends = FakeSocket.sentLog.join(' ');
    expect(allSends).not.toMatch('tab-A');
    expect(calls.filter((call) => call.includes('tab-A'))).toEqual([]);
    expect(allSends).toMatch('Target.closeTarget');
  });

  it('refuses to navigate when devtools recycles a pre-existing tab id', async () => {
    resetSockets();
    fakeCreatedTargetId = 'tab-A';
    let settled = false;
    let failure: unknown = null;
    const pending = collectSmoke({
      httpGet: fakeHttpGet([]),
      cdpBase: 'http://127.0.0.1:19222',
      webSocketCtor: FakeSocket as unknown as WebSocket,
      routeUrl: 'http://localhost:5174/',
      settleMs: 1,
      timeoutMs: 5000,
      preExistingTabIds: ['tab-A'],
    }).then(
      () => {
        settled = true;
      },
      (error: unknown) => {
        settled = true;
        failure = error;
      }
    );
    for (let i = 0; i < 200 && !settled; i += 1) {
      await tick(5);
      driveSockets();
    }
    await pending;
    expect(String(failure)).toMatch('refusing to navigate it');
    // The recycled tab is never navigated: no Page.navigate was ever sent.
    expect(FakeSocket.sentLog.join(' ')).not.toMatch('Page.navigate');
  });
});

describe('quest-auto-trigger orchestration', () => {
  it('records SMOKE_OK with promotion permanently ineligible and cleans up', async () => {
    resetSockets();
    const calls: string[] = [];
    const runPromise = runAutoTrigger(fakeDeps(calls), { ...baseOptions(), outDir: 'test-record' });
    for (let i = 0; i < 300; i += 1) {
      await tick(5);
      driveSockets((navigated) => (navigated ? [{ method: 'Page.loadEventFired', params: {} }] : []));
      if (calls.some((call) => call.startsWith('writeRecord:'))) break;
    }
    const record = await runPromise;
    expect(record.verdict).toBe('SMOKE_OK');
    expect(record.evidenceClass).toBe(EVIDENCE_CLASS);
    expect(record.promotionEligible).toBe(false);
    expect(record.tabAudit?.preExistingIntact).toBe(true);
    expect(record.closeConfirmed).toBe(true);
    // Cleanup ran: server stopped, reverse and forward removed.
    expect(calls).toContain('stopServer');
    expect(calls).toContain('removeAdbReverse:5173');
    expect(calls).toContain('removeAdbForward:19222');
    expect(calls[calls.length - 1]).toBe('writeRecord:test-record');
  });

  it('fails closed on a dirty worktree without --allow-dirty and starts nothing', async () => {
    resetSockets();
    const calls: string[] = [];
    const record = await runAutoTrigger(
      fakeDeps(calls, { readGitHead: async () => ({ head: 'abc123', clean: false }) }),
      baseOptions()
    );
    expect(record.verdict).toBe('TRIGGER_FAILED');
    expect(record.triggerError).toMatch('dirty');
    expect(calls.some((call) => call.startsWith('startServer:'))).toBe(false);
  });

  it('records SMOKE_FAIL when the page logs console errors', async () => {
    resetSockets();
    const calls: string[] = [];
    const runPromise = runAutoTrigger(fakeDeps(calls), { ...baseOptions(), outDir: 'test-record' });
    let injected = false;
    for (let i = 0; i < 300; i += 1) {
      await tick(5);
      driveSockets((navigated) => {
        if (navigated && !injected) {
          injected = true;
          return [
            {
              method: 'Runtime.consoleAPICalled',
              params: { type: 'error', args: [{ value: 'boom' }] },
            },
            { method: 'Page.loadEventFired', params: {} },
          ];
        }
        return navigated ? [{ method: 'Page.loadEventFired', params: {} }] : [];
      });
      if (calls.some((call) => call.startsWith('writeRecord:'))) break;
    }
    const record = await runPromise;
    expect(record.verdict).toBe('SMOKE_FAIL');
    expect(record.smoke?.errorCount).toBe(1);
  });
});
