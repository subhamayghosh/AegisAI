import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "../src/contexts/AuthContext";
import { ToastProvider } from "../src/contexts/ToastContext";
import Login from "../src/pages/Login";

vi.mock("../src/api/auth", () => ({
  login: vi.fn(),
  register: vi.fn(),
  refresh: vi.fn(),
  logout: vi.fn(),
  getMe: vi.fn(),
}));

import * as authApi from "../src/api/auth";

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
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

describe("Login", () => {
  it("submits credentials and stores the access + refresh token", async () => {
    authApi.login.mockResolvedValue({
      user: { id: "1", email: "a@b.com", display_name: "A", role: "user" },
      access_token: "access-123",
      refresh_token: "refresh-456",
    });

    renderLogin();

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "a@b.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "password1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(authApi.login).toHaveBeenCalledWith({
      email: "a@b.com",
      password: "password1",
    }));

    await waitFor(() =>
      expect(localStorage.getItem("refresh_token")).toBe("refresh-456")
    );
    await waitFor(() =>
      expect(screen.getByText("Dashboard Home")).toBeInTheDocument()
    );
  });

  it("explains why a legacy local-domain email was rejected", async () => {
    authApi.login.mockRejectedValue({ response: { status: 422 } });
    renderLogin();

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "admin@promptshield.local" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "password1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(
      await screen.findByText("Enter a valid email address. Local demo accounts use @promptshield.dev.")
    ).toBeInTheDocument();
  });
});
