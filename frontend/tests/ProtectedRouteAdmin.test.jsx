import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "../src/contexts/ToastContext";
import ProtectedRoute from "../src/components/ProtectedRoute";

vi.mock("../src/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1", role: "user" }, initializing: false }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ProtectedRoute — admin gating", () => {
  it("redirects a non-admin user away from an admin-only route and shows a toast", async () => {
    render(
      <MemoryRouter initialEntries={["/audit"]}>
        <ToastProvider>
          <Routes>
            <Route path="/dashboard" element={<div>Dashboard Home</div>} />
            <Route element={<ProtectedRoute adminOnly />}>
              <Route path="/audit" element={<div>Audit Log Page</div>} />
            </Route>
          </Routes>
        </ToastProvider>
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("Dashboard Home")).toBeInTheDocument());
    expect(screen.queryByText("Audit Log Page")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/don't have access/i);
  });
});
