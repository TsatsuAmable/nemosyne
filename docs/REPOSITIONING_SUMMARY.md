# Documentation Repositioning Summary

## Problem
Nemosyne documentation presents the framework as feature-complete when it is actually **engineering-complete but research-naive**.

## Audit Findings

### README.md — Overstated Claims

| Claim | Status | Issue |
|-------|--------|-------|
| "Revolutionary data-native VR visualization framework" | Unvalidated marketing | No empirical evidence |
| "17 visualization components" | Partially implemented | Counts planned vs working |
| "7 layout algorithms" | Implemented but untested | No validation they produce useful outputs |
| "Automatically analyzes your data" | Not validated | Topology detection accuracy unknown |
| "10,000+ nodes @ 30fps" | Unbenchmarked | Performance claim without data |
| "MemPalace Integration" | Partial | Connector exists, utility unproven |
| WebSocket "real-time" features | Implemented | But no studies on latency impact |

### ARCHITECTURE.md
- Presents complete system architecture as implemented
- No caveats about unvalidated assumptions
- Extension points documented as stable (may change after research)

### API_REFERENCE_COMPLETE.md
- Complete API documented as stable
- No warnings about experimental status
- Methods presented as production-ready

## Required Changes

1. **Add prominent research preview banner** to all docs
2. **Change "complete" → "in development"** where appropriate
3. **Add validation status tables** for each major feature
4. **Separate implemented vs planned** features clearly
5. **Add call for collaborators** on empirical studies

## Suggested New README Structure

```markdown
# Nemosyne 🌌

**Research Framework for Immersive Data Visualization**

> ⚠️ **Research Preview**: We're validating whether 3D VR visualizations 
> improve data comprehension. Many features are experimental and need 
> empirical testing.

## Current State

| Component | Implementation | Validation |
|-----------|---------------|------------|
| Core rendering | ✅ Working | ⚠️ Needs UX study |
| Layout algorithms | ✅ 7 implemented | ⚠️ Untested for efficacy |
| Topology detection | 🚧 Partial | ❌ Not started |
| Performance claims | 🚧 Unbenchmarked | ❌ Needs measurement |
```
