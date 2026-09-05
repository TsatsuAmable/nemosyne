export interface ValidationPrerequisiteRecordOptions {
  root?: string;
  sessionLabel: string;
  gate: string;
  satisfied: boolean;
  reason: string;
}

export function recordValidationPrerequisite(
  options: ValidationPrerequisiteRecordOptions
): string;
