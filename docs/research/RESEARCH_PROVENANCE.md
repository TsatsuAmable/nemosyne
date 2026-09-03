# Research Provenance & Attribution

**Status:** initial audit and policy.  
**Tracking:** #648.  
**Scope of this pass:** scholarly/design provenance visible in the repository and seed literature needed for the first Nemosyne papers. This is **not yet** a complete legal audit of every dependency, asset, dataset, shader, font or historical snippet.

## 1. Three different things must not be conflated

### 1.1 Scholarly influence

A paper, theory, system or empirical result influenced Nemosyne's framing, design or research questions.

**Action:** cite it in research documentation and papers, and state what it informed. Conceptual influence does not by itself mean Nemosyne contains copyrighted source material from that work.

### 1.2 Third-party incorporated material

Nemosyne distributes or adapts source code, assets, datasets, text, models, icons, textures, fonts or other copyrightable material from another project.

**Action:** preserve the applicable licence, copyright and notice requirements and record the exact incorporated material. This belongs in a separate third-party-notice audit as well as in scholarly citations when academically relevant.

### 1.3 Independent or convergent design

Nemosyne reaches a similar idea independently, or uses a broad technique that is common in the field.

**Action:** do not invent a dependency. Cite related work when it is relevant to novelty/context, but do not describe independent work as copied or derived without evidence.

## 2. Repository evidence already requiring stronger academic attribution

`docs/archive/GAME_UI_INSPIRATION.md` explicitly states that Nemosyne's production-polish work "deliberately borrows patterns" from VR games and immersive-analytics research, and maps those patterns to concrete implementation locations. The document already lists sources but mostly as titles/URLs rather than full scholarly references.

The strongest academic example is:

### DashSpace

**Citation:** Marcel Borowski, Peter W. S. Butcher, Janus Bager Kristensen, Jonas Oxenboll Petersen, Panagiotis D. Ritsos, Clemens N. Klokmose, and Niklas Elmqvist. *DashSpace: A Live Collaborative Platform for Immersive and Ubiquitous Analytics.* IEEE Transactions on Visualization and Computer Graphics 31(10), 7034–7047, 2025. DOI: `10.1109/TVCG.2025.3537679`.

**Nemosyne provenance:** the archived inspiration document lists DashSpace among sources used while adopting immersive UI patterns.

**Current incorporation finding:** this first-pass repository search found the DashSpace reference but did not find evidence that Nemosyne incorporates DashSpace source code, Optomancy, or Vega-Lite implementation material. Treat this as **scholarly/design influence** unless a later code-history/material audit finds otherwise.

### 3D gestural interaction for immersive analytics

**Citation:** Nico Reski, Aris Alissandrakis, and Andreas Kerren. *Designing a 3D gestural interface to support user interaction with time-oriented data as immersive 3D radar charts.* Virtual Reality 28, Article 30, 2024. DOI: `10.1007/s10055-023-00913-w`.

**Nemosyne provenance:** the predecessor/preprint was already named as *3D Gestural Radar Chart* in the UI inspiration sources. This work is directly relevant to Nemosyne's hand/gesture interaction design, gesture-intent ambiguity, comfort and empirical evaluation strategy.

**Current incorporation finding:** scholarly/design influence. No copied implementation has been established by this pass.

### RÉCITKIT

**Citation:** Vidya Setlur and Samuel Ridet. *RÉCITKIT: A Spatial Toolkit for Designing and Evaluating Human-Centered Immersive Data Narratives.* arXiv:2508.18670, 2025.

**Nemosyne provenance:** cited in the archived UI inspiration document as an immersive-data-narrative reference.

**Current incorporation finding:** scholarly/design influence. No copied implementation has been established by this pass.

## 3. Foundational immersive-analytics literature that should frame Paper 1

These are not necessarily sources from which a particular Nemosyne line of code was derived. They are prior work that defines the field Nemosyne enters and therefore belongs in a credible related-work section.

### Immersive Analytics: An Introduction

Tim Dwyer, Kim Marriott, Tobias Isenberg, Karsten Klein, Nathalie Riche, Falk Schreiber, Wolfgang Stuerzlinger, and Bruce H. Thomas. *Immersive Analytics: An Introduction.* In **Immersive Analytics**, LNCS 11190, pp. 1–23, Springer, 2018. DOI: `10.1007/978-3-030-01388-2_1`.

**Relevance to Nemosyne:** establishes immersive analytics as removal/reduction of barriers between people, data and analytical tools; provides the broader historical and research context for using immersive environments for analysis rather than treating VR as presentation novelty.

### Immersive Analytics: Theory and Research Agenda

Richard Skarbez, Nicholas F. Polys, J. Todd Ogle, Chris North, and Doug A. Bowman. *Immersive Analytics: Theory and Research Agenda.* Frontiers in Robotics and AI 6:82, 2019. DOI: `10.3389/frobt.2019.00082`.

**Relevance to Nemosyne:** frames immersive analytics around analysis, decision making, sensemaking and knowledge generation, and provides a useful baseline against which Nemosyne's more specific claims about scientific reasoning, provenance and adaptive representation should be distinguished.

## 4. Visual analytics / human-model interaction literature

### Semantic interaction

Alex Endert, Patrick Fiaux, and Chris North. *Semantic Interaction for Visual Text Analytics.* Proceedings of CHI 2012, pp. 473–482. DOI: `10.1145/2207676.2207741`.

Related work by Endert and collaborators develops semantic interaction as a way of coupling human analytical reasoning to computational models through interactions expressed in the domain's visual metaphor.

