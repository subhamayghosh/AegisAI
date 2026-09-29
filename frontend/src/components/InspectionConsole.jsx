import { Check, Circle, Loader2, Terminal } from "lucide-react";

const STAGES = [
  ["parse", "Normalize input", "Reading the selected source boundary"],
  ["tier1", "Tier 1 · Heuristic", "Scanning rules and encoded payloads"],
  ["tier2", "Tier 2 · Semantic", "Comparing meaning against local attack patterns"],
  ["tier3", "Tier 3 · Claude judge", "Asking the configured Anthropic judge for intent"],
  ["policy", "Policy + audit", "Combining signals, sanitizing, and recording a hash"],
];

export function inspectionStages() {
  return STAGES;
}

function StageIcon({ status }) {
  if (status === "done") return <Check size={13} aria-hidden="true" />;
  if (status === "active") return <Loader2 size={13} className="animate-spin" aria-hidden="true" />;
  return <Circle size={11} aria-hidden="true" />;
}

export default function InspectionConsole({ active, step, entries, quote }) {
  const completed = active ? step : STAGES.length;
  const completedRun = !active && entries.length > 0;

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-slate-200 shadow-inner" aria-label="Live inspection console">
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
          <Terminal size={15} aria-hidden="true" />
          Live inspection console
        </div>
        <span className="flex items-center gap-1.5 text-[11px] text-emerald-300">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
          {active ? "processing" : "ready"}
        </span>
      </div>

      <ol className="mt-4 space-y-2" aria-live="polite">
        {STAGES.map(([id, label, detail], index) => {
          const status = active ? (index < completed ? "done" : index === completed ? "active" : "idle") : completedRun ? "done" : "idle";
          return (
            <li key={id} className={`flex gap-3 rounded-xl px-2 py-1.5 ${status === "active" ? "bg-cyan-400/10" : ""}`}>
              <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${status === "done" ? "border-emerald-400/50 bg-emerald-400/15 text-emerald-300" : status === "active" ? "border-cyan-300/60 bg-cyan-300/15 text-cyan-200" : "border-slate-700 text-slate-600"}`}>
                <StageIcon status={status} />
              </span>
              <span className="min-w-0">
                <span className={`block text-xs font-medium ${status === "idle" ? "text-slate-500" : "text-slate-100"}`}>{label}</span>
                <span className="block text-[11px] leading-5 text-slate-500">{detail}</span>
              </span>
            </li>
          );
        })}
      </ol>

      <div className="mt-4 rounded-xl border border-slate-800 bg-black/30 p-3 font-mono text-[11px] leading-5 text-slate-400">
        {entries.length === 0 ? (
          <span className="text-slate-600">$ awaiting inspection input…</span>
        ) : (
          entries.map((entry, index) => (
            <div key={`${entry}-${index}`}><span className="mr-2 text-cyan-400">›</span>{entry}</div>
          ))
        )}
      </div>

      {quote && (
        <blockquote className="mt-4 border-l-2 border-cyan-300/50 pl-3">
          <p className="text-sm italic leading-6 text-slate-100">“{quote.quote}”</p>
          <footer className="mt-1 text-[11px] text-slate-500">
            {quote.author} · {quote.context}
          </footer>
        </blockquote>
      )}
    </section>
  );
}
