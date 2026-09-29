import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import * as historyApi from "../api/history";
import DecisionPill from "../components/DecisionPill";
import SignalCard from "../components/SignalCard";
import { ATTACK_TYPE_LABELS } from "../constants";

export default function HistoryDetail() {
  const { id } = useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["history-detail", id],
    queryFn: () => historyApi.getHistoryItem(id),
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
          {status === 404
            ? "This inspection could not be found."
            : "Failed to load this inspection."}
        </p>
        <Link to="/history" className="text-sm font-medium text-primary hover:underline">
          Back to history
        </Link>
      </div>
    );
  }

  const item = data;

  return (
    <div className="space-y-4">
      <Link
        to="/history"
        className="inline-flex items-center gap-1 text-sm text-textMuted hover:text-text"
      >
        <ArrowLeft size={14} aria-hidden="true" /> Back to history
      </Link>

      <div className="rounded-card border border-border bg-surface p-5">
        <div className="flex flex-wrap items-center gap-3">
          <DecisionPill decision={item.final_decision} />
          {item.attack_type && (
            <span className="rounded-full bg-surfaceAlt px-2.5 py-0.5 text-xs font-medium text-textMuted">
              {ATTACK_TYPE_LABELS[item.attack_type] ?? item.attack_type}
            </span>
          )}
          <span className="text-xs text-textMuted">
            {new Date(item.created_at).toLocaleString()}
          </span>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 text-sm md:grid-cols-4">
          <div>
            <dt className="text-xs text-textMuted">Source type</dt>
            <dd>{item.source_type}</dd>
          </div>
          <div className="col-span-2 md:col-span-2">
            <dt className="text-xs text-textMuted">Input hash</dt>
            <dd className="break-all font-mono text-xs leading-relaxed">{item.input_hash}</dd>
          </div>
          <div>
            <dt className="text-xs text-textMuted">Latency</dt>
            <dd>{item.latency_ms_total} ms</dd>
          </div>
          <div>
            <dt className="text-xs text-textMuted">Working model</dt>
            <dd>{item.working_model_id}</dd>
          </div>
          <div>
            <dt className="text-xs text-textMuted">Judge model</dt>
            <dd>{item.judge_model_id}</dd>
          </div>
          {item.session_id && (
            <div>
              <dt className="text-xs text-textMuted">Session</dt>
              <dd>
                <Link
                  to={`/sessions/${item.session_id}`}
                  className="font-mono text-xs text-primary hover:underline"
                >
                  {item.session_id.slice(0, 8)}…
                </Link>
              </dd>
            </div>
          )}
        </dl>

        <p className="mt-4 text-sm text-textMuted">{item.reason}</p>

        {item.input_text && (
          <details className="mt-4 rounded-card border border-border bg-surfaceAlt p-3">
            <summary className="cursor-pointer text-sm font-medium">Input text</summary>
            <pre className="mt-2 whitespace-pre-wrap text-xs text-textMuted">{item.input_text}</pre>
          </details>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {item.tier_signals.map((signal, idx) => (
            <SignalCard key={`${signal.tier}-${idx}`} signal={signal} />
          ))}
        </div>

        {item.sanitized_text && (
          <details className="mt-4 rounded-card border border-border bg-surfaceAlt p-3">
            <summary className="cursor-pointer text-sm font-medium">Sanitized text</summary>
            <pre className="mt-2 whitespace-pre-wrap text-xs text-textMuted">
              {item.sanitized_text}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
