/**
 * Shared WebRTC connection helpers.
 * Pure functions used by both share.tsx and view.tsx.
 */

export const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export const MAX_RECONNECT_ATTEMPTS = 8;
export const RECONNECT_BASE_DELAY = 1000;
export const CONNECTION_TIMEOUT = 15_000;
export const DEFAULT_SIGNALING_PORT = 3717;

/**
 * Build the signaling WebSocket URL.
 *
 * - Cloud mode (room param): wss://<host>/ws?room=<roomId>
 * - LAN mode (ip param): ws://<ip>:<port>
 */
export function buildSignalingWsUrl(
  room: string | null,
  ip: string,
  location: { protocol: string; host: string },
): string {
  if (room) {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    return `${proto}://${location.host}/ws?room=${room}`;
  }
  const target = ip.trim().includes(":")
    ? ip.trim()
    : `${ip.trim()}:${DEFAULT_SIGNALING_PORT}`;
  return `ws://${target}`;
}


