import fs from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  mountSemanticDetailReturnControl,
} from '../src/app/dataset/SemanticDetailReturnControl.ts';
import type {
  SemanticDetailTransition,
  SemanticDetailTransitionListener,
  SemanticDetailTransitionSnapshot,
} from '../src/app/dataset/SemanticDetailTransition.ts';

const PARENT = {
  semanticId: 'density-cell:1-1',
  datasetFingerprint: 'a'.repeat(64),
  decisionId: 'decision-a3-return',
};

function fakeTransition(initial: SemanticDetailTransitionSnapshot) {
  let snapshot = initial;
  const listeners = new Set<SemanticDetailTransitionListener>();
  const clear = vi.fn(() => {
    snapshot = {
      status: 'IDLE',
      parent: null,
      returnedCount: 0,
      totalMemberCount: 0,
      refusalReason: null,
    };
    for (const listener of listeners) listener(snapshot);
  });
  const transition = {
    get snapshot() {
      return snapshot;
    },
    clear,
    subscribe(listener: SemanticDetailTransitionListener) {
      listeners.add(listener);
      listener(snapshot);
      return () => listeners.delete(listener);
    },
  } as unknown as SemanticDetailTransition;
  return {
    transition,
    clear,
    publish(next: SemanticDetailTransitionSnapshot) {
      snapshot = next;
      for (const listener of listeners) listener(snapshot);
    },
  };
}

function idleSnapshot(): SemanticDetailTransitionSnapshot {
  return {
    status: 'IDLE',
    parent: null,
    returnedCount: 0,
    totalMemberCount: 0,
    refusalReason: null,
  };
}

describe('Stream A A3 explicit return navigation', () => {
  it('shows Back to structure only while bounded semantic detail is active', () => {
    const state = fakeTransition(idleSnapshot());
    const root = document.createElement('div');
    const control = mountSemanticDetailReturnControl(state.transition, root);

    expect(control.element.hidden).toBe(true);

    state.publish({
      status: 'PENDING',
      parent: PARENT,
      returnedCount: 0,
      totalMemberCount: 0,
      refusalReason: null,
    });
    expect(control.element.hidden).toBe(false);

    state.publish({
      status: 'READY',
      parent: PARENT,
      returnedCount: 2,
      totalMemberCount: 2,
      refusalReason: null,
    });
    expect(control.element.hidden).toBe(false);

    state.publish({
      status: 'REFUSED',
      parent: PARENT,
      returnedCount: 0,
      totalMemberCount: 0,
      refusalReason: 'stale',
    });
    expect(control.element.hidden).toBe(true);

    control.dispose();
  });

  it('returns by clearing detail state without issuing another selection or analysis command', () => {
    const state = fakeTransition({
      status: 'READY',
      parent: PARENT,
      returnedCount: 2,
      totalMemberCount: 2,
      refusalReason: null,
    });
    const root = document.createElement('div');
    const control = mountSemanticDetailReturnControl(state.transition, root);

    control.element.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(state.clear).toHaveBeenCalledTimes(1);
    expect(state.transition.snapshot.status).toBe('IDLE');
    expect(control.element.hidden).toBe(true);
    control.dispose();
  });

  it('unsubscribes and removes the affordance on teardown', () => {
    const state = fakeTransition({
      status: 'READY',
      parent: PARENT,
      returnedCount: 1,
      totalMemberCount: 1,
      refusalReason: null,
    });
    const root = document.createElement('div');
    const control = mountSemanticDetailReturnControl(state.transition, root);
    const element = control.element;

    control.dispose();
    expect(root.contains(element)).toBe(false);

    state.publish(idleSnapshot());
    expect(state.clear).not.toHaveBeenCalled();
  });

  it('is production-wired outside World and remains row-free', () => {
    const bootstrap = fs.readFileSync('src/app/bootstrap.ts', 'utf8');
    const control = fs.readFileSync('src/app/dataset/SemanticDetailReturnControl.ts', 'utf8');
    const transition = fs.readFileSync('src/app/dataset/SemanticDetailTransition.ts', 'utf8');

    expect(bootstrap).toContain('mountSemanticDetailReturnControl(semanticDetailTransition)');
    expect(control).not.toContain('.rows');
    expect(control).not.toContain('execute(');
    expect(control).not.toContain('registerDataset');
    expect(transition).toContain('subscribe(listener: SemanticDetailTransitionListener)');
  });
});
