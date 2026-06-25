# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install all workspace dependencies
npm install

# Development
npm run dev              # Run both apps in parallel (web + desktop)
npm run dev:web          # React Router v7 web app (localhost:5173)
npm run dev:desktop      # Electron app with HMR (renderer on localhost:5174)

# Build
npm run build:web
npm run build:desktop
npm run dist -w desktop  # Package Electron app via electron-builder

# Type checking (web only)
npm run typecheck -w web  # runs react-router typegen && tsc

# Run a single workspace command
npm run <script> -w web
npm run <script> -w desktop
```

## Architecture

**Monorepo** (npm workspaces) with two apps:

```
apps/web/       — React Router v7, SSR mode, deployed via Docker to Coolify  (dev port 5173)
apps/desktop/   — Electron + React + electron-vite                            (renderer dev port 5174)
```

### Two signaling modes

There are two modes that determine how the phone and desktop connect:

| Mode | When | Signaling path |
|---|---|---|
| **Cloud** (default) | `hostUrl` is HTTPS (e.g. `https://ipcam.upkan.id`) | Room-based relay: both peers connect to `wss://<host>/ws?room=<roomId>` on the web server |
| **LAN / dev** | `hostUrl` is HTTP or localhost | Direct: phone → `ws://<desktop-ip>:3717`, desktop renderer → `ws://localhost:3717` |

In **cloud mode**: desktop or phone generates a random `roomId`. Desktop encodes it into a QR code, or the phone generates one automatically upon opening `/share` directly. Both connect to the cloud relay in the same room. The web server (`server.ts`) proxies the WebSocket and routes messages per room.

In **LAN mode**: desktop shows its local IP in the QR URL (`/share?ip=<ip>&port=3717`). The phone connects directly to the desktop's signaling server. No rooms are used.

Opening `/share` directly on HTTPS will automatically generate a random Room ID for cloud connection and display a shareable viewer link.

### Core flow (cloud mode)

```
Phone browser (/share?room=XXXX)
  └─ getUserMedia → WebRTC offer
       └─ wss://ipcam.upkan.id/ws?room=XXXX  ← relay in web server (server.ts)
            └─ wss://ipcam.upkan.id/ws?room=XXXX  ← desktop or web viewer connects here too
                 └─ WebRTC peer-to-peer stream
                      └─ Viewer (/view?room=XXXX) previews stream
```

### apps/web

Four routes:
- `/` (`routes/landing.tsx`) — marketing landing page
- `/share` (`routes/share.tsx`) — phone UI: camera permission, WebRTC offer sender. Auto-generates a random Room ID if opened directly on cloud/HTTPS.
- `/view` (`routes/view.tsx`) — web-based WebRTC receiver/viewer (replaces desktop app for viewing). Accepts `?room=XXXX` (cloud), `?ip=x.x.x.x&port=3717` (LAN), `?obs=1` (OBS Browser Source mode with no chrome, transparent bg, auto-connect). If opened without query params, allows manual entry of Room ID.
- WebSocket at `/ws?room=<id>` — signaling relay (handled in `server.ts`, not a route). `MAX_PEERS_PER_ROOM` is 4 to support sender + desktop + web viewer + OBS simultaneously.

The `/share` and `/view` pages are entirely client-side (no loaders/actions). They manage the WebRTC peer connection lifecycle in React refs to avoid re-render teardown.

### apps/desktop

Three Electron processes, standard `electron-vite` layout:

| Process | File | Responsibility |
|---|---|---|
| Main | `src/main/index.ts` | App lifecycle, IPC handlers, starts LAN signaling server |
| Preload | `src/preload/index.ts` | Context bridge — exposes `window.api` |
| Renderer | `src/renderer/src/App.tsx` | React UI: QR code, WebRTC receiver, video preview, virtual cam controls |

**LAN signaling server** (`src/main/signaling.ts`): plain WebSocket server on port `3717`, binds to `0.0.0.0`. Dumb broadcast relay — forwards every message from one peer to all others. Used only in LAN mode; cloud mode uses the web server relay instead.

**IPC**: `get-local-ip` handler in main returns the first non-internal IPv4 address. Renderer calls it via `window.api.getLocalIP()` to show in the LAN-mode panel and encode into the QR URL.

### Virtual camera

The Electron app receives the WebRTC stream in the renderer. A canvas-based frame capture loop (`rafRef`) reads video frames at 15 fps and sends raw RGBA buffers to the main process via `window.api.virtualCam.sendFrame()`. The main process writes them to the virtual camera device. Users must install the driver themselves (e.g. OBS Virtual Camera on macOS).

### Signaling port

Port `3717` is hardcoded in two places: `apps/desktop/src/main/signaling.ts` and the placeholder text in `apps/web/app/routes/share.tsx`. Keep them in sync if changing.

### Deployment (web)

`apps/web/Dockerfile` uses the React Router v7 default template. The built output is served via `node server.js`.
