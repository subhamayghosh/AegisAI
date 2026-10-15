import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import * as historyApi from "../api/history";
import DecisionPill from "../components/DecisionPill";
import FriendlyResult from "../components/FriendlyResult";
import { ATTACK_TYPE_LABELS } from "../constants";
import { sourceLabel } from "../utils/inspectionFeedback";

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

        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 text-sm md:grid-cols-3">
          <div>
            <dt className="text-xs text-textMuted">Content source</dt>
            <dd>{sourceLabel(item.source_type)}</dd>
          </div>
          {item.session_id && (
            <div>
              <dt className="text-xs text-textMuted">Conversation session</dt>
              <dd>
                <Link
                  to={`/sessions/${item.session_id}`}
                  className="text-primary hover:underline"
                >
                  View session timeline
                </Link>
              </dd>
            </div>
          )}
        </dl>

        {item.input_text && (
          <details className="mt-4 rounded-card border border-border bg-surfaceAlt p-3">
            <summary className="cursor-pointer text-sm font-medium">Input text</summary>
            <pre className="mt-2 whitespace-pre-wrap text-xs text-textMuted">{item.input_text}</pre>
          </details>
        )}

        <div className="mt-4">
          <FriendlyResult result={item} sourceType={item.source_type} />
        </div>
      </div>
    </div>
  );
}
 