**Relevance to Nemosyne:** Nemosyne's `physical input -> perception -> InteractionIntent -> NIL -> semantic operation` principle shares the broad aim of preserving analyst meaning across interaction and computation. Nemosyne must explain both the relationship and the difference: NIL is a modality-independent semantic command/provenance boundary for a larger investigation system, not simply a model-steering interaction technique.

## 5. Visualization grammars and representation-recommendation literature

### Vega-Lite

Arvind Satyanarayan, Dominik Moritz, Kanit Wongsuphasawat, and Jeffrey Heer. *Vega-Lite: A Grammar of Interactive Graphics.* IEEE Transactions on Visualization and Computer Graphics 23(1), 341–350, 2017. DOI: `10.1109/TVCG.2016.2599030`.

**Relevance to Nemosyne:** an important precedent for declarative representation grammars and compositional specification. Full Moneta's planned `RepresentationOntology` / `RepresentationGraph` should be positioned relative to visualization grammars while making clear that its intended search objects are governed spatial/perceptual representation hypotheses tied to analytical evidence and investigation intent.

### Draco

Dominik Moritz, Chenglong Wang, Greg L. Nelson, Halden Lin, Adam M. Smith, Bill Howe, and Jeffrey Heer. *Formalizing Visualization Design Knowledge as Constraints: Actionable and Extensible Models in Draco.* IEEE Transactions on Visualization and Computer Graphics 25(1), 438–448, 2019. DOI: `10.1109/TVCG.2018.2865240`.

**Relevance to Nemosyne:** Draco is a major prior system for representing visualization design knowledge as hard/soft constraints and learning preference weights. Nemosyne's original internal recommender was also historically named `Draco`, later renamed **Moneta**. Current Nemosyne explicitly does **not** use Clingo/ASP as the Moneta runtime solver. A paper about Moneta must nevertheless treat Moritz et al. as central related work and carefully distinguish Nemosyne's goals: dataset evidence and measurement constraints, spatial embodiment fitness, explicit abstention, investigation context, provenance and eventual compositional spatial representation search.

**Important attribution note:** the shared historical name alone does not establish code derivation. This audit has not found a repository citation to Moritz et al. in the historical Draco documents. That absence should be corrected in scholarly documentation because of the conceptual/name overlap, while avoiding an unsupported claim that Nemosyne copied Draco's implementation.

### Draco 2

Junran Yang, Péter Ferenc Gyarmati, Zehua Zeng, and Dominik Moritz. *Draco 2: An Extensible Platform to Model Visualization Design.* IEEE VIS Short Papers, 2023. DOI: `10.1109/VIS54172.2023.00042`.

**Relevance to Nemosyne:** contemporary constraint-based visualization design platform and an important baseline/contrast for future Moneta evaluation.

### VizML

Kevin Z. Hu, Michiel A. Bakker, Stephen Li, Tim Kraska, and César A. Hidalgo. *VizML: A Machine Learning Approach to Visualization Recommendation.* CHI 2019. DOI: `10.1145/3290605.3300358`.

**Relevance to Nemosyne:** learned visualization recommendation from large corpora. Moneta's long-term learning problem differs because recommendation acceptance is not sufficient ground truth and because Nemosyne aims to preserve scientific/measurement constraints, held-out user/dataset/task groups, explicit abstention and evidence provenance.

## 6. Product/game design inspirations

The archived UI inspiration document also names design precedents such as Elite Dangerous, No Man's Sky, Half-Life: Alyx, Google VR's Constellation Menu, Starblood Arena, Echo VR, Braid, Photoshop history and others.

These should remain labelled **design inspiration**, not academic evidence. Where Nemosyne uses screenshots, icons, copied text, models, sounds, textures or other protected assets from such products, that would create a separate material/licensing question. This initial audit has not established such incorporation.

The phrase "deliberately borrows patterns" should be replaced in the active research-facing documentation with language such as:

> "Nemosyne's spatial interaction design is informed by prior immersive-analytics research and established VR interaction patterns, with specific influences recorded below."

The archived document may remain unchanged as historical evidence if desired; new canonical research documentation should use the more precise phrasing.

## 7. What Nemosyne should claim as its own only after related-work review

Potential Nemosyne contributions include the **specific synthesis and implementation** of:

- five explicit semantic authority domains: analytical, representation, interaction, discovery and learning;
- analytical-authority-preserving dataset-level semantic embodiment;
- an abstention-first representation decision path rather than fabricated fallback;
- modality-independent `InteractionIntent -> NIL` semantic operations;
- investigation/replay/provenance as product architecture rather than post-hoc logging;
- Product Mode versus freezeable Research Mode;
- Memory Palace as a persistent investigation/evidence graph;
- Moneta's planned transition from bounded candidate ranking to governed `RepresentationOntology` / `RepresentationGraph` compositional search.

These are **candidate novelty statements**, not yet final novelty claims. Before publication each must be compared against the literature in visual analytics, provenance, immersive analytics, visualization recommendation, human-AI interaction and reproducible computational science.

## 8. Required follow-up audit

Before the first archival paper or public research release:

- inspect git history for copied/adapted snippets that current-file search may miss;
- audit non-package assets, fonts, icons, shaders, textures, 3D models and bundled datasets;
- inspect package/dependency licences and generated notices separately from scholarly references;
- map every research-facing design claim to a citation or an explicitly identified Nemosyne-originated principle;
- replace weak title/URL references with stable scholarly metadata (authors, year, venue, DOI/arXiv as appropriate);
- add citations to the active UX/design documents where prior empirical findings are used to justify interaction rules;
- maintain `references.bib` as the machine-readable source used by manuscripts.

## 9. Citation integrity rule

A citation should explain **why the work is relevant**. A long bibliography with no intellectual mapping is not adequate provenance. Conversely, similarity of terminology alone is not evidence of derivation. The research record should be both generous in credit and precise about what actually came from where.
