import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_PEER_ID,
  generateHexId,
  getPeerId,
  shouldHandleTargetedPayload,
  unwrapSignalingPayload,
} from "../app/lib/peer-signaling-utils";

describe("peer signaling helpers", () => {
  it("extracts a viewer peer id from routed payloads", () => {
    expect(getPeerId({ peerId: "viewer-a" })).toBe("viewer-a");
  });

  it("falls back for legacy signaling payloads", () => {
    expect(getPeerId({ sdp: "v=0..." })).toBe(DEFAULT_PEER_ID);
    expect(getPeerId(null)).toBe(DEFAULT_PEER_ID);
  });

  it("ignores offers and candidates targeted to another viewer", () => {
    expect(shouldHandleTargetedPayload({ targetPeerId: "viewer-a" }, "viewer-a")).toBe(true);
    expect(shouldHandleTargetedPayload({ targetPeerId: "viewer-b" }, "viewer-a")).toBe(false);
  });

  it("keeps legacy untargeted payloads compatible", () => {
    expect(shouldHandleTargetedPayload({ candidate: "candidate:..." }, "viewer-a")).toBe(true);
  });

  it("unwraps nested descriptions and candidates while preserving legacy payloads", () => {
    const description = { type: "offer", sdp: "v=0..." };
    const candidate = { candidate: "candidate:..." };

    expect(unwrapSignalingPayload({ description }, "description")).toBe(description);
    expect(unwrapSignalingPayload({ candidate }, "candidate")).toBe(candidate);
    expect(unwrapSignalingPayload(description, "description")).toBe(description);
  });

  it("generates lowercase hex ids using crypto randomness", () => {
    const originalCrypto = globalThis.crypto;
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: {
        getRandomValues: vi.fn((bytes: Uint8Array) => {
          bytes.set([0, 1, 10, 15, 255]);
          return bytes;
        }),
      },
    });

    expect(generateHexId()).toBe("00010a0fff");

    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: originalCrypto,
    });
  });
});
