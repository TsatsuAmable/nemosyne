# Nemosyne Wiki

Welcome to the Nemosyne documentation hub.

## Quick Links

- [Getting Started](./tutorials/Getting-Started.md)
- [API Reference](./api/)
- [Example Gallery](./examples/)
- [Artefact Catalog](./artefacts/)

## What's Nemosyne?

Nemosyne is a JavaScript framework for creating **VR data visualizations**. It transforms your real-world data into interactive, manipulable 3D artefacts that can be explored in virtual reality.

## Core Concepts

1. **Artefacts** — 3D objects that represent your data
2. **Topologies** — How data is structured (networks, hierarchies, time-series, etc.)
3. **Behaviours** — How artefacts respond to interaction
4. **Transforms** — Converting data values into visual properties

## Hello World Example

```html
<a-scene>
  <nemosyne-artefact 
    src="crystal-artefact.json"
    data="{ value: 42 }">
  </nemosyne-artefact>
</a-scene>
```

## Status

🚧 **Early Development** — APIs subject to change. Check back for updates!

---

## Contributing

See the main repository for contribution guidelines.
