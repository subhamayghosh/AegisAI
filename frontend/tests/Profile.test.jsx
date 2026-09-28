import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "../src/contexts/ToastContext";
import Profile from "../src/pages/Profile";

vi.mock("../src/hooks/useAuth", () => ({
  useAuth: () => ({
    user: {
      id: "u1",
      email: "user@example.com",
      display_name: "Test User",
      role: "user",
      created_at: "2026-01-01T00:00:00Z",
      last_login_at: "2026-01-01T00:00:00Z",
    },
    updateUser: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock("../src/api/users", () => ({
  getSettings: vi.fn(),
  getAvailableModels: vi.fn(),
  updateProfile: vi.fn(),
  changePassword: vi.fn(),
}));

import * as usersApi from "../src/api/users";

const AVAILABLE_MODELS = {
  working: [{ id: "claude-sonnet-5", label: "Claude Sonnet 5", description: "Balanced" }],
  judge: [{ id: "claude-opus-4-7", label: "Claude Opus 4.7", description: "Strong reasoning" }],
  defaults: { working: "claude-sonnet-5", judge: "claude-opus-4-7" },
};

function renderProfile() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter>
          <Profile />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  usersApi.getAvailableModels.mockResolvedValue(AVAILABLE_MODELS);
});

describe("Profile — Preferred models card", () => {
  it('shows "Using app default (Claude Sonnet 5)" when the saved value is null', async () => {
    usersApi.getSettings.mockResolvedValue({
      working_model_id: null,
      judge_model_id: null,
      store_raw_text_in_history: false,
      tier2_threshold: 0.75,
      session_jailbreak_threshold: 0.7,
      theme: "auto",
    });

    renderProfile();

    expect(
      await screen.findByText("Using app default (Claude Sonnet 5)")
    ).toBeInTheDocument();
  });

  it("shows the human label when a model is explicitly saved", async () => {
    usersApi.getSettings.mockResolvedValue({
      working_model_id: "claude-sonnet-5",
      judge_model_id: "claude-opus-4-7",
      store_raw_text_in_history: false,
      tier2_threshold: 0.75,
      session_jailbreak_threshold: 0.7,
      theme: "auto",
    });

    renderProfile();

    await waitFor(() => expect(screen.getAllByText("Claude Sonnet 5").length).toBeGreaterThan(0));
    expect(screen.getByText("Claude Opus 4.7")).toBeInTheDocument();
  });

  it('the "Change in Settings" link navigates with ?tab=models', async () => {
    usersApi.getSettings.mockResolvedValue({
      working_model_id: null,
      judge_model_id: null,
      store_raw_text_in_history: false,
      tier2_threshold: 0.75,
      session_jailbreak_threshold: 0.7,
      theme: "auto",
    });

    renderProfile();

    const link = await screen.findByRole("link", { name: /change in settings/i });
    expect(link).toHaveAttribute("href", "/settings?tab=models");
  });
});

describe("Profile — identity", () => {
  it("renders the email as a disabled, aria-readonly field", async () => {
    usersApi.getSettings.mockResolvedValue({
      working_model_id: null,
      judge_model_id: null,
      store_raw_text_in_history: false,
      tier2_threshold: 0.75,
      session_jailbreak_threshold: 0.7,
      theme: "auto",
    });

    renderProfile();

    const emailInput = await screen.findByDisplayValue("user@example.com");
    expect(emailInput).toBeDisabled();
    expect(emailInput).toHaveAttribute("aria-readonly", "true");
  });
});
