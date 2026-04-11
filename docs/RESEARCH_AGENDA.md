This is a good question to dig into carefully, because the project sits at the intersection of several distinct research traditions that don't often talk to each other. Let me work through the areas where genuine research contribution is possible.

---

## Theoretical Research Agenda for Nemosyne

### 1. The Fundamental Empirical Question: Does Spatial Encoding Actually Help?

Before anything else, this project needs to answer a question it currently assumes away: **does embodied, navigable 3D space produce better data comprehension than 2D alternatives, and if so, for which task types?**

The existing literature is genuinely mixed. Work by Cockburn & McKenzie (2002) found that 3D file system navigation offered no significant benefit over 2D for retrieval tasks. Conversely, research on scientific visualization — molecular dynamics, astronomical datasets, neuroimaging — consistently shows spatial navigation advantages for tasks involving *relational topology* rather than *value comparison*. The theoretical distinction that needs formalising is:

- **Value-reading tasks** (what is the revenue in Q3?) — 2D almost certainly wins
- **Topology-reading tasks** (which node is the bridge between these two clusters?) — 3D may win
- **Temporal-trajectory tasks** (how did this network evolve?) — embodied navigation through the Z-axis may offer genuine advantages

Nemosyne needs a *task taxonomy* grounded in this distinction. Without it, the claim that "VR unlocks new ways of understanding complex systems" is marketing, not science.

---

### 2. Formalising the Datumplane Semantics

The X/Y/Z axis assignment (relationships, hierarchy, time) is the most intellectually interesting thing in the project, but it's stated as a design choice without theoretical grounding. There are two research directions worth pursuing here:

**Semantic spatial mapping theory.** There's a body of work in cognitive linguistics on *conceptual metaphor* (Lakoff & Johnson) where we understand abstract concepts through spatial primitives — more is up, time moves forward, importance is central. The Datumplane's axis assignments could be grounded in and tested against this literature. Are the chosen mappings actually congruent with human spatial intuition, or are they arbitrary? A psychophysics experiment — presenting the same dataset in multiple axis configurations and measuring comprehension speed and accuracy — would be publishable and directly useful.

**Axis conflict and overloading.** Real data doesn't arrive cleanly partitioned into relational, hierarchical, and temporal dimensions. A social network with timestamps and group membership already has all three simultaneously. The framework needs a formal theory of *axis priority* and *dimension projection* — how do you decide what goes where when the data resists the schema? This connects to dimensionality reduction literature (t-SNE, UMAP) but the problem is distinct because legibility and navigability constraints matter alongside mathematical optimality.

---

### 3. Topology Detection as a Research Problem

The `TopologyDetector` is currently a heuristic classifier. Making it principled requires engaging with **graph topology inference** literature. Specifically:

The project should distinguish between *schema-level* detection (does this JSON have a `parent` field? does it have `lat`/`lng`?) and *structural-level* detection (does the underlying relational structure exhibit scale-free degree distribution, suggesting a network layout? does the value distribution suggest a continuous field rather than discrete categories?). The former is what the code currently does. The latter is a genuine unsolved problem in automated visualization recommendation.

The closest existing work is the **Draco** system (Moritz et al., 2019) from UW's Interactive Data Lab, which uses constraint programming and a learned cost model to recommend 2D visualization designs. Extending that approach to 3D/VR — with the additional degrees of freedom that entails — is a tractable and publishable research contribution. The key challenge is that the 3D design space is vastly larger and evaluation metrics (legibility, navigability, presence) are harder to operationalise than 2D perceptual accuracy.

---

### 4. Embodied Interaction and the "Memory Palace" Hypothesis

The project references the *method of loci* (memory palace technique) as implicit inspiration — encoding information spatially so that navigation through space triggers recall. This is actually a serious and underexplored application of spatial computing.

The empirical question: **does encoding information in a self-constructed, navigable VR space improve recall compared to list-based or map-based 2D representations?** There's evidence from the cognitive science literature that *self-generated* spatial contexts produce stronger encoding than experimenter-imposed ones (due to the generation effect and contextual reinstatement theory). But the interaction design implications for a VR data tool are largely unexplored.

