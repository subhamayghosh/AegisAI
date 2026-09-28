import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import History from "../src/pages/History";

vi.mock("../src/api/history", () => ({
  listHistory: vi.fn(),
}));

import * as historyApi from "../src/api/history";

function renderHistory() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <History />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("History", () => {
  it("re-fetches with updated query params when a filter changes", async () => {
    historyApi.listHistory.mockResolvedValue({
      items: [
        {
          id: "1",
          source_type: "user_message",
          final_decision: "BLOCK",
          attack_type: "instruction_override",
          input_hash: "abc123",
          latency_ms_total: 12,
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
      total: 1,
      page: 1,
      page_size: 25,
    });

    renderHistory();

    await waitFor(() =>
      expect(historyApi.listHistory).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, page_size: 25 })
      )
    );

    fireEvent.change(screen.getByLabelText(/decision/i), { target: { value: "BLOCK" } });

    await waitFor(() =>
      expect(historyApi.listHistory).toHaveBeenCalledWith(
        expect.objectContaining({ decision: "BLOCK", page: 1 })
      )
    );
  });

  it("shows an empty state with a CTA to /inspect when there are no results", async () => {
    historyApi.listHistory.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 25 });

    renderHistory();

    expect(
      await screen.findByText(/no inspections match these filters yet/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /run an inspection/i })).toBeInTheDocument();
  });
});
