// @ts-nocheck
// @vitest-environment jsdom

import { describe, it, expect, afterEach, vi } from 'vitest';
import { NemosyneVRButton } from '../src/vr/VRButton.ts';

function makeMockRenderer() {
  return {
    getContext: vi.fn(() => ({ makeXRCompatible: vi.fn() })),
    xr: {
      isPresenting: false,
      getSession: vi.fn(() => null),
      setSession: vi.fn().mockResolvedValue(undefined),
    },
  };
}

describe('NemosyneVRButton', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    const button = document.getElementById('nemosyne-vr-button');
    if (button?.parentNode) button.parentNode.removeChild(button);
    vi.restoreAllMocks();
  });

  it('creates a disabled button when XR is unsupported', () => {
    vi.stubGlobal('navigator', {});
    const renderer = makeMockRenderer();
    const button = NemosyneVRButton.createButton(renderer);

    expect(button.textContent).toBe('VR NOT SUPPORTED');
    expect(button.disabled).toBe(true);
  });

  it('creates an enabled ENTER VR button when XR is supported', () => {
    vi.stubGlobal('navigator', {
      xr: {
        isSessionSupported: vi.fn().mockResolvedValue(true),
      },
    });
    const renderer = makeMockRenderer();
    const button = NemosyneVRButton.createButton(renderer);

    expect(button.textContent).toBe('ENTER VR');
    expect(button.disabled).toBe(false);
  });

  it('disables the button if the session is not supported', async () => {
    vi.stubGlobal('navigator', {
      xr: {
        isSessionSupported: vi.fn().mockResolvedValue(false),
      },
    });
    const renderer = makeMockRenderer();
    const button = NemosyneVRButton.createButton(renderer);

    await new Promise((r) => setTimeout(r, 10));

    expect(button.textContent).toBe('VR NOT SUPPORTED');
    expect(button.disabled).toBe(true);
  });

  it('requests an immersive-vr session on click', async () => {
    vi.stubGlobal(
      'XRWebGLLayer',
      class XRWebGLLayer {
        constructor(session, gl) {
          this.session = session;
          this.gl = gl;
        }
      }
    );

    const session = {
      mode: 'immersive-vr',
      renderState: { baseLayer: null },
      updateRenderState: vi.fn().mockResolvedValue(undefined),
      addEventListener: vi.fn(),
    };

    vi.stubGlobal('navigator', {
      xr: {
        isSessionSupported: vi.fn().mockResolvedValue(true),
        requestSession: vi.fn().mockResolvedValue(session),
      },
    });

    const renderer = makeMockRenderer();
    const button = NemosyneVRButton.createButton(renderer);
    button.click();

    await new Promise((r) => setTimeout(r, 10));

    expect(navigator.xr.requestSession).toHaveBeenCalledWith('immersive-vr', {
      requiredFeatures: ['local-floor'],
      optionalFeatures: ['hand-tracking'],
    });
    expect(renderer.xr.setSession).toHaveBeenCalledWith(session);
    expect(button.textContent).toBe('IN VR');
  });

  it('explains a stuck session and stays retryable after InvalidStateError', async () => {
    const requestSession = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error("Failed to execute 'requestSession' on 'XRSystem'"), {
          name: 'InvalidStateError',
        })
      )
      .mockResolvedValue({
        renderState: { baseLayer: null },
        updateRenderState: vi.fn().mockResolvedValue(undefined),
        addEventListener: vi.fn(),
      });
    vi.stubGlobal('navigator', {
      userAgent: 'OculusBrowser',
      xr: { isSessionSupported: vi.fn().mockResolvedValue(true), requestSession },
    });
    vi.stubGlobal(
      'XRWebGLLayer',
      class XRWebGLLayer {
        constructor(session, gl) {
          this.session = session;
          this.gl = gl;
        }
      }
    );

    const renderer = makeMockRenderer();
    const button = NemosyneVRButton.createButton(renderer);
    button.click();
    await new Promise((r) => setTimeout(r, 10));

    expect(button.textContent).toMatch('already active');
    expect(button.textContent).toMatch('tap to retry');
    button.click();
    await new Promise((r) => setTimeout(r, 10));
    expect(requestSession).toHaveBeenCalledTimes(2);
  });

  it('names Guardian/floor tracking after NotSupportedError and stays retryable', async () => {
    const requestSession = vi.fn().mockRejectedValue(
      Object.assign(new Error('The specified session configuration is not supported'), {
        name: 'NotSupportedError',
      })
    );
    vi.stubGlobal('navigator', {
      userAgent: 'OculusBrowser',
      xr: { isSessionSupported: vi.fn().mockResolvedValue(true), requestSession },
    });

    const renderer = makeMockRenderer();
    const button = NemosyneVRButton.createButton(renderer);
    button.click();
    await new Promise((r) => setTimeout(r, 10));

    expect(button.textContent).toMatch('Guardian');
    expect(button.textContent).toMatch('tap to retry');
    expect(button.disabled).toBe(false);
  });

  it('preserves the raw message for unknown errors and stays retryable', async () => {
    const requestSession = vi.fn().mockRejectedValue(new Error('mystery failure'));
    vi.stubGlobal('navigator', {
      userAgent: 'OculusBrowser',
      xr: { isSessionSupported: vi.fn().mockResolvedValue(true), requestSession },
    });

    const renderer = makeMockRenderer();
    const button = NemosyneVRButton.createButton(renderer);
    button.click();
    await new Promise((r) => setTimeout(r, 10));

    expect(button.textContent).toContain('mystery failure');
    expect(button.textContent).toMatch(/tap to retry/i);
  });

  it('shows an error when XRWebGLLayer is unavailable', async () => {
    vi.stubGlobal('XRWebGLLayer', undefined);

    const session = {
      updateRenderState: vi.fn().mockResolvedValue(undefined),
      addEventListener: vi.fn(),
    };

    vi.stubGlobal('navigator', {
      xr: {
        isSessionSupported: vi.fn().mockResolvedValue(true),
        requestSession: vi.fn().mockResolvedValue(session),
      },
    });

    const renderer = makeMockRenderer();
    const button = NemosyneVRButton.createButton(renderer);
    button.click();

    await new Promise((r) => setTimeout(r, 10));

    expect(button.textContent).toContain('VR SETUP ERROR');
  });
});
