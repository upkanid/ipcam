# IPCam Upkan - Web

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

## Build And Deploy

```bash
# From repo root
npm run build:web

# Or from this directory
npm run build

# Preview locally in the Workers runtime
npm run preview

# Deploy through Wrangler
npm run deploy
```

Outputs:
- `build/client/` - static assets uploaded through the Worker assets binding
- `build/server/` - Worker bundle and generated Wrangler config

The deployment includes a Cloudflare Durable Object named `SignalingRoom`. Each
room ID maps to one Durable Object instance, which keeps WebSocket peers
co-located and broadcasts signaling messages consistently across Worker
instances. Rooms are closed after 10 minutes without signaling activity.

Authenticate Wrangler before the first deploy:

```bash
npx wrangler login
```

For a custom domain, configure the domain or route in the Cloudflare dashboard
or add a `routes` entry to `wrangler.jsonc`. The desktop app should continue to
use the HTTPS site URL; cloud mode will connect to `/ws?room=<roomId>` over
`wss://` automatically.

## Stack

| | |
|---|---|
| Framework | React Router v7 (SSR) |
| Runtime | Cloudflare Workers |
| Signaling | Durable Objects + WebSocket Hibernation |
| Styling | Tailwind CSS v4 |
| Bundler | Vite + esbuild |

## CI

Type check and build run automatically on pushes/PRs that touch `apps/web/`.
