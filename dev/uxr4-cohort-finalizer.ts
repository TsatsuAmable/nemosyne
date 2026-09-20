import fs from 'node:fs';
import path from 'node:path';
import { verifyFinalizedCustody } from './validation-finalizer.ts';
import {
  composeUxr4LaneEvidence,
  type Uxr4LaneEvidence,
  type Uxr4QualificationProfile,
} from '../src/validation/uxr4-verification-envelope.ts';
import type { Uxr4EvidenceObservation } from '../src/validation/uxr4-verification-envelope.ts';
import { validateValidationManifest } from '../src/validation/validation-manifest.ts';

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export interface Uxr4CohortArtifact {
  schemaVersion: 1;
  profile: Uxr4QualificationProfile;
  sessionLabels: string[];
  adjudication: ReturnType<typeof composeUxr4LaneEvidence>;
}

export function finalizeUxr4Cohort(options: {
  validationLogRoot: string;
  profile: Uxr4QualificationProfile;
  sessionLabels: string[];
}): Uxr4CohortArtifact {
  const lanes: Uxr4LaneEvidence[] = options.sessionLabels.map((label) => {
    const evidenceDir = path.join(options.validationLogRoot, label);
    const verified = verifyFinalizedCustody(evidenceDir);
    if (!verified.ok) {
      return {
        sessionId: label,
        buildId: 'invalid',
        deviceBuildFingerprint: null,
        evidenceClass: 'governed-physical-validation',
        sourceProfile: null,
        custodyValid: false,
        observations: [],
      };
    }
    const analysis = readJson(path.join(evidenceDir, 'analysis.json'));
    if (!isRecord(analysis) || !Array.isArray(analysis.uxr4Observations)) {
      return {
        sessionId: verified.custody.sessionId,
        buildId: verified.custody.buildId,
        deviceBuildFingerprint: verified.custody.deviceBuildFingerprint,
        evidenceClass:
          verified.custody.evidenceClass === 'clean-production-qualification'
            ? 'clean-production-qualification'
            : 'governed-physical-validation',
        sourceProfile: null,
        custodyValid: false,
        observations: [],
      };
    }
    const manifestCheck = validateValidationManifest(
      readJson(path.join(evidenceDir, 'manifest.json'))
    );
    return {
      sessionId: verified.custody.sessionId,
      buildId: verified.custody.buildId,
      deviceBuildFingerprint: verified.custody.deviceBuildFingerprint,
      evidenceClass:
        verified.custody.evidenceClass === 'clean-production-qualification'
          ? 'clean-production-qualification'
          : 'governed-physical-validation',
      sourceProfile: manifestCheck.ok ? manifestCheck.manifest.profile : null,
      custodyValid: manifestCheck.ok,
      observations: analysis.uxr4Observations as Uxr4EvidenceObservation[],
    };
  });
  return {
    schemaVersion: 1,
    profile: options.profile,
    sessionLabels: [...options.sessionLabels],
    adjudication: composeUxr4LaneEvidence(options.profile, lanes),
  };
}
