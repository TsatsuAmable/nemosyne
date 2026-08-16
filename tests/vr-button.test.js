// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
  let originalNavigator;

  beforeEach(() => {
    originalNavigator = globalThis.navigator;
  });

  afterEach(() => {
    globalThis.navigator = originalNavigator;
    const button = document.getElementById('nemosyne-vr-button');
    if (button?.parentNode) button.parentNode.removeChild(button);
    vi.restoreAllMocks();
  });

  it('creates a disabled button when XR is unsupported', () => {
    globalThis.navigator = {};
    const renderer = makeMockRenderer();
    const button = NemosyneVRButton.createButton(renderer);

    expect(button.textContent).toBe('VR NOT SUPPORTED');
    expect(button.disabled).toBe(true);
  });

  it('creates an enabled ENTER VR button when XR is supported', () => {
    globalThis.navigator = {
      xr: {
        isSessionSupported: vi.fn().mockResolvedValue(true),
      },
    };
    const renderer = makeMockRenderer();
    const button = NemosyneVRButton.createButton(renderer);

    expect(button.textContent).toBe('ENTER VR');
    expect(button.disabled).toBe(false);
  });

  it('disables the button if the session is not supported', async () => {
    globalThis.navigator = {
      xr: {
        isSessionSupported: vi.fn().mockResolvedValue(false),
      },
    };
    const renderer = makeMockRenderer();
    const button = NemosyneVRButton.createButton(renderer);

    await new Promise((r) => setTimeout(r, 10));

    expect(button.textContent).toBe('VR NOT SUPPORTED');
    expect(button.disabled).toBe(true);
  });

  it('requests an immersive-vr session on click', async () => {
    globalThis.XRWebGLLayer = class XRWebGLLayer {
      constructor(session, gl) {
        this.session = session;
        this.gl = gl;
      }
    };

    const session = {
      mode: 'immersive-vr',
      renderState: { baseLayer: null },
      updateRenderState: vi.fn().mockResolvedValue(undefined),
      addEventListener: vi.fn(),
    };

    globalThis.navigator = {
      xr: {
        isSessionSupported: vi.fn().mockResolvedValue(true),
        requestSession: vi.fn().mockResolvedValue(session),
      },
    };

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

    delete globalThis.XRWebGLLayer;
  });

  it('shows an error when XRWebGLLayer is unavailable', async () => {
    delete globalThis.XRWebGLLayer;

    const session = {
      updateRenderState: vi.fn().mockResolvedValue(undefined),
      addEventListener: vi.fn(),
    };

    globalThis.navigator = {
      xr: {
        isSessionSupported: vi.fn().mockResolvedValue(true),
        requestSession: vi.fn().mockResolvedValue(session),
      },
    };

    const renderer = makeMockRenderer();
    const button = NemosyneVRButton.createButton(renderer);
    button.click();

    await new Promise((r) => setTimeout(r, 10));

    expect(button.textContent).toContain('VR SETUP ERROR');
  });
});
