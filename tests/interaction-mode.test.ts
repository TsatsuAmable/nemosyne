// @ts-nocheck
import { describe, it, expect, vi } from 'vitest';
import { InteractionModeController } from '../src/vr/input/InteractionModeController.ts';

describe('Interaction State Machine & Focus Vocabulary (Sprint 24.1)', () => {
  it('manages authoritative interaction modes and reversible transitions', () => {
    const onModeChange = vi.fn();
    const controller = new InteractionModeController({
      initialMode: 'NAVIGATE',
      onModeChange,
    });

    expect(controller.currentMode).toBe('NAVIGATE');

    const changed = controller.setMode('INTERACT', 'user_select');
    expect(changed).toBe(true);
    expect(controller.currentMode).toBe('INTERACT');
    expect(onModeChange).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'NAVIGATE',
        to: 'INTERACT',
        reason: 'user_select',
      })
    );

    // Revert transition
    const reverted = controller.revertMode();
    expect(reverted).toBe(true);
    expect(controller.currentMode).toBe('NAVIGATE');
  });

  it('maintains shared focus states across surfaces', () => {
    const controller = new InteractionModeController();

    controller.setFocusState('panel-dataset', 'hovered');
    controller.setFocusState('wheel-action-filter', 'armed');

    expect(controller.getFocusState('panel-dataset')).toBe('hovered');
    expect(controller.getFocusState('wheel-action-filter')).toBe('armed');
    expect(controller.getFocusState('unknown-widget')).toBe('idle');
  });

  it('resolves both-pinch gesture action by active interaction mode without suppression', () => {
    const controller = new InteractionModeController();

    controller.setMode('NAVIGATE');
    expect(controller.resolveBothPinchAction().action).toBe('worldTransform');

    controller.setMode('TRANSFORM');
    expect(controller.resolveBothPinchAction().action).toBe('scaleRotateArtifact');

    controller.setMode('INTERACT');
    expect(controller.resolveBothPinchAction().action).toBe('commitSelection');

    controller.setMode('OBSERVE');
    expect(controller.resolveBothPinchAction().action).toBe('resumeInteraction');
  });
});

describe('P0.4 — Real State Machine: Transition Guards & Negative Tests', () => {
  it('rejects transitions not in the adjacency table (OBSERVE → TRANSFORM is illegal)', () => {
    const controller = new InteractionModeController({ initialMode: 'OBSERVE' });

    // OBSERVE can only go to NAVIGATE or INTERACT — not TRANSFORM.
    expect(controller.validateTransition('TRANSFORM')).toBe(false);
    expect(controller.setMode('TRANSFORM', 'illegal_jump')).toBe(false);
    expect(controller.currentMode).toBe('OBSERVE');

    // OBSERVE → INTERACT is legal.
    expect(controller.setMode('INTERACT', 'resume')).toBe(true);
    expect(controller.currentMode).toBe('INTERACT');

    // INTERACT → TRANSFORM is now legal.
    expect(controller.setMode('TRANSFORM', 'begin_transform')).toBe(true);
  });

  it('rejects TRANSFORM when context explicitly signals no selection', () => {
    const controller = new InteractionModeController({ initialMode: 'INTERACT' });

    // Without context, TRANSFORM is allowed (backward compat).
    expect(controller.setMode('TRANSFORM')).toBe(true);
    expect(controller.currentMode).toBe('TRANSFORM');

    // Go back to INTERACT.
    controller.setMode('INTERACT');

    // With hasSelection: false, TRANSFORM is rejected.
    expect(controller.setMode('TRANSFORM', 'no_selection', { hasSelection: false })).toBe(false);
    expect(controller.currentMode).toBe('INTERACT');

    // With hasSelection: true, TRANSFORM is allowed.
    expect(controller.setMode('TRANSFORM', 'has_selection', { hasSelection: true })).toBe(true);
    expect(controller.currentMode).toBe('TRANSFORM');
  });

  it('resolveBothPinchAction is exhaustive — no default fallthrough', () => {
    const controller = new InteractionModeController();
    // Verify every mode produces a defined action.
    for (const mode of ['NAVIGATE', 'INTERACT', 'TRANSFORM', 'OBSERVE'] as const) {
      controller.setMode(mode);
      const result = controller.resolveBothPinchAction();
      expect(result.action).toBeTruthy();
      expect(result.description).toBeTruthy();
    }
  });

  it('rejects invalid mode values', () => {
    const controller = new InteractionModeController();
    // @ts-expect-error — testing invalid input
    expect(controller.validateTransition('INVALID')).toBe(false);
    // @ts-expect-error — testing invalid input
    expect(controller.setMode('INVALID')).toBe(false);
    expect(controller.currentMode).toBe('INTERACT');
  });
});
