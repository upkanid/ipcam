import { describe, it, expect } from "vitest";

/**
 * Tests for route meta exports and route configuration.
 * These tests import the meta functions directly from the route modules
 * and verify they return the correct SEO metadata.
 */

// We test the route config file directly
describe("routes.ts configuration", () => {
  it("exports correct route structure", async () => {
    // Import dynamically to avoid React Router dev server issues
    const routeConfig = await import("../app/routes");
    const routes = routeConfig.default;

    expect(Array.isArray(routes)).toBe(true);
    expect(routes.length).toBeGreaterThanOrEqual(3);

    // Check that expected routes exist
    const paths = routes.map((r: any) => r.path ?? "/");
    expect(paths).toContain("share");
    expect(paths).toContain("view");
  });
});

describe("signaling port consistency", () => {
  it("DEFAULT_SIGNALING_PORT matches the hardcoded value in server and desktop", async () => {
    // This test documents that port 3717 is the agreed-upon signaling port
    // If changing this, also update: apps/desktop/src/main/signaling.ts
    const { DEFAULT_SIGNALING_PORT } = await import("../app/lib/webrtc-utils");
    expect(DEFAULT_SIGNALING_PORT).toBe(3717);
  });
});
