import fs from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { mountSemanticDatumInspector } from '../src/app/dataset/SemanticDatumInspector.ts';
import type {
  SemanticDatumInspectionResultV1,
  SemanticDetailTransition,
  SemanticDetailTransitionListener,
  SemanticDetailTransitionSnapshot,
} from '../src/app/dataset/SemanticDetailTransition.ts';

const PARENT = {
  semanticId: 'density-cell:0-0',
  datasetFingerprint: 'a'.repeat(64),
  decisionId: 'decision-a4-inspector',
};

function snapshot(
  status: SemanticDetailTransitionSnapshot['status'],
  observationIds: string[] = [],
): SemanticDetailTransitionSnapshot {
  return {
    status,
    parent: status === 'IDLE' ? null : PARENT,
    returnedCount: observationIds.length,
    totalMemberCount: observationIds.length,
    observationIds,
    refusalReason: status === 'REFUSED' ? 'stale' : null,
  };
}

function readyInspection(observationId: string): SemanticDatumInspectionResultV1 {
  return {
    status: 'READY',
    observationId,
    fields: { beta: 2, alpha: 'exact' },
    lineage: {
      datasetFingerprint: 'a'.repeat(64),
      observationId,
      decisionId: 'decision-a4-inspector',
      representationFamily: 'DENSITY',
      semanticObjectId: 'density-cell:0-0',
      generation: 7,
      datasetVersion: 3,
      investigationContext: 'test exact inspection',
      kernelVersion: 'kernel-a4',
      algorithmVersion: 'density-a4',
      decisionModelVersion: 'model-a4',
      decisionModelArtifactHash: 'b'.repeat(64),
    },
    sourceProvenance: {
      status: 'UNAVAILABLE',
      reason: 'no governed per-row source provenance',
    },
  };
}

function fakeTransition(initial: SemanticDetailTransitionSnapshot) {
  let current = initial;
  const listeners = new Set<SemanticDetailTransitionListener>();
  const inspectObservation = vi.fn(async (observationId: string) => readyInspection(observationId));
  const transition = {
    get snapshot() {
      return current;
    },
    subscribe(listener: SemanticDetailTransitionListener) {
      listeners.add(listener);
      listener(current);
      return () => listeners.delete(listener);
    },
    inspectObservation,
  } as unknown as SemanticDetailTransition;
  return {
    transition,
    inspectObservation,
    publish(next: SemanticDetailTransitionSnapshot) {
      current = next;
      for (const listener of listeners) listener(next);
    },
  };
}

describe('Stream A A4 semantic datum inspector', () => {
  it('appears only for a READY bounded page and exposes only bounded observation IDs', () => {
    const state = fakeTransition(snapshot('IDLE'));
    const root = document.createElement('div');
    const inspector = mountSemanticDatumInspector(state.transition, root);
    const select = inspector.element.querySelector('select') as HTMLSelectElement;

    expect(inspector.element.hidden).toBe(true);
    state.publish(snapshot('READY', ['obs-1', 'obs-2']));

    expect(inspector.element.hidden).toBe(false);
    expect([...select.options].map((option) => option.value)).toEqual(['obs-1', 'obs-2']);
    expect(inspector.element.textContent).toContain('2 of 2 observations');

    state.publish(snapshot('REFUSED'));
    expect(inspector.element.hidden).toBe(true);
    expect(select.options).toHaveLength(0);

    inspector.dispose();
  });

  it('requests the selected exact datum and renders exact values plus explicit provenance availability', async () => {
    const state = fakeTransition(snapshot('READY', ['obs-1', 'obs-2']));
    const root = document.createElement('div');
    const inspector = mountSemanticDatumInspector(state.transition, root);
    const select = inspector.element.querySelector('select') as HTMLSelectElement;
    const button = inspector.element.querySelector('#semantic-datum-inspect') as HTMLElement;

    select.value = 'obs-2';
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await vi.waitFor(() => expect(state.inspectObservation).toHaveBeenCalledWith('obs-2'));
    await vi.waitFor(() => expect(inspector.element.textContent).toContain('Exact datum ready · obs-2'));

    const fieldText = inspector.element.querySelector('#semantic-datum-fields')?.textContent ?? '';
    const lineageText = inspector.element.querySelector('#semantic-datum-lineage')?.textContent ?? '';
    expect(fieldText).toContain('alpha');
    expect(fieldText).toContain('exact');
    expect(fieldText).toContain('beta');
    expect(lineageText).toContain('decision-a4-inspector');
    expect(lineageText).toContain('density-cell:0-0');
    expect(lineageText).toContain('Unavailable · no governed per-row source provenance');

    inspector.dispose();
  });

  it('suppresses a late exact-datum result after the semantic detail context changes', async () => {
    const deferred: {
      resolve?: (value: SemanticDatumInspectionResultV1) => void;
    } = {};
    const state = fakeTransition(snapshot('READY', ['obs-1']));
    state.inspectObservation.mockImplementation(
      () => new Promise<SemanticDatumInspectionResultV1>((resolve) => {
        deferred.resolve = resolve;
      }),
    );
    const root = document.createElement('div');
    const inspector = mountSemanticDatumInspector(state.transition, root);
    const button = inspector.element.querySelector('#semantic-datum-inspect') as HTMLElement;

    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await vi.waitFor(() => expect(state.inspectObservation).toHaveBeenCalledTimes(1));
    state.publish(snapshot('REFUSED'));
    expect(deferred.resolve).toBeTypeOf('function');
    deferred.resolve!(readyInspection('obs-1'));
    await Promise.resolve();

    expect(inspector.element.hidden).toBe(true);
    expect(inspector.element.textContent).not.toContain('Exact datum ready');
    inspector.dispose();
  });

  it('is production-wired outside World and has no source-row/cache access', () => {
    const bootstrap = fs.readFileSync('src/app/bootstrap.ts', 'utf8');
    const inspector = fs.readFileSync('src/app/dataset/SemanticDatumInspector.ts', 'utf8');

    expect(bootstrap).toContain('mountSemanticDatumInspector(semanticDetailTransition)');
    expect(inspector).not.toContain('.rows');
    expect(inspector).not.toContain('dataset.toJSON');
    expect(inspector).not.toContain('registerDataset');
    expect(inspector).toContain('transition.inspectObservation(observationId)');
  });
});
