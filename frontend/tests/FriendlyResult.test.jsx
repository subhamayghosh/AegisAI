import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import FriendlyResult from "../src/components/FriendlyResult";

describe("FriendlyResult", () => {
  it("explains a safety-review stop even when earlier checks found nothing", () => {
    render(
      <FriendlyResult
        result={{
          source_type: "user_message",
          final_decision: "BLOCK",
          latency_ms_total: 140,
          sanitized_text: null,
          tier_signals: [
            { tier: "tier1_heuristic", flagged: false, confidence: 0, matched_rule: null },
            { tier: "tier2_semantic", flagged: false, confidence: 0, matched_rule: null },
            {
              tier: "tier3_llm_judge",
              flagged: true,
              attack_type: "secret_extraction",
              confidence: 0.97,
              matched_rule: "judge:secret_extraction",
            },
          ],
        }}
      />
    );

    expect(screen.getByText("This content was stopped")).toBeInTheDocument();
    expect(screen.getAllByText(/asking for private setup or hidden instructions/i)).toHaveLength(2);
    expect(screen.getByText("No separate concern found")).toBeInTheDocument();
    expect(screen.getByText("97% certainty")).toBeInTheDocument();
    expect(screen.queryByText(/claude|tier 3|judge:|model/i)).not.toBeInTheDocument();
  });
});
