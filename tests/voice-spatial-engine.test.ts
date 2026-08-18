// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { VoiceCommandListener } from '../src/ai/VoiceCommandListener.ts';
import { SpatialAudioNarrator } from '../src/vr/audio/SpatialAudioNarrator.ts';

describe('Sprint 16.1 & 16.2: Voice & Natural Language Spatial Query Engine Suite', () => {
  it('parses natural language filter phrases accurately', () => {
    const cmd1 = VoiceCommandListener.parseTranscript('filter revenue above 200');
    expect(cmd1.intent).toBe('FILTER');
    expect(cmd1.targetField).toBe('revenue');
    expect(cmd1.comparisonOperator).toBe('>');
    expect(cmd1.numericValue).toBe(200);

    const cmd2 = VoiceCommandListener.parseTranscript('where margin less than 15');
    expect(cmd2.intent).toBe('FILTER');
    expect(cmd2.targetField).toBe('margin');
    expect(cmd2.comparisonOperator).toBe('<');
    expect(cmd2.numericValue).toBe(15);
  });

  it('parses natural language layout phrases accurately', () => {
    const cmd1 = VoiceCommandListener.parseTranscript('show graph view');
    expect(cmd1.intent).toBe('LAYOUT');
    expect(cmd1.layoutType).toBe('FORCE_DIRECTED_3D');

    const cmd2 = VoiceCommandListener.parseTranscript('switch to tree hierarchy');
    expect(cmd2.intent).toBe('LAYOUT');
    expect(cmd2.layoutType).toBe('RADIAL_ORBITAL');
  });

  it('parses reset layout intent', () => {
    const cmd = VoiceCommandListener.parseTranscript('reset view');
    expect(cmd.intent).toBe('RESET');
  });

  it('instantiates SpatialAudioNarrator gracefully', () => {
    const narrator = new SpatialAudioNarrator();
    expect(narrator).toBeDefined();
  });
});
