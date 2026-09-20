export const EVIDENCE_RECEIPT_BUNDLE_SCHEMA_VERSION = '1' as const;

export type AssumptionStatusV1 = 'satisfied' | 'violated' | 'unchecked' | 'notTestableFromData';

export type SupportPolicyV1 =
  'fullDataset' | 'completeCase' | 'pairwiseComplete' | 'filteredSubset' | 'imputed' | 'other';

export interface EvidenceReceiptAssumptionV1 {
  readonly assumption: string;
  readonly status: AssumptionStatusV1;
  readonly detail: string;
}

export interface EvidenceReceiptSampleSupportV1 {
  readonly totalRows: number;
  readonly rowsUsed: number;
  readonly rowsExcluded: number;
  readonly columns: readonly string[];
  readonly policy: SupportPolicyV1;
  readonly exclusionReasons: readonly {
    readonly reason: string;
    readonly rowCount: number;
  }[];
}

export interface EvidenceReceiptUncertaintyV1 {
  readonly method: string;
  readonly lower: number | null;
  readonly upper: number | null;
  readonly standardError: number | null;
}

export interface EvidenceReceiptStabilityV1 {
  readonly method: string;
  readonly score: number;
  readonly repetitions: number;
}

export interface EvidenceReceiptSensitivityV1 {
  readonly factor: string;
  readonly testedValues: readonly string[];
  readonly materiallyChanged: boolean;
}

export interface EvidenceReceiptMethodProvenanceV1 {
  readonly method: string;
  readonly methodVersion: string;
  readonly kernelVersion: string;
  readonly datasetFingerprint: string;
  readonly parameters: readonly (readonly [string, string])[];
}

export interface EvidenceReceiptGeometryV1 {
  readonly columns: readonly string[];
  readonly metric: string;
  readonly transformations: readonly string[];
  readonly missingnessPolicy: string;
}

export type MeasurementScaleV1 =
  | 'unknown'
  | 'identifier'
  | 'nominal'
  | 'ordinal'
  | 'interval'
  | 'ratio'
  | 'count'
  | 'proportion'
  | 'compositional'
  | 'circular'
  | 'temporal'
  | 'spatialCoordinate';

export type ObservationStructureV1 =
  | 'unknown'
  | 'iid'
  | 'grouped'
  | 'repeatedMeasures'
  | 'temporalSequence'
  | 'spatial'
  | 'spatiotemporal';

export interface MeasurementModelRecordV1 {
  readonly model: {
    readonly column: string;
    readonly scale: MeasurementScaleV1;
    readonly observationStructure: ObservationStructureV1;
    readonly compositionalGroup: string | null;
  };
  readonly status: 'inferred' | 'declared' | 'confirmed' | 'ambiguous' | 'unknown';
  readonly basis: readonly {
    readonly source: string;
    readonly rationale: string;
  }[];
}

export interface AnalyticalAdmissionV1 {
  readonly status: 'admitted' | 'rejected';
  readonly issues: readonly {
    readonly column: string | null;
    readonly reason: string;
  }[];
}

export type EvidenceMeasurementContextV1 =
  | { readonly status: 'NOT_ESTABLISHED' }
  | {
      readonly status: 'ESTABLISHED';
      readonly records: readonly MeasurementModelRecordV1[];
      readonly semanticAdmissionPolicy:
        'allowInferred' | 'requireDeclared' | 'requireConfirmed' | null;
      readonly analyticalAdmission: AnalyticalAdmissionV1 | null;
    };

export interface EvidenceReceiptV1 {
  readonly receiptId: string;
  readonly claimId: string;
  readonly estimand: string;
  readonly measurementContext: EvidenceMeasurementContextV1;
  readonly geometry: EvidenceReceiptGeometryV1 | null;
  readonly assumptions: readonly EvidenceReceiptAssumptionV1[];
  readonly sampleSupport: EvidenceReceiptSampleSupportV1;
  readonly uncertainty: EvidenceReceiptUncertaintyV1 | null;
  readonly stability: EvidenceReceiptStabilityV1 | null;
  readonly sensitivity: readonly EvidenceReceiptSensitivityV1[];
  readonly limitations: readonly string[];
  readonly methodProvenance: EvidenceReceiptMethodProvenanceV1;
}

