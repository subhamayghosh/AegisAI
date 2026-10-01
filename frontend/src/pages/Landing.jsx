import { Link } from "react-router-dom";
import { FileSearch, Filter, ShieldCheck, Sparkles } from "lucide-react";
import { ATTACK_TYPES, SOURCE_TYPES } from "../constants";

const STEPS = [
  {
    icon: Filter,
    title: "Tier 1 — Heuristics",
    body: "Regex rules catch known instruction-override, role-change, and encoded-payload patterns in milliseconds.",
  },
  {
    icon: FileSearch,
    title: "Tier 2 — Semantic",
    body: "Local sentence embeddings flag paraphrased attacks that regex alone would miss.",
  },
  {
    icon: ShieldCheck,
    title: "Tier 3 — LLM Judge",
    body: "A Claude judge model reasons over ambiguous, multi-turn, or context-dependent injection attempts.",
  },
];

// Counted from the shared enum lists and the tier cards above rather than
// written as literals, so these headline figures cannot drift out of sync when
// a source type, attack type, or tier is added.
const STATS = [
  { value: SOURCE_TYPES.length, label: "input source types protected" },
  { value: ATTACK_TYPES.length, label: "prompt-injection attack types" },
  { value: STEPS.length, label: "defense tiers, one clear decision" },
];

export default function Landing() {
  return (
    <div className="min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="relative isolate min-h-screen">
        <img
          src="/images/security-network-bg.png"
          alt=""
          className="absolute inset-0 -z-20 h-full w-full object-cover opacity-70"
        />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_25%,rgba(99,102,241,.28),transparent_27rem),linear-gradient(110deg,rgba(2,6,23,.95),rgba(2,6,23,.72),rgba(2,6,23,.9))]" />

        <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
          <div className="flex items-center gap-2.5 font-semibold">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20 backdrop-blur">
              <ShieldCheck className="text-cyan-300" size={21} aria-hidden="true" />
            </span>
            <span className="tracking-tight">AegisAI</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="rounded-xl border border-white/15 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-white/30 hover:bg-white/10"
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-indigo-950/30 transition hover:-translate-y-0.5 hover:bg-cyan-50"
            >
              Sign up
            </Link>
          </div>
        </header>

        <section className="mx-auto flex max-w-7xl flex-col px-5 pb-20 pt-20 sm:px-8 lg:pb-28 lg:pt-28">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-medium text-cyan-100 backdrop-blur">
              <Sparkles size={14} aria-hidden="true" />
              Prompt-injection defense for production agents
            </span>
            <h1 className="mt-6 max-w-3xl text-5xl font-semibold leading-[1.02] tracking-[-0.045em] text-white sm:text-6xl lg:text-7xl">
              Protect every input before it reaches your <span className="text-cyan-300">AI agent.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
              AegisAI inspects every message, document, and tool response through a three-tier defense pipeline — then makes the reason visible.
            </p>
          </div>

          <div className="mt-16 grid max-w-5xl gap-4 sm:grid-cols-3">
            {STATS.map(({ value, label }) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-slate-950/35 p-5 backdrop-blur-sm">
                <p className="text-2xl font-semibold text-white">{value}</p>
                <p className="mt-1 text-sm text-slate-300">{label}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="bg-slate-50 px-5 py-20 text-slate-900 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">Defense in depth</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Fast when it can be. Thoughtful when it has to be.</h2>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, body }, index) => (
              <div key={title} className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-100/60">
                <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${index === 0 ? "bg-violet-100 text-violet-700" : index === 1 ? "bg-cyan-100 text-cyan-700" : "bg-fuchsia-100 text-fuchsia-700"}`}>
                  <Icon size={22} aria-hidden="true" />
                </span>
                <h2 className="mt-5 font-semibold">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
