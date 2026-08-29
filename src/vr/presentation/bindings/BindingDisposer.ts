export type BindingDisposer = () => void;

/**
 * Compose listener disposers into one idempotent resource boundary.
 *
 * Bindings use this rather than reaching into the event bus so disposing one
 * projection cannot remove listeners owned by another subsystem.
 */
export function combineBindingDisposers(disposers: BindingDisposer[]): BindingDisposer {
  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    const failures: unknown[] = [];
    for (const dispose of disposers) {
      try {
        dispose();
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length > 0) {
      throw new AggregateError(failures, 'Projection binding disposal failed');
    }
  };
}
