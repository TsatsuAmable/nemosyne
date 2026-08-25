import { test, expect, type Page } from '@playwright/test';

type HarnessRole = 'participant' | 'observer';

interface RemotePeerSnapshot {
  peerId: string;
  name: string;
  role: HarnessRole;
  state: Record<string, unknown>;
}

interface HarnessSnapshot {
  peerId: string;
  role: HarnessRole;
  connected: boolean;
  remotePeers: RemotePeerSnapshot[];
  channels: Array<{ peerId: string; readyState: RTCDataChannelState }>;
  eventCounts: Record<string, number>;
}

interface HarnessWindow extends Window {
  __nemosyneCollaborationHarness: {
    connect(options: { roomId: string; peerId: string; role: HarnessRole }): Promise<HarnessSnapshot>;
    snapshot(): HarnessSnapshot;
    setLocalState(state: Record<string, unknown>): HarnessSnapshot;
    broadcastStateDelta(topic: string, data: Record<string, unknown>): boolean;
    broadcastDatasetOperation(op: Record<string, unknown>): boolean;
    sendRawDatasetOperation(op: Record<string, unknown>): number;
    sendRawStateDelta(topic: string, data: Record<string, unknown>): number;
    partition(): void;
    disconnect(): void;
  };
}

async function snapshot(page: Page): Promise<HarnessSnapshot> {
  return page.evaluate(() => (window as HarnessWindow).__nemosyneCollaborationHarness.snapshot());
}

async function waitForOpenChannel(page: Page, peerId: string): Promise<void> {
  await expect
    .poll(
      async () => {
        const state = await snapshot(page);
        return state.channels.some(
          (channel) => channel.peerId === peerId && channel.readyState === 'open'
        );
      },
      { timeout: 15_000, message: `${peerId} data channel becomes open` }
    )
    .toBe(true);
}

async function waitForRemoteRevision(page: Page, peerId: string, revision: number): Promise<void> {
  await expect
    .poll(
      async () => {
        const state = await snapshot(page);
        return state.remotePeers.find((peer) => peer.peerId === peerId)?.state.revision;
      },
      { timeout: 15_000, message: `${peerId} remote state converges to revision ${revision}` }
    )
    .toBe(revision);
}

