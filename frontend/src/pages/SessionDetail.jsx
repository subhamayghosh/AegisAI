import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  Gauge,
  ShieldAlert,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import * as sessionsApi from "../api/sessions";
import DecisionPill from "../components/DecisionPill";
import { SESSION_JAILBREAK_THRESHOLD } from "../constants";
import { attackLabel, sourceLabel } from "../utils/inspectionFeedback";

const CHART_TICKS = [0, 0.25, 0.5, 0.75, 1];

function clampScore(value) {
  return Math.min(Math.max(Number(value) || 0, 0), 1);
}

function formatPercent(value) {
  return `${Math.round(clampScore(value) * 100)}%`;
}

function SessionTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2 shadow-xl">
      <p className="text-xs font-semibold text-text">Turn {label}</p>
      <p className="mt-1 text-xs text-textMuted">
        Safety signal: <span className="font-semibold text-primary">{formatPercent(payload[0].value)}</span>
      </p>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, detail, tone = "primary" }) {
  const toneStyles = {
    primary: "bg-primary/10 text-primary",
    neutralize: "bg-neutralizeBg text-neutralize",
    block: "bg-blockBg text-block",
    allow: "bg-allowBg text-allow",
  };

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <span className={`grid h-9 w-9 place-items-center rounded-xl ${toneStyles[tone]}`}>
          <Icon size={17} aria-hidden="true" />
        </span>
        <span className="text-xs font-medium text-textMuted">{label}</span>
      </div>
      <p className="mt-3 text-xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs leading-5 text-textMuted">{detail}</p>
    </div>
  );
}

