import { describe, it, expect } from 'vitest';
import { TypedEventBus } from '../src/utils/TypedEventBus.ts';

interface TestSubsystemEvents {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: (...args: any[]) => void;
  'data:loaded': (datasetName: string, rowCount: number) => void;
  'analysis:executed': (operation: string, executionMs: number) => void;
}

describe('Typed Event Bus (nanoevents)', () => {
  it('dispatches typed events to registered listeners and unsubscribes cleanly', () => {
    const bus = new TypedEventBus<TestSubsystemEvents>();

    let receivedDataset = '';
    let receivedRows = 0;

    const unsubscribe = bus.on('data:loaded', (name, count) => {
      receivedDataset = name;
      receivedRows = count;
    });

    bus.emit('data:loaded', 'synthetic_sales', 500);

    expect(receivedDataset).toBe('synthetic_sales');
    expect(receivedRows).toBe(500);

    // Unsubscribe
    unsubscribe();
    bus.emit('data:loaded', 'new_dataset', 1000);

    // Values remain unchanged
    expect(receivedDataset).toBe('synthetic_sales');
    expect(receivedRows).toBe(500);
  });
});
