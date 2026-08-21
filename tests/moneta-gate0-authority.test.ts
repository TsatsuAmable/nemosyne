import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const DRACO_ROOT = join(ROOT, 'src', 'draco');

function collectTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory()
      ? collectTypeScriptFiles(path)
      : entry.endsWith('.ts')
        ? [path]
        : [];
  });
}

describe('V3 Gate 0 representation authority', () => {
  it('keeps legacy src/draco as compatibility adapters only', () => {
    const violations: string[] = [];

    for (const file of collectTypeScriptFiles(DRACO_ROOT)) {
      const source = readFileSync(file, 'utf8').trim();
      const repoPath = relative(ROOT, file).replaceAll('\\', '/');

      // Draco remains temporarily for source compatibility, but it may only
      // re-export the canonical implementation from src/moneta. No classes,
      // functions, constants, scoring tables or solver logic may live here.
      const statements = source
        .split(';')
        .map((statement) => statement.trim())
        .filter(Boolean);

      const adapterOnly =
        statements.length > 0 &&
        statements.every(
          (statement) =>
            /^(export\s+\*\s+from\s+['"][.]{1,2}\/.+moneta\/.+['"]|export\s+\{[^}]+\}\s+from\s+['"][.]{1,2}\/.+moneta\/.+['"]|export\s+type\s+\{[^}]+\}\s+from\s+['"][.]{1,2}\/.+moneta\/.+['"])$/s.test(
              statement
            )
        );

      if (!adapterOnly) violations.push(repoPath);
    }

    expect(
      violations,
      `Legacy Draco contains independent implementation authority: ${violations.join(', ')}`
    ).toEqual([]);
  });
});
