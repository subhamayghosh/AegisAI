import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import InspectionConsole from "../src/components/InspectionConsole";

describe("InspectionConsole", () => {
  it("keeps supporting copy and trace output readable on the dark console", () => {
    render(
      <InspectionConsole
        active
        step={2}
        entries={["tier2: Looking for hidden or indirect requests"]}
        quote={{
          quote: "Security is a process, not a product.",
          author: "Bruce Schneier",
          context: "Every AegisAI decision leaves a trace.",
        }}
      />
    );

    expect(screen.getByText("Looking for hidden or indirect requests")).toHaveClass("text-slate-300");
    expect(screen.getByRole("log", { name: /progress details/i })).toHaveClass(
      "bg-[#050b16]",
      "text-slate-200"
    );
    expect(screen.getByText(/Bruce Schneier/)).toHaveClass("text-slate-300");
  });
});
