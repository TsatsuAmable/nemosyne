// @ts-nocheck
/**
 * Vitest setup: mock WebGL context so three.js WebGLRenderer can be
 * instantiated in jsdom without the native `canvas` npm package,
 * and ensure a functional in-memory localStorage mock for Node 22+.
 */

const createLocalStorageMock = () => {
  const store = new Map();
  return {
    getItem: (key) => store.get(String(key)) ?? null,
    setItem: (key, val) => store.set(String(key), String(val)),
    removeItem: (key) => store.delete(String(key)),
    clear: () => store.clear(),
    get length() {
      return store.size;
    },
    key: (i) => Array.from(store.keys())[i] ?? null,
  };
};

if (typeof globalThis.localStorage === 'undefined' || typeof globalThis.localStorage?.clear !== 'function') {
  const localStorageMock = createLocalStorageMock();
  Object.defineProperty(globalThis, 'localStorage', {
    value: localStorageMock,
    writable: true,
    configurable: true,
  });
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
      configurable: true,
    });
  }
}

function makeWebGLContext(canvas) {
  const noOp = () => {};

  const params = {
    0x1f00: 'WebGL Mock Renderer', // VENDOR
    0x1f01: 'Mock GPU', // RENDERER
    0x1f02: 'WebGL 2.0 (OpenGL ES 3.0)', // VERSION
    0x9245: 'Mock Extensions Inc', // UNMASKED_VENDOR_WEBGL
    0x9246: 'Mock GPU 9000', // UNMASKED_RENDERER_WEBGL
    0x0d33: 4096, // MAX_TEXTURE_SIZE
    0x8c4b: 16, // MAX_VERTEX_TEXTURE_IMAGE_UNITS
    0x8b49: 16, // MAX_FRAGMENT_UNIFORM_VECTORS
    0x8872: 8, // MAX_TEXTURE_IMAGE_UNITS
    0x8869: 16, // MAX_VERTEX_ATTRIBS
    0x8dfb: 16, // MAX_VERTEX_UNIFORM_VECTORS
    0x8b4c: 1024, // MAX_VARYING_VECTORS
    0x8871: 16, // MAX_COMBINED_TEXTURE_IMAGE_UNITS
    0x8f41: 2048, // MAX_RENDERBUFFER_SIZE
  };

  const ctx = {
    getExtension: () => null,
    getSupportedExtensions: () => [],
    getParameter: (p) => params[p] ?? 0,

    createShader: () => ({ __type: 'shader' }),
    createProgram: () => ({ __type: 'program' }),
    shaderSource: noOp,
    compileShader: noOp,
    attachShader: noOp,
    linkProgram: noOp,
    useProgram: noOp,
    getProgramParameter: () => true,
    getShaderParameter: () => true,
    getShaderInfoLog: () => '',
    getProgramInfoLog: () => '',
    getActiveUniform: () => ({ name: 'u_mock', size: 1, type: 0x1406 }),
    getActiveAttrib: () => ({ name: 'a_mock', size: 1, type: 0x1406 }),
    deleteShader: noOp,
    deleteProgram: noOp,
    getAttribLocation: () => 0,
    getUniformLocation: () => ({ __type: 'uniform' }),
    enableVertexAttribArray: noOp,
    disableVertexAttribArray: noOp,
    vertexAttribPointer: noOp,

    createBuffer: () => ({ __type: 'buffer' }),
    bindBuffer: noOp,
    bufferData: noOp,
    deleteBuffer: noOp,

    createTexture: () => ({ __type: 'texture' }),
    bindTexture: noOp,
    texImage2D: noOp,
    texImage3D: noOp,
    texParameteri: noOp,
    activeTexture: noOp,
    deleteTexture: noOp,

    createFramebuffer: () => ({ __type: 'framebuffer' }),
    bindFramebuffer: noOp,
    framebufferTexture2D: noOp,
    deleteFramebuffer: noOp,

    createRenderbuffer: () => ({ __type: 'renderbuffer' }),
    bindRenderbuffer: noOp,
    renderbufferStorage: noOp,
    framebufferRenderbuffer: noOp,
    deleteRenderbuffer: noOp,

    enable: noOp,
    disable: noOp,
    blendFunc: noOp,
    blendFuncSeparate: noOp,
    blendEquation: noOp,
    depthFunc: noOp,
    depthMask: noOp,
    depthRange: noOp,
    clearDepth: noOp,
    clearColor: noOp,
    colorMask: noOp,
    viewport: noOp,
    scissor: noOp,
    clear: noOp,
    clearStencil: noOp,
    stencilFunc: noOp,
    stencilFuncSeparate: noOp,
    stencilOp: noOp,
    stencilOpSeparate: noOp,
    stencilMask: noOp,
    drawArrays: noOp,
    drawElements: noOp,
    lineWidth: noOp,
    cullFace: noOp,
    frontFace: noOp,
    polygonOffset: noOp,
    sampleCoverage: noOp,
    getError: () => 0,
    hint: noOp,
    finish: noOp,
    flush: noOp,
    readPixels: noOp,

    uniformMatrix4fv: noOp,
    uniformMatrix3fv: noOp,
    uniformMatrix2fv: noOp,
    uniform4fv: noOp,
    uniform3fv: noOp,
    uniform2fv: noOp,
    uniform1f: noOp,
    uniform1i: noOp,
    uniform4iv: noOp,
    uniform3iv: noOp,
    uniform2iv: noOp,

    makeXRCompatible: () => Promise.resolve(undefined),
    getShaderPrecisionFormat: () => ({ precision: 1, rangeMin: 1, rangeMax: 1 }),
    getContextAttributes: () => ({ alpha: false, antialias: true, preserveDrawingBuffer: false }),
    isContextLost: () => false,
    canvas: canvas ?? null,
  };

  // Attach the numeric constants three.js reads directly from the context.
  const constants = {
    VERSION: 0x1f02,
    VENDOR: 0x1f00,
    RENDERER: 0x1f01,
    UNMASKED_VENDOR_WEBGL: 0x9245,
    UNMASKED_RENDERER_WEBGL: 0x9246,
    MAX_TEXTURE_SIZE: 0x0d33,
    MAX_VERTEX_TEXTURE_IMAGE_UNITS: 0x8c4b,
    MAX_FRAGMENT_UNIFORM_VECTORS: 0x8b49,
    MAX_TEXTURE_IMAGE_UNITS: 0x8872,
    MAX_VERTEX_ATTRIBS: 0x8869,
    MAX_VERTEX_UNIFORM_VECTORS: 0x8dfb,
    TEXTURE_2D: 0x0de1,
    TEXTURE0: 0x84c0,
    ARRAY_BUFFER: 0x8892,
    ELEMENT_ARRAY_BUFFER: 0x8893,
    FLOAT: 0x1406,
    UNSIGNED_SHORT: 0x1403,
    UNSIGNED_BYTE: 0x1401,
    TRIANGLES: 0x0004,
    LINES: 0x0001,
    LINE_STRIP: 0x0003,
    DEPTH_TEST: 0x0b71,
    BLEND: 0x0be2,
    CULL_FACE: 0x0b44,
    SCISSOR_TEST: 0x0c11,
    SRC_ALPHA: 0x0302,
    ONE_MINUS_SRC_ALPHA: 0x0303,
    FRONT: 0x0404,
    BACK: 0x0405,
    FRONT_AND_BACK: 0x0408,
    CW: 0x0900,
    CCW: 0x0901,
    COLOR_BUFFER_BIT: 0x00004000,
    DEPTH_BUFFER_BIT: 0x00000100,
    STENCIL_BUFFER_BIT: 0x00000400,
    RGBA: 0x1908,
    RGB: 0x1907,
    STATIC_DRAW: 0x88e4,
    DYNAMIC_DRAW: 0x88e8,
    STREAM_DRAW: 0x88e0,
    UNPACK_FLIP_Y_WEBGL: 0x9240,
    UNPACK_PREMULTIPLY_ALPHA_WEBGL: 0x9241,
    FRAGMENT_SHADER: 0x8b30,
    VERTEX_SHADER: 0x8b31,
    COMPILE_STATUS: 0x8b81,
    LINK_STATUS: 0x8b82,
    MAX_VARYING_VECTORS: 0x8b4c,
    MAX_COMBINED_TEXTURE_IMAGE_UNITS: 0x8871,
    MAX_RENDERBUFFER_SIZE: 0x8f41,
  };
  Object.assign(ctx, constants);

  return ctx;
}

