import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Inspect from "../src/pages/Inspect";

vi.mock("../src/hooks/useToast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

vi.mock("../src/api/firewall", () => ({
  inspect: vi.fn(),
}));

import * as firewallApi from "../src/api/firewall";

function renderInspect() {
  return render(
    <MemoryRouter initialEntries={["/inspect"]}>
      <Inspect />
    </MemoryRouter>
  );
}

beforeEach(() => vi.clearAllMocks());

describe("Inspect demo inputs", () => {
  it("loads a long source-specific scenario", () => {
    renderInspect();

    fireEvent.change(screen.getByLabelText(/complex demo scenario/i), {
      target: { value: "email-finance" },
    });

    expect(screen.getByLabelText(/source type/i)).toHaveValue("email");
    expect(screen.getByLabelText(/content/i).value).toContain("finance-automation@example.invalid");
  });

  it("offers an attachment mode for HTML and email-style sources", () => {
    renderInspect();

    fireEvent.change(screen.getByLabelText(/source type/i), {
      target: { value: "html" },
    });
    fireEvent.click(screen.getByRole("button", { name: /attach file/i }));

    expect(screen.getByLabelText(/attachment/i)).toBeInTheDocument();
    expect(screen.getByText(/the attachment is read locally/i)).toBeInTheDocument();
    expect(firewallApi.inspect).not.toHaveBeenCalled();
  });
});