export default function SessionDetail() {
  const { id } = useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["session-detail", id],
    queryFn: () => sessionsApi.getSession(id),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="rounded-3xl border border-border bg-surface p-6">
        <div className="h-5 w-44 animate-pulse rounded bg-surfaceAlt" />
        <div className="mt-4 h-28 animate-pulse rounded-2xl bg-surfaceAlt" />
      </div>
    );
  }

  if (error) {
    const status = error.response?.status;
    return (
      <div className="flex flex-col items-center gap-3 rounded-3xl border border-border bg-surface py-16 text-center">
        <ShieldAlert className="text-textMuted" size={32} aria-hidden="true" />
        <p className="text-sm text-textMuted">
          {status === 404 ? "This session could not be found." : "Failed to load this session."}
        </p>
        <Link to="/sessions" className="text-sm font-medium text-primary hover:underline">
          Back to sessions
        </Link>
      </div>
    );
  }

  const turns = data?.turns ?? [];
  const chartData = turns.map((turn) => ({
    turn: turn.turn_id,
    score: clampScore(turn.session_suspicion_score),
  }));
  const maxScore = chartData.length ? Math.max(...chartData.map((point) => point.score)) : 0;
  const latestTurn = turns[turns.length - 1];
  const latestDecision = latestTurn?.final_decision || (maxScore >= SESSION_JAILBREAK_THRESHOLD ? "BLOCK" : "ALLOW");
  const needsAttention = turns.filter((turn) => turn.final_decision !== "ALLOW").length;
  const scoreTone = maxScore >= SESSION_JAILBREAK_THRESHOLD ? "block" : maxScore >= 0.4 ? "neutralize" : "allow";

  return (
    <div className="space-y-5">
      <Link
        to="/sessions"
        className="inline-flex items-center gap-1 text-sm text-textMuted transition hover:text-text"
      >
        <ArrowLeft size={14} aria-hidden="true" /> Back to sessions
      </Link>

      <section
        className="relative z-10 isolate overflow-hidden rounded-3xl border border-indigo-300/35 bg-slate-950 p-5 text-white shadow-[0_20px_60px_rgba(30,41,89,0.28)] sm:p-7"
        style={{ background: "linear-gradient(135deg, rgb(30 27 75) 0%, rgb(15 23 42) 52%, rgb(8 51 68) 100%)" }}
      >
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-cyan-400/15 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-indigo-400/20 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
              <Activity size={15} aria-hidden="true" /> Session safety journey
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Your conversation at a glance</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
              Follow how the safety signal changed across each turn and see where the conversation needed attention.
            </p>
            <span className="mt-4 inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1.5 font-mono text-[11px] text-slate-300">
              Conversation reference · {id.slice(0, 8)}…
            </span>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 p-4 lg:min-w-52 lg:text-right">
            <p className="text-xs font-medium text-slate-300">Latest outcome</p>
            <div className="mt-2 flex items-center gap-2 lg:justify-end">
              <DecisionPill decision={latestDecision} friendly />
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-300">
              {maxScore >= SESSION_JAILBREAK_THRESHOLD
                ? "Review recommended for this conversation."
                : latestDecision === "ALLOW"
                  ? "No conversation-level threshold was reached."
                  : "A protective action was taken on the latest turn."}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Session summary">
        <SummaryCard
          icon={TrendingUp}
          label="Highest safety signal"
          value={formatPercent(maxScore)}
          detail={`Review line is set at ${formatPercent(SESSION_JAILBREAK_THRESHOLD)}.`}
          tone={scoreTone}
        />
        <SummaryCard
          icon={Gauge}
          label="Conversation turns"
          value={turns.length}
          detail={turns.length === 1 ? "One message checked" : `${turns.length} messages checked`}
        />
        <SummaryCard
          icon={needsAttention ? CircleAlert : CheckCircle2}
          label="Turns needing attention"
          value={`${needsAttention} of ${turns.length}`}
          detail={needsAttention ? "A review or protective action was triggered." : "Every turn stayed within the expected boundary."}
          tone={needsAttention ? "neutralize" : "allow"}
        />
        <SummaryCard
          icon={Sparkles}
          label="Conversation status"
          value={latestDecision === "ALLOW" ? "On track" : "Protected"}
          detail={latestDecision === "ALLOW" ? "The latest turn can continue." : "AegisAI kept the latest concern contained."}
          tone={latestDecision === "ALLOW" ? "allow" : "block"}
        />
      </section>

      {turns.length === 0 ? (
        <section className="rounded-3xl border border-border bg-surface p-8 text-center">
          <Activity className="mx-auto text-textMuted" size={30} aria-hidden="true" />
          <h2 className="mt-3 text-base font-semibold">No turns to display yet</h2>
          <p className="mt-1 text-sm text-textMuted">This session does not have any recorded inspections.</p>
        </section>
      ) : (
        <>
          <section className="rounded-3xl border border-border bg-surface p-4 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Conversation signal</p>
                <h2 className="mt-1 text-lg font-semibold">How the safety signal changed</h2>
                <p className="mt-1 text-sm text-textMuted">A higher signal means the conversation deserves a closer look.</p>
              </div>
              <span className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
                {turns.length} {turns.length === 1 ? "turn" : "turns"} tracked
              </span>
            </div>

            <div className="mt-5 h-64 w-full" aria-label="Safety signal by conversation turn">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 12, right: 14, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--color-border))" vertical={false} />
                  <XAxis
                    dataKey="turn"
                    stroke="rgb(var(--color-text-muted))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    label={{ value: "Turn", position: "insideBottomRight", offset: -2, fill: "rgb(var(--color-text-muted))", fontSize: 11 }}
                  />
                  <YAxis
                    domain={[0, 1]}
                    ticks={CHART_TICKS}
                    tickFormatter={formatPercent}
                    stroke="rgb(var(--color-text-muted))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    width={42}
                  />
                  <Tooltip content={<SessionTooltip />} cursor={{ stroke: "rgb(var(--color-primary) / 0.24)" }} />
                  <ReferenceLine
                    y={SESSION_JAILBREAK_THRESHOLD}
                    stroke="rgb(var(--color-neutralize))"
                    strokeDasharray="5 5"
                    label={{ value: "Review line", position: "insideTopRight", fontSize: 11, fill: "rgb(var(--color-text-muted))" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="rgb(var(--color-primary))"
                    strokeWidth={3}
                    dot={{ r: 3, fill: "rgb(var(--color-surface))", stroke: "rgb(var(--color-primary))", strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: "rgb(var(--color-primary))", stroke: "rgb(var(--color-surface))", strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-textMuted">
              <span className="inline-flex items-center gap-2"><span className="h-2 w-6 rounded-full bg-primary" aria-hidden="true" /> Safety signal</span>
              <span className="inline-flex items-center gap-2"><span className="h-0.5 w-6 border-t-2 border-dashed border-neutralize" aria-hidden="true" /> Review line at {formatPercent(SESSION_JAILBREAK_THRESHOLD)}</span>
            </div>
          </section>

          <section className="rounded-3xl border border-border bg-surface p-4 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Turn-by-turn story</p>
                <h2 className="mt-1 text-lg font-semibold">What happened in each turn</h2>
                <p className="mt-1 text-sm text-textMuted">Each message gets its own clear outcome and safety signal.</p>
              </div>
              <span className="text-xs text-textMuted">{needsAttention ? `${needsAttention} turn${needsAttention === 1 ? "" : "s"} need attention` : "No turns need attention"}</span>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[700px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-textMuted">
                    <th className="px-3 pb-3 font-medium">Turn</th>
                    <th className="px-3 pb-3 font-medium">Content source</th>
                    <th className="px-3 pb-3 font-medium">What we found</th>
                    <th className="px-3 pb-3 font-medium">Outcome</th>
                    <th className="px-3 pb-3 text-right font-medium">Safety signal</th>
                  </tr>
                </thead>
                <tbody>
                  {turns.map((turn) => {
                    const score = clampScore(turn.session_suspicion_score);
                    const concern = turn.attack_type ? attackLabel(turn.attack_type) : "No specific concern";
                    return (
                      <tr key={turn.inspection_id} className="border-b border-border/70 transition-colors hover:bg-surfaceAlt/45 last:border-0">
                        <td className="px-3 py-3.5">
                          <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-primary/10 px-2 text-xs font-bold text-primary">
                            {turn.turn_id}
                          </span>
                        </td>
                        <td className="px-3 py-3.5 font-medium">{sourceLabel(turn.source_type)}</td>
                        <td className="px-3 py-3.5 text-textMuted">{concern}</td>
                        <td className="px-3 py-3.5"><DecisionPill decision={turn.final_decision} friendly /></td>
                        <td className="px-3 py-3.5">
                          <div className="flex items-center justify-end gap-2">
                            <div className="h-2 w-24 rounded-full bg-surfaceAlt" aria-hidden="true">
                              <div className={`h-full rounded-full ${score >= SESSION_JAILBREAK_THRESHOLD ? "bg-block" : score >= 0.4 ? "bg-neutralize" : "bg-primary"}`} style={{ width: `${score * 100}%` }} />
                            </div>
                            <span className="w-10 text-right text-xs font-semibold text-textMuted">{formatPercent(score)}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
 
