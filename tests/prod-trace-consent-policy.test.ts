import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import {
  setupDevTraceRecorder,
  UX_TRACE_APP_EXPORT_SCHEMA_VERSION,
  UX_TRACE_APP_INTEGRITY_ALGORITHM,
} from '../src/app/devTrace.ts';
import { parseUXTraceText } from '../scripts/lib/ux-trace-input.mjs';
import type { UXTraceRecorderOptions } from '../src/vr/trace/UXTraceRecorder.ts';
import type {
  SelectionDispatchInfo,
  SelectionDispatchStartInfo,
} from '../src/vr/input/SelectionDispatcher.ts';

type Handler = (payload?: unknown) => void;

type ExportedTrace = {
  schemaVersion: number;
  recordCount: number;
  droppedCount: number;
  buildHash?: string;
  validationSession?: { label: string; id: string };
  integrity: { algorithm: string; payloadSha256: string };
  records: Array<Record<string, unknown>>;
};

const SELECTION_START: SelectionDispatchStartInfo = {
  hudConsumed: false,
  sceneMesh: null,
  pointer: null,
  rayValid: true,
};

const SELECTION_OUTCOME: SelectionDispatchInfo = {
  ...SELECTION_START,
  hadCallback: true,
};

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
  let panelState = 'settings';
  const getUIState = vi.fn(() => ({ panel: panelState }));
  const fetchImpl = vi.fn(async () => ({ ok: true, status: 200 }));
  const dispatcher: {
    onDispatchStart: ((info: SelectionDispatchStartInfo) => void) | null;
  } = { onDispatchStart: null };
  const engine = {
    camera: new THREE.PerspectiveCamera(),
    addUpdatable: vi.fn(),
    removeUpdatable: vi.fn(),
    input: {
      hands: [],
      panels: [],
      interactables: [],
      dispatcher,
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
    dispatcher,
    getUIState,
    fetchImpl,
    setPanelState(value: string) {
      panelState = value;
    },
    emit(topic: string, payload?: unknown) {
      for (const handler of [...(handlers.get(topic) ?? [])]) handler(payload);
    },
    exported(): ExportedTrace {
      return JSON.parse(recorder.exportJson()) as ExportedTrace;
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

  it('freezes selection context before scene/global callbacks can mutate UI state', () => {
    const { recorder, dispatcher, exported, setPanelState } = makeHarness({ enabled: true });

    setPanelState('before-selection');
    dispatcher.onDispatchStart?.(SELECTION_START);
    setPanelState('after-selection');
    recorder.recordSelection(SELECTION_OUTCOME);

    const selection = exported().records.find((record) => record.type === 'selection') as
      | { ctx?: { ui?: Record<string, unknown> } }
      | undefined;
    expect(selection?.ctx?.ui).toMatchObject({ panel: 'before-selection' });
  });

  it('does not admit a selection outcome when the dispatch began before consent', () => {
    const { recorder, dispatcher, exported, getUIState } = makeHarness({ enabled: false });

    dispatcher.onDispatchStart?.(SELECTION_START);
    expect(getUIState).not.toHaveBeenCalled();

    recorder.setEnabled(true);
    recorder.recordSelection(SELECTION_OUTCOME);

    expect(exported().records.some((record) => record.type === 'selection')).toBe(false);
  });

  it('exports validation correlation only when label and id form one canonical valid pair', () => {
    const { recorder, exported } = makeHarness({ enabled: true });

    recorder.recordSessionManifest({
      buildHash: 'abc123',
      validationSessionLabel: 'QV3-abc1234-20260905T170000',
      validationSessionId: 'not-a-uuid',
    });

    const invalidEnvelope = exported();
    const invalidManifest = invalidEnvelope.records.find(
      (record) => record.type === 'session-manifest'
    );
    expect(invalidManifest?.buildHash).toBe('abc123');
    expect(invalidManifest).not.toHaveProperty('validationSessionLabel');
    expect(invalidManifest).not.toHaveProperty('validationSessionId');
    expect(invalidEnvelope.buildHash).toBe('abc123');
    expect(invalidEnvelope.validationSession).toBeUndefined();

    recorder.recordSessionManifest({
      validationSessionLabel: 'QV3-abc1234-20260905T170000',
      validationSessionId: '0d4862a0-2c79-4e86-8a71-af6c8d61ba2a',
    });

    const validEnvelope = exported();
    const manifests = validEnvelope.records.filter((record) => record.type === 'session-manifest');
    const validManifest = manifests.at(-1);
    expect(validManifest?.validationSessionLabel).toBe('QV3-abc1234-20260905T170000');
    expect(validManifest?.validationSessionId).toBe('0d4862a0-2c79-4e86-8a71-af6c8d61ba2a');
    expect(validEnvelope.validationSession).toEqual({
      label: 'QV3-abc1234-20260905T170000',
      id: '0d4862a0-2c79-4e86-8a71-af6c8d61ba2a',
    });
  });

  it('emits v2 whole-envelope integrity on the real application composition path', () => {
    const { recorder } = makeHarness({ enabled: true });
    recorder.recordSessionManifest({
      buildHash: 'build-abc',
      validationSessionLabel: 'QV3-abc1234-20260905T170000',
      validationSessionId: '0d4862a0-2c79-4e86-8a71-af6c8d61ba2a',
    });

    const payload = recorder.exportJson();
    const envelope = JSON.parse(payload) as ExportedTrace;
    expect(envelope.schemaVersion).toBe(UX_TRACE_APP_EXPORT_SCHEMA_VERSION);
    expect(envelope.integrity.algorithm).toBe(UX_TRACE_APP_INTEGRITY_ALGORITHM);

    const parsed = parseUXTraceText(payload, { source: 'policy-export.json' });
    expect(parsed.format).toBe('envelope-v2');
    expect(parsed.integrityVerified).toBe(true);
    expect(parsed.integrityScope).toBe('envelope');
  });

  it('keeps build and validation attribution after the manifest record is evicted from the bounded ring', () => {
    const { recorder } = makeHarness({ enabled: true });
    recorder.recordSessionManifest({
      buildHash: 'build-stable',
      validationSessionLabel: 'QV3-abc1234-20260905T170000',
      validationSessionId: '0d4862a0-2c79-4e86-8a71-af6c8d61ba2a',
    });

    for (let i = 0; i < 1105; i += 1) recorder.recordSessionManifest({});

    const payload = recorder.exportJson();
    const envelope = JSON.parse(payload) as ExportedTrace;
    expect(envelope.droppedCount).toBeGreaterThan(0);
    expect(
      envelope.records.some(
        (record) => record.type === 'session-manifest' && record.buildHash === 'build-stable'
      )
    ).toBe(false);
    expect(envelope.buildHash).toBe('build-stable');
    expect(envelope.validationSession).toEqual({
      label: 'QV3-abc1234-20260905T170000',
      id: '0d4862a0-2c79-4e86-8a71-af6c8d61ba2a',
    });
    expect(parseUXTraceText(payload, { source: 'truncated-policy-export.json' }).integrityVerified).toBe(
      true
    );
  });

  it('fails export closed if immutable build or validation attribution changes mid-trace', () => {
    const { recorder } = makeHarness({ enabled: true });
    recorder.recordSessionManifest({ buildHash: 'build-a' });
    recorder.recordSessionManifest({ buildHash: 'build-b' });
    expect(() => recorder.exportJson()).toThrow(/UX trace provenance conflict/);
  });

  it('keeps governed development tracing enabled when the production setting is toggled off', () => {
    const { recorder } = makeHarness({ enabled: true, alwaysEnabled: true });
    expect(recorder.enabled).toBe(true);
    recorder.setEnabled(false);
    expect(recorder.enabled).toBe(true);
  });
});
