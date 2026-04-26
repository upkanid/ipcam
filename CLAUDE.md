# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install all workspace dependencies
pnpm install

# Development
pnpm dev:web          # React Router v7 web app (localhost:5173)
pnpm dev:desktop      # Electron app with HMR

# Build
pnpm build:web
pnpm build:desktop
pnpm --filter desktop dist   # Package Electron app via electron-builder

# Type checking (web only)
pnpm --filter web typecheck  # runs react-router typegen && tsc

# Run a single workspace command
pnpm --filter web <script>
pnpm --filter desktop <script>
```

## Architecture

**Monorepo** (pnpm workspaces) with two apps:

```
apps/web/       — React Router v7, SSR mode, deployed via Docker to Coolify
apps/desktop/   — Electron + React + electron-vite
```

### Core flow

```
Phone browser (apps/web /share)
  └─ getUserMedia → WebRTC offer
       └─ WebSocket to ws://<desktop-ip>:3717  ← signaling server in Electron main
            └─ WebRTC peer-to-peer stream
                 └─ Electron renderer previews stream
                      └─ (future) virtual camera output
```

### apps/web

Two routes:
- `/` (`routes/landing.tsx`) — marketing landing page
- `/share` (`routes/share.tsx`) — phone UI: requests camera permission, connects to Electron signaling server via WebSocket, initiates WebRTC offer

The `/share` page is entirely client-side (no loaders/actions). It manages the WebRTC peer connection lifecycle in React refs to avoid re-render teardown.

### apps/desktop

Three Electron processes, standard `electron-vite` layout:

| Process | File | Responsibility |
|---|---|---|
| Main | `src/main/index.ts` | App lifecycle, IPC handlers, starts signaling server |
| Preload | `src/preload/index.ts` | Context bridge — exposes `window.api.getLocalIP()` |
| Renderer | `src/renderer/src/App.tsx` | React UI: show IP, manage WebRTC receiver, preview video |

**Signaling server** (`src/main/signaling.ts`): plain WebSocket server on port `3717`, binds to `0.0.0.0`. It is a dumb relay — it forwards every message from one peer to all others. No rooms, no auth.

**IPC**: `get-local-ip` handler in main returns the first non-internal IPv4 address. The renderer calls it via `window.api.getLocalIP()` on mount to display the address the phone should connect to.

### Virtual camera (not yet implemented)

The Electron app receives the WebRTC stream in the renderer. To output it as a virtual camera device, a native bridge is needed (e.g. `v4l2loopback` on Linux, OBS Virtual Camera on Windows/Mac). Users must install the driver themselves — the app should detect presence and show instructions if missing.

### Signaling port

Port `3717` is hardcoded in two places: `apps/desktop/src/main/signaling.ts` and the placeholder text in `apps/web/app/routes/share.tsx`. Keep them in sync if changing.

### Deployment (web)

`apps/web/Dockerfile` uses the React Router v7 default template — update it to use `pnpm` instead of `npm` before deploying. The built output is served via `react-router-serve ./build/server/index.js`.
