import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import HistoryDetail from "../src/pages/HistoryDetail";

vi.mock("../src/api/history", () => ({
  getHistoryItem: vi.fn(),
}));

import * as historyApi from "../src/api/history";

function renderDetail(id) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/history/${id}`]}>
        <Routes>
          <Route path="/history/:id" element={<HistoryDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("HistoryDetail", () => {
  it("shows a not-found message and a back link when the API returns 404", async () => {
    historyApi.getHistoryItem.mockRejectedValue({ response: { status: 404 } });

    renderDetail("missing-id");

    expect(
      await screen.findByText(/this inspection could not be found/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to history/i })).toHaveAttribute(
      "href",
      "/history"
    );
  });
});
