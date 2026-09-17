# Prior Art & Intellectual Provenance Index

**Status:** canonical attribution index, initial repository-wide audit pass  
**Date:** 17 September 2026  
**Machine-readable bibliography:** `docs/research/references.bib`

## Rule

Nemosyne credits prior work at the point where it materially informs an implemented technique, scientific rule, architecture, interaction pattern, benchmark, or research claim. Attribution must say what the source informed. A citation is not a claim of copied code, and conceptual similarity is not evidence of derivation.

Use three labels:

- **ADOPTED/ADAPTED:** an implementation or rule deliberately uses a technique from prior work. Cite near the implementation and in this index.
- **INFORMED BY / RELATED PRIOR ART:** the work materially shaped design or evaluation, but Nemosyne is not claiming implementation derivation.
- **CONTEXT ONLY:** important related work for novelty/positioning, not an implementation source.

Third-party code/assets remain a separate licensing and notices obligation. See `RESEARCH_PROVENANCE.md`.

## Audited mappings

| Nemosyne surface | Attribution status | Prior art | What is used / relationship |
| --- | --- | --- | --- |
| `src/moneta/ConstraintEngine.ts`, Rust Moneta constraints | INFORMED BY / RELATED PRIOR ART | Moritz et al., 2019, Draco, DOI `10.1109/TVCG.2018.2865240`; Yang et al., 2023, Draco 2, DOI `10.1109/VIS54172.2023.00042` | Hard/soft constraint representation and weighted visualization recommendation are central prior art. Nemosyne's solver/authority/evidence architecture is not claimed to be Draco source-code derivation. |
| `dev/xr-lab/MonetaEvidenceProtocol.ts` compositional guard | INFORMED BY | Aitchison, 1982, DOI `10.1111/j.2517-6161.1982.tb01195.x` | Compositions live on a simplex and raw Euclidean treatment can be scientifically inappropriate; Moneta therefore makes compositional handling explicit and may refuse unsupported semantics. |
| `wasm/src/layouts/force_directed.rs` | RELATED PRIOR ART | Fruchterman & Reingold, 1991, DOI `10.1002/spe.4380211102` | Repulsive-node / attractive-edge force-directed graph layout family. Nemosyne uses a custom deterministic 3D variant and does not claim to implement the paper verbatim. |
| immersive analytics product framing | CONTEXT / INFORMED BY | Dwyer et al., 2018, DOI `10.1007/978-3-030-01388-2_1`; Skarbez et al., 2019, DOI `10.3389/frobt.2019.00082` | Field framing for immersive analysis and sensemaking. |
| spatial/gesture UI research | INFORMED BY | Reski et al., 2024, DOI `10.1007/s10055-023-00913-w`; Borowski et al., 2025, DOI `10.1109/TVCG.2025.3537679`; Setlur & Ridet, 2025, arXiv `2508.18670` | Immersive gestural interaction, collaborative immersive analytics, and spatial narrative design informed UX research. |
| NIL / semantic interaction boundary | RELATED PRIOR ART | Endert, Fiaux & North, 2012, DOI `10.1145/2207676.2207741` | Semantic interaction is an important predecessor for preserving analyst meaning across visual interaction and computation; NIL is a broader modality-independent command/provenance boundary. |
| future representation ontology / grammar | RELATED PRIOR ART | Satyanarayan et al., 2017, Vega-Lite, DOI `10.1109/TVCG.2016.2599030` | Declarative/compositional visualization grammar precedent. |
| learned representation recommendation | RELATED PRIOR ART | Hu et al., 2019, VizML, DOI `10.1145/3290605.3300358` | Learned visualization recommendation baseline; Moneta additionally governs scientific admissibility, abstention, provenance and investigation context. |
| effective-feature authority research | INFORMED BY / SCIENTIFIC BOUNDARY | Koltchinskii & Lounici, 2017, DOI `10.3150/15-BEJ730`, plus research recorded in `MONETA_EFFECTIVE_FEATURE_AUTHORITY_20260915.md` | Effective rank is task/model dependent; Nemosyne's current numerical linear-rank diagnostic must not be relabelled as intrinsic dimension or generic high-dimensional admission authority. |

## Initial audit findings

The repository already had a strong seed bibliography and `RESEARCH_PROVENANCE.md`, but attribution was concentrated in research prose rather than attached to implementation sites. `ConstraintEngine` retained the historical Draco conceptual shape without an implementation-near citation; the compositional evidence guard did not name the foundational compositional-data literature; and the force-directed kernel did not identify the graph-drawing family it belongs to.

This pass corrects those high-confidence mappings. It deliberately does **not** spray citations onto every standard algorithm or infer derivation from resemblance. Historical Git archaeology, statistical primitives, layout families, interaction techniques, provenance/replay mechanisms, VR comfort rules, calibration methods, dimensionality-reduction quality measures, and non-code assets remain follow-up audit surfaces.

## Continual attribution procedure

For every future implementation or research PR:

1. Ask whether a technique, algorithm, empirical rule, design pattern, benchmark, scientific threshold, formalism, or architecture was adopted or materially informed by prior work.
2. Prefer the primary paper/specification/standard. Use stable DOI, arXiv identifier, RFC/standard identifier, or canonical project citation.
3. Add or reuse a BibTeX entry in `references.bib` for scholarly work.
4. Put a compact implementation-near comment where the relationship would otherwise be invisible. State `Adopted/adapted from`, `Informed by`, or `Related prior art`; do not overclaim derivation.
5. Add/update the mapping in this index when the influence is architecturally, scientifically, or product-research significant.
6. In the PR's **Prior art / attribution** section, list sources and the exact relationship, or explicitly state that no material external technique was adopted.
7. During adversarial review, challenge missing attribution and also challenge false attribution. Both under-crediting and invented lineage are provenance defects.
8. If code/assets/data were actually incorporated, separately satisfy licence/copyright/NOTICE obligations. Scholarly citation does not discharge licensing requirements.

## Audit backlog

Priority follow-up areas:

- inspect git history for historical Draco/Moneta implementation lineage and copied/adapted snippets;
- map statistical primitives and Moneta evidence rules to primary statistical literature where they are not merely textbook/common operations;
- audit dimensionality-reduction, neighborhood/density/stability metrics and benchmark implementations;
- audit graph, hierarchy, temporal, geospatial, spectral and streamline layout algorithms;
- audit VR interaction/comfort/direct-touch rules against primary HCI/XR evidence and platform specifications;
- audit provenance, replay, content-addressing and cryptographic constructions against relevant standards/prior systems;
- audit non-package assets, shaders, fonts, icons, models, datasets and generated material for licensing provenance;
- audit package/dependency licences separately and maintain required notices.

This index is a living research-provenance artifact, not a claim that the initial audit is exhaustive.