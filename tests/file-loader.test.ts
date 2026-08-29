// @ts-nocheck
// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FileLoaderUI } from '../src/ui/FileLoader.ts';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.ts';

const CSV_CONTENT = `value,category
10,A
20,B
30,A`;

const JSON_CONTENT = JSON.stringify([
  { value: 10, category: 'A' },
  { value: 20, category: 'B' },
]);

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('FileLoaderUI', () => {
  let onLoad: any;
  let loader: FileLoaderUI;

  beforeEach(() => {
    onLoad = vi.fn();
    // Wave 6: the analytical kernel is the only parse/topology/encoding path,
    // reached through AtlasCore (the single production kernel caller). Wire a
    // mock-kernel-backed AtlasCore so the loader runs in plain jsdom; parse
    // parity is covered by Rust tests + wasm-runtime.test.ts.
    loader = new FileLoaderUI({ onLoad, atlas: new AtlasCore({ kernel: makeKernelMockBridge() }) });
  });

  afterEach(() => {
    loader.dispose();
    vi.restoreAllMocks();
  });

  it('creates a container in the document body', () => {
    expect(loader.container).toBeTruthy();
    expect(loader.container.parentNode).toBe(document.body);
    expect(loader.container.id).toBe('nemosyne-loader');
  });

  it('emits a sample dataset when a sample is selected', () => {
    const select = loader.container.querySelector('select')!;
    select.value = 'supply-chain';
    select.dispatchEvent(new Event('change'));

    expect(onLoad).toHaveBeenCalled();
    const entry = onLoad.mock.calls[0][0];
    expect(entry.name).toBe('Supply Chain Hierarchy');
    expect(entry.topology).toBe('HIERARCHY');
    expect(entry.dataset).toBeTruthy();
  });

  it('loads a CSV file and emits it', async () => {
    const file = new File([CSV_CONTENT], 'data.csv', { type: 'text/csv' });
    const input = loader.container.querySelector('input[type="file"]')!;

    // Simulate file selection.
    Object.defineProperty(input, 'files', {
      value: [file],
      writable: false,
    });
    input.dispatchEvent(new Event('change'));

    await new Promise((r) => setTimeout(r, 20));

    expect(onLoad).toHaveBeenCalled();
    const entry = onLoad.mock.calls[0][0];
    expect(entry.name).toBe('data.csv');
    expect(entry.dataset.rowCount).toBe(3);
    expect(entry.topology).toBe('TABULAR');
  });

  it('loads a JSON file and emits it', async () => {
    const file = new File([JSON_CONTENT], 'data.json', { type: 'application/json' });
    const input = loader.container.querySelector('input[type="file"]')!;

    Object.defineProperty(input, 'files', {
      value: [file],
      writable: false,
    });
    input.dispatchEvent(new Event('change'));

    await new Promise((r) => setTimeout(r, 20));

    expect(onLoad).toHaveBeenCalled();
    const entry = onLoad.mock.calls[0][0];
    expect(entry.name).toBe('data.json');
    expect(entry.dataset.rowCount).toBe(2);
  });

  it('invalidates a deferred file read before disposal can emit or parse', async () => {
    const text = deferred<string>();
    const parseBytes = vi.spyOn(loader.atlas!, 'parseBytes');
    const file = {
      name: 'late.csv',
      size: CSV_CONTENT.length,
      text: vi.fn(() => text.promise),
    } as File;

    const pending = loader._handleFile(file);
    loader.dispose();
    loader.dispose();
    text.resolve(CSV_CONTENT);
    await pending;

    expect(parseBytes).not.toHaveBeenCalled();
    expect(onLoad).not.toHaveBeenCalled();
    expect(loader.container.isConnected).toBe(false);
  });

  it('auto-detects topology from CSV schema', async () => {
    const file = new File(
      ['time,value\n2026-07-28T00:00:00,10\n2026-07-28T01:00:00,20'],
      'series.csv',
      { type: 'text/csv' }
    );
    const input = loader.container.querySelector('input[type="file"]')!;

    Object.defineProperty(input, 'files', { value: [file], writable: false });
    input.dispatchEvent(new Event('change'));

    await new Promise((r) => setTimeout(r, 20));

    expect(onLoad).toHaveBeenCalled();
    const entry = onLoad.mock.calls[0][0];
    expect(entry.topology).toBe('TIME_SERIES');
  });

  it('shows an error status for empty CSV files', async () => {
    const file = new File(['name\n'], 'empty.csv', { type: 'text/csv' });
    const input = loader.container.querySelector('input[type="file"]')!;

    Object.defineProperty(input, 'files', { value: [file], writable: false });
    input.dispatchEvent(new Event('change'));

    await new Promise((r) => setTimeout(r, 20));

    expect(onLoad).not.toHaveBeenCalled();
    const statusEl = loader.container.querySelector('#loader-status')!;
    expect(statusEl.textContent).toContain('Error:');
  });

  it('rejects malicious file names (path traversal / null byte) at the real import boundary', async () => {
    const malicious = new File([CSV_CONTENT], '../../etc/passwd\0.csv', { type: 'text/csv' });
    const input = loader.container.querySelector('input[type="file"]')!;

    Object.defineProperty(input, 'files', { value: [malicious], writable: false });
    input.dispatchEvent(new Event('change'));

    await new Promise((r) => setTimeout(r, 20));

    // The malicious name is rejected fail-closed before any content is read,
    // so no dataset ever reaches the consumer with the traversal label.
    expect(onLoad).not.toHaveBeenCalled();
    const statusEl = loader.container.querySelector('#loader-status')!;
    expect(statusEl.textContent).toContain('File name rejected');
  });

  it('rejects file names with control characters or excessive length before parsing', async () => {
    const cases = ['evil\x01.csv', 'x'.repeat(200) + '.csv', '..\\..\\win\\evil.csv'];
    for (const name of cases) {
      const file = new File([CSV_CONTENT], name, { type: 'text/csv' });
      const input = loader.container.querySelector('input[type="file"]')!;

      Object.defineProperty(input, 'files', { value: [file], writable: false, configurable: true });
      input.dispatchEvent(new Event('change'));

      await new Promise((r) => setTimeout(r, 20));
      expect(onLoad).not.toHaveBeenCalled();
    }

    const statusEl = loader.container.querySelector('#loader-status')!;
    expect(statusEl.textContent).toContain('File name rejected');
  });

  it('renders a schema preview after loading', async () => {
    const file = new File(['category,value\nA,10\nB,20'], 'data.csv', { type: 'text/csv' });
    const input = loader.container.querySelector('input[type="file"]')!;

    Object.defineProperty(input, 'files', { value: [file], writable: false });
    input.dispatchEvent(new Event('change'));

    await new Promise((r) => setTimeout(r, 20));

    const schemaEl = loader.container.querySelector('#loader-schema') as HTMLElement;
    expect(schemaEl.style.display).toBe('block');
    expect(schemaEl.innerHTML).toContain('category');
    expect(schemaEl.innerHTML).toContain('value');
    expect(schemaEl.innerHTML).toContain('TABULAR');
  });

  it('shows and hides the container', () => {
    loader.hide();
    expect(loader.container.style.display).toBe('none');

    loader.show();
    expect(loader.container.style.display).toBe('block');
  });

  it('displays a status message', () => {
    loader._status('hello test');
    const statusEl = loader.container.querySelector('#loader-status')!;
    expect(statusEl.textContent).toBe('hello test');
  });
});
