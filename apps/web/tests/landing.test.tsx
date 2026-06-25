// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Landing from "../app/routes/landing";
import React from "react";

describe("Landing Page", () => {
  it("renders correctly and contains the main headers and sections", () => {
    render(<Landing />);

    // Check main title
    const mainHeading = screen.getByRole("heading", { level: 1 });
    expect(mainHeading).toBeDefined();
    expect(mainHeading.textContent).toContain("Jadikan HP kamu webcam wireless.");

    // Check key action links/buttons
    expect(screen.getAllByText(/Start Sharing/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Open Viewer/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Perbandingan/i)).toBeDefined();
  });
});
