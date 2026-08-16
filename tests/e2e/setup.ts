/**
 * Global E2E Test Suite Setup & Harness Installer.
 * Installs WebGL mocks, WebXR mocks, and unhandled promise rejection traps.
 */

import { installWebGLMock, resetWebGLMockStats } from './harness/webgl_mock.js';
import { installWebXRMock, MockXRSession } from './harness/webxr_session_mock.js';

let globalWebXRSession: MockXRSession | null = null;
let unhandledRejections: Error[] = [];

export function getUnhandledRejections(): Error[] {
  return unhandledRejections;
}

export function clearUnhandledRejections(): void {
  unhandledRejections = [];
}

export function setupE2EEnvironment(): { session: MockXRSession } {
  resetWebGLMockStats();
  installWebGLMock();
  globalWebXRSession = installWebXRMock();
  clearUnhandledRejections();

  if (typeof process !== 'undefined') {
    process.on('unhandledRejection', (reason: any) => {
      const err = reason instanceof Error ? reason : new Error(String(reason));
      unhandledRejections.push(err);
    });
  }

  return { session: globalWebXRSession };
}

// Auto-run environment setup when setup.ts is loaded
setupE2EEnvironment();
