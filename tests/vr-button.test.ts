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

  it('ends the active immersive session when clicked again', async () => {
    vi.stubGlobal(
      'XRWebGLLayer',
      class XRWebGLLayer {
        constructor(session, gl) {
          this.session = session;
          this.gl = gl;
        }
      }
    );

    let endListener: (() => void) | null = null;
    const session = {
      mode: 'immersive-vr',
      renderState: { baseLayer: null },
      updateRenderState: vi.fn().mockResolvedValue(undefined),
      addEventListener: vi.fn((type, listener) => {
        if (type === 'end') endListener = listener;
      }),
      end: vi.fn().mockImplementation(async () => endListener?.()),
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
    expect(button.textContent).toBe('IN VR');

    button.click();
    await new Promise((r) => setTimeout(r, 10));

    expect(session.end).toHaveBeenCalledTimes(1);
    expect(button.textContent).toBe('ENTER VR');
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
