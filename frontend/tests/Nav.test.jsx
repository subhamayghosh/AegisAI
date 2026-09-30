import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Nav from "../src/components/Nav";

describe("Nav", () => {
  it("keeps every primary destination available in the mobile variant", () => {
    render(
      <MemoryRouter initialEntries={["/inspect"]}>
        <Nav mobile />
      </MemoryRouter>
    );

    const nav = screen.getByRole("navigation", { name: /primary mobile/i });
    expect(nav).not.toHaveClass("hidden");
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: "Inspect" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "History" })).toHaveAttribute("href", "/history");
    expect(screen.getByRole("link", { name: "Sessions" })).toHaveAttribute("href", "/sessions");
  });
});
