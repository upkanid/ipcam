# IPCam Upkan

Turn your phone into a wireless IP camera — no cables, no drivers, no accounts.

Point your phone at anything and stream the feed live to your desktop via WebRTC. The signal arrives in the **IPCam Upkan** desktop app where you can preview it full-screen or push it out as a virtual camera device for use in OBS, Zoom, Meet, and any app that reads a webcam.

---

## How it works

```
Phone browser  ──── WebRTC offer ────▶  Signaling relay  ◀──── Desktop app / Browser viewer
     │                                                                           │
     └─────────────── WebRTC P2P stream (direct) ────────────────────────────────┘
```

Signaling is brokered by a tiny relay server in cloud mode. The camera stream itself travels peer-to-peer through WebRTC when NAT traversal succeeds, so latency is as low as your network allows.

Two relay modes are supported:

| Mode | When to use | How to connect |
|---|---|---|
| **Cloud signaling** (default) | Any network, phone and desktop on different Wi-Fi | Share camera from phone directly (auto Room ID) or scan desktop QR → Connect with Room ID on desktop app or browser viewer (`/view`) |
| **LAN signaling** | Same network, no internet | Desktop shows IP QR → phone opens `/share?ip=…` → direct connection to desktop |

---

## Desktop app

Download the latest release for your platform:

| Platform | File |
|---|---|
| macOS | `.dmg` |
| Windows | `.exe` (NSIS installer) |
| Linux | `.AppImage` |

→ **[Releases](../../releases)**

### macOS — first launch

The app is ad-hoc signed but not notarized (no Apple Developer certificate). On first open macOS will show an "unidentified developer" warning:

> Right-click (or Control-click) the app → **Open** → **Open**

Alternatively, run once in Terminal to clear the quarantine flag:
```bash
xattr -cr "/Applications/IPCam Upkan.app"
```

### Usage

1. Open **IPCam Upkan** on your desktop.
2. Click **→ START RECEIVING**.
3. Scan the QR code with your phone's camera — it opens the share page automatically.
4. Tap **→ Start Sharing** on your phone.
5. The live feed appears in the desktop app within a few seconds.

To output as a virtual camera, install [OBS Virtual Camera](https://obsproject.com/kb/virtual-camera) (macOS/Windows) or `v4l2loopback` (Linux), then click **→ ENABLE** in the Virtual Cam panel.

---

## Web app

The phone-side UI is hosted at **[ipcam.upkan.id](https://ipcam.upkan.id)** — no install required. Always opened via QR code from the desktop app.

### Self-hosting

```bash
# Build
npm run build:web

# Run (Docker)
docker build -f apps/web/Dockerfile -t ipcam-web .
docker run -p 3000:3000 ipcam-web
```

Or deploy the image to any Node-capable host (Coolify, Railway, Fly, etc.). The web server is a plain Express + WebSocket process — no database, no external dependencies.

---

## Development

**Requirements:** Node ≥ 22, npm ≥ 10

```bash
# Install dependencies
npm install

# Fix Electron if needed (macOS)
npm run postinstall:electron

# Run both apps in parallel
npm run dev

# Web only  (localhost:5173)
npm run dev:web

# Desktop only  (renderer on localhost:5174)
npm run dev:desktop

# Type check all workspaces
npm run typecheck
```

For local dev, change the **Web App URL** in the desktop settings panel from `https://ipcam.upkan.id` to `http://<your-ip>:5173`. The desktop will switch to LAN mode and generate an IP-based QR.

**Troubleshooting:** See [SETUP.md](./SETUP.md) for common issues.

---

## Stack

| | |
|---|---|
| Web | React Router v7 (SSR), Express, WebSocket |
| Desktop | Electron, electron-vite, React |
| Streaming | WebRTC (getUserMedia → RTCPeerConnection) |
| Packaging | electron-builder — DMG / NSIS / AppImage |
| Deploy | Docker → Coolify |
