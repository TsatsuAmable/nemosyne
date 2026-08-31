import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const EXPORT_SURFACES = [
  'src/app/InvestigationShell.ts',
  'src/app/AnalystJourneyControls.ts',
] as const;

const NEMOSYNE_MIME = 'application/vnd.nemosyne+zip';
const NEMOSYNE_FILENAME = 'nemosyne-investigation.nemosyne';
const ACCEPT_CONTRACT = '.nemosyne,application/vnd.nemosyne+zip,application/zip';

describe('.nemosyne browser presentation contract', () => {
  it.each(EXPORT_SURFACES)('%s exports the portable ZIP using the Nemosyne media type', (path) => {
    const contents = source(path);

    expect(contents).toContain(`type: '${NEMOSYNE_MIME}'`);
    expect(contents).not.toMatch(/type:\s*'application\/zip'/);
    expect(contents).toContain(NEMOSYNE_FILENAME);
  });

  it.each(EXPORT_SURFACES)('%s prefers .nemosyne imports while retaining legacy ZIP compatibility', (path) => {
    expect(source(path)).toContain(ACCEPT_CONTRACT);
  });
});
