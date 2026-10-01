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

  function fillForm({ email = "taken@b.com" } = {}) {
    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: "A" } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: email } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "password1" } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: "password1" } });
  }

  const submit = () => fireEvent.click(screen.getByRole("button", { name: /create account/i }));

  const TAKEN = "An account with that email already exists. Sign in instead.";

  it("reports a duplicate email inline and as a toast", async () => {
    authApi.register.mockRejectedValue({ response: { status: 409 } });

    renderRegister();
    fillForm();
    submit();

    await waitFor(() => expect(screen.getAllByText(TAKEN).length).toBeGreaterThan(0));
    // Inline on the field, not only a transient toast.
    expect(screen.getByLabelText(/email/i)).toHaveAttribute("aria-invalid", "true");
  });

  it("repeats the same duplicate-email message without re-posting or stacking toasts", async () => {
    authApi.register.mockRejectedValue({ response: { status: 409 } });

    renderRegister();
    fillForm();
    submit();
    await waitFor(() => expect(authApi.register).toHaveBeenCalledTimes(1));

    submit();
    submit();

    // Known-taken address is not re-posted, so the rate limiter is never hit
    // and the message cannot change to the generic failure text.
    await waitFor(() => expect(screen.getAllByText(TAKEN).length).toBeGreaterThan(0));
    expect(authApi.register).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Registration failed. Please try again.")).not.toBeInTheDocument();
    // One toast in the notification region, not one per click.
    const region = screen.getByRole("region", { name: /notifications/i });
    expect(region.querySelectorAll('[role="alert"]')).toHaveLength(1);
  });

  it("shows a specific message when the register rate limit is hit", async () => {
    authApi.register.mockRejectedValue({ response: { status: 429 } });

    renderRegister();
    fillForm({ email: "fresh@b.com" });
    submit();

    await waitFor(() =>
      expect(screen.getByText("Too many attempts. Please wait a minute and try again.")).toBeInTheDocument()
    );
    expect(screen.queryByText("Registration failed. Please try again.")).not.toBeInTheDocument();
  });

  it("explains an unreachable backend instead of blaming registration", async () => {
    authApi.register.mockRejectedValue({ message: "Network Error" });

    renderRegister();
    fillForm({ email: "fresh2@b.com" });
    submit();

    await waitFor(() =>
      expect(
        screen.getByText("AegisAI is not reachable. Start the backend and frontend, then try again.")
      ).toBeInTheDocument()
    );
  });
});
