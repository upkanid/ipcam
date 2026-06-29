# Roadmap

## Reliability

- Add TURN server configuration for networks where STUN-only WebRTC cannot connect.
- Add browser/Electron smoke tests for share, view, OBS mode, reconnects, and room capacity.
- Add connection diagnostics that explain whether signaling, ICE, or media failed.

## Desktop

- Improve virtual camera and virtual microphone setup checks per platform.
- Reduce runtime dependency on user-installed Python packages where practical.
- Harden Electron preload and IPC validation.

## Open Source

- Keep dependency security advisories at zero for runtime dependencies.
- Publish clear release notes with each desktop installer.
- Add issue templates for bug reports, platform support, and feature requests.
