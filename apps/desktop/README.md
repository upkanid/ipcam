# IPCam Upkan — Desktop

Electron app that receives the WebRTC stream from your phone and exposes it as a virtual camera.

## Development

**Requirements:** Node ≥ 22, npm ≥ 10

```bash
# From repo root
npm install

# Run desktop only (renderer on localhost:5174)
npm run dev:desktop

# Or from this directory
npm run dev
```

## Build

```bash
# Compile (electron-vite)
npm run build:desktop

# Package installer (electron-builder)
npm run dist -w apps/desktop
```

Output goes to `apps/desktop/dist/`:

| Platform | File |
|---|---|
| Windows | `*Setup*.exe` (NSIS) |
| macOS | `*.dmg` |
| Linux | `*.AppImage` |

## Stack

| | |
|---|---|
| Runtime | Electron 31 |
| Renderer | React 18, Vite (electron-vite) |
| Streaming | WebRTC via renderer |
| Virtual cam | OS-level (OBS Virtual Camera / v4l2loopback) |
| Packaging | electron-builder |

## Release

Releases are built automatically by the `Build Desktop` GitHub Actions workflow on every `v*` tag push, producing artifacts for Windows, macOS, and Linux. A GitHub Release is then created with all three installers attached.

To trigger manually, use **workflow_dispatch** from the Actions tab.
