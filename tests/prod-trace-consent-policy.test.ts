import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { setupDevTraceRecorder } from '../src/app/devTrace.ts';
import type { UXTraceRecorderOptions } from '../src/vr/trace/UXTraceRecorder.ts';

type Handler = (payload?: unknown) => void;

function makeHarness(options: {
  enabled?: boolean;
  alwaysEnabled?: boolean;
} = {}) {
  const handlers = new Map<string, Handler[]>();
  const eventBus = {
    on(topic: string, handler: Handler) {
      const list = handlers.get(topic) ?? [];
      list.push(handler);
      handlers.set(topic, list);
      return () => {
        const current = handlers.get(topic) ?? [];
        const index = current.indexOf(handler);
        if (index >= 0) current.splice(index, 1);
      };
    },
  };
  const getUIState = vi.fn(() => ({ panel: 'settings' }));
  const fetchImpl = vi.fn(async () => ({ ok: true, status: 200 }));
  const engine = {
    camera: new THREE.PerspectiveCamera(),
    addUpdatable: vi.fn(),
    removeUpdatable: vi.fn(),
    input: {
      hands: [],
      panels: [],
      interactables: [],
    },
  };
  const recorderOptions: UXTraceRecorderOptions = {
    engine,
    eventBus,
    getUIState,
    fetchImpl,
  };
  if (options.enabled !== undefined) recorderOptions.enabled = options.enabled;

  const recorder = setupDevTraceRecorder(
    { recorderOptions, bind: vi.fn() },
    {
      allowNetworkFlush: false,
      alwaysEnabled: options.alwaysEnabled ?? false,
    }
  );

  return {
    recorder,
    getUIState,
    fetchImpl,
    emit(topic: string, payload?: unknown) {
      for (const handler of [...(handlers.get(topic) ?? [])]) handler(payload);
    },
    exported() {
      return JSON.parse(recorder.exportJson()) as {
        recordCount: number;
        records: Array<Record<string, unknown>>;
      };
    },
  };
}

describe('production UX trace consent policy', () => {
  it('constructs production tracing fail-closed when no explicit enabled state is supplied', () => {
    const { recorder } = makeHarness();
    expect(recorder.enabled).toBe(false);
  });

  it('does not observe event-bus interaction or build spatial context before consent or after withdrawal', () => {
    const { recorder, emit, exported, getUIState } = makeHarness({ enabled: false });

    emit('gesture:recognized', {
      name: 'scoopUp',
      ctx: { confidence: 0.91, source: 'hand' },
    });
    emit('interaction', { action: 'select', target: 'node-42' });

    expect(exported().recordCount).toBe(0);
    expect(getUIState).not.toHaveBeenCalled();

    recorder.setEnabled(true);
    emit('gesture:recognized', {
      name: 'scoopUp',
      ctx: { confidence: 0.91, source: 'hand' },
    });
    emit('interaction', { action: 'select', target: 'node-42' });

    const consented = exported();
    expect(consented.records.some((record) => record.type === 'gesture')).toBe(true);
    expect(consented.records.some((record) => record.type === 'interaction')).toBe(true);
    expect(getUIState).toHaveBeenCalled();

    const beforeWithdrawal = consented.recordCount;
    getUIState.mockClear();
    recorder.setEnabled(false);
    emit('gesture:recognized', { name: 'pinch' });
    emit('interaction', { action: 'open-panel' });

    const withdrawn = exported();
    expect(withdrawn.recordCount).toBe(beforeWithdrawal + 2);
    expect(withdrawn.records.slice(-2)).toEqual([
      expect.objectContaining({ type: 'trace-lifecycle', event: 'consent-disabled' }),
      expect.objectContaining({ type: 'trace-lifecycle', event: 'trace-end' }),
    ]);
    expect(
      withdrawn.records.slice(beforeWithdrawal).some(
        (record) => record.type === 'gesture' || record.type === 'interaction'
      )
    ).toBe(false);
    expect(getUIState).not.toHaveBeenCalled();
  });

  it('exports validation correlation only when label and id form one canonical valid pair', () => {
    const { recorder, exported } = makeHarness({ enabled: true });

    recorder.recordSessionManifest({
      buildHash: 'abc123',
      validationSessionLabel: 'QV3-abc1234-20260905T170000',
      validationSessionId: 'not-a-uuid',
    });

    const invalidManifest = exported().records.find(
      (record) => record.type === 'session-manifest'
    );
    expect(invalidManifest?.buildHash).toBe('abc123');
    expect(invalidManifest).not.toHaveProperty('validationSessionLabel');
    expect(invalidManifest).not.toHaveProperty('validationSessionId');

    recorder.recordSessionManifest({
      validationSessionLabel: 'QV3-abc1234-20260905T170000',
      validationSessionId: '0d4862a0-2c79-4e86-8a71-af6c8d61ba2a',
    });

    const manifests = exported().records.filter((record) => record.type === 'session-manifest');
    const validManifest = manifests.at(-1);
    expect(validManifest?.validationSessionLabel).toBe('QV3-abc1234-20260905T170000');
    expect(validManifest?.validationSessionId).toBe('0d4862a0-2c79-4e86-8a71-af6c8d61ba2a');
  });

  it('keeps governed development tracing enabled when the production setting is toggled off', () => {
    const { recorder } = makeHarness({ enabled: true, alwaysEnabled: true });
    expect(recorder.enabled).toBe(true);
    recorder.setEnabled(false);
    expect(recorder.enabled).toBe(true);
  });
});
