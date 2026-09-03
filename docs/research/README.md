# Nemosyne Research & Publication Documentation

**Status:** research documentation authority for publication planning and scholarly provenance.  
**Tracking issue:** #648.  
**Does not replace:** `docs/ROADMAP.md` for implementation status or `docs/Nemosyne_Definitive_Vision_and_Roadmap.md` for product/research direction.

## Purpose

This directory makes Nemosyne's academic record explicit. It exists so that future papers can distinguish:

- what prior research and external design work informed Nemosyne;
- what material is actually incorporated and may carry licence/notice obligations;
- what Nemosyne claims as an original system, architectural or research contribution;
- which claims are supported by software evidence, device evidence, human observation or formal experiments;
- which ideas remain hypotheses or future research directions;
- how individual papers divide the research programme without duplicate or inflated claims.

The objective is not to retroactively make every engineering document read like a paper. Engineering records should remain useful engineering records. Publication documents should cite those records as implementation/provenance evidence while using a conventional scholarly structure and bibliography.

## Files

- `RESEARCH_PROVENANCE.md` — attribution policy, initial related-work audit and distinction between scholarly influence and third-party incorporated material.
- `PUBLICATION_ROADMAP.md` — proposed paper sequence, prerequisite evidence and candidate venues.
- `PAPER_01_CORE_PRINCIPLES.md` — concept, contribution/evidence matrix and outline for the first exploratory Nemosyne paper.
- `references.bib` — seed machine-readable bibliography. This is deliberately incomplete and should grow through literature review rather than ad-hoc URL collection.

## Research claim discipline

Every publishable claim should be classifiable using the following evidence ladder.

| Class | Meaning | Example |
|---|---|---|
| `PROPOSED` | Design principle, hypothesis or planned capability | RepresentationGraph compositional search before implementation |
| `IMPLEMENTED` | A production code path exists | NIL semantic command routing exists |
| `SOFTWARE_VERIFIED` | Deterministic/unit/property/browser evidence exercises the claimed software path | candidate → semantic payload → artifact identity test |
| `DEVICE_OBSERVED` | Recorded evidence from the target physical device | Quest frame-time/interaction evidence |
| `HUMAN_OBSERVED` | Exploratory human-use evidence, not necessarily a frozen experiment | repeated UX sessions identifying friction |
| `EXPERIMENTALLY_SUPPORTED` | Pre-specified or otherwise rigorous empirical study supports the claim | controlled comparison showing improved task outcome |
| `REPLICATED` | Independent or multi-study evidence supports generalisation | repeated study across datasets/user groups/labs |

A stronger class may subsume weaker implementation evidence, but the manuscript must never silently promote a claim. In particular:

- green CI is not evidence of human benefit;
- a successful demo is not evidence of scientific discovery improvement;
- user acceptance is not automatically Moneta ground truth;
- product telemetry is not a substitute for formal study outcomes;
- browser/IWER evidence is not physical-headset evidence;
- a model score labelled `confidence` is not calibrated statistical confidence unless the calibration claim is actually supported.

## Claim provenance

For empirical or system claims intended for publication, preserve enough information to reconstruct the evidence:

```text
manuscript claim
  -> repository commit / release
  -> dataset + immutable dataset revision
  -> kernel / algorithm / schema version
  -> representation ontology / Moneta / perception model identity as applicable
  -> protocol / test / study identifier
  -> raw evidence or governed derived evidence
  -> analysis code + result
```

`.nemosyne` investigation provenance and the product/research freeze mechanisms are useful infrastructure for this, but they do not remove the need for conventional research records.

## Authorship and AI-assisted development

Nemosyne has been developed with substantial AI-agent assistance. Papers should describe AI-assisted engineering where it materially affected methods, implementation or reproducibility, following the policy of the target venue at submission time. AI systems are tools, not authors. Human authors remain responsible for claims, literature review, methods, data, analysis, writing integrity and disclosure.

## Publication workflow

1. Define one primary research question and contribution bundle.
2. Map every proposed claim to its current evidence class.
3. Conduct a focused related-work review before fixing novelty language.
4. Decide whether the paper is exploratory/design/systems work or makes empirical outcome claims.
5. Collect only the evidence needed for those claims, including negative/null evidence.
6. Freeze the relevant system/data/model/protocol identities before confirmatory evaluation.
7. Draft the paper from the evidence ledger rather than from product marketing language.
8. Run an adversarial paper review: novelty, attribution, claim strength, statistical validity, alternative explanations, reproducibility and limitations.
9. Check the target venue's current originality, preprint, anonymisation, human-subject, GenAI and artifact policies before submission.

## Immediate priority

Paper 1 should be an exploratory introduction to Nemosyne's core principles and research agenda. It should establish the intellectual architecture and the falsifiable questions that later papers test. It should **not** claim that Nemosyne already improves scientific discovery in humans; that is a later empirical question.
