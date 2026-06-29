export const DEFAULT_PEER_ID = "default";

export function getPeerId(payload: unknown, fallback = DEFAULT_PEER_ID): string {
  if (
    payload &&
    typeof payload === "object" &&
    "peerId" in payload &&
    typeof payload.peerId === "string" &&
    payload.peerId.trim()
  ) {
    return payload.peerId;
  }
  return fallback;
}

export function shouldHandleTargetedPayload(payload: unknown, localPeerId: string): boolean {
  if (
    payload &&
    typeof payload === "object" &&
    "targetPeerId" in payload &&
    typeof payload.targetPeerId === "string" &&
    payload.targetPeerId
  ) {
    return payload.targetPeerId === localPeerId;
  }
  return true;
}

export function unwrapSignalingPayload<T = unknown>(
  payload: unknown,
  key: "description" | "candidate",
): T {
  if (payload && typeof payload === "object" && key in payload) {
    return (payload as Record<string, T>)[key];
  }
  return payload as T;
}

export function generateHexId(byteLength = 5): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
