import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "../src/contexts/ToastContext";
import ModelsTab from "../src/components/settings/ModelsTab";

vi.mock("../src/api/users", () => ({
  updateSettings: vi.fn(),
}));

import * as usersApi from "../src/api/users";

const AVAILABLE_MODELS = {
  working: [
    { id: "claude-sonnet-5", label: "Claude Sonnet 5", description: "Balanced" },
    { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", description: "Fastest" },
  ],
  judge: [
    { id: "claude-opus-4-7", label: "Claude Opus 4.7", description: "Strong reasoning" },
    { id: "claude-sonnet-5", label: "Claude Sonnet 5", description: "Faster" },
  ],
  defaults: { working: "claude-sonnet-5", judge: "claude-opus-4-7" },
};

const BASE_SETTINGS = {
  working_model_id: null,
  judge_model_id: null,
  store_raw_text_in_history: false,
  tier2_threshold: 0.75,
  session_jailbreak_threshold: 0.7,
  theme: "auto",
};

function renderModelsTab(settings) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ModelsTab settings={settings} availableModels={AVAILABLE_MODELS} />
      </ToastProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ModelsTab", () => {
  it("saves the changed working model without touching unrelated settings", async () => {
    usersApi.updateSettings.mockResolvedValue({ ...BASE_SETTINGS, working_model_id: "claude-haiku-4-5-20251001" });

    renderModelsTab(BASE_SETTINGS);

    fireEvent.change(screen.getByLabelText(/working llm/i), {
      target: { value: "claude-haiku-4-5-20251001" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(usersApi.updateSettings).toHaveBeenCalledTimes(1));
    const payload = usersApi.updateSettings.mock.calls[0][0];
    expect(payload.working_model_id).toBe("claude-haiku-4-5-20251001");
    expect(payload).not.toHaveProperty("store_raw_text_in_history");
  });

  it("maps 'Use app default' to null on the wire", async () => {
    usersApi.updateSettings.mockResolvedValue(BASE_SETTINGS);

    renderModelsTab({ ...BASE_SETTINGS, working_model_id: "claude-haiku-4-5-20251001" });

    fireEvent.change(screen.getByLabelText(/working llm/i), {
      target: { value: "__default__" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(usersApi.updateSettings).toHaveBeenCalledTimes(1));
    expect(usersApi.updateSettings.mock.calls[0][0].working_model_id).toBeNull();
  });

  it("shows an inline error under the offending dropdown on a 422", async () => {
    usersApi.updateSettings.mockRejectedValue({
      response: { status: 422, data: { detail: "working_model_id must be one of: claude-sonnet-5" } },
    });

    renderModelsTab(BASE_SETTINGS);

    fireEvent.change(screen.getByLabelText(/working llm/i), {
      target: { value: "claude-haiku-4-5-20251001" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    expect(
      await screen.findByText("working_model_id must be one of: claude-sonnet-5")
    ).toBeInTheDocument();
  });

  it("shows a warning banner when the saved model is no longer in the allowlist", () => {
    renderModelsTab({ ...BASE_SETTINGS, working_model_id: "claude-opus-3-legacy" });

    expect(
      screen.getByText((text) => text.includes("is no longer available"))
    ).toBeInTheDocument();
    expect(screen.getByText("claude-opus-3-legacy")).toBeInTheDocument();
  });
});
