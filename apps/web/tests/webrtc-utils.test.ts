import { describe, it, expect } from "vitest";
import {
  buildSignalingWsUrl,
  ICE_SERVERS,
  MAX_RECONNECT_ATTEMPTS,
  RECONNECT_BASE_DELAY,
  CONNECTION_TIMEOUT,
  DEFAULT_SIGNALING_PORT,
} from "../app/lib/webrtc-utils";

describe("buildSignalingWsUrl", () => {
  describe("cloud mode (room param)", () => {
    it("uses wss:// on HTTPS host", () => {
      const url = buildSignalingWsUrl("ABC123", "", {
        protocol: "https:",
        host: "ipcam.upkan.id",
      });
      expect(url).toBe("wss://ipcam.upkan.id/ws?room=ABC123");
    });

    it("uses ws:// on HTTP host", () => {
      const url = buildSignalingWsUrl("ABC123", "", {
        protocol: "http:",
        host: "localhost:5173",
      });
      expect(url).toBe("ws://localhost:5173/ws?room=ABC123");
    });

    it("includes room ID in URL", () => {
      const url = buildSignalingWsUrl("DEADBEEF01", "", {
        protocol: "https:",
        host: "ipcam.upkan.id",
      });
      expect(url).toContain("room=DEADBEEF01");
    });

    it("ignores ip param when room is provided", () => {
      const url = buildSignalingWsUrl("ABC123", "192.168.1.100:3717", {
        protocol: "https:",
        host: "ipcam.upkan.id",
      });
      expect(url).toBe("wss://ipcam.upkan.id/ws?room=ABC123");
      expect(url).not.toContain("192.168");
    });
  });

  describe("LAN mode (ip param)", () => {
    it("uses ws:// with ip:port", () => {
      const url = buildSignalingWsUrl(null, "192.168.1.100:3717", {
        protocol: "http:",
        host: "localhost:5173",
      });
      expect(url).toBe("ws://192.168.1.100:3717");
    });

    it("appends default port when no port in ip", () => {
      const url = buildSignalingWsUrl(null, "192.168.1.100", {
        protocol: "http:",
        host: "localhost:5173",
      });
      expect(url).toBe(`ws://192.168.1.100:${DEFAULT_SIGNALING_PORT}`);
    });

    it("trims whitespace from ip", () => {
      const url = buildSignalingWsUrl(null, "  192.168.1.100:3717  ", {
        protocol: "http:",
        host: "localhost:5173",
      });
      expect(url).toBe("ws://192.168.1.100:3717");
    });

    it("handles IPv6-like addresses with colons", () => {
      const url = buildSignalingWsUrl(null, "10.0.0.1:4000", {
        protocol: "http:",
        host: "localhost:5173",
      });
      expect(url).toBe("ws://10.0.0.1:4000");
    });

    it("handles custom port", () => {
      const url = buildSignalingWsUrl(null, "192.168.1.1:9999", {
        protocol: "http:",
        host: "localhost:5173",
      });
      expect(url).toBe("ws://192.168.1.1:9999");
    });
  });
});

// isBlockedByMixedContent is no longer used since IP-based sharing from browser was simplified out.

describe("constants", () => {
  it("ICE_SERVERS has Google STUN servers", () => {
    expect(ICE_SERVERS).toHaveLength(2);
    expect(ICE_SERVERS[0].urls).toBe("stun:stun.l.google.com:19302");
    expect(ICE_SERVERS[1].urls).toBe("stun:stun1.l.google.com:19302");
  });

  it("MAX_RECONNECT_ATTEMPTS is reasonable", () => {
    expect(MAX_RECONNECT_ATTEMPTS).toBe(30);
  });

  it("RECONNECT_BASE_DELAY is 250 milliseconds", () => {
    expect(RECONNECT_BASE_DELAY).toBe(250);
  });

  it("CONNECTION_TIMEOUT is 10 seconds", () => {
    expect(CONNECTION_TIMEOUT).toBe(10_000);
  });

  it("DEFAULT_SIGNALING_PORT is 3717", () => {
    expect(DEFAULT_SIGNALING_PORT).toBe(3717);
  });
});