export interface EvidenceReceiptBundleV1 {
  readonly schemaVersion: typeof EVIDENCE_RECEIPT_BUNDLE_SCHEMA_VERSION;
  readonly datasetFingerprint: string;
  readonly kernelVersion: string;
  readonly receipts: readonly EvidenceReceiptV1[];
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`[EvidenceReceipt] ${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[], label: string): void {
  const expected = new Set(keys);
  const actual = Object.keys(value);
  if (actual.length !== expected.size || actual.some((key) => !expected.has(key))) {
    throw new Error(`[EvidenceReceipt] ${label} has an unsupported shape`);
  }
}

function stringValue(value: unknown, label: string): string {
  if (typeof value !== 'string') {
    throw new Error(`[EvidenceReceipt] ${label} must be a string`);
  }
  return value;
}

function nonEmptyString(value: unknown, label: string): string {
  const parsed = stringValue(value, label);
  if (parsed.length === 0) {
    throw new Error(`[EvidenceReceipt] ${label} must be a non-empty string`);
  }
  return parsed;
}

function finiteNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`[EvidenceReceipt] ${label} must be finite`);
  }
  return value;
}

function count(value: unknown, label: string): number {
  const parsed = finiteNumber(value, label);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`[EvidenceReceipt] ${label} must be a non-negative safe integer`);
  }
  return parsed;
}

function stringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) throw new Error(`[EvidenceReceipt] ${label} must be an array`);
  return value.map((entry, index) => nonEmptyString(entry, `${label}[${index}]`));
}

function nullableFiniteNumber(value: unknown, label: string): number | null {
  return value === null ? null : finiteNumber(value, label);
}

function parseMeasurementRecord(value: unknown, index: number): MeasurementModelRecordV1 {
  const item = record(value, `measurementContext.records[${index}]`);
  exactKeys(item, ['model', 'status', 'basis'], `measurementContext.records[${index}]`);

  const model = record(item.model, `measurementContext.records[${index}].model`);
  exactKeys(
    model,
    ['column', 'scale', 'observationStructure', 'compositionalGroup'],
    `measurementContext.records[${index}].model`
  );
  const scale = nonEmptyString(
    model.scale,
    `measurementContext.records[${index}].model.scale`
  ) as MeasurementScaleV1;
  if (
    ![
      'unknown',
      'identifier',
      'nominal',
      'ordinal',
      'interval',
      'ratio',
      'count',
      'proportion',
      'compositional',
      'circular',
      'temporal',
      'spatialCoordinate',
    ].includes(scale)
  ) {
    throw new Error('[EvidenceReceipt] unsupported measurement scale');
  }
  const observationStructure = nonEmptyString(
    model.observationStructure,
    `measurementContext.records[${index}].model.observationStructure`
  ) as ObservationStructureV1;
  if (
    ![
      'unknown',
      'iid',
      'grouped',
      'repeatedMeasures',
      'temporalSequence',
      'spatial',
      'spatiotemporal',
    ].includes(observationStructure)
  ) {
    throw new Error('[EvidenceReceipt] unsupported observation structure');
  }
  const compositionalGroup =
    model.compositionalGroup === null
      ? null
      : nonEmptyString(
          model.compositionalGroup,
          `measurementContext.records[${index}].model.compositionalGroup`
        );

  const status = nonEmptyString(
    item.status,
    `measurementContext.records[${index}].status`
  ) as MeasurementModelRecordV1['status'];
  if (!['inferred', 'declared', 'confirmed', 'ambiguous', 'unknown'].includes(status)) {
    throw new Error('[EvidenceReceipt] unsupported measurement model status');
  }

  if (!Array.isArray(item.basis)) {
    throw new Error('[EvidenceReceipt] measurement model basis must be an array');
  }
  const basis = item.basis.map((basisValue, basisIndex) => {
    const basisItem = record(
      basisValue,
      `measurementContext.records[${index}].basis[${basisIndex}]`
    );
    exactKeys(
      basisItem,
      ['source', 'rationale'],
      `measurementContext.records[${index}].basis[${basisIndex}]`
    );
    return {
      source: nonEmptyString(
        basisItem.source,
        `measurementContext.records[${index}].basis[${basisIndex}].source`
      ),
      rationale: nonEmptyString(
        basisItem.rationale,
        `measurementContext.records[${index}].basis[${basisIndex}].rationale`
      ),
    };
  });

  return {
    model: {
      column: nonEmptyString(model.column, `measurementContext.records[${index}].model.column`),
      scale,
      observationStructure,
      compositionalGroup,
    },
    status,
    basis,
  };
}

function parseAnalyticalAdmission(value: unknown): AnalyticalAdmissionV1 {
  const admission = record(value, 'measurementContext.analyticalAdmission');
  exactKeys(admission, ['status', 'issues'], 'measurementContext.analyticalAdmission');
  const status = nonEmptyString(
    admission.status,
    'measurementContext.analyticalAdmission.status'
  ) as AnalyticalAdmissionV1['status'];
  if (!['admitted', 'rejected'].includes(status)) {
    throw new Error('[EvidenceReceipt] unsupported analytical admission status');
  }
  if (!Array.isArray(admission.issues)) {
    throw new Error('[EvidenceReceipt] analytical admission issues must be an array');
  }
  const issues = admission.issues.map((issueValue, index) => {
    const issue = record(issueValue, `measurementContext.analyticalAdmission.issues[${index}]`);
    exactKeys(
      issue,
      ['column', 'reason'],
      `measurementContext.analyticalAdmission.issues[${index}]`
    );
    return {
      column:
        issue.column === null
          ? null
          : nonEmptyString(
              issue.column,
              `measurementContext.analyticalAdmission.issues[${index}].column`
            ),
      reason: nonEmptyString(
        issue.reason,
        `measurementContext.analyticalAdmission.issues[${index}].reason`
      ),
    };
  });
  return { status, issues };
}

function parseMeasurementContext(value: unknown): EvidenceMeasurementContextV1 {
  const context = record(value, 'measurementContext');
  const status = nonEmptyString(context.status, 'measurementContext.status');
  if (status === 'NOT_ESTABLISHED') {
    exactKeys(context, ['status'], 'measurementContext');
    return { status };
  }
  if (status !== 'ESTABLISHED') {
    throw new Error('[EvidenceReceipt] unsupported measurementContext status');
  }
  exactKeys(
    context,
    ['status', 'records', 'semanticAdmissionPolicy', 'analyticalAdmission'],
    'measurementContext'
  );
  if (!Array.isArray(context.records) || context.records.length === 0) {
    throw new Error(
      '[EvidenceReceipt] established measurementContext.records must be a non-empty array'
    );
  }
  const policy = context.semanticAdmissionPolicy;
  if (
    policy !== null &&
    !['allowInferred', 'requireDeclared', 'requireConfirmed'].includes(String(policy))
  ) {
    throw new Error('[EvidenceReceipt] invalid semantic admission policy');
  }
  return {
    status,
    records: context.records.map(parseMeasurementRecord),
    semanticAdmissionPolicy:
      policy === null ? null : (policy as 'allowInferred' | 'requireDeclared' | 'requireConfirmed'),
    analyticalAdmission:
      context.analyticalAdmission === null
        ? null
        : parseAnalyticalAdmission(context.analyticalAdmission),
  };
}

function parseSampleSupport(value: unknown): EvidenceReceiptSampleSupportV1 {
  const support = record(value, 'sampleSupport');
  exactKeys(
    support,
    ['totalRows', 'rowsUsed', 'rowsExcluded', 'columns', 'policy', 'exclusionReasons'],
    'sampleSupport'
  );
  const totalRows = count(support.totalRows, 'sampleSupport.totalRows');
  const rowsUsed = count(support.rowsUsed, 'sampleSupport.rowsUsed');
  const rowsExcluded = count(support.rowsExcluded, 'sampleSupport.rowsExcluded');
  if (rowsUsed > totalRows || rowsExcluded !== totalRows - rowsUsed) {
    throw new Error('[EvidenceReceipt] sample support counts are inconsistent');
  }
  const policy = nonEmptyString(support.policy, 'sampleSupport.policy') as SupportPolicyV1;
  if (
    ![
      'fullDataset',
      'completeCase',
      'pairwiseComplete',
      'filteredSubset',
      'imputed',
      'other',
    ].includes(policy)
  ) {
    throw new Error('[EvidenceReceipt] unsupported sample support policy');
  }
  if (!Array.isArray(support.exclusionReasons)) {
    throw new Error('[EvidenceReceipt] exclusionReasons must be an array');
  }
  const exclusionReasons = support.exclusionReasons.map((entry, index) => {
    const item = record(entry, `exclusionReasons[${index}]`);
    exactKeys(item, ['reason', 'rowCount'], `exclusionReasons[${index}]`);
    return {
      reason: nonEmptyString(item.reason, `exclusionReasons[${index}].reason`),
      rowCount: count(item.rowCount, `exclusionReasons[${index}].rowCount`),
    };
  });
  const explained = exclusionReasons.reduce((sum, reason) => sum + reason.rowCount, 0);
  if (explained > rowsExcluded) {
    throw new Error('[EvidenceReceipt] exclusion reasons exceed excluded rows');
  }
  return {
    totalRows,
    rowsUsed,
    rowsExcluded,
    columns: stringArray(support.columns, 'sampleSupport.columns'),
    policy,
    exclusionReasons,
  };
}

function parseMethodProvenance(value: unknown): EvidenceReceiptMethodProvenanceV1 {
  const provenance = record(value, 'methodProvenance');
  exactKeys(
    provenance,
    ['method', 'methodVersion', 'kernelVersion', 'datasetFingerprint', 'parameters'],
    'methodProvenance'
  );
  if (!Array.isArray(provenance.parameters)) {
    throw new Error('[EvidenceReceipt] methodProvenance.parameters must be an array');
  }
  const parameters = provenance.parameters.map((entry, index): [string, string] => {
    if (!Array.isArray(entry) || entry.length !== 2) {
      throw new Error(`[EvidenceReceipt] methodProvenance.parameters[${index}] must be a pair`);
    }
    return [
      nonEmptyString(entry[0], `methodProvenance.parameters[${index}][0]`),
      stringValue(entry[1], `methodProvenance.parameters[${index}][1]`),
    ];
  });
  return {
    method: nonEmptyString(provenance.method, 'methodProvenance.method'),
    methodVersion: nonEmptyString(provenance.methodVersion, 'methodProvenance.methodVersion'),
    kernelVersion: nonEmptyString(provenance.kernelVersion, 'methodProvenance.kernelVersion'),
    datasetFingerprint: nonEmptyString(
      provenance.datasetFingerprint,
      'methodProvenance.datasetFingerprint'
    ),
    parameters,
  };
}

function parseReceipt(value: unknown, index: number): EvidenceReceiptV1 {
  const receipt = record(value, `receipts[${index}]`);
  exactKeys(
    receipt,
    [
      'receiptId',
      'claimId',
      'estimand',
      'measurementContext',
      'geometry',
      'assumptions',
      'sampleSupport',
      'uncertainty',
      'stability',
      'sensitivity',
      'limitations',
      'methodProvenance',
    ],
    `receipts[${index}]`
  );
  if (!Array.isArray(receipt.assumptions) || !Array.isArray(receipt.sensitivity)) {
    throw new Error('[EvidenceReceipt] assumptions and sensitivity must be arrays');
  }
  const assumptions = receipt.assumptions.map((entry, assumptionIndex) => {
    const item = record(entry, `assumptions[${assumptionIndex}]`);
    exactKeys(item, ['assumption', 'status', 'detail'], `assumptions[${assumptionIndex}]`);
    const status = nonEmptyString(item.status, 'assumption.status') as AssumptionStatusV1;
    if (!['satisfied', 'violated', 'unchecked', 'notTestableFromData'].includes(status)) {
      throw new Error('[EvidenceReceipt] unsupported assumption status');
    }
    return {
      assumption: nonEmptyString(item.assumption, 'assumption.assumption'),
      status,
      detail: nonEmptyString(item.detail, 'assumption.detail'),
    };
  });
  const geometry =
    receipt.geometry === null
      ? null
      : (() => {
          const item = record(receipt.geometry, 'geometry');
          exactKeys(
            item,
            ['columns', 'metric', 'transformations', 'missingnessPolicy'],
            'geometry'
          );
          const metric = nonEmptyString(item.metric, 'geometry.metric');
          if (
            ![
              'euclidean',
              'standardizedEuclidean',
              'mahalanobis',
              'gower',
              'aitchison',
              'hamming',
              'jaccard',
              'geodesic',
              'dynamicTimeWarping',
            ].includes(metric)
          ) {
            throw new Error('[EvidenceReceipt] unsupported analytical metric');
          }
          const transformations = stringArray(item.transformations, 'geometry.transformations');
          if (
            transformations.some(
              (entry) =>
                ![
                  'standardize',
                  'robustScale',
                  'rankEncode',
                  'indicatorEncode',
                  'ilr',
                  'circularEmbedding',
                ].includes(entry)
            )
          ) {
            throw new Error('[EvidenceReceipt] unsupported analytical transformation');
          }
          const missingnessPolicy = nonEmptyString(
            item.missingnessPolicy,
            'geometry.missingnessPolicy'
          );
          if (
            !['preserve', 'completeCase', 'pairwiseComplete', 'impute'].includes(missingnessPolicy)
          ) {
            throw new Error('[EvidenceReceipt] unsupported missingness policy');
          }
          return {
            columns: stringArray(item.columns, 'geometry.columns'),
            metric,
            transformations,
            missingnessPolicy,
          };
        })();
  const uncertainty =
    receipt.uncertainty === null
      ? null
      : (() => {
          const item = record(receipt.uncertainty, 'uncertainty');
          exactKeys(item, ['method', 'lower', 'upper', 'standardError'], 'uncertainty');
          return {
            method: nonEmptyString(item.method, 'uncertainty.method'),
            lower: nullableFiniteNumber(item.lower, 'uncertainty.lower'),
            upper: nullableFiniteNumber(item.upper, 'uncertainty.upper'),
            standardError: nullableFiniteNumber(item.standardError, 'uncertainty.standardError'),
          };
        })();

  const stability =
    receipt.stability === null
      ? null
      : (() => {
          const item = record(receipt.stability, 'stability');
          exactKeys(item, ['method', 'score', 'repetitions'], 'stability');
          return {
            method: nonEmptyString(item.method, 'stability.method'),
            score: finiteNumber(item.score, 'stability.score'),
            repetitions: count(item.repetitions, 'stability.repetitions'),
          };
        })();
  const sensitivity = receipt.sensitivity.map((entry, sensitivityIndex) => {
    const item = record(entry, `sensitivity[${sensitivityIndex}]`);
    exactKeys(
      item,
      ['factor', 'testedValues', 'materiallyChanged'],
      `sensitivity[${sensitivityIndex}]`
    );
    if (typeof item.materiallyChanged !== 'boolean') {
      throw new Error('[EvidenceReceipt] sensitivity.materiallyChanged must be boolean');
    }
    return {
      factor: nonEmptyString(item.factor, 'sensitivity.factor'),
      testedValues: stringArray(item.testedValues, 'sensitivity.testedValues'),
      materiallyChanged: item.materiallyChanged,
    };
  });
  return {
    receiptId: nonEmptyString(receipt.receiptId, 'receiptId'),
    claimId: nonEmptyString(receipt.claimId, 'claimId'),
    estimand: nonEmptyString(receipt.estimand, 'estimand'),
    measurementContext: parseMeasurementContext(receipt.measurementContext),
    geometry,
    assumptions,
    sampleSupport: parseSampleSupport(receipt.sampleSupport),
    uncertainty,
    stability,
    sensitivity,
    limitations: stringArray(receipt.limitations, 'limitations'),
    methodProvenance: parseMethodProvenance(receipt.methodProvenance),
  };
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

export function parseEvidenceReceiptBundleV1(value: unknown): EvidenceReceiptBundleV1 {
  const bundle = record(value, 'bundle');
  exactKeys(bundle, ['schemaVersion', 'datasetFingerprint', 'kernelVersion', 'receipts'], 'bundle');
  if (bundle.schemaVersion !== EVIDENCE_RECEIPT_BUNDLE_SCHEMA_VERSION) {
    throw new Error('[EvidenceReceipt] unsupported schemaVersion');
  }
  if (!Array.isArray(bundle.receipts)) {
    throw new Error('[EvidenceReceipt] receipts must be an array');
  }
  const datasetFingerprint = nonEmptyString(bundle.datasetFingerprint, 'datasetFingerprint');
  const kernelVersion = nonEmptyString(bundle.kernelVersion, 'kernelVersion');
  const receipts = bundle.receipts.map(parseReceipt);
  const ids = new Set<string>();
  for (const receipt of receipts) {
    if (ids.has(receipt.receiptId)) throw new Error('[EvidenceReceipt] duplicate receiptId');
    ids.add(receipt.receiptId);
    if (
      receipt.methodProvenance.datasetFingerprint !== datasetFingerprint ||
      receipt.methodProvenance.kernelVersion !== kernelVersion
    ) {
      throw new Error('[EvidenceReceipt] receipt provenance does not match bundle identity');
    }
  }
  return deepFreeze({
    schemaVersion: EVIDENCE_RECEIPT_BUNDLE_SCHEMA_VERSION,
    datasetFingerprint,
    kernelVersion,
    receipts,
  });
}
