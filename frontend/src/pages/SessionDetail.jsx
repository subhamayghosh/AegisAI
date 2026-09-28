import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ShieldAlert } from "lucide-react";
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

export default function SessionDetail() {
  const { id } = useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["session-detail", id],
    queryFn: () => sessionsApi.getSession(id),
    retry: false,
  });

  if (isLoading) {
    return <p className="text-sm text-textMuted">Loading…</p>;
  }

  if (error) {
    const status = error.response?.status;
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
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

  const turns = data.turns;
  const chartData = turns.map((t) => ({ turn: t.turn_id, score: t.session_suspicion_score }));

  return (
    <div className="space-y-4">
      <Link
        to="/sessions"
        className="inline-flex items-center gap-1 text-sm text-textMuted hover:text-text"
      >
        <ArrowLeft size={14} aria-hidden="true" /> Back to sessions
      </Link>

      <div className="rounded-card border border-border bg-surface p-5">
        <h1 className="text-lg font-semibold">Session {id.slice(0, 8)}…</h1>

        <div className="mt-4 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--color-border))" />
              <XAxis dataKey="turn" stroke="rgb(var(--color-text-muted))" fontSize={12} />
              <YAxis domain={[0, 1]} stroke="rgb(var(--color-text-muted))" fontSize={12} />
              <Tooltip />
              <ReferenceLine
                y={SESSION_JAILBREAK_THRESHOLD}
                stroke="rgb(var(--color-neutralize))"
                strokeDasharray="4 4"
                label={{ value: "Threshold", fontSize: 11, fill: "rgb(var(--color-text-muted))" }}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="rgb(var(--color-primary))"
                strokeWidth={2}
                dot
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-textMuted">
                <th className="px-2 py-1 font-medium">Turn</th>
                <th className="px-2 py-1 font-medium">Source</th>
                <th className="px-2 py-1 font-medium">Attack type</th>
                <th className="px-2 py-1 font-medium">Decision</th>
                <th className="px-2 py-1 text-right font-medium">Suspicion score</th>
              </tr>
            </thead>
            <tbody>
              {turns.map((turn) => (
                <tr key={turn.inspection_id} className="border-t border-border">
                  <td className="px-2 py-1.5">{turn.turn_id}</td>
                  <td className="px-2 py-1.5">{turn.source_type}</td>
                  <td className="px-2 py-1.5">{turn.attack_type || "—"}</td>
                  <td className="px-2 py-1.5">
                    <DecisionPill decision={turn.final_decision} />
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {turn.session_suspicion_score.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
