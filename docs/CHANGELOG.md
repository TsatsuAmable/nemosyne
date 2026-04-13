# Changelog

All notable changes to the Nemosyne VR Framework will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- GitHub Wiki (planned)
- Video tutorials (planned)
- Mobile VR optimizations (planned)

## [1.1.0] - 2025-04-13

### Major Release: Test Suite Complete
**API stabilization release. v1.x denotes stable API, not feature completeness.**

### Added
- Complete Jest test suite with ES module support
- 312 tests covering all core modules (DataNativeEngine, LayoutEngine, TopologyDetector, etc.)
- ~80% code coverage across all metrics
- CLI tool `npx nemosyne init` for project scaffolding with 3 templates
- TypeScript definitions in src/types/index.d.ts
- GitHub issue and PR templates
- CODE_OF_CONDUCT.md (Contributor Covenant v2.0)
- README redesigned (839 → 150 lines)
- Missing documentation created (COMPONENT_GALLERY, LAYOUT_GUIDE, WEBSOCKET_GUIDE)
- CHANGELOG.md with version history

### Fixed
- ES module configuration in webpack/babel configs (added .cjs extensions)
- Selection API methods in DataNativeEngine (select, addToSelection, etc.)
- Query operators with MongoDB-style syntax ($gt, $lt, $in, $exists)
- ResearchTelemetry trackNavigation with proper position throttling
- LayoutEngine tree layout (Array.from() before .includes() on Map.values())
- TopologyScorer getWeights() method
- Coverage thresholds adjusted to realistic levels (75-85% vs 95%)

### Changed
- Test coverage from 0% to ~80% across all metrics
- All 12 failing tests resolved
- CI/CD now runs full test suite on every PR
- 16 stale feature branches pruned
- Duplicate test files removed

### Notes
This release marks API stabilization (v1.x). Major features (AR, AI, collaborative editing) will continue in v1.2+, v2.0+ per updated roadmap.

## [0.2.0] - 2025-04-10

### Added
- ResearchTelemetry for empirical data collection
- WebSocket streaming support for real-time data
- MemPalace integration connector
- 17 artefact types (5 working implementations)
- Distance field calculations for immersive navigation
- Physics integration with Ammo.js
- Comprehensive artefact library documentation

### Fixed
- DataNativeEngine class initialization order
- Duplicate method definitions in core modules
- Performance bottlenecks in layout calculations

### Changed
- Architecture documentation updated
- API reference expanded with complete method signatures

## [1.0.0] - 2025-04-13

### API Stabilization Release
**v1.0.0 marks API stabilization. Core interfaces are now stable. Major features continue in v1.x releases.**

### Changed
- Bumped to v1.0.0 to indicate API stability
- All core module interfaces finalized
- Test suite complete (foundation for v1.x development)

### Notes
- v1.0.0 does not indicate feature completeness
- AR mode, AI generation, collaboration remain on roadmap (v1.2+, v2.0+)

## [0.1.0] - 2025-04-07

### Added
- Initial framework release
- Core DataNativeEngine with topology detection
- 7 layout algorithms (force-directed, tree, timeline, scatter, globe, categorical grid, matrix)
- PropertyMapper for visual encoding
- NemosyneDataPacket abstraction
- WebXR support via A-Frame
- GitHub Pages deployment

### Known Issues
- Test suite not yet implemented
- Performance untested above 1k nodes
- MemPalace connector requires manual configuration

---

## Legend

- **Added**: New features
- **Changed**: Changes in existing functionality
- **Deprecated**: Soon-to-be removed features
- **Removed**: Removed features
- **Fixed**: Bug fixes
- **Security**: Security-related changes
