# Contributing

Thanks for helping improve IPCam Upkan. This repo is a small npm workspace with a web app and an Electron desktop app.

## Development Setup

```bash
npm install
npm run dev
```

Useful commands:

```bash
npm test
npm run typecheck
npm run build
npm run dev:web
npm run dev:desktop
```

## Pull Requests

- Keep changes focused and explain the user-facing behavior being changed.
- Add or update tests for signaling, WebRTC helper behavior, virtual device helpers, or UI copy when relevant.
- Run `npm test`, `npm run typecheck`, and the relevant build before opening a PR.
- Do not commit generated build output from `apps/web/build`, `apps/desktop/out`, or `apps/desktop/dist`.

## Architecture Notes

- Cloud mode uses the hosted web server only for signaling. Media is sent peer-to-peer by WebRTC when NAT traversal succeeds.
- LAN mode uses the desktop app's local WebSocket signaling server on port `3717`.
- If you change the signaling message contract, update both web routes and desktop renderer code.
