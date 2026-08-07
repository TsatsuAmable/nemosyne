// @vitest-environment jsdom

import { describe, it, expect, afterEach } from 'vitest';
import * as THREE from 'three';
import { VRConsole } from '../src/vr/ui/VRConsole.ts';

describe('VRConsole', () => {
  let consolePanel;
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  afterEach(() => {
    if (consolePanel) {
      consolePanel.unpatchConsole();
      consolePanel = null;
    }
    // Defensive restore in case unpatch failed.
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
  });

  it('captures console.log output', () => {
    consolePanel = new VRConsole(new THREE.Group());

    console.log('test-message-42');

    const captured = consolePanel.lines.some((l) => l.text.includes('test-message-42'));
    expect(captured).toBe(true);
    expect(consolePanel.lines[consolePanel.lines.length - 1].level).toBe('log');
  });

  it('captures console.warn and console.error with distinct levels', () => {
    consolePanel = new VRConsole(new THREE.Group());

    console.warn('warn-message');
    console.error('error-message');

    expect(
      consolePanel.lines.some((l) => l.level === 'warn' && l.text.includes('warn-message'))
    ).toBe(true);
    expect(
      consolePanel.lines.some((l) => l.level === 'error' && l.text.includes('error-message'))
    ).toBe(true);
  });

  it('caps the number of stored lines', () => {
    consolePanel = new VRConsole(new THREE.Group(), { maxLines: 5 });

    for (let i = 0; i < 10; i++) {
      console.log(`line-${i}`);
    }

    expect(consolePanel.lines.length).toBe(5);
    expect(consolePanel.lines[0].text).toContain('line-5');
    expect(consolePanel.lines[4].text).toContain('line-9');
  });

  it('unpatches console on request', () => {
    consolePanel = new VRConsole(new THREE.Group());
    consolePanel.unpatchConsole();

    // After unpatching, our panel should not capture new logs.
    const beforeCount = consolePanel.lines.length;
    console.log('after-unpatch');
    expect(consolePanel.lines.length).toBe(beforeCount);
  });
});
