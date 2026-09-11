import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock the platform boundaries so the component test never touches the network
// Only the bare API interfaces IntakeForm touches are stubbed.
vi.mock("@/api/apiClient", () => ({
  default: {
    integrations: { Core: { UploadFile: vi.fn(() => Promise.resolve({ file_url: "mock://upload" })) } },
    functions: { invoke: vi.fn() },
    entities: {},
  },
}));

// VIN auto-decode is async/backend-backed — return an idle state so the Initial
// step's vehicle fields stay user-controlled.
vi.mock("@/hooks/useVinDecode", () => ({
  useVinDecode: () => ({ data: null, loading: false, error: null }),
}));

// Toast uses module-level state shared across renders; mock to isolate.
vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import IntakeForm from "../IntakeForm";

describe("IntakeForm multi-step flow", () => {
  it("starts on Vehicle Identification with Next disabled until identity is complete, then advances", async () => {
    const user = userEvent.setup();
    render(<IntakeForm />);

    // Step 01 — Vehicle Identification is the initial viewport.
    expect(screen.getByText(/Vehicle Identification/i)).toBeInTheDocument();
    const next = screen.getByRole("button", { name: /Next/i });
    expect(next).toBeDisabled();

    // Fill the four required identity fields.
    await user.type(screen.getByPlaceholderText("2021"), "2021");
    await user.type(screen.getByPlaceholderText("Ford"), "Ford");
    await user.type(screen.getByPlaceholderText("F-150"), "F-150");
    await user.type(screen.getByPlaceholderText("17-character VIN"), "1FTFW1ET5DFC10312");

    // All required fields present → gate opens.
    expect(next).toBeEnabled();
    await user.click(next);

    // Step 02 — Symptom Matrix.
    expect(screen.getAllByText(/Symptom Matrix/i).length).toBeGreaterThan(0);

    // Back returns to step 01 with the entered identity intact.
    await user.click(screen.getByRole("button", { name: /Back/i }));
    expect(screen.getByText(/Vehicle Identification/i)).toBeInTheDocument();
    expect((screen.getByPlaceholderText("Ford") as HTMLInputElement).value).toBe("Ford");
  });
});