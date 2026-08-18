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
