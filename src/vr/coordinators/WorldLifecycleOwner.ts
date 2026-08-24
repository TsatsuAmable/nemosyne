export type WorldBootState =
  | 'INITIALIZING'
  | 'READY'
  | 'KERNEL_UNAVAILABLE'
  | 'INCOMPATIBLE'
  | 'FATAL'
  | 'DISPOSING'
  | 'DISPOSED';

export interface WorldLifecycleDependencies {
  startEngine(): void;
  initializeKernel(generation: number): Promise<void>;
  onKernelUnavailable(error: unknown): void;
  onDisposing(): void;
  teardown(): Promise<void>;
}

export class WorldLifecycleOwner {
  state: WorldBootState = 'INITIALIZING';

  private readonly dependencies: WorldLifecycleDependencies;
  private engineStarted = false;
  private kernelPromise: Promise<void> | null = null;
  private disposePromise: Promise<void> | null = null;
  private disposed = false;
  private kernelGeneration = 0;

  constructor(dependencies: WorldLifecycleDependencies) {
    this.dependencies = dependencies;
  }

  get isDisposed(): boolean {
    return this.disposed;
  }

  start(): Promise<void> {
    if (this.disposed) {
      return Promise.reject(new Error('Cannot start a disposed World lifecycle'));
    }
    if (!this.engineStarted) {
      try {
        this.dependencies.startEngine();
        this.engineStarted = true;
      } catch (error) {
        this.state = 'FATAL';
        return Promise.reject(error);
      }
    }
    if (this.state === 'READY') return Promise.resolve();
    return this.initializeKernel();
  }

  recoverKernel(): Promise<void> {
    if (!this.engineStarted) return this.start();
    if (this.state !== 'KERNEL_UNAVAILABLE') return this.start();
    return this.initializeKernel();
  }

  markKernelUnavailable(error: unknown): void {
    if (this.disposed) return;
    this.kernelGeneration += 1;
    this.kernelPromise = null;
    this.state = 'KERNEL_UNAVAILABLE';
    this.dependencies.onKernelUnavailable(error);
  }

  isCurrentKernelAttempt(generation: number): boolean {
    return !this.disposed && generation === this.kernelGeneration;
  }

  dispose(): Promise<void> {
    if (this.disposePromise) return this.disposePromise;
    this.disposed = true;
    this.kernelGeneration += 1;
    this.kernelPromise = null;
    this.state = 'DISPOSING';
    this.dependencies.onDisposing();
    this.disposePromise = (async () => {
      try {
        await this.dependencies.teardown();
      } finally {
        this.state = 'DISPOSED';
      }
    })();
    return this.disposePromise;
  }

  private initializeKernel(): Promise<void> {
    if (this.kernelPromise) return this.kernelPromise;
    this.state = 'INITIALIZING';
    const generation = ++this.kernelGeneration;
    const attempt = this.dependencies
      .initializeKernel(generation)
      .then(() => {
        if (this.isCurrentKernelAttempt(generation)) this.state = 'READY';
      })
      .catch((error) => {
        if (this.isCurrentKernelAttempt(generation)) this.markKernelUnavailable(error);
      })
      .finally(() => {
        if (this.kernelPromise === attempt) this.kernelPromise = null;
      });
    this.kernelPromise = attempt;
    return attempt;
  }
}
