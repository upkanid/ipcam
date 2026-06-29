# Security Policy

## Supported Versions

Security fixes target the current `main` branch and the latest published desktop release.

## Reporting a Vulnerability

Please do not open a public issue for a suspected vulnerability.

Report privately by emailing the maintainer or by using GitHub private vulnerability reporting if it is enabled for the repository. Include:

- A short description of the issue.
- Reproduction steps or proof of concept.
- Affected platform: web, desktop, or both.
- Any known workaround.

We aim to acknowledge reports within 7 days.

## Security Model

- The cloud relay forwards signaling metadata only. Camera and microphone media are WebRTC peer-to-peer when connectivity allows.
- Room IDs are bearer secrets. Anyone with a room ID can attempt to join that room.
- The desktop app exposes local IPC only through Electron preload APIs. Treat renderer changes as security-sensitive.
