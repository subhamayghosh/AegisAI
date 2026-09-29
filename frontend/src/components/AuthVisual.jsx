import { CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

const BENEFITS = [
  "Three-tier detection in one decision",
  "Source-aware neutralization for retrieved content",
  "Private by default — audit logs retain hashes only",
];

export default function AuthVisual({ mode }) {
  const isRegistration = mode === "register";

  return (
    <aside className="relative hidden min-h-screen overflow-hidden bg-slate-950 md:flex md:w-[42%] md:flex-col lg:w-[46%]">
      <img
        src="/images/security-network-bg.png"
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-55"
      />
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950/65 via-indigo-950/70 to-slate-950/90" />
      <div className="relative z-10 flex h-full flex-col p-6 lg:p-10 xl:p-14">
        <Link to="/" className="flex w-fit items-center gap-2 text-white">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20 backdrop-blur">
            <ShieldCheck size={23} className="text-cyan-300" aria-hidden="true" />
          </span>
          <span className="text-base font-semibold tracking-tight lg:text-lg">PromptShield</span>
        </Link>

        <div className="relative mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center py-7 text-center">
          <div className="absolute h-72 w-72 rounded-full bg-violet-500/25 blur-3xl" aria-hidden="true" />
          <img
            src="/images/auth-shield-3d.png"
            alt="A 3D shield protecting an AI prompt stream"
            className="relative z-10 -mb-3 w-full max-w-[16rem] drop-shadow-[0_30px_50px_rgba(34,211,238,0.25)] lg:-mb-6 lg:max-w-[25rem]"
          />
          <div className="relative z-10 mt-1 max-w-md">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-medium text-cyan-100">
              <Sparkles size={13} aria-hidden="true" /> Adaptive AI security
            </span>
            <h1 className="mt-4 text-xl font-semibold leading-tight tracking-tight text-white lg:text-3xl xl:text-4xl">
              {isRegistration
                ? "Build a safer path to every agent."
                : "The defense layer between content and your agent."}
            </h1>
            <p className="mt-3 hidden text-sm leading-6 text-slate-300 lg:block xl:text-base">
              {isRegistration
                ? "Create your workspace and inspect external content before it reaches your LLM."
                : "Resume your security command center and see exactly why each input is allowed, neutralized, or blocked."}
            </p>
          </div>
        </div>

        <ul className="relative z-10 hidden gap-3 rounded-2xl border border-white/10 bg-slate-950/30 p-5 text-sm text-slate-200 backdrop-blur-sm lg:grid">
          {BENEFITS.map((benefit) => (
            <li key={benefit} className="flex items-start gap-2.5">
              <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-emerald-300" aria-hidden="true" />
              <span>{benefit}</span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
