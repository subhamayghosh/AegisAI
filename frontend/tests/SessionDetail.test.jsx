import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import SessionDetail from "../src/pages/SessionDetail";

vi.mock("../src/api/sessions", () => ({
  getSession: vi.fn(),
}));

import * as sessionsApi from "../src/api/sessions";

const SESSION_ID = "3ce5ecdf-9c1a-4a9d-9a2f-2f4b0d7e5a11";
const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;

function renderDetail(id = SESSION_ID) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/sessions/${id}`]}>
        <Routes>
          <Route path="/sessions/:id" element={<SessionDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeAll(() => {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.getBoundingClientRect = () => ({
    width: 800,
    height: 320,
    top: 0,
    right: 800,
    bottom: 320,
    left: 0,
    x: 0,
    y: 0,
    toJSON() {},
  });
});

afterAll(() => {
  delete globalThis.ResizeObserver;
  Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
});

beforeEach(() => vi.clearAllMocks());

describe("SessionDetail", () => {
  it("presents a friendly session journey with readable turn outcomes", async () => {
    sessionsApi.getSession.mockResolvedValue({
      session_id: SESSION_ID,
      turns: [
        {
          inspection_id: "inspection-1",
          turn_id: 1,
          source_type: "user_message",
          attack_type: "instruction_override",
          final_decision: "BLOCK",
          session_suspicion_score: 0.85,
        },
        {
          inspection_id: "inspection-2",
          turn_id: 2,
          source_type: "email",
          attack_type: null,
          final_decision: "ALLOW",
          session_suspicion_score: 0.2,
        },
        {
          inspection_id: "inspection-3",
          turn_id: 3,
          source_type: "image",
          attack_type: "indirect_prompt_injection",
          final_decision: "NEUTRALIZE",
          session_suspicion_score: 0.72,
        },
      ],
    });

    renderDetail();

    expect(await screen.findByRole("heading", { name: /your conversation at a glance/i })).toBeInTheDocument();
    expect(screen.getByText("Review recommended for this conversation.")).toBeInTheDocument();
    expect(screen.getAllByText("85%")).toHaveLength(2);
    expect(screen.getByText("User message")).toBeInTheDocument();
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("Image")).toBeInTheDocument();
    expect(screen.getByText("Instruction override")).toBeInTheDocument();
    expect(screen.getByText("No specific concern")).toBeInTheDocument();
    expect(screen.getByText("Indirect prompt injection")).toBeInTheDocument();
    expect(screen.getByText("Protected")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to sessions/i })).toHaveAttribute("href", "/sessions");
    expect(screen.queryByText("session_suspicion_score")).not.toBeInTheDocument();
  });

  it("shows a friendly not-found state", async () => {
    sessionsApi.getSession.mockRejectedValue({ response: { status: 404 } });

    renderDetail("missing-session");

    expect(await screen.findByText("This session could not be found.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to sessions/i })).toHaveAttribute("href", "/sessions");
  });
});
 
