import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "../src/contexts/AuthContext";
import { ToastProvider } from "../src/contexts/ToastContext";
import Register from "../src/pages/Register";

vi.mock("../src/api/auth", () => ({
  login: vi.fn(),
  register: vi.fn(),
  refresh: vi.fn(),
  logout: vi.fn(),
  getMe: vi.fn(),
}));

import * as authApi from "../src/api/auth";

function renderRegister() {
  return render(
    <MemoryRouter initialEntries={["/register"]}>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/register" element={<Register />} />
            <Route path="/dashboard" element={<div>Dashboard Home</div>} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe("Register", () => {
  it("registers and redirects to the dashboard on success", async () => {
    authApi.register.mockResolvedValue({
      user: { id: "1", email: "a@b.com", display_name: "A", role: "user" },
      access_token: "access-123",
      refresh_token: "refresh-456",
    });

    renderRegister();

    fireEvent.change(screen.getByLabelText(/display name/i), {
      target: { value: "A" },
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "a@b.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "password1" },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "password1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() =>
      expect(authApi.register).toHaveBeenCalledWith({
        email: "a@b.com",
        password: "password1",
        display_name: "A",
      })
    );

    await waitFor(() =>
      expect(screen.getByText("Dashboard Home")).toBeInTheDocument()
    );
  });
});
