/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import {
  INVESTIGATOR_TASKS,
  dispatchInvestigatorTask,
  type InvestigatorTaskIntent,
} from '../src/app/intents/InvestigatorTaskIntent.ts';
import { mountDesktopSelectionTaskRail } from '../src/app/DesktopSelectionTaskRail.ts';
import { ContextualTaskSurface } from '../src/vr/ui/ContextualTaskSurface.ts';

afterEach(() => {
  document.body.innerHTML = '';
});

function createMockEngine() {
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 1.6, 3);
  return {
    camera,
    scene: new THREE.Scene(),
    input: {
      feedback: {
        playSelect: vi.fn(),
        playHover: vi.fn(),
        playGestureTone: vi.fn(),
        playHaptic: vi.fn(),
      },
      pointers: [],
    },
    addUpdatable: vi.fn(),
    addHudObject: vi.fn(),
    removeUpdatable: vi.fn(),
    removeHudObject: vi.fn(),
  } as any;
}

function mountShellFixture(): HTMLElement {
  const shell = document.createElement('section');
  shell.id = 'investigation-shell';
  const aside = document.createElement('aside');
  aside.appendChild(document.createElement('details'));
  shell.appendChild(aside);
  document.body.appendChild(shell);
  return shell;
}

describe('P1-UV C3 desktop/XR semantic parity', () => {
  it('freezes one canonical selected-object task vocabulary', () => {
    expect(INVESTIGATOR_TASKS.map(({ id, label }) => ({ id, label }))).toEqual([
      { id: 'inspect', label: 'Inspect' },
      { id: 'compare', label: 'Compare' },
      { id: 'challenge', label: 'Challenge' },
      { id: 'record', label: 'Record' },
      { id: 'navigate', label: 'Navigate' },
      { id: 'more', label: 'More' },
    ]);
  });

  it('dispatches every canonical task through one callback resolver without analytical logic', () => {
    const payload = { id: 'node-7', topology: 'GRAPH' };
    const callbacks = {
      onInspect: vi.fn(),
      onCompare: vi.fn(),
      onChallenge: vi.fn(),
      onRecord: vi.fn(),
      onNavigate: vi.fn(),
      onMore: vi.fn(),
    };

    for (const task of INVESTIGATOR_TASKS) {
      expect(dispatchInvestigatorTask(callbacks, task.id, payload)).toBe(true);
    }

    expect(callbacks.onInspect).toHaveBeenCalledWith(payload);
    expect(callbacks.onCompare).toHaveBeenCalledWith(payload);
    expect(callbacks.onChallenge).toHaveBeenCalledWith(payload);
    expect(callbacks.onRecord).toHaveBeenCalledWith(payload);
    expect(callbacks.onNavigate).toHaveBeenCalledWith(payload);
    expect(callbacks.onMore).toHaveBeenCalledWith(payload);
  });

  it('uses the same transient resolver and availability semantics for immersive tasks', () => {
    const onRecord = vi.fn();
    const surface = new ContextualTaskSurface(createMockEngine(), { onRecord });
    const payload = { id: 'node-1', topology: 'GRAPH' };
    surface.showAtNode(new THREE.Object3D(), payload);

    expect(surface.taskAvailability('record', payload)).toEqual({ available: true });
    expect(surface.taskAvailability('challenge', { id: 'table', topology: 'TABULAR' })).toEqual({
      available: false,
      reason: 'Needs linked structure',
    });

    expect(surface.dispatchTask('record')).toBe(true);
    expect(onRecord).toHaveBeenCalledOnce();
    expect(onRecord).toHaveBeenCalledWith(payload);
    expect(surface.activeData).toBeNull();
    expect(surface.activeNode).toBeNull();
    expect(surface.visible).toBe(false);
  });

  it('renders all six tasks on desktop and delegates the exact selected payload', () => {
    mountShellFixture();
    const payload = { id: 'graph-node', topology: 'GRAPH' };
    let selected: { label: string; data: Record<string, unknown> } | null = {
      label: 'Graph node',
      data: payload,
    };
    const dispatched: Array<[InvestigatorTaskIntent, Record<string, unknown>]> = [];

    const handle = mountDesktopSelectionTaskRail({
      getSelection: () => selected,
      dispatchTask: (intent, data) => {
        dispatched.push([intent, data]);
        selected = null;
        return true;
      },
      taskAvailability: (intent, data) => {
        if (!data) return { available: false, reason: 'Select an object' };
        if ((intent === 'challenge' || intent === 'navigate') && data.topology === 'TABULAR') {
          return {
            available: false,
            reason: intent === 'challenge' ? 'Needs linked structure' : 'No linked path',
          };
        }
        return { available: true };
      },
    });

    for (const task of INVESTIGATOR_TASKS) {
      const button = document.getElementById(`desktop-task-${task.id}`);
      expect(button).not.toBeNull();
      expect(button?.textContent).toBe(task.label);
    }

    document.getElementById('desktop-task-inspect')?.click();
    expect(dispatched).toEqual([['inspect', payload]]);
    expect(document.getElementById('desktop-selection-context')?.textContent).toContain(
      'Select a data object',
    );
    for (const task of INVESTIGATOR_TASKS) {
      expect(document.getElementById(`desktop-task-${task.id}`)?.hasAttribute('disabled')).toBe(
        true,
      );
    }

    handle.dispose();
  });

  it('projects XR unavailable reasons onto desktop instead of enabling a divergent task', () => {
    mountShellFixture();
    const payload = { id: 'row-1', topology: 'TABULAR' };
    const dispatchTask = vi.fn(() => true);

    const handle = mountDesktopSelectionTaskRail({
      getSelection: () => ({ label: 'Row 1', data: payload }),
      dispatchTask,
      taskAvailability: (intent, data) => {
        if (!data) return { available: false, reason: 'Select an object' };
        if (intent === 'challenge') return { available: false, reason: 'Needs linked structure' };
        if (intent === 'navigate') return { available: false, reason: 'No linked path' };
        return { available: true };
      },
    });

    const challenge = document.getElementById('desktop-task-challenge');
    const navigate = document.getElementById('desktop-task-navigate');
    expect(challenge?.hasAttribute('disabled')).toBe(true);
    expect(challenge?.getAttribute('title')).toBe('Needs linked structure');
    expect(navigate?.hasAttribute('disabled')).toBe(true);
    expect(navigate?.getAttribute('title')).toBe('No linked path');

    challenge?.click();
    navigate?.click();
    expect(dispatchTask).not.toHaveBeenCalled();

    handle.dispose();
  });

  it('invalidates stale desktop selection when the authoritative context changes', () => {
    mountShellFixture();
    const payload = { id: 'node-1', topology: 'GRAPH' };
    let selected: { label: string; data: Record<string, unknown> } | null = {
      label: 'Node 1',
      data: payload,
    };
    const contextSubscribers: Array<() => void> = [];

    const handle = mountDesktopSelectionTaskRail({
      getSelection: () => selected,
      dispatchTask: vi.fn(() => true),
      subscribeSelectionContext: (handler) => {
        contextSubscribers.push(handler);
        return () => {
          const index = contextSubscribers.indexOf(handler);
          if (index >= 0) contextSubscribers.splice(index, 1);
        };
      },
    });

    expect(document.getElementById('desktop-selection-context')?.textContent).toContain('Node 1');
    expect(contextSubscribers).toHaveLength(1);
    selected = null;
    contextSubscribers[0]!();
    expect(document.getElementById('desktop-selection-context')?.textContent).toContain(
      'Select a data object',
    );
    for (const task of INVESTIGATOR_TASKS) {
      expect(document.getElementById(`desktop-task-${task.id}`)?.hasAttribute('disabled')).toBe(
        true,
      );
    }

    handle.dispose();
    expect(contextSubscribers).toHaveLength(0);
  });
});
