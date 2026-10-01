import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Landing from "../src/pages/Landing";
import { ATTACK_TYPES, SOURCE_TYPES } from "../src/constants";

function renderLanding() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Landing />
    </MemoryRouter>
  );
}

describe("Landing", () => {
  it("offers Sign in and Sign up, pointing at the auth routes", () => {
    renderLanding();

    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute("href", "/register");
  });

  it("does not render the removed hero calls to action", () => {
    renderLanding();

    expect(screen.queryByRole("link", { name: /protect an agent/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /open dashboard/i })).not.toBeInTheDocument();
    // The header pair is the only way into the app from here.
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  it("derives the headline counts from the shared enums instead of literals", () => {
    renderLanding();

    expect(screen.getByText("input source types protected").previousSibling).toHaveTextContent(
      String(SOURCE_TYPES.length)
    );
    expect(screen.getByText("prompt-injection attack types").previousSibling).toHaveTextContent(
      String(ATTACK_TYPES.length)
    );
    // One card per tier described in the "Defense in depth" section.
    expect(screen.getByText("defense tiers, one clear decision").previousSibling).toHaveTextContent("3");
  });
});
