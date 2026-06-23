# Setup IPCam Upkan - Development

## Prerequisites

- Node.js ≥ 22
- npm ≥ 10
- macOS / Windows / Linux

## Installation

```bash
# Clone repository (jika belum)
git clone <repository-url>
cd ipcam-upkan

# Install dependencies
npm install

# Fix electron installation (jika ada masalah)
npm run postinstall:electron
```

## Development

```bash
# Run both web and desktop apps
npm run dev

# Run web app only (port 5173)
npm run dev:web

# Run desktop app only
npm run dev:desktop

# Type check all workspaces
npm run typecheck
```

## Available URLs

- **Web App**: http://localhost:5173
- **Desktop Renderer**: http://localhost:5174

## Troubleshooting

### Electron tidak bisa start

Jika ada error `Electron uninstall` atau `ENOENT`, jalankan:

```bash
npm run postinstall:electron
```

### Rolldown binding error (Web app)

Jika ada error `Cannot find native binding` di web app:

```bash
# Clean install
rm -rf node_modules package-lock.json
rm -rf apps/web/node_modules apps/web/package-lock.json
rm -rf apps/desktop/node_modules apps/desktop/package-lock.json
npm install
```

### Permission denied errors

Pastikan semua executable memiliki permission yang benar:

```bash
chmod +x node_modules/.bin/*
```

## Build for Production

```bash
# Build web app
npm run build:web

# Build desktop app
npm run build:desktop
```

## Notes

- Desktop app menggunakan Electron 31.7.7
- Web app menggunakan React Router v7 dengan SSR
- Kedua app menggunakan WebRTC untuk streaming
