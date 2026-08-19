/**
 * VR Resilience and Error Recovery subsystem.
 */

export { WebGLContextRecovery, type ContextRecoveryDelegate, type ContextState } from './WebGLContextRecovery.ts';
export { DiegeticErrorBoundary, type DiegeticErrorOptions } from './DiegeticErrorBoundary.ts';
export { GPUResourceDisposal, type DisposalStats } from './GPUResourceDisposal.ts';
