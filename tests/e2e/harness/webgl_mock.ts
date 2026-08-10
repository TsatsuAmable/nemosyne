/**
 * WebGL 1.0 / 2.0 Mock Harness for Headless E2E Testing with Three.js.
 * Tracks buffer, texture, shader, and framebuffer allocations for leak verification.
 */

export interface WebGLMockStats {
  createdBuffers: number;
  deletedBuffers: number;
  createdTextures: number;
  deletedTextures: number;
  createdShaders: number;
  deletedShaders: number;
  createdPrograms: number;
  deletedPrograms: number;
  createdFramebuffers: number;
  deletedFramebuffers: number;
  activeBuffers: number;
  activeTextures: number;
}

let stats: WebGLMockStats = {
  createdBuffers: 0,
  deletedBuffers: 0,
  createdTextures: 0,
  deletedTextures: 0,
  createdShaders: 0,
  deletedShaders: 0,
  createdPrograms: 0,
  deletedPrograms: 0,
  createdFramebuffers: 0,
  deletedFramebuffers: 0,
  get activeBuffers() {
    return this.createdBuffers - this.deletedBuffers;
  },
  get activeTextures() {
    return this.createdTextures - this.deletedTextures;
  },
};

export function getWebGLMockStats(): WebGLMockStats {
  return stats;
}

export function resetWebGLMockStats(): void {
  stats.createdBuffers = 0;
  stats.deletedBuffers = 0;
  stats.createdTextures = 0;
  stats.deletedTextures = 0;
  stats.createdShaders = 0;
  stats.deletedShaders = 0;
  stats.createdPrograms = 0;
  stats.deletedPrograms = 0;
  stats.createdFramebuffers = 0;
  stats.deletedFramebuffers = 0;
}

export function makeExtendedWebGLContext(canvas?: HTMLCanvasElement): any {
  const noOp = () => {};

  const params: Record<number, any> = {
    0x1f00: 'WebGL Mock Renderer (E2E)', // VENDOR
    0x1f01: 'Mock GPU (E2E)', // RENDERER
    0x1f02: 'WebGL 2.0 (OpenGL ES 3.0 Mock)', // VERSION
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

  const ctx: any = {
    canvas: canvas || null,
    getExtension: (name: string) => {
      if (name === 'ANGLE_instanced_arrays') {
        return {
          drawArraysInstancedANGLE: noOp,
          drawElementsInstancedANGLE: noOp,
          vertexAttribDivisorANGLE: noOp,
          VERTEX_ATTRIB_ARRAY_DIVISOR_ANGLE: 0x88fe,
        };
      }
      if (name === 'OES_texture_float' || name === 'OES_texture_float_linear' || name === 'EXT_color_buffer_float') {
        return {};
      }
      return null;
    },
    getSupportedExtensions: () => ['ANGLE_instanced_arrays', 'OES_texture_float', 'OES_texture_float_linear', 'EXT_color_buffer_float'],
    getParameter: (p: number) => params[p] ?? 0,

    createShader: () => {
      stats.createdShaders++;
      return { __type: 'shader', id: stats.createdShaders };
    },
    createProgram: () => {
      stats.createdPrograms++;
      return { __type: 'program', id: stats.createdPrograms };
    },
    shaderSource: noOp,
    compileShader: noOp,
    attachShader: noOp,
    linkProgram: noOp,
    useProgram: noOp,
    getProgramParameter: () => true,
    getShaderParameter: () => true,
    getShaderInfoLog: () => '',
    getProgramInfoLog: () => '',
    deleteShader: (shader: any) => {
      if (shader) stats.deletedShaders++;
    },
    deleteProgram: (program: any) => {
      if (program) stats.deletedPrograms++;
    },
    getAttribLocation: () => 0,
    getUniformLocation: (prog: any, name: string) => ({ __type: 'uniform', name }),
    enableVertexAttribArray: noOp,
    disableVertexAttribArray: noOp,
    vertexAttribPointer: noOp,
    vertexAttribIPointer: noOp,
    vertexAttribDivisor: noOp,

    createBuffer: () => {
      stats.createdBuffers++;
      return { __type: 'buffer', id: stats.createdBuffers };
    },
    bindBuffer: noOp,
    bufferData: noOp,
    bufferSubData: noOp,
    deleteBuffer: (buf: any) => {
      if (buf) stats.deletedBuffers++;
    },

    createTexture: () => {
      stats.createdTextures++;
      return { __type: 'texture', id: stats.createdTextures };
    },
    bindTexture: noOp,
    texImage2D: noOp,
    texImage3D: noOp,
    texSubImage2D: noOp,
    texParameteri: noOp,
    activeTexture: noOp,
    generateMipmap: noOp,
    deleteTexture: (tex: any) => {
      if (tex) stats.deletedTextures++;
    },

    createFramebuffer: () => {
      stats.createdFramebuffers++;
      return { __type: 'framebuffer', id: stats.createdFramebuffers };
    },
    bindFramebuffer: noOp,
    framebufferTexture2D: noOp,
    deleteFramebuffer: (fb: any) => {
      if (fb) stats.deletedFramebuffers++;
    },

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
    blendEquationSeparate: noOp,
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
    drawArraysInstanced: noOp,
    drawElementsInstanced: noOp,
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
    uniform1fv: noOp,
    uniform1iv: noOp,

    makeXRCompatible: () => Promise.resolve(undefined),
    getShaderPrecisionFormat: () => ({ precision: 23, rangeMin: 127, rangeMax: 127 }),
    getContextAttributes: () => ({ alpha: true, antialias: true, preserveDrawingBuffer: false, depth: true, stencil: true }),
    isContextLost: () => false,
  };

  const constants: Record<string, number> = {
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
    STATIC_DRAW: 0x88e4,
    DYNAMIC_DRAW: 0x88e8,
    STREAM_DRAW: 0x88e0,
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
    UNPACK_FLIP_Y_WEBGL: 0x9240,
    UNPACK_PREMULTIPLY_ALPHA_WEBGL: 0x9241,
    FRAGMENT_SHADER: 0x8b30,
    VERTEX_SHADER: 0x8b31,
    COMPILE_STATUS: 0x8b81,
    LINK_STATUS: 0x8b82,
  };

  Object.assign(ctx, constants);
  return ctx;
}

export function installWebGLMock(): void {
  if (typeof HTMLCanvasElement !== 'undefined') {
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      value: function (type: string) {
        if (type === 'webgl' || type === 'experimental-webgl' || type === 'webgl2') {
          return makeExtendedWebGLContext(this);
        }
        if (type === '2d') {
          const noOp = () => {};
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
            set fillStyle(_: any) {},
            set strokeStyle(_: any) {},
            set lineWidth(_: any) {},
            set font(_: any) {},
            set textAlign(_: any) {},
            set textBaseline(_: any) {},
            set shadowColor(_: any) {},
            set shadowBlur(_: any) {},
          };
          (ctx as any).__markNeedsUpdate = () => {
            if ((canvas as any).__texture) (canvas as any).__texture.needsUpdate = true;
          };
          return ctx;
        }
        return null;
      },
      configurable: true,
      writable: true,
    });
  }
}
