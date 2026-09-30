import { describe, test, expect } from 'vitest';
import {
  canonicalizeInvestigationIntent,
  computeIntentIdentity,
  INVESTIGATION_INTENT_SCHEMA_V1,
} from '../src/atlas/domain/InvestigationIntent.ts';

describe('InvestigationIntent V1', () => {
  describe('canonicalization', () => {
    test('NFC normalization', () => {
      // "Amélie" with an acute e vs combining acute
      const composed = 'Amélie';
      const decomposed = 'Ame\u0301lie';

      const intent1 = canonicalizeInvestigationIntent({
        schemaVersion: INVESTIGATION_INTENT_SCHEMA_V1,
        researchQuestion: composed,
      });
      const intent2 = canonicalizeInvestigationIntent({
        schemaVersion: INVESTIGATION_INTENT_SCHEMA_V1,
        researchQuestion: decomposed,
      });

      expect(intent1.researchQuestion).toBe(composed);
      expect(intent2.researchQuestion).toBe(composed);
      expect(computeIntentIdentity(intent1)).toBe(computeIntentIdentity(intent2));
    });

    test('leading/trailing whitespace equivalence but internal whitespace preservation', () => {
      const intent = canonicalizeInvestigationIntent({
        schemaVersion: INVESTIGATION_INTENT_SCHEMA_V1,
        hypothesis: '   This  is   a test   ',
      });
      expect(intent.hypothesis).toBe('This  is   a test');
    });

    test('empty optional scalar becomes absent', () => {
      const intent = canonicalizeInvestigationIntent({
        schemaVersion: INVESTIGATION_INTENT_SCHEMA_V1,
        researchQuestion: '   ',
        currentTask: '',
      });
      expect(intent.researchQuestion).toBeUndefined();
      expect(intent.currentTask).toBeUndefined();
      expect(Object.keys(intent)).not.toContain('researchQuestion');
      expect(Object.keys(intent)).not.toContain('currentTask');
    });

    test('variables preserve order', () => {
      const intent1 = canonicalizeInvestigationIntent({
        schemaVersion: INVESTIGATION_INTENT_SCHEMA_V1,
        variablesOfInterest: ['A', 'B'],
      });
      const intent2 = canonicalizeInvestigationIntent({
        schemaVersion: INVESTIGATION_INTENT_SCHEMA_V1,
        variablesOfInterest: ['B', 'A'],
      });
      expect(intent1.variablesOfInterest).toEqual(['A', 'B']);
      expect(intent2.variablesOfInterest).toEqual(['B', 'A']);
      expect(computeIntentIdentity(intent1)).not.toBe(computeIntentIdentity(intent2));
    });

    test('empty variable item rejects', () => {
      expect(() => {
        canonicalizeInvestigationIntent({
          schemaVersion: INVESTIGATION_INTENT_SCHEMA_V1,
          variablesOfInterest: ['A', '   ', 'C'],
        });
      }).toThrow(/variablesOfInterest cannot contain empty items/);
    });

    test('same canonical content hashes identically', () => {
      const intent1 = {
        schemaVersion: INVESTIGATION_INTENT_SCHEMA_V1,
        researchQuestion: 'Is this the same?',
        hypothesis: 'Yes  it is',
      };
      const intent2 = {
        schemaVersion: INVESTIGATION_INTENT_SCHEMA_V1,
        hypothesis: 'Yes  it is',
        researchQuestion: '  Is this the same?  ',
      };
      expect(computeIntentIdentity(intent1)).toBe(computeIntentIdentity(intent2));
    });

    test('material changes alter identity', () => {
      const base = {
        schemaVersion: INVESTIGATION_INTENT_SCHEMA_V1,
        researchQuestion: 'Q',
        hypothesis: 'H',
        currentTask: 'T',
        variablesOfInterest: ['V'],
      };

      const baseHash = computeIntentIdentity(base);

      expect(computeIntentIdentity({ ...base, researchQuestion: 'Q2' })).not.toBe(baseHash);
      expect(computeIntentIdentity({ ...base, hypothesis: 'H2' })).not.toBe(baseHash);
      expect(computeIntentIdentity({ ...base, currentTask: 'T2' })).not.toBe(baseHash);
      expect(computeIntentIdentity({ ...base, variablesOfInterest: ['V2'] })).not.toBe(baseHash);
    });

    test('unsupported schema version / malformed unknown input rejects', () => {
      expect(() => canonicalizeInvestigationIntent(null)).toThrow(/must be an object/);
      expect(() => canonicalizeInvestigationIntent(undefined)).toThrow(/must be an object/);
      expect(() => canonicalizeInvestigationIntent('string')).toThrow(/must be an object/);

      expect(() => canonicalizeInvestigationIntent({ schemaVersion: 2 })).toThrow(
        /Unsupported InvestigationIntent schema version/
      );
      expect(() => canonicalizeInvestigationIntent({ schemaVersion: '1' })).toThrow(/Unsupported/);
      expect(() =>
        canonicalizeInvestigationIntent({
          schemaVersion: INVESTIGATION_INTENT_SCHEMA_V1,
          researchQuestion: 123,
        })
      ).toThrow(/must be a string/);
      expect(() =>
        canonicalizeInvestigationIntent({
          schemaVersion: INVESTIGATION_INTENT_SCHEMA_V1,
          researchQuestion: 'Q',
          futureMeaning: 'must not be silently discarded',
        })
      ).toThrow(/Unsupported InvestigationIntent field: futureMeaning/);
    });

    test('canonicalization does not mutate the caller input', () => {
      const input = {
        schemaVersion: INVESTIGATION_INTENT_SCHEMA_V1,
        researchQuestion: '  Original  ',
        variablesOfInterest: ['  V1  '],
      };
      const output = canonicalizeInvestigationIntent(input);
      expect(input.researchQuestion).toBe('  Original  ');
      expect(input.variablesOfInterest[0]).toBe('  V1  ');
      expect(output.researchQuestion).toBe('Original');
      expect(output.variablesOfInterest![0]).toBe('V1');
      expect(output).not.toBe(input);
    });
  });
});
