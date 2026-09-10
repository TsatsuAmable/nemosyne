/**
 * Shared UXR0 observation-profile identity and duration contract.
 *
 * This module is dependency-free so runtime drivers and validation/evidence
 * comparators cannot drift onto independent definitions of the same profiles.
 */
export const UXR0_QUALIFICATION_PROFILE_KINDS = [
  'functional-5m',
  'resource-trend-30m',
  'sustained-60m',
] as const;

export type Uxr0QualificationProfileKind =
  (typeof UXR0_QUALIFICATION_PROFILE_KINDS)[number];

export const UXR0_PROFILE_DURATIONS_SEC: Readonly<
  Record<Uxr0QualificationProfileKind, number>
> = {
  'functional-5m': 5 * 60,
  'resource-trend-30m': 30 * 60,
  'sustained-60m': 60 * 60,
};
