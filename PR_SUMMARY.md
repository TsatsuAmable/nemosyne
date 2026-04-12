# PR Summary: Research Framework Repositioning

## Branch
`feature/research-framework-positioning`

## Commits
1. `docs: Reposition as research framework — honest about validation needs`
2. `style: Convert research section to CSS classes, remove inline styles`
3. `content: Remove demo links from use cases section`
4. `docs: Rewrite README with honest research positioning`
5. `docs: Reposition wiki docs for research honesty`
6. `docs: Rewrite examples README with honest data disclosures`
7. `docs: Add research preview warnings to API reference`

## Files Changed
- `docs/index.html` — Website repositioned
- `docs/css/styles.css` — CSS classes added (no inline styles)
- `README.md` — Complete rewrite with research framing
- `docs/wiki/Home.md` — Research banner, status table
- `docs/wiki/Getting-Started.md` — Experimental caveats
- `docs/wiki/FAQ.md` — Honest "unknown" answers
- `examples/README.md` — Simulated data disclosures
- `docs/API_REFERENCE_COMPLETE.md` — Experimental warnings
- `docs/REPOSITIONING_SUMMARY.md` — Audit documentation

## Key Changes

### Claims Removed
- "Revolutionary data-native VR framework" → "Experimental research framework"
- "17 visualization components" → "~5 working, efficacy untested"
- "10,000+ nodes @ 30fps" → "Unbenchmarked"
- "Live data integration" → "Simulated data"
- "Automatically builds optimal visualization" → "Heuristic-based, accuracy unknown"

### Claims Added
- Research Preview banners on all entry points
- Implementation vs Validation status tables
- Research Agenda with 7 specific questions
- Call for research collaborators
- Honest "unknown" for unvalidated features

## Testing
- [ ] Review `docs/index.html` in browser
- [ ] Verify all links work
- [ ] Check mobile responsiveness
- [ ] Review wording for tone consistency

## Merge Recommendation
Ready for review. This PR addresses the reputational risk of overstated claims by honestly positioning Nemosyne as research-in-progress.
