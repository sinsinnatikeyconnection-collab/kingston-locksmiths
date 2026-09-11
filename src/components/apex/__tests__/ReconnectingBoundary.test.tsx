import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// The boundary logs a fault to the backend on catch — mock it so the test never
// makes a real call and never depends on a platform SDK runtime.
vi.mock("@/lib/logSystemHealth", () => ({
  logSystemHealth: vi.fn(),
}));

import ReconnectingBoundary from "../ReconnectingBoundary";

/** A component that always throws during render — used to trigger the boundary. */
function Thrower(): never {
  throw new Error("simulated chunk load failure");
}

describe("ReconnectingBoundary", () => {
  it("renders children when nothing throws", () => {
    render(
      <ReconnectingBoundary component="TestModule">
        <div data-testid="child">child content</div>
      </ReconnectingBoundary>
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.queryByText(/Re-establishing Link/i)).not.toBeInTheDocument();
  });

  it("catches a render error and shows the branded Reconnecting fallback", () => {
    // React logs the caught error to console.error in dev; silence the noise.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ReconnectingBoundary component="TestModule">
        <Thrower />
      </ReconnectingBoundary>
    );
    expect(screen.getByText(/Re-establishing Link/i)).toBeInTheDocument();
    expect(screen.getByText(/Stand by/i)).toBeInTheDocument();
    expect(screen.getByText(/TestModule/i)).toBeInTheDocument();
    // First attempt is auto-retry (attempts < MAX), so the manual Retry button is NOT shown yet.
    expect(screen.queryByRole("button", { name: /Retry/i })).not.toBeInTheDocument();
    spy.mockRestore();
  });
});