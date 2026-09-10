from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match in {path}, got {count}")
    p.write_text(text.replace(old, new, 1))


Path('src/validation/uxr0-qualification-profile.ts').write_text("""/**
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
""")

replace_once(
    'src/vr/scalability/LoadTestDriver.ts',
    """import { WorldTopics } from '../../utils/EventBus.ts';
import {
  LoadTestCollector,""",
    """import { WorldTopics } from '../../utils/EventBus.ts';
import {
  UXR0_PROFILE_DURATIONS_SEC,
  type Uxr0QualificationProfileKind,
} from '../../validation/uxr0-qualification-profile.ts';
import {
  LoadTestCollector,""",
    'load-test shared UXR0 import',
)

replace_once(
    'src/vr/scalability/LoadTestDriver.ts',
    """export type Uxr0QualificationProfileKind =
  | 'functional-5m'
  | 'resource-trend-30m'
  | 'sustained-60m';

export const UXR0_PROFILE_DURATIONS_SEC: Readonly<Record<Uxr0QualificationProfileKind, number>> = {
  'functional-5m': 5 * 60,
  'resource-trend-30m': 30 * 60,
  'sustained-60m': 60 * 60,
};""",
    """// Preserve the #701 public import surface while keeping one shared authority.
export { UXR0_PROFILE_DURATIONS_SEC };
export type { Uxr0QualificationProfileKind };""",
    'load-test duplicate UXR0 declarations',
)

replace_once(
    'src/validation/uxr0-replacement-qualification.ts',
    """/**
 * UXR0 replacement A/B evidence contract.""",
    """import {
  UXR0_QUALIFICATION_PROFILE_KINDS,
  type Uxr0QualificationProfileKind,
} from './uxr0-qualification-profile.ts';

/**
 * UXR0 replacement A/B evidence contract.""",
    'replacement shared UXR0 import',
)

replace_once(
    'src/validation/uxr0-replacement-qualification.ts',
    """export type Uxr0QualificationProfileKind =
  | 'functional-5m'
  | 'resource-trend-30m'
  | 'sustained-60m';

""",
    """,
    'replacement duplicate UXR0 type',
)

replace_once(
    'src/validation/uxr0-replacement-qualification.ts',
    """const PROFILE_KINDS = new Set<Uxr0QualificationProfileKind>([
  'functional-5m',
  'resource-trend-30m',
  'sustained-60m',
]);""",
    """const PROFILE_KINDS = new Set<Uxr0QualificationProfileKind>(
  UXR0_QUALIFICATION_PROFILE_KINDS
);""",
    'replacement duplicate profile kind runtime set',
)

replace_once(
    'src/app/resourceEnvelopeDiagnostics.ts',
    """  workerDiagnostics: readonly AnalyticalWorkerDiagnostic[];
  workerTransfer: {""",
    """  workerDiagnostics: readonly AnalyticalWorkerDiagnostic[];
  /** Additive UXR0 extension; optional so historical schema-v1 Q3 reports remain valid. */
  workerTransfer?: {""",
    'resource envelope schema-v1 compatibility',
)
