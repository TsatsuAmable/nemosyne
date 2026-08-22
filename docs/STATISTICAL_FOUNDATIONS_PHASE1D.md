# Statistical Foundations Phase 1D — Sample Support and Missingness

Phase 1D makes the population of observations behind each analytical claim explicit.

## Sample support

`EvidenceClaim<T>::sample_support` records:

- total dataset rows;
- rows actually used by the method;
- rows excluded;
- the columns defining the analytical support;
- the support policy (`FullDataset`, `CompleteCase`, `PairwiseComplete`, `FilteredSubset`, `Imputed`, or `Other`);
- counted exclusion reasons where they are known.

Support accounting is descriptive provenance. A high support fraction is not statistical confidence, and a low support fraction does not by itself prove bias.

The Rust constructor rejects impossible accounting such as `rows_used > total_rows` or exclusion-reason counts larger than the number of excluded rows.

## Missingness evidence

Rust computes dataset-level missingness evidence containing:

- total rows and cells;
- total missing cells and missing fraction;
- observed/missing support per column;
- observed missingness patterns across columns;
- a separate missingness-mechanism assessment.

A cell is missing when the key is absent or the value is explicitly `Null`.

## Missingness mechanism boundary

MCAR, MAR, and MNAR are not inferred from missing-value percentages or pattern counts.

The default mechanism is `Unknown` with source `Unknown`. Any stronger mechanism state must come from an explicit declaration or a separately specified model-based analysis with its own assumptions and provenance.

This is deliberate: a missingness pattern can be observed from the dataset, while the data-generating mechanism generally cannot be identified from those counts alone.

## Complete-case support

`complete_case_support(dataset, columns)` derives sample support for a requested set of columns from the authoritative Rust dataset. The same dataset can therefore have different support for different analyses.

For example, an analysis of `x` may use 90/100 rows while an analysis of `(x, y, z)` uses only 62/100. Nemosyne must preserve those as different evidence supports rather than attaching the dataset row count to both results.

## Explicit non-goals

Phase 1D does not:

- infer MCAR/MAR/MNAR;
- impute values;
- recommend an imputation method;
- treat complete-case analysis as universally valid;
- calculate an "effective sample size" for dependent observations;
- convert support fraction into confidence;
- yet replace every legacy structure-profile missingness field in the transport ABI.

The next integration step is to route existing Rust analyzers through these support constructors so every emitted `EvidenceClaim` carries method-specific support rather than generic dataset cardinality.
