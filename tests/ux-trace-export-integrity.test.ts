// @ts-nocheck
import { describe, expect, it, vi } from 'vitest';
import {
  UX_TRACE_EXPORT_SCHEMA_VERSION,
  UX_TRACE_INTEGRITY_ALGORITHM,
  UXTraceRecorder,
} from '../src/vr/trace/UXTraceRecorder.ts';
import { canonicalSha256Hex } from '../src/security/CryptoHash.ts';
import { parseUXTraceText } from '../scripts/lib/ux-trace-input.mjs';

function makeRecorder(enabled = true) {
  const updatables: unknown[] = [];
  const engine = {
    addUpdatable(obj: unknown) {
      updatables.push(obj);
    },
    removeUpdatable(obj: unknown) {
      const index = updatables.indexOf(obj);
      if (index >= 0) updatables.splice(index, 1);
    },
    input: {
      hands: [],
      panels: [],
      interactables: [],
      pointers: { getBestPointerRay: () => null },
    },
  };
  const recorder = new UXTraceRecorder({
    engine,
    enabled,
    fetchImpl: vi.fn(async () => ({ ok: false, status: 404 })),
  });
  return recorder;
}

function recordsOf(recorder: UXTraceRecorder) {
  return (recorder as unknown as { _buffer: Array<Record<string, unknown>> })._buffer;
}

describe('UX trace lifecycle and export integrity', () => {
  it('emits trace-start only when recording is enabled', () => {
    const enabled = makeRecorder(true);
    expect(recordsOf(enabled).map((r) => [r.type, r.event])).toEqual([
      ['trace-lifecycle', 'trace-start'],
    ]);

    const disabled = makeRecorder(false);
    expect(recordsOf(disabled)).toEqual([]);
  });

  it('records consent boundaries without admitting observations after withdrawal', () => {
    const recorder = makeRecorder(false);
    recorder.setEnabled(true);
    recorder.recordSessionManifest({ datasetFingerprint: 'fp-a', datasetVersion: 'v1' });
    recorder.setEnabled(false);
    const countAtWithdrawal = recordsOf(recorder).length;

    recorder.recordSessionManifest({ datasetFingerprint: 'should-not-record' });
    expect(recordsOf(recorder)).toHaveLength(countAtWithdrawal);

    const lifecycle = recordsOf(recorder)
      .filter((r) => r.type === 'trace-lifecycle')
      .map((r) => r.event);
    expect(lifecycle).toEqual([
      'consent-enabled',
      'trace-start',
      'dataset-boundary',
      'consent-disabled',
      'trace-end',
    ]);
  });

  it('emits dataset-boundary only when authoritative dataset identity changes', () => {
    const recorder = makeRecorder(true);
    recorder.recordSessionManifest({
      datasetName: 'A',
      datasetFingerprint: 'fp-a',
      datasetVersion: 'v1',
      topology: 'POINT',
    });
    recorder.recordSessionManifest({
      datasetName: 'A',
      datasetFingerprint: 'fp-a',
      datasetVersion: 'v1',
      topology: 'POINT',
    });
    recorder.recordSessionManifest({
      datasetName: 'B',
      datasetFingerprint: 'fp-b',
      datasetVersion: 'v2',
      topology: 'GRAPH',
    });

    const boundaries = recordsOf(recorder).filter(
      (r) => r.type === 'trace-lifecycle' && r.event === 'dataset-boundary'
    );
    expect(boundaries).toHaveLength(2);
    expect(boundaries[0].datasetFingerprint).toBe('fp-a');
    expect(boundaries[1].datasetFingerprint).toBe('fp-b');
  });

  it('exports a versioned canonical-SHA256 envelope directly accepted by the analyzer parser', () => {
    const recorder = makeRecorder(true);
    recorder.recordSessionManifest({
      buildHash: 'build-abc',
      validationSessionLabel: 'quest-gate-a',
      validationSessionId: '00000000-0000-4000-8000-000000000001',
      datasetFingerprint: 'fp-a',
    });

    const payload = recorder.exportJson();
    const envelope = JSON.parse(payload);

    expect(envelope.schemaVersion).toBe(UX_TRACE_EXPORT_SCHEMA_VERSION);
    expect(envelope.integrity.algorithm).toBe(UX_TRACE_INTEGRITY_ALGORITHM);
    expect(envelope.integrity.recordsSha256).toBe(canonicalSha256Hex(envelope.records));
    expect(envelope.recordCount).toBe(envelope.records.length);
    expect(envelope.firstSeq).toBe(envelope.records[0].seq);
    expect(envelope.lastSeq).toBe(envelope.records.at(-1).seq);
    expect(envelope.buildHash).toBe('build-abc');
    expect(envelope.validationSession).toEqual({
      label: 'quest-gate-a',
      id: '00000000-0000-4000-8000-000000000001',
    });
    expect(
      envelope.records.some(
        (r: Record<string, unknown>) => r.type === 'trace-lifecycle' && r.event === 'export-requested'
      )
    ).toBe(true);

    const parsed = parseUXTraceText(payload, { source: 'recorder-export.json' });
    expect(parsed.format).toBe('envelope-v1');
    expect(parsed.integrityVerified).toBe(true);
    expect(parsed.records).toEqual(envelope.records);
  });

  it('keeps exports bounded and makes buffer truncation explicit', () => {
    const recorder = makeRecorder(true);
    for (let i = 0; i < 1105; i += 1) {
      recorder.recordSessionManifest({});
    }

    const envelope = JSON.parse(recorder.exportJson());
    expect(envelope.records.length).toBeLessThanOrEqual(1000);
    expect(envelope.recordCount).toBe(envelope.records.length);
    expect(envelope.droppedCount).toBeGreaterThan(0);
    const dropMarker = envelope.records.find(
      (r: Record<string, unknown>) => r.type === 'trace-lifecycle' && r.event === 'buffer-drop'
    );
    expect(dropMarker).toBeDefined();
    expect(dropMarker.droppedCount).toBe(envelope.droppedCount);
    expect(envelope.firstSeq).toBe(envelope.records[0].seq);
    expect(envelope.lastSeq).toBe(envelope.records.at(-1).seq);
    expect(() => parseUXTraceText(JSON.stringify(envelope), { source: 'bounded.json' })).not.toThrow();
  });

  it('exports a closed trace after consent withdrawal without creating post-withdrawal records', () => {
    const recorder = makeRecorder(true);
    recorder.recordSessionManifest({ datasetFingerprint: 'fp-a' });
    recorder.setEnabled(false);
    const before = recordsOf(recorder).length;
    const envelope = JSON.parse(recorder.exportJson());

    expect(recordsOf(recorder)).toHaveLength(before);
    expect(envelope.traceOpen).toBe(false);
    expect(envelope.records.at(-1)).toMatchObject({
      type: 'trace-lifecycle',
      event: 'trace-end',
      reason: 'consent-withdrawn',
    });
  });
});
