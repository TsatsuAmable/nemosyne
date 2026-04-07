# Nemosyne Framework

The core library for creating VR data artefacts in A-Frame.

## Installation

```bash
npm install nemosyne
```

Or via CDN:

```html
<script src="https://cdn.jsdelivr.net/npm/nemosyne@latest/dist/nemosyne.min.js"></script>
```

## Quick Start

```html
<a-scene>
  <nemosyne-artefact 
    src="artefact.json" 
    data="data.json"
    position="0 1.6 0">
  </nemosyne-artefact>
</a-scene>
```

## Architecture

Nemosyne is built on top of [A-Frame](https://aframe.io) and extends it with:

- **Data transforms:** Convert raw data → 3D geometries
- **Artefact system:** Reusable, configurable visual components
- **Behaviour engine:** Interactive responses to user input
- **Scale system:** Data-to-visual mappings (D3.js integration)

## API

- [Components](./src/components/) — A-Frame entity components
- [Transforms](./src/transforms/) — Data processing functions
- [Behaviours](./src/behaviours/) — Interaction handlers
- [Utils](./src/utils/) — Helper functions

## Development

```bash
npm install
npm run dev      # Development server
npm run build    # Production build
npm run test     # Run test suite
```

## License

MIT
