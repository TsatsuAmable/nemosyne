# Representation equivalence

Status: Draft study-governance artifact.

## Rule
An intended treatment difference is an experimental manipulation. An uncontrolled difference capable of explaining the result is a confound.

## Controlled dimensions
The following must be equivalent or intentionally matched across conditions:
- dataset identity and version
- feature definitions and data dictionary
- preprocessing pipeline
- task family and scoring logic
- instructions and timing policy
- training duration and content parity
- researcher intervention policy

## Experimental dimensions
The following are deliberately varied as part of the interface manipulation:
- visual encoding strategy
- navigation model
- embodiment and presence model
- display/interaction modality

## Task-instance equivalence
Equivalent task instances must differ across conditions while being matched in difficulty and structure. The matching method should be recorded before collection begins.

## Deviation policy
If the selected task instances or interface path differ substantially from the chosen precedent, that deviation should be recorded and reviewed before finalizing the study package.
