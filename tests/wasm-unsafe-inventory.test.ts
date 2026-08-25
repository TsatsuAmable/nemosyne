import { readFileSync, readdirSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();
const wasmSourceRoot = resolve(repoRoot, 'wasm/src');

function rustFiles(directory: string): string[] {
  return readdirSync(directory)
    .flatMap((entry) => {
      const path = resolve(directory, entry);
      return statSync(path).isDirectory() ? rustFiles(path) : path.endsWith('.rs') ? [path] : [];
    })
    .sort();
}

function repoPath(path: string): string {
  return relative(repoRoot, path).replaceAll('\\', '/');
}

const sources = rustFiles(wasmSourceRoot).map((path) => ({
  path: repoPath(path),
  source: readFileSync(path, 'utf8'),
}));

const expectedUnsafeFiles = [
  'wasm/src/data/compatibility.rs',
  'wasm/src/data/load_profile.rs',
  'wasm/src/data/typed_ingest.rs',
  'wasm/src/layouts/authority_abi.rs',
  'wasm/src/lib.rs',
] as const;

describe('Rust/WASM unsafe inventory', () => {
  it('keeps the unsafe source set explicit and non-expanding', () => {
    const actualUnsafeFiles = sources
      .filter(({ source }) => /\bunsafe\s*(?:fn|\{)/.test(source))
      .map(({ path }) => path);

    expect(actualUnsafeFiles).toEqual([...expectedUnsafeFiles]);
  });

  it('keeps host-facing raw ranges on fallible tracked ownership checks', () => {
    for (const { path, source } of sources) {
      if (path === 'wasm/src/lib.rs') continue;
      expect(source, path).not.toMatch(/allocator::view\s*\(/);
      expect(source, path).not.toMatch(/allocator::view_mut\s*\(/);
    }
  });

  it('does not reconstruct caller-controlled global allocator metadata', () => {
    const joined = sources.map(({ source }) => source).join('\n');
    expect(joined).not.toMatch(/std::alloc::[^;\n]*\bdealloc\b/);
    expect(joined).not.toMatch(/\bdealloc\s*\([^)]*Layout/);
    expect(joined).not.toMatch(/\balloc_zeroed\b/);
  });
});
