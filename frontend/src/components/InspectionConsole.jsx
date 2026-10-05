import { Check, Circle, Loader2, Terminal } from "lucide-react";
import { FRIENDLY_DECISIONS } from "../utils/inspectionFeedback";

const STAGES = [
  ["parse", "Read your content", "Keeping the source context intact"],
  ["tier1", "Wording check", "Looking for direct attempts to take control"],
  ["tier2", "Meaning check", "Looking for hidden or indirect requests"],
  ["tier3", "Safety review", "Understanding what the content is trying to do"],
  ["policy", "Explain the result", "Preparing a clear answer and next step"],
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
    <section className="rounded-2xl border border-slate-600 bg-gradient-to-br from-slate-900 via-slate-900 to-[#07101f] p-5 text-slate-100 shadow-[0_18px_45px_rgba(2,6,23,0.28)]" aria-label="Safety check progress">
      <div className="flex items-center justify-between gap-3 border-b border-slate-700 pb-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
          <Terminal size={15} aria-hidden="true" />
          Safety check progress
        </div>
        <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-200">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
          {active ? "checking" : "ready"}
        </span>
      </div>

      <ol className="mt-4 space-y-2" aria-live="polite">
        {STAGES.map(([id, label, detail], index) => {
          const status = active ? (index < completed ? "done" : index === completed ? "active" : "idle") : completedRun ? "done" : "idle";
          return (
            <li key={id} className={`flex gap-3 rounded-xl border px-2.5 py-2 ${status === "active" ? "border-cyan-300/30 bg-cyan-300/10" : "border-transparent"}`}>
              <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${status === "done" ? "border-emerald-400/60 bg-emerald-400/15 text-emerald-200" : status === "active" ? "border-cyan-300/70 bg-cyan-300/15 text-cyan-100" : "border-slate-500 text-slate-400"}`}>
                <StageIcon status={status} />
              </span>
              <span className="min-w-0">
                <span className={`block text-xs font-semibold ${status === "idle" ? "text-slate-300" : "text-white"}`}>{label}</span>
                <span className="block text-xs leading-5 text-slate-300">{detail}</span>
              </span>
            </li>
          );
        })}
      </ol>

      <div
        className="mt-4 max-h-72 overflow-y-auto rounded-xl border border-slate-600 bg-[#050b16] p-3.5 font-sans text-xs leading-5 text-slate-200 shadow-inner"
        role="log"
        aria-label="Progress details"
        aria-live="polite"
      >
        {entries.length === 0 ? (
          <span className="text-slate-400">Waiting for your content…</span>
        ) : (
          entries.map((entry, index) => (
            <div key={`${entry}-${index}`} className="flex gap-2">
              <span className="shrink-0 text-cyan-300">›</span>
              <span className="break-words">{entry}</span>
            </div>
          ))
        )}
      </div>

      {quote && (
        <blockquote className="mt-4 rounded-r-lg border-l-2 border-cyan-300/70 bg-slate-800/55 py-2 pr-3 pl-3">
          <p className="text-sm font-medium italic leading-6 text-white">“{quote.quote}”</p>
          <footer className="mt-1 text-xs leading-5 text-slate-300">
            {quote.author} · {quote.context}
          </footer>
        </blockquote>
      )}
    </section>
  );
}
