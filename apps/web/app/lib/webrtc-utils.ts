/**
 * Shared WebRTC connection helpers.
 * Pure functions used by both share.tsx and view.tsx.
 */

export const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

let cachedTurn: { key: string; servers: RTCIceServer[]; expiresAt: number } | null = null;

export async function getIceServers(room: string | null, origin: string): Promise<RTCIceServer[]> {
  if (!room) return ICE_SERVERS;
  const key = `${origin}:${room}`;
  if (cachedTurn?.key === key && cachedTurn.expiresAt > Date.now()) return cachedTurn.servers;
  try {
    const response = await fetch(`${origin}/ice-servers?room=${encodeURIComponent(room)}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return ICE_SERVERS;
    const data = await response.json() as { iceServers?: RTCIceServer[] };
    if (!Array.isArray(data.iceServers) || !data.iceServers.some(
      (server) => server.username && server.credential && server.urls,
    )) return ICE_SERVERS;
    const servers = [...ICE_SERVERS, ...data.iceServers];
    cachedTurn = { key, servers, expiresAt: Date.now() + 60 * 60_000 };
    return servers;
  } catch {
    return ICE_SERVERS;
  }
}

export const MAX_RECONNECT_ATTEMPTS = 30;
export const RECONNECT_BASE_DELAY = 250;
export const CONNECTION_TIMEOUT = 10_000;
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
