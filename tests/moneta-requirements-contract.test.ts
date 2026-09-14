import { describe, expect, it } from 'vitest';
import * as v from 'valibot';
import {
  createDefaultRequirements,
  RepresentationRequirementsSchema,
  validateRepresentationRequirements,
} from '../src/moneta/representation/RepresentationRequirements.ts';

describe('Moneta requirements contract', () => {
  it('uses a plain hardware object whose material limits survive JSON serialisation', () => {
    const requirements = createDefaultRequirements('explore');

    expect(Array.isArray(requirements.hardwareConstraints)).toBe(false);
    expect(JSON.parse(JSON.stringify(requirements)).hardwareConstraints).toEqual(
      requirements.hardwareConstraints
    );
  });

  it('rejects invalid occlusion, non-finite hardware, and unknown top-level fields', () => {
    const invalidOcclusion = {
      ...createDefaultRequirements('explore'),
      maxFrustumExclusionTolerance: -0.01,
    };
    const nonFiniteHardware = {
      ...createDefaultRequirements('explore'),
      hardwareConstraints: {
        ...createDefaultRequirements('explore').hardwareConstraints,
        maxElements: Infinity,
      },
    };
    const unknownField = {
      ...createDefaultRequirements('explore'),
      arbitraryUnvalidatedField: true,
    };

    expect(() => v.parse(RepresentationRequirementsSchema, invalidOcclusion)).toThrow();
    expect(() => v.parse(RepresentationRequirementsSchema, nonFiniteHardware)).toThrow();
    expect(() => v.parse(RepresentationRequirementsSchema, unknownField)).toThrow();
  });

  it('enforces cross-field occlusion and progressive-disclosure invariants', () => {
    const mismatchedOcclusion = {
      ...createDefaultRequirements('explore'),
      acceptableLoss: {
        ...createDefaultRequirements('explore').acceptableLoss,
        maxFrustumExclusionTolerance: 0.1,
      },
    };
    const emptyDisclosure = {
      ...createDefaultRequirements('explore'),
      progressiveDisclosure: { enabled: true, levels: [] },
    };

    expect(() => validateRepresentationRequirements(mismatchedOcclusion)).toThrow(
      /maxFrustumExclusionTolerance/
    );
    expect(() => validateRepresentationRequirements(emptyDisclosure)).toThrow(
      /requires at least one level/
    );
  });

  it('accepts only explicit, unambiguous grouped-aggregate semantics', () => {
    const valid = {
      ...createDefaultRequirements('group-comparison'),
      aggregateSemantics: {
        kind: 'GROUPED_AGGREGATE',
        groupingField: 'cohort',
        measure: { field: 'value', function: 'MEAN' },
      },
    };
    expect(validateRepresentationRequirements(valid).aggregateSemantics).toEqual(
      valid.aggregateSemantics,
    );

    for (const aggregateSemantics of [
      {
        kind: 'GROUPED_AGGREGATE',
        groupingField: '',
        measure: { field: 'value', function: 'MEAN' },
      },
      {
        kind: 'GROUPED_AGGREGATE',
        groupingField: ' cohort ',
        measure: { field: 'value', function: 'MEAN' },
      },
      {
        kind: 'GROUPED_AGGREGATE',
        groupingField: 'cohort',
        measure: { function: 'MEAN' },
      },
      {
        kind: 'GROUPED_AGGREGATE',
        groupingField: 'cohort',
        measure: { field: 'value', function: 'COUNT' },
      },
      {
        kind: 'GROUPED_AGGREGATE',
        groupingField: 'cohort',
        measure: { field: 'cohort', function: 'SUM' },
      },
    ]) {
      expect(() =>
        validateRepresentationRequirements({
          ...createDefaultRequirements('group-comparison'),
          aggregateSemantics,
        }),
      ).toThrow();
    }

    const count = validateRepresentationRequirements({
      ...createDefaultRequirements('group-comparison'),
      aggregateSemantics: {
        kind: 'GROUPED_AGGREGATE',
        groupingField: 'cohort',
        measure: { function: 'COUNT' },
      },
    });
    expect(count.aggregateSemantics?.measure).toEqual({ function: 'COUNT' });
  });
});
