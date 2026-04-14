## Release v1.2.1

**Architecture Consolidation & Documentation Compliance**

### What's New

#### Phase 5.5: Architecture Consolidation ✅
- Consolidated framework source into main codebase (`src/framework/`)
- Single source of truth for `nemosyne-artefact-v2` component
- Fixed webpack build compatibility (CDN → npm imports)
- Fixed ESLint config for ES modules

#### Documentation Compliance
- Verified all README quickstart examples work
- All documented APIs are exported and functional
- Added `calculatePositions()` to framework LayoutEngine

### API Verification
| Feature | Status |
|---------|--------|
| `nemosyne-artefact-v2` component | ✅ Working |
| `import * as Nemosyne from 'nemosyne'` | ✅ Working |
| `nemosyne init/serve/build/validate/template` | ✅ Working |
| WebSocketDataSource | ✅ Working |
| TransformDSL | ✅ Working |
| LayoutEngine.calculatePositions() | ✅ Working |

### Build Status
- **Tests:** 484 passing (13 suites)
- **Coverage:** 83.5% statements
- **Build:** All bundles successful
- **CDN:** `unpkg.com/nemosyne@1.2.1/dist/nemosyne.iife.js`

### Commits
- Framework consolidation
- Build system fixes
- Documentation compliance verification
- v1.2.1 release
