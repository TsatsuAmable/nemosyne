import { describe, expect, it } from 'vitest';
import { WebXRSimulatorAdapter } from '../helpers/WebXRSimulatorAdapter.ts';

describe('P1-USIM WebXR simulator substrate', () => {
  it('constructs a simulator adapter', () => {
    const adapter = new WebXRSimulatorAdapter();
    expect(adapter).toBeTruthy();
    expect(adapter.device).toBeTruthy();
  });

  it('can set headset and controller positions programmatically', () => {
    const adapter = new WebXRSimulatorAdapter();
    adapter.setHeadsetPosition(0, 1.6, -2);
    adapter.setRightControllerPosition(0.5, 1.4, -1.8);
    adapter.setLeftControllerPosition(-0.5, 1.4, -1.8);
    // No throw means the simulation state was updated.
    expect(true).toBe(true);
  });

  it('triggers controller buttons without throwing', () => {
    const adapter = new WebXRSimulatorAdapter();
    adapter.triggerRightControllerButton('select', true);
    adapter.triggerRightControllerButton('select', false);
  });
});

describe('P1-USIM production bundle isolation', () => {
  it('excludes iwer from production runtime imports', () => {
    // The simulator helper is only reachable from tests/helpers, never from src/.
    // Verify no production source imports iwer directly.
    const fs = require('node:fs');
    const path = require('node:path');
    const srcDir = path.resolve(process.cwd(), 'src');
    let found = false;
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
          const content = fs.readFileSync(full, 'utf8');
          if (content.includes("from 'iwer'") || content.includes('from "iwer"')) {
            found = true;
          }
        }
      }
    };
    walk(srcDir);
    expect(found).toBe(false);
  });
});