import { CheckCircle2, ChevronDown, ShieldAlert, ShieldCheck, ShieldX, Sparkles } from "lucide-react";
import { FRIENDLY_DECISIONS, getFriendlyChecks, getResultContext, getSignalMessage, getVerdictConfidence, sourceLabel } from "../utils/inspectionFeedback";
import ConfidenceBar from "./ConfidenceBar";

const TONE_STYLES = {
  allow: { panel: "border-allow/25 bg-allowBg/70", icon: "bg-allow text-white", accent: "text-allow" },
  neutralize: { panel: "border-neutralize/25 bg-neutralizeBg/70", icon: "bg-neutralize text-white", accent: "text-neutralize" },
  block: { panel: "border-block/25 bg-blockBg/70", icon: "bg-block text-white", accent: "text-block" },
};
const ICONS = { allow: ShieldCheck, neutralize: ShieldAlert, block: ShieldX };

function CheckIcon({ status }) {
  if (status === "flagged") return <ShieldAlert size={17} aria-label="Needs attention" />;
  return <CheckCircle2 size={17} aria-label="No separate concern" />;
}

export default function FriendlyResult({ result, sourceType = null }) {
  const decision = FRIENDLY_DECISIONS[result.final_decision] || FRIENDLY_DECISIONS.ALLOW;
  const tone = TONE_STYLES[decision.tone];
  const Icon = ICONS[decision.tone];
  const context = getResultContext({ ...result, source_type: result.source_type || sourceType });
  const checks = getFriendlyChecks(result.tier_signals);
  const source = sourceLabel(result.source_type || sourceType);
  const verdictConfidence = Math.round(getVerdictConfidence(result) * 100);

  return (
    <div className="space-y-4" aria-label="Inspection result">
      <section className={`relative overflow-hidden rounded-3xl border p-5 sm:p-6 ${tone.panel}`}>
        <div className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full bg-white/30 blur-3xl" aria-hidden="true" />
        <div className="relative flex gap-4">
          <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl shadow-lg ${tone.icon}`}><Icon size={25} aria-hidden="true" /></span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className={`text-xs font-bold uppercase tracking-[0.16em] ${tone.accent}`}>AegisAI verdict</p>
              <span className="rounded-full border border-current/20 px-2 py-0.5 text-[11px] font-semibold">{decision.label}</span>
              <span className="rounded-full bg-surface/70 px-2 py-0.5 text-[11px] font-semibold text-textMuted">{verdictConfidence}% confidence</span>
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">{decision.title}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-textMuted">{decision.description}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-textMuted">
              <span className="rounded-full bg-surface/70 px-3 py-1.5">Source: {source}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
        <div className="flex items-center gap-2"><Sparkles size={17} className="text-primary" aria-hidden="true" /><h3 className="text-base font-semibold">What this means</h3></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <InfoBlock title="Why" text={context.issue} />
          <InfoBlock title="What happened" text={context.outcome} />
          <InfoBlock title="Your next step" text={context.nextStep} />
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div><h3 className="text-base font-semibold">How we reached this answer</h3><p className="mt-1 text-sm text-textMuted">Each check has a simple job. A green check means it found no additional concern.</p></div>
          <span className="text-xs text-textMuted">Completed in {result.latency_ms_total ?? 0} ms</span>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {checks.map((check) => {
            const confidence = check.signal?.confidence ?? 0;
            return <article key={check.tier} className={`rounded-2xl border p-4 ${check.status === "flagged" ? "border-block/30 bg-blockBg/35" : "border-border bg-surfaceAlt/45"}`}>
              <div className="flex items-center justify-between gap-2"><h4 className="text-sm font-semibold">{check.title}</h4><span className={check.status === "flagged" ? "text-block" : "text-allow"}><CheckIcon status={check.status} /></span></div>
              <p className="mt-3 min-h-10 text-sm leading-5 text-textMuted">{getSignalMessage(check)}</p>
              {check.signal?.flagged ? <div className="mt-3"><ConfidenceBar value={confidence} label="How certain this check is" /><p className="mt-1 text-xs text-textMuted">{Math.round(confidence * 100)}% certainty</p></div> : <p className="mt-3 text-xs font-medium text-allow">{check.detail}</p>}
            </article>;
          })}
        </div>
      </section>

      {result.sanitized_text && <details className="group rounded-2xl border border-border bg-surface p-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold"><span>{result.final_decision === "NEUTRALIZE" ? "See the cleaned version" : "See the content that can continue"}</span><ChevronDown size={17} className="transition group-open:rotate-180" aria-hidden="true" /></summary>
        <div className="mt-3 whitespace-pre-wrap rounded-xl border border-border bg-surfaceAlt/60 p-3 text-sm leading-6 text-textMuted">{result.sanitized_text}</div>
      </details>}
    </div>
  );
}

function InfoBlock({ title, text }) {
  return <div className="rounded-xl bg-surfaceAlt/70 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-textMuted">{title}</p><p className="mt-1.5 text-sm leading-5">{text}</p></div>;
}
