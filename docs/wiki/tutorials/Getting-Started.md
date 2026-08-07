# Getting Started with Nemosyne

This guide will walk you through running Nemosyne locally and loading your first dataset.

## Prerequisites

- Node.js 20+
- A modern web browser (Chrome, Firefox, Edge)
- Optional: a VR headset (Meta Quest 3/3S) for the full experience
- Optional: OpenSSL for generating local HTTPS certificates

## Installation

```bash
# Clone the repository
git clone https://github.com/TsatsuAmable/nemosyne.git
cd nemosyne

# Install dependencies
npm install
```

## Generate HTTPS certificates

WebXR requires a secure origin. The Vite dev server will use certificates from the `certs/` folder if present.

### macOS / Linux / Git Bash

```bash
mkdir certs
openssl req -x509 -newkey rsa:2048 -keyout certs/key.pem -out certs/cert.pem -subj /CN=localhost -nodes
```

### Windows (Git Bash)

Same command as above, run from Git Bash.

## Start the dev server

```bash
npm run dev
```

Vite 8 enables HTTPS automatically when `certs/key.pem` and `certs/cert.pem` are found.

Open `https://YOUR-IP:5173` in Meta Quest Browser, or use ADB port forwarding and open `https://localhost:5173`.

## Load your first dataset

1. Launch the app.
2. Use the file loader panel to upload a CSV or JSON file, or pick a built-in sample dataset.
3. The Draco recommender will choose a layout and geometry automatically.
4. Use hand gestures or the wheel menu to filter, aggregate, sort, or cluster the data.

## Desktop fallback

If you don't have a headset, the app also works with mouse and keyboard:

- **Mouse** — look around and click to select.
- **WASD / Arrow keys** — move.
- **M** — toggle wheel menu.
- **F** — filter.
- **A** — aggregate.
- **S** — sort.
- **Ctrl+Z / Ctrl+Y** — undo / redo.
- **P** — open settings.

## Next Steps

- [Learn about Artefacts](../../ARTEFACTS.md)
- [Read the Roadmap](../../ROADMAP.md)
- [Explore the Architecture](../../ARCHITECTURE.md)

## Troubleshooting

### The page doesn't load in Quest Browser

- Make sure you are using `https://`.
- Check that the certificate files exist in `certs/`.
- Verify the computer and headset are on the same network.

### Controls don't work

- Click on the canvas first to focus it.
- Ensure hand tracking or controllers are enabled in your VR system settings.

---

*Tutorial version 1.0.0-alpha.1*
