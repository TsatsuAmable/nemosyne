# Nemosyne Build System

## Quick Build

```bash
# Development build (with source maps)
npm run build

# Production build (minified)
npm run build:prod

# Watch mode for development
npm run dev
```

## Output Files

After building, the `dist/` directory contains:

| File | Format | Description |
|------|--------|-------------|
| `nemosyne.es.js` | ES Module | For modern bundlers (Webpack, Rollup, Vite) |
| `nemosyne.umd.js` | UMD | For Node.js and older bundlers |
| `nemosyne.iife.js` | IIFE | For direct browser `<script>` tags |
| `nemosyne.min.*.js` | Minified | Smaller size for production |
| `*.map` | Source Maps | For debugging |

## CDN Usage

```html
<!-- Development -->
<script src="https://cdn.jsdelivr.net/npm/nemosyne@0.2.0/dist/nemosyne.iife.js"></script>

<!-- Production (minified) -->
<script src="https://cdn.jsdelivr.net/npm/nemosyne@0.2.0/dist/nemosyne.min.iife.js"></script>
```

## Build Scripts

### `npm run build`
Standard production build with all formats.

### `npm run build:analyze`
Build with bundle size analyzer.

### `npm run release`
Prepares a full release package including:
- Built distribution files
- README, LICENSE, CHANGELOG
- Versioned archive for GitHub

## Development

```bash
# Install dependencies
npm install

# Start dev server with hot reload
npm run dev

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format
```
