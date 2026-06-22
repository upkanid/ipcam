# IPCam Upkan — Web

Phone-side UI for IPCam Upkan. Opens in the phone browser via QR code from the desktop app — no install required.

Handles WebRTC signaling and streams the phone camera to the desktop peer.

## Development

**Requirements:** Node ≥ 22, npm ≥ 10

```bash
# From repo root
npm install

# Run web only (localhost:5173)
npm run dev:web

# Or from this directory
npm run dev
```

## Build

```bash
# From repo root
npm run build:web

# Or from this directory
npm run build
```

Outputs:
- `build/client/` — static assets
- `build/server/` — SSR server bundle
- `server.js` — compiled Express entry point

## Production

```bash
node server.js  # runs on PORT (default 3000)
```

## Docker

Build context must be the **repo root** (Dockerfile uses `apps/web/` paths):

```bash
docker build -f apps/web/Dockerfile -t ipcam-web .
docker run -p 3000:3000 ipcam-web
```

## Stack

| | |
|---|---|
| Framework | React Router v7 (SSR) |
| Server | Express + WebSocket (`ws`) |
| Styling | Tailwind CSS v4 |
| Bundler | Vite + esbuild |

## CI

Type check and build run automatically on pushes/PRs that touch `apps/web/`.
