import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Dashboard from "../src/pages/Dashboard";

vi.mock("../src/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1", role: "user", display_name: "Test User" } }),
}));

vi.mock("../src/hooks/useToast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

vi.mock("../src/api/history", () => ({
  listHistory: vi.fn(),
}));
vi.mock("../src/api/admin", () => ({
  getMetrics: vi.fn(),
  getEvents: vi.fn(),
}));
vi.mock("../src/api/sessions", () => ({
  listSessions: vi.fn(),
  getSession: vi.fn(),
}));
vi.mock("../src/api/firewall", () => ({
  inspect: vi.fn(),
}));

vi.mock("../src/utils/delay", () => ({
  delay: vi.fn().mockResolvedValue(undefined),
}));

import * as historyApi from "../src/api/history";
import * as sessionsApi from "../src/api/sessions";
import * as firewallApi from "../src/api/firewall";

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchInterval: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Dashboard />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionsApi.listSessions.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 1 });
  sessionsApi.getSession.mockResolvedValue({ session_id: "s1", turns: [] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Dashboard", () => {
  it("renders stat cards computed from the mocked history API", async () => {
    historyApi.listHistory.mockResolvedValue({
      items: [
        { id: "1", source_type: "user_message", final_decision: "BLOCK", attack_type: "instruction_override", input_hash: "abcdefghijklmnop", latency_ms_total: 12, created_at: "2026-01-01T00:00:00Z" },
        { id: "2", source_type: "user_message", final_decision: "ALLOW", attack_type: null, input_hash: "qrstuvwxyzabcdef", latency_ms_total: 8, created_at: "2026-01-01T00:00:01Z" },
        { id: "3", source_type: "user_message", final_decision: "NEUTRALIZE", attack_type: "role_change", input_hash: "ghijklmnopqrstuv", latency_ms_total: 15, created_at: "2026-01-01T00:00:02Z" },
      ],
      total: 3,
      page: 1,
      page_size: 50,
    });

    renderDashboard();

    await waitFor(() =>
      expect(within(screen.getByTestId("stat-Total")).getByText("3")).toBeInTheDocument()
    );
    expect(within(screen.getByTestId("stat-Blocked")).getByText("1")).toBeInTheDocument();
    expect(within(screen.getByTestId("stat-Neutralized")).getByText("1")).toBeInTheDocument();
    expect(within(screen.getByTestId("stat-Allowed")).getByText("1")).toBeInTheDocument();
  });

  it("fires 15 scripted requests when Run demo mode is clicked", async () => {
    historyApi.listHistory.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 50 });
    firewallApi.inspect.mockResolvedValue({
      input_id: "i1",
      session_id: "s1",
      turn_id: 1,
      final_decision: "ALLOW",
      tier_signals: [],
      session_suspicion_score: 0,
      reason: "ok",
      working_model_id: "claude-sonnet-5",
      judge_model_id: "claude-opus-4-7",
      latency_ms_total: 10,
    });

    renderDashboard();

    const button = await screen.findByRole("button", { name: /run demo mode/i });
    fireEvent.click(button);

    await waitFor(() => expect(firewallApi.inspect).toHaveBeenCalledTimes(15));
  });
});
