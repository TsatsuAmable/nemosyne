export function resolveAstGrepBin(root: string): string | null;

export interface TestQualityScanResult {
  ok: boolean;
  output: string;
  error: string;
}

export function scanRule(bin: string, rulePath: string, scope: string, cwd: string): TestQualityScanResult;

export function parseLocations(output: string): string[];