// jsdom defines getContext on the prototype and warns about unimplemented
// contexts. We replace it wholesale so three.js and our canvas UI can work.
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value(type, ..._rest) {
    if (type === 'webgl' || type === 'experimental-webgl' || type === 'webgl2') {
      return makeWebGLContext(this);
    }
    if (type === '2d') {
      const noOp = () => {};
      /* eslint-disable-next-line @typescript-eslint/no-this-alias */
      const canvas = this;
      const ctx = {
        clearRect: noOp,
        fillRect: noOp,
        strokeRect: noOp,
        beginPath: noOp,
        closePath: noOp,
        moveTo: noOp,
        lineTo: noOp,
        arc: noOp,
        rect: noOp,
        stroke: noOp,
        fill: noOp,
        fillText: noOp,
        measureText: () => ({ width: 0 }),
        getImageData: () => ({ data: new Uint8ClampedArray(0) }),
        putImageData: noOp,
        drawImage: noOp,
        createLinearGradient: () => ({ addColorStop: noOp }),
        createRadialGradient: () => ({ addColorStop: noOp }),
        save: noOp,
        restore: noOp,
        translate: noOp,
        rotate: noOp,
        set fillStyle(_) {},
        set strokeStyle(_) {},
        set lineWidth(_) {},
        set font(_) {},
        set textAlign(_) {},
        set textBaseline(_) {},
        set shadowColor(_) {},
        set shadowBlur(_) {},
      };
      // Track texture update requests for tests that assert redraws.
      ctx.__markNeedsUpdate = () => {
        if (canvas.__texture) canvas.__texture.needsUpdate = true;
      };
      return ctx;
    }
    return null;
  },
  configurable: true,
  writable: true,
});
