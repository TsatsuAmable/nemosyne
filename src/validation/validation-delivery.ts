export const VALIDATION_RECEIPT_VERSION_HEADER = 'x-nemosyne-validation-receipt-version';
export const VALIDATION_RECEIPT_VERSION = '1';
export const VALIDATION_STATUS_ENDPOINT = '/__validation-status';
export const VALIDATION_UX_ENDPOINT = '/__validation-ux-results';

export interface QualificationProgress {
  target: 3;
  renderCompleted: number;
  boundaryAttempts: number;
  buildId: string | null;
  deviceBuildFingerprint: string | null;
}

export interface ValidationDeliveryReceipt {
  version: '1';
  status: 'captured';
  receivedAt: string;
  artifact: string;
  sessionLabel: string;
  sessionId: string;
  progress: QualificationProgress | null;
}

export interface ValidationServerStatus {
  status: 'ok';
  sessionLabel: string;
  sessionId: string;
  progress: QualificationProgress | null;
  gateDisposition: {
    status: string | null;
    reasons: string[];
  } | null;
}

export function isValidationDeliveryReceipt(value: unknown): value is ValidationDeliveryReceipt {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return (
    v.version === '1' &&
    v.status === 'captured' &&
    typeof v.receivedAt === 'string' &&
    typeof v.artifact === 'string' &&
    typeof v.sessionLabel === 'string' &&
    typeof v.sessionId === 'string'
  );
}
