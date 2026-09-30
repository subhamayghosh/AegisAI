import { Check, Circle, Pause, Play, RotateCcw, Sparkles, Square, X } from "lucide-react";
import DecisionPill from "./DecisionPill";
import { ATTACK_TYPE_LABELS, SOURCE_TYPES } from "../constants";

const SOURCE_LABELS = Object.fromEntries(SOURCE_TYPES.map((source) => [source.value, source.label]));

function scenarioLabel(scenario) {
  return ATTACK_TYPE_LABELS[scenario.label] || (scenario.label === "benign" ? "Benign control" : scenario.label);
}

function statusText(status) {
  if (status === "running") return "Live replay in progress";
  if (status === "stopping") return "Finishing the current inspection";
  if (status === "complete") return "Replay complete";
  if (status === "stopped") return "Replay paused";
  return "Ready when you are";
}

export default function DemoTourPanel({
  scenarios,
  currentIndex,
  results,
  status,
  onStart,
  onStop,
  onExit,
}) {
  const total = scenarios.length;
  const current = scenarios[currentIndex >= 0 ? currentIndex : 0];
  const isRunning = status === "running" || status === "stopping";
  const completed = results.length;
  const progress = total ? Math.round((completed / total) * 100) : 0;
  const progressWidth = progress === 0 ? "w-0" : progress < 34 ? "w-1/4" : progress < 67 ? "w-1/2" : progress < 100 ? "w-3/4" : "w-full";

  return (
    <section className="relative overflow-hidden rounded-3xl border border-indigo-400/30 bg-gradient-to-br from-slate-950 via-indigo-950 to-cyan-950 p-5 text-white shadow-[0_24px_70px_rgba(30,41,89,0.28)] sm:p-7" aria-label="Guided live demo">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-indigo-400/20 blur-3xl" aria-hidden="true" />

      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
            <Sparkles size={15} aria-hidden="true" />
            AegisAI live mission
          </div>
          <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-medium text-slate-200">
            Synthetic content · safe to replay
          </span>
        </div>

        <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">See the firewall think.</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
              Watch real inspections move through parsing, heuristics, semantic search, Claude, and policy—one explainable decision at a time.
            </p>
          </div>
          <div className="min-w-44 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 lg:text-right">
            <p className="text-xs font-medium text-slate-300">{statusText(status)}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{completed}<span className="text-base text-slate-400">/{total}</span></p>
            <p className="text-xs text-cyan-200">{progress}% of the tour</p>
          </div>
        </div>

        <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10" aria-label={`${progress}% demo progress`} role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progress}>
          <div className={`h-full rounded-full bg-gradient-to-r from-cyan-300 via-indigo-300 to-fuchsia-300 transition-all duration-500 ${progressWidth}`} />
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(18rem,0.95fr)]">
          <div className="rounded-2xl border border-white/15 bg-black/20 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">Now inspecting</p>
                <h2 className="mt-2 text-lg font-semibold">{scenarioLabel(current)}</h2>
                <p className="mt-1 text-sm text-slate-300">{SOURCE_LABELS[current.source_type] || current.source_type} · scenario {(currentIndex >= 0 ? currentIndex : 0) + 1} of {total}</p>
              </div>
              <span className="rounded-xl border border-cyan-200/20 bg-cyan-200/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-100">LIVE TRACE</span>
            </div>
            <p className="mt-4 line-clamp-3 rounded-xl border border-white/10 bg-slate-950/45 p-3 text-xs leading-5 text-slate-300">
              {current.text}
            </p>
          </div>

          <div className="rounded-2xl border border-white/15 bg-black/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">Scenario queue</p>
              <span className="text-xs text-slate-400">{total} checks</span>
            </div>
            <ol className="mt-3 max-h-36 space-y-1.5 overflow-y-auto pr-1" aria-label="Demo scenario queue">
              {scenarios.map((scenario, index) => {
                const item = results[index];
                const isCurrent = index === currentIndex;
                return (
                  <li key={`${scenario.label}-${index}`} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs ${isCurrent ? "bg-cyan-300/15 text-white" : "text-slate-400"}`}>
                    <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full border border-white/15">
                      {item?.response ? <Check size={10} className="text-emerald-300" aria-label="Completed" /> : item?.error ? <X size={10} className="text-rose-300" aria-label="Failed" /> : isCurrent && isRunning ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-200" /> : <Circle size={9} className="text-slate-500" aria-label="Pending" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{index + 1}. {scenarioLabel(scenario)}</span>
                    {item?.response && <DecisionPill decision={item.response.final_decision} />}
                  </li>
                );
              })}
            </ol>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {isRunning ? (
            <button type="button" onClick={onStop} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-50">
              {status === "stopping" ? <Pause size={15} aria-hidden="true" /> : <Square size={15} aria-hidden="true" />}
              {status === "stopping" ? "Finishing current check…" : "Stop after this check"}
            </button>
          ) : (
            <button type="button" onClick={onStart} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-50">
              {status === "idle" ? <Play size={15} aria-hidden="true" /> : <RotateCcw size={15} aria-hidden="true" />}
              {status === "idle" ? "Start guided replay" : "Replay full tour"}
            </button>
          )}
          <button type="button" onClick={onExit} className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/10">
            <ArrowLeftIcon />
            Back to dashboard
          </button>
          <span className="text-xs text-slate-400" aria-live="polite">{isRunning ? "The Inspect console below is following this scenario." : "Choose replay when you want to watch the full pipeline again."}</span>
        </div>
      </div>
    </section>
  );
}

function ArrowLeftIcon() {
  return <span aria-hidden="true">←</span>;
}