test('observer partition recovers WebRTC, converges state, and preserves mutation denial', async ({
  browser,
}) => {
  const participantContext = await browser.newContext();
  const observerContext = await browser.newContext();
  const participantPage = await participantContext.newPage();
  const observerPage = await observerContext.newPage();
  const pageErrors: string[] = [];

  participantPage.on('pageerror', (error) => pageErrors.push(`participant: ${String(error)}`));
  observerPage.on('pageerror', (error) => pageErrors.push(`observer: ${String(error)}`));

  const roomId = `res02-${Date.now()}`;
  const participantId = 'participant-a';
  const observerId = 'observer-b';

  try {
    await Promise.all([
      participantPage.goto('/tests/smoke/collaboration-harness.html'),
      observerPage.goto('/tests/smoke/collaboration-harness.html'),
    ]);

    await participantPage.evaluate(
      (options) => (window as HarnessWindow).__nemosyneCollaborationHarness.connect(options),
      { roomId, peerId: participantId, role: 'participant' as const }
    );
    await observerPage.evaluate(
      (options) => (window as HarnessWindow).__nemosyneCollaborationHarness.connect(options),
      { roomId, peerId: observerId, role: 'observer' as const }
    );

    await Promise.all([
      waitForOpenChannel(participantPage, observerId),
      waitForOpenChannel(observerPage, participantId),
    ]);

    await participantPage.evaluate(() =>
      (window as HarnessWindow).__nemosyneCollaborationHarness.setLocalState({
        dataset: 'baseline',
        revision: 1,
      })
    );
    await waitForRemoteRevision(observerPage, participantId, 1);

    const observerPolicy = await observerPage.evaluate(() => ({
      delta: (window as HarnessWindow).__nemosyneCollaborationHarness.broadcastStateDelta(
        'layout',
        { layout: 'forbidden' }
      ),
      operation: (window as HarnessWindow).__nemosyneCollaborationHarness.broadcastDatasetOperation({
        op: 'sort',
        column: 'x',
      }),
    }));
    expect(observerPolicy).toEqual({ delta: false, operation: false });

    const beforeRawViolation = await snapshot(participantPage);
    const rawSends = await observerPage.evaluate(() => ({
      operation: (window as HarnessWindow).__nemosyneCollaborationHarness.sendRawDatasetOperation({
        op: 'sort',
        column: 'x',
      }),
      delta: (window as HarnessWindow).__nemosyneCollaborationHarness.sendRawStateDelta(
        'layout',
        { layout: 'forbidden' }
      ),
    }));
    expect(rawSends.operation).toBeGreaterThan(0);
    expect(rawSends.delta).toBeGreaterThan(0);
    await participantPage.waitForTimeout(150);

    const afterRawViolation = await snapshot(participantPage);
    expect(afterRawViolation.eventCounts.remoteDatasetOperation).toBe(
      beforeRawViolation.eventCounts.remoteDatasetOperation
    );
    expect(afterRawViolation.eventCounts.stateDelta).toBe(beforeRawViolation.eventCounts.stateDelta);

    await observerPage.evaluate(() =>
      (window as HarnessWindow).__nemosyneCollaborationHarness.partition()
    );
    await expect
      .poll(async () => (await snapshot(observerPage)).eventCounts.disconnected ?? 0, {
        timeout: 5_000,
        message: 'observer sees the injected signalling partition',
      })
      .toBeGreaterThanOrEqual(1);

    // This update is made while the observer is disconnected. Recovery must
    // rebuild the WebRTC data channel and send the participant's current state.
    await participantPage.evaluate(() =>
      (window as HarnessWindow).__nemosyneCollaborationHarness.setLocalState({
        dataset: 'during-partition',
        revision: 2,
      })
    );

    await expect
      .poll(async () => (await snapshot(observerPage)).eventCounts.connected ?? 0, {
        timeout: 15_000,
        message: 'observer signalling reconnects',
      })
      .toBeGreaterThanOrEqual(2);

    await Promise.all([
      waitForOpenChannel(participantPage, observerId),
      waitForOpenChannel(observerPage, participantId),
    ]);
    await waitForRemoteRevision(observerPage, participantId, 2);

    const participantRecovered = await snapshot(participantPage);
    const observerRecovered = await snapshot(observerPage);
    expect(participantRecovered.remotePeers.find((peer) => peer.peerId === observerId)?.role).toBe(
      'observer'
    );
    expect(observerRecovered.role).toBe('observer');
    expect(participantRecovered.eventCounts.peerJoined).toBeGreaterThanOrEqual(2);
    expect(observerRecovered.eventCounts.peerJoined).toBeGreaterThanOrEqual(2);

    const recoveredPolicy = await observerPage.evaluate(() => ({
      delta: (window as HarnessWindow).__nemosyneCollaborationHarness.broadcastStateDelta(
        'dataset',
        { revision: 999 }
      ),
      operation: (window as HarnessWindow).__nemosyneCollaborationHarness.broadcastDatasetOperation({
        op: 'filter',
        column: 'x',
      }),
    }));
    expect(recoveredPolicy).toEqual({ delta: false, operation: false });

    const beforeRecoveredViolation = await snapshot(participantPage);
    await observerPage.evaluate(() => {
      (window as HarnessWindow).__nemosyneCollaborationHarness.sendRawDatasetOperation({
        op: 'filter',
        column: 'x',
      });
      (window as HarnessWindow).__nemosyneCollaborationHarness.sendRawStateDelta('dataset', {
        revision: 999,
      });
    });
    await participantPage.waitForTimeout(150);
    const afterRecoveredViolation = await snapshot(participantPage);
    expect(afterRecoveredViolation.eventCounts.remoteDatasetOperation).toBe(
      beforeRecoveredViolation.eventCounts.remoteDatasetOperation
    );
    expect(afterRecoveredViolation.eventCounts.stateDelta).toBe(
      beforeRecoveredViolation.eventCounts.stateDelta
    );

    expect(pageErrors, `uncaught browser errors: ${pageErrors.join(' | ')}`).toEqual([]);
  } finally {
    await participantPage
      .evaluate(() => (window as HarnessWindow).__nemosyneCollaborationHarness.disconnect())
      .catch(() => undefined);
    await observerPage
      .evaluate(() => (window as HarnessWindow).__nemosyneCollaborationHarness.disconnect())
      .catch(() => undefined);
    await participantContext.close();
    await observerContext.close();
  }
});
