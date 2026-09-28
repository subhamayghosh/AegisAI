import { CheckCircle2, XCircle } from "lucide-react";
import ConfidenceBar from "./ConfidenceBar";

const TIER_LABELS = {
  tier1_heuristic: "Tier 1 — Heuristic",
  tier2_semantic: "Tier 2 — Semantic",
  tier3_llm_judge: "Tier 3 — LLM Judge",
};

export default function SignalCard({ signal }) {
  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{TIER_LABELS[signal.tier] || signal.tier}</span>
        {signal.flagged ? (
          <XCircle className="shrink-0 text-block" size={16} aria-label="Flagged" />
        ) : (
          <CheckCircle2 className="shrink-0 text-allow" size={16} aria-label="Not flagged" />
        )}
      </div>
      {signal.matched_rule && (
        <p className="mt-1 truncate text-xs text-textMuted" title={signal.matched_rule}>
          {signal.matched_rule}
        </p>
      )}
      <div className="mt-2">
        <ConfidenceBar value={signal.confidence} />
      </div>
      <p className="mt-1 text-xs text-textMuted">{signal.latency_ms} ms</p>
      {signal.notes && <p className="mt-1 text-xs text-textMuted">{signal.notes}</p>}
    </div>
  );
}
