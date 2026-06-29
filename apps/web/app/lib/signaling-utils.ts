/**
 * Shared signaling validation logic.
 * Extracted for reuse between server.ts and tests.
 */

export const VALID_SIGNAL_TYPES = new Set([
  "offer",
  "answer",
  "candidate",
  "peer_joined",
  "viewer_ready",
]);
export const MAX_MSG_SIZE = 16_384; // 16 KB

export function validateSignalingMsg(raw: string): boolean {
  if (raw.length > MAX_MSG_SIZE) return false;
  try {
    const msg = JSON.parse(raw);
    return (
      typeof msg === "object" &&
      msg !== null &&
      typeof msg.type === "string" &&
      VALID_SIGNAL_TYPES.has(msg.type) &&
      "payload" in msg
    );
  } catch {
    return false;
  }
}

export function isValidRoomId(room: string): boolean {
  return /^[A-Fa-f0-9]{6,16}$/.test(room);
}
