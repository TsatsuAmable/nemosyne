export type PromotionRiskClassification = 'high-risk' | 'standard-risk' | 'low-risk';

export interface PromotionEvidenceInput {
  body?: string;
  expectedSha: string;
  changedFiles: number;
}

export interface PromotionEvidenceResult {
  ok: boolean;
  classification: PromotionRiskClassification | null;
  errors: string[];
}

export function validatePromotionEvidence(input: PromotionEvidenceInput): PromotionEvidenceResult;
