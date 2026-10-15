import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DEMO_ATTACKS } from "../src/demoAttacks";
import DemoTourPanel from "../src/components/DemoTourPanel";

describe("guided replay scenarios", () => {
  it("keeps every scenario title and payload distinct", () => {
    expect(DEMO_ATTACKS).toHaveLength(15);
    expect(new Set(DEMO_ATTACKS.map((scenario) => scenario.id)).size).toBe(15);
    expect(new Set(DEMO_ATTACKS.map((scenario) => scenario.title)).size).toBe(15);
    expect(new Set(DEMO_ATTACKS.map((scenario) => scenario.text)).size).toBe(15);
  });

  it("shows each scenario's title in the replay queue", () => {
    render(
      <DemoTourPanel
        scenarios={DEMO_ATTACKS}
        currentIndex={9}
        results={[]}
        status="idle"
        onStart={() => {}}
        onStop={() => {}}
        onExit={() => {}}
      />
    );

    expect(screen.getByText(/10\. Renewable energy brief/)).toBeInTheDocument();
    expect(screen.getByText(/11\. Mentor thank-you email/)).toBeInTheDocument();
    expect(screen.getByText(/12\. Photosynthesis explainer/)).toBeInTheDocument();
    expect(screen.queryByText("Benign control")).not.toBeInTheDocument();
  });
});
 