Research directions here include:
- Does *physically navigating* to a data point (teleporting or walking in VR) produce stronger associative memory than clicking to it?
- Does the *semantic consistency* of the spatial encoding (the Datumplane's principled axis assignments) outperform arbitrary spatial placement for later recall?
- What's the role of *proprioceptive feedback* — the felt sense of body position — in anchoring data memory?

This is the strongest case for VR over 2D dashboard that the project doesn't yet articulate.

---

### 5. Multi-User Shared Reference Frame Problem

Nemosyne lists collaborative multi-user VR as a roadmap item. This surfaces a largely unsolved research problem: **when multiple users navigate the same data space simultaneously, how do shared reference frames and private viewpoints interact?**

In 2D collaborative tools (Figma, Miro), everyone sees the same canvas with different cursors. In VR, users have embodied positions and orientations — two users can be looking at the same node from opposite sides and literally have inverted spatial reference frames. For a data visualization context this matters a lot: if I point at a cluster and say "look at this," my collaborator may be oriented such that "this" is in completely the opposite direction from their perspective.

The research agenda here draws on **shared space** and **mutual awareness** theories in CSCW literature, but the specific problem of *coordinated spatial reference* in data-dense VR environments is novel. Potential interventions to study: shared "camera" modes, spatial annotation anchored to data objects rather than world coordinates, automatic orientation normalisation when users enter a shared view.

---

### 6. Perceptual Limits of 3D Data Density

The performance claims (10,000+ nodes at 30fps) treat this as a rendering problem. But it's also a *perceptual* problem — at what point does node density in 3D space cause the visualization to become illegible regardless of frame rate?

In 2D, there's substantial psychophysics work on clutter, visual search, and preattentive processing (Ware's *Information Visualization: Perception for Design* is foundational). The 3D analogue is much less developed. Key open questions:

- What is the effective "field of relevant perception" in a VR data space — how far from the user's gaze does data remain meaningfully comprehensible?
- How does *depth* function as a data channel? Unlike X and Y, depth is subject to perspective distortion, stereoscopic ambiguity, and vergence-accommodation conflict. Using Z as a data dimension (as the Datumplane does for time) needs to be empirically validated as perceptually reliable.
- What interaction patterns compensate for the reduced discriminability of depth as a channel — and can the framework surface them automatically when data density crosses a threshold?

---

### 7. The "Artefact" as a Unit of Abstraction — Semiotics and Design Theory

Finally, there's a more philosophical research thread worth pulling. The project's vocabulary — "artefacts," "crystals," the Datumplane, the Shrike — is doing real conceptual work, distinguishing this from "just a chart in 3D." But the ontology is currently intuitive rather than rigorous.

Drawing on **semiotics** (Peirce's icon/index/symbol distinction) and **affordance theory** (Gibson, Norman): what kind of sign is a data crystal? It's meant to be both *iconic* (its shape resembles its data structure in some way) and *indexical* (its colour/scale directly reflects a data value). But the conditions under which an arbitrary shape reads as meaningfully iconic rather than arbitrary are not well understood in a VR context where users can approach from any angle.

More concretely: when is a 3D form a better encoding than a colour channel or a label? The answer likely depends on the viewing angle distribution across users, the dimensionality of the data being encoded, and the precision required for the task. This connects to the broader unsolved question of **how to design 3D glyphs** for multivariate data — a problem that scientific visualization has wrestled with for decades and hasn't fully resolved.

---

### The Through-Line

All of these threads share a common structure: Nemosyne makes design choices that are *reasonable intuitions* but *unvalidated empirically and untethered theoretically*. The research agenda is essentially to build the scientific foundation under the intuitions — task taxonomies, axis semantic experiments, topology detection grounding, perceptual density limits, and embodied memory studies. Any two or three of these would constitute a genuine contribution to the HCI and information visualization literature, and would also make the framework substantially more defensible as an engineering artifact.

The project has a good aesthetic sense and a clear philosophical direction. What it needs is the discipline to test whether the philosophy actually holds when humans sit down and try to use it.
