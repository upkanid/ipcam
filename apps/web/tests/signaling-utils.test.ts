import { describe, it, expect } from "vitest";
import {
  validateSignalingMsg,
  isValidRoomId,
  VALID_SIGNAL_TYPES,
  MAX_MSG_SIZE,
} from "../app/lib/signaling-utils";

describe("validateSignalingMsg", () => {
  it("accepts valid offer message", () => {
    const msg = JSON.stringify({ type: "offer", payload: { sdp: "v=0..." } });
    expect(validateSignalingMsg(msg)).toBe(true);
  });

  it("accepts valid answer message", () => {
    const msg = JSON.stringify({ type: "answer", payload: { sdp: "v=0..." } });
    expect(validateSignalingMsg(msg)).toBe(true);
  });

  it("accepts valid candidate message", () => {
    const msg = JSON.stringify({
      type: "candidate",
      payload: { candidate: "candidate:..." },
    });
    expect(validateSignalingMsg(msg)).toBe(true);
  });

  it("rejects message with unknown type", () => {
    const msg = JSON.stringify({ type: "hello", payload: {} });
    expect(validateSignalingMsg(msg)).toBe(false);
  });

  it("rejects message without type field", () => {
    const msg = JSON.stringify({ payload: {} });
    expect(validateSignalingMsg(msg)).toBe(false);
  });

  it("rejects message without payload field", () => {
    const msg = JSON.stringify({ type: "offer" });
    expect(validateSignalingMsg(msg)).toBe(false);
  });

  it("rejects non-JSON string", () => {
    expect(validateSignalingMsg("not json")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(validateSignalingMsg("")).toBe(false);
  });

  it("rejects null JSON", () => {
    expect(validateSignalingMsg("null")).toBe(false);
  });

  it("rejects array JSON", () => {
    expect(validateSignalingMsg('[{"type":"offer","payload":{}}]')).toBe(false);
  });

  it("rejects message exceeding MAX_MSG_SIZE", () => {
    const huge = JSON.stringify({
      type: "offer",
      payload: "x".repeat(MAX_MSG_SIZE),
    });
    expect(validateSignalingMsg(huge)).toBe(false);
  });

  it("accepts message at exactly MAX_MSG_SIZE", () => {
    // Build a message that is just under the limit
    const base = '{"type":"offer","payload":"';
    const suffix = '"}';
    const fill = "a".repeat(MAX_MSG_SIZE - base.length - suffix.length);
    const msg = base + fill + suffix;
    expect(msg.length).toBe(MAX_MSG_SIZE);
    expect(validateSignalingMsg(msg)).toBe(true);
  });

  it("rejects message where type is not a string", () => {
    const msg = JSON.stringify({ type: 123, payload: {} });
    expect(validateSignalingMsg(msg)).toBe(false);
  });

  it("accepts payload with null value", () => {
    const msg = JSON.stringify({ type: "candidate", payload: null });
    expect(validateSignalingMsg(msg)).toBe(true);
  });

  it("accepts valid peer_joined message", () => {
    const msg = JSON.stringify({ type: "peer_joined", payload: {} });
    expect(validateSignalingMsg(msg)).toBe(true);
  });

  it("accepts valid viewer_ready message", () => {
    const msg = JSON.stringify({ type: "viewer_ready", payload: {} });
    expect(validateSignalingMsg(msg)).toBe(true);
  });

  it("accepts routed viewer_ready messages with peerId", () => {
    const msg = JSON.stringify({
      type: "viewer_ready",
      payload: { peerId: "viewer-a" },
    });
    expect(validateSignalingMsg(msg)).toBe(true);
  });

  it("accepts targeted offers for multi-viewer rooms", () => {
    const msg = JSON.stringify({
      type: "offer",
      payload: {
        targetPeerId: "viewer-a",
        description: { type: "offer", sdp: "v=0..." },
      },
    });
    expect(validateSignalingMsg(msg)).toBe(true);
  });

  it("accepts routed candidates for a specific peer", () => {
    const msg = JSON.stringify({
      type: "candidate",
      payload: {
        peerId: "viewer-a",
        candidate: { candidate: "candidate:..." },
      },
    });
    expect(validateSignalingMsg(msg)).toBe(true);
  });

  it("VALID_SIGNAL_TYPES contains exactly offer, answer, candidate, peer_joined, viewer_ready", () => {
    expect(VALID_SIGNAL_TYPES.size).toBe(5);
    expect(VALID_SIGNAL_TYPES.has("offer")).toBe(true);
    expect(VALID_SIGNAL_TYPES.has("answer")).toBe(true);
    expect(VALID_SIGNAL_TYPES.has("candidate")).toBe(true);
    expect(VALID_SIGNAL_TYPES.has("peer_joined")).toBe(true);
    expect(VALID_SIGNAL_TYPES.has("viewer_ready")).toBe(true);
  });
});

describe("isValidRoomId", () => {
  it("accepts 6-char hex string", () => {
    expect(isValidRoomId("A1B2C3")).toBe(true);
  });

  it("accepts 10-char hex string (default generated length)", () => {
    expect(isValidRoomId("A1B2C3D4E5")).toBe(true);
  });

  it("accepts 16-char hex string (max)", () => {
    expect(isValidRoomId("A1B2C3D4E5F67890")).toBe(true);
  });

  it("accepts lowercase hex", () => {
    expect(isValidRoomId("abcdef1234")).toBe(true);
  });

  it("accepts mixed case hex", () => {
    expect(isValidRoomId("AbCdEf1234")).toBe(true);
  });

  it("rejects too short (5 chars)", () => {
    expect(isValidRoomId("A1B2C")).toBe(false);
  });

  it("rejects too long (17 chars)", () => {
    expect(isValidRoomId("A1B2C3D4E5F678901")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidRoomId("")).toBe(false);
  });

  it("rejects non-hex characters", () => {
    expect(isValidRoomId("ZZZZZZ")).toBe(false);
  });

  it("rejects string with spaces", () => {
    expect(isValidRoomId("A1B2 C3")).toBe(false);
  });

  it("rejects string with special characters", () => {
    expect(isValidRoomId("A1B2C3!@")).toBe(false);
  });
});
