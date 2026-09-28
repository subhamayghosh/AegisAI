import { Link } from "react-router-dom";
import { FileSearch, Filter, ShieldCheck } from "lucide-react";

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

export default function Landing() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-4 py-4">
        <div className="flex items-center gap-2 font-semibold">
          <ShieldCheck className="text-primary" size={22} aria-hidden="true" />
          <span>PromptShield</span>
        </div>
        <div className="flex gap-2">
          <Link
            to="/login"
            className="rounded-card border border-border px-4 py-2 text-sm font-medium hover:bg-surfaceAlt"
          >
            Login
          </Link>
          <Link
            to="/register"
            className="rounded-card bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primaryHover"
          >
            Register
          </Link>
        </div>
      </header>

      <section className="mx-auto flex max-w-3xl flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Stop prompt injection before it reaches your agent.
        </h1>
        <p className="mt-4 max-w-xl text-lg text-textMuted">
          PromptShield inspects every inbound message, document, and tool
          response through a three-tier defense pipeline — and shows you
          exactly why a decision was made.
        </p>
        <div className="mt-8 flex gap-3">
          <Link
            to="/register"
            className="rounded-card bg-primary px-6 py-3 text-sm font-semibold text-white hover:bg-primaryHover"
          >
            Get started
          </Link>
          <Link
            to="/login"
            className="rounded-card border border-border px-6 py-3 text-sm font-semibold hover:bg-surfaceAlt"
          >
            Sign in
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-6 px-4 py-12 sm:grid-cols-3">
        {STEPS.map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            className="rounded-card border border-border bg-surface p-6"
          >
            <Icon className="text-primary" size={28} aria-hidden="true" />
            <h2 className="mt-3 font-semibold">{title}</h2>
            <p className="mt-2 text-sm text-textMuted">{body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
