import { describe, it, expect, afterEach, vi } from 'vitest';
import { NemosyneVRButton } from '../src/vr/VRButton.ts';

/**
 * Minimal mock WebGL context.
 */
function makeMockGL() {
  return {
    makeXRCompatible: vi.fn().mockResolvedValue(undefined),
    getExtension: vi.fn(),
    getParameter: vi.fn(),
    createShader: vi.fn(() => ({})),
    createProgram: vi.fn(() => ({})),
    useProgram: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    blendFunc: vi.fn(),
    clear: vi.fn(),
    clearColor: vi.fn(),
    viewport: vi.fn(),
    drawArrays: vi.fn(),
    drawElements: vi.fn(),
    bindFramebuffer: vi.fn(),
    createFramebuffer: vi.fn(() => ({})),
    createTexture: vi.fn(() => ({})),
    bindTexture: vi.fn(),
    texImage2D: vi.fn(),
    texParameteri: vi.fn(),
    activeTexture: vi.fn(),
    uniformMatrix4fv: vi.fn(),
    uniform1i: vi.fn(),
    getAttribLocation: vi.fn(() => 0),
    getUniformLocation: vi.fn(() => ({})),
    vertexAttribPointer: vi.fn(),
    enableVertexAttribArray: vi.fn(),
    createBuffer: vi.fn(() => ({})),
    bindBuffer: vi.fn(),
    bufferData: vi.fn(),
    getShaderPrecisionFormat: vi.fn(() => ({ precision: 1 })),
    canvas: document.createElement('canvas'),
  };
}

function makeMockSession({ mode = 'immersive-vr' } = {}) {
  let renderState = { baseLayer: null, layers: [] };
  const listeners = {};
  const session = {
    mode,
    renderState,
    inputSources: [],
    addEventListener(name, fn) {
      listeners[name] = listeners[name] || [];
      listeners[name].push(fn);
    },
    removeEventListener() {},
    dispatchEvent(event) {
      (listeners[event.type] || []).forEach((fn) => fn(event));
    },
    updateRenderState: vi.fn(async (state) => {
      renderState = { ...renderState, ...state };
      session.renderState = renderState;
    }),
    end: vi.fn().mockResolvedValue(undefined),
    requestAnimationFrame: vi.fn(),
  };
  return session;
}

class MockXRWebGLLayer {
  constructor(session, gl) {
    this.session = session;
    this.gl = gl;
    this.framebuffer = {};
    this.framebufferWidth = 1;
    this.framebufferHeight = 1;
    this.getViewport = vi.fn(() => ({ x: 0, y: 0, width: 1, height: 1 }));
  }
}

function stubXR({ supported = true } = {}) {
  const sessions = [];
  const xr = {
    isSessionSupported: vi.fn().mockResolvedValue(supported),
    requestSession: vi.fn().mockImplementation(async (mode, init) => {
      const session = makeMockSession({ mode });
      sessions.push(session);
      return session;
    }),
  };

  vi.stubGlobal('XRWebGLLayer', MockXRWebGLLayer);
  vi.stubGlobal('navigator', { ...globalThis.navigator, xr });

  return { xr, sessions };
}

function restoreXR() {
  vi.unstubAllGlobals();
}

describe('NemosyneVRButton', () => {
  function makeMockRenderer() {
    return {
      xr: {
        isPresenting: false,
        setSession: vi.fn().mockResolvedValue(undefined),
      },
      getContext: vi.fn().mockReturnValue(makeMockGL()),
    };
  }

  afterEach(() => {
    restoreXR();
  });

  it('disables the button when XR is not supported', async () => {
    stubXR({ supported: false });
    const renderer = makeMockRenderer();
    const btn = NemosyneVRButton.createButton(renderer);
    await new Promise((r) => setTimeout(r, 0));
    expect(btn.textContent).toBe('VR NOT SUPPORTED');
    expect(btn.disabled).toBe(true);
  });

  it('creates the XR layer, makes context compatible, and binds three.js session', async () => {
    const { sessions } = stubXR();
    const renderer = makeMockRenderer();
    const btn = NemosyneVRButton.createButton(renderer);
    expect(btn.textContent).toBe('ENTER VR');

    btn.click();
    await new Promise((r) => setTimeout(r, 0));

    expect(sessions.length).toBe(1);
    const session = sessions[0];
    expect(session.updateRenderState).toHaveBeenCalled();
    expect(session.renderState.baseLayer).toBeInstanceOf(MockXRWebGLLayer);
    expect(renderer.xr.setSession).toHaveBeenCalledWith(session);
    expect(btn.textContent).toBe('IN VR');
  });

  it('survives when XRWebGLLayer is not defined', async () => {
    stubXR();
    vi.stubGlobal('XRWebGLLayer', undefined);

    const renderer = makeMockRenderer();
    const btn = NemosyneVRButton.createButton(renderer);
    btn.click();
    await new Promise((r) => setTimeout(r, 0));

    expect(btn.textContent).toMatch(/XRWebGLLayer/);
    expect(renderer.xr.setSession).not.toHaveBeenCalled();
  });
});
