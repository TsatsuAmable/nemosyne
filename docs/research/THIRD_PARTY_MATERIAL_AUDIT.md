# Third-Party Material Audit

**Status:** initial audit framework.  
**Tracking:** #648.  
**Purpose:** separate copyright/licence provenance from scholarly related-work citation.

This document is an engineering/research provenance record, not a legal opinion. It records what has been checked, what is known, and what remains to be audited before an archival paper, research artifact release or broader distribution claim.

## 1. Audit rule

For each external source, answer two independent questions:

1. **Did the work materially inform Nemosyne's ideas or design?**  
   If yes, record scholarly/design attribution in `RESEARCH_PROVENANCE.md` and manuscripts.

2. **Does Nemosyne actually distribute or adapt material from that source?**  
   If yes, record the exact material, source, version/commit, licence, copyright notice and required attribution/redistribution terms here or in a root-level `THIRD_PARTY_NOTICES.md` created from the completed audit.

A `yes` to the first question does not imply a `yes` to the second.

## 2. Initial findings from the named academic sources

| Source | Scholarly/design influence | Evidence of incorporated code/assets in initial search | Disposition |
|---|---|---|---|
| DashSpace (Borowski et al., 2025) | Yes: explicitly listed in archived UI inspiration sources | None found in first-pass current-tree search; no `Optomancy` or Vega-Lite implementation dependency found from this source | Cite academically; keep material audit open until history/assets scan |
| Reski, Alissandrakis & Kerren gestural IA work | Yes: predecessor/preprint listed in UI inspiration sources | None established | Cite academically; no licence notice currently inferred |
| RÉCITKIT (Setlur & Ridet) | Yes: listed in UI inspiration sources | None established | Cite academically; no licence notice currently inferred |
| Draco / Draco 2 | Strong related-work relevance; historical Nemosyne recommender also used the name `Draco` before becoming Moneta | No evidence established that Nemosyne embeds the Draco/Draco 2 codebase or Clingo/ASP solver; current roadmap explicitly excludes Clingo/ASP as Moneta runtime solver | Add scholarly citation/contrast; do not claim code derivation without evidence |
| Vega-Lite | Foundational related work for representation grammars | No current evidence established that Nemosyne embeds Vega-Lite itself | Cite where relevant to grammar/composition discussion |
| VizML | Related work for learned visualization recommendation | No incorporated implementation established | Cite in Moneta-related work |
| Semantic Interaction (Endert et al.) | Related conceptual lineage for coupling interaction to analytical meaning | No incorporated implementation established | Cite/contrast in NIL interaction discussion |

## 3. Design inspirations named in repository history

`docs/archive/GAME_UI_INSPIRATION.md` names commercial products and toolkits including Elite Dangerous, No Man's Sky, Half-Life: Alyx, Starblood Arena, Echo VR, Braid, Photoshop and Google VR interaction examples.

Current interpretation:

- **interaction pattern inspiration:** expected and should be acknowledged when materially relevant;
- **copyrighted game assets/code:** not established by this audit;
- **trademark/product names:** use descriptively when discussing related design precedent;
- **screenshots or marketing images in future papers:** require a separate publication-permission/fair-use analysis according to venue policy. Prefer original Nemosyne figures unless a comparison genuinely requires third-party imagery.

## 4. Repository areas still requiring material-level inspection

Before closing the audit, inspect at least:

### Source/code

- copied or adapted source snippets not represented as package dependencies;
- vendored libraries;
- shaders copied/adapted from examples/tutorials;
- generated code carrying upstream notices;
- historical files that may have been removed from current main but influenced surviving implementation.

### Visual/media assets

- icons;
- fonts;
- textures;
- 3D meshes/models;
- audio/haptic assets;
- screenshots;
- diagrams derived from external publications;
- demo data bundled into the product.

### Datasets/models

- public datasets and their redistribution conditions;
- pretrained model artifacts;
- synthetic/reference corpora with upstream source requirements;
- `nemosyne-data` catalogue licences and per-dataset provenance.

### Package ecosystem

- npm package licence inventory;
- Rust crate licence inventory;
- build-time versus distributed dependency distinction;
- incompatible/copyleft or notice-bearing dependencies;
- generated browser bundles and whether notices must accompany distribution.

Package licence scanning is a separate supply-chain task; the existence of Nemosyne's MIT root licence does not overwrite dependency licences.

## 5. Research artifact publication checks

Before releasing a paper artifact bundle:

- include only datasets whose redistribution terms permit it;
- strip secrets, user data and consent-restricted learning corpora;
- preserve required third-party notices;
- verify whether figures contain third-party screenshots or artwork;
- ensure example `.nemosyne` packages contain redistributable data;
- identify model licences and weights separately from source-code licences;
- document exact third-party versions/commits used in experiments.

## 6. Current conclusion

The current evidence supports a need for **better academic attribution**, particularly for immersive-analytics and representation-recommendation prior work. This first pass has **not identified a specific licence breach or copied implementation from the academics currently under discussion**.

That conclusion is deliberately narrow. It should not be promoted to "the repository contains no third-party material issues" until the code-history, asset, dataset and dependency audits above are complete.

## 7. Closure output

When the audit is complete, decide whether Nemosyne needs a root-level `THIRD_PARTY_NOTICES.md` for distributed material. If the answer is yes, generate it from verified sources and licence texts rather than from memory or inferred attribution.
