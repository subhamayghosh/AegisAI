import { useNavigate } from "react-router-dom";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Inbox } from "lucide-react";
import * as sessionsApi from "../api/sessions";
import DecisionPill from "../components/DecisionPill";
import { SESSION_JAILBREAK_THRESHOLD } from "../constants";

export default function Sessions() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["sessions-list"],
    queryFn: () => sessionsApi.listSessions({ page: 1, page_size: 50 }),
  });

  const sessions = data?.items ?? [];

  // SessionSummaryOut has no final-decision field, so we look it up from
  // each session's last turn — bounded to this page's rows (<=50).
  const detailQueries = useQueries({
    queries: sessions.map((session) => ({
      queryKey: ["session-detail", session.session_id],
      queryFn: () => sessionsApi.getSession(session.session_id),
    })),
  });

  const finalDecisionFor = (sessionId) => {
    const idx = sessions.findIndex((s) => s.session_id === sessionId);
    const turns = detailQueries[idx]?.data?.turns;
    return turns?.length ? turns[turns.length - 1].final_decision : null;
  };

  if (!isLoading && sessions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-card border border-border bg-surface py-16 text-center">
        <Inbox className="text-textMuted" size={32} aria-hidden="true" />
        <p className="text-sm text-textMuted">No sessions yet. Run an inspection to start one.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Sessions</h1>
      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-textMuted">
              <th className="px-4 py-2 font-medium">Session</th>
              <th className="px-4 py-2 font-medium">Turns</th>
              <th className="px-4 py-2 font-medium">Max suspicion score</th>
              <th className="px-4 py-2 font-medium">Final decision</th>
              <th className="px-4 py-2 font-medium">Last activity</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((session) => {
              const decision = finalDecisionFor(session.session_id);
              const score = Math.min(Math.max(session.max_suspicion_score, 0), 1);
              return (
                <tr
                  key={session.session_id}
                  onClick={() => navigate(`/sessions/${session.session_id}`)}
                  className="cursor-pointer border-t border-border hover:bg-surfaceAlt"
                >
                  <td className="px-4 py-2 font-mono text-xs">
                    {session.session_id.slice(0, 8)}…
                  </td>
                  <td className="px-4 py-2">{session.turn_count}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 rounded-full bg-surfaceAlt">
                        <div
                          className={`h-full rounded-full ${
                            score >= SESSION_JAILBREAK_THRESHOLD ? "bg-block" : "bg-primary"
                          }`}
                          style={{ width: `${score * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-textMuted">{score.toFixed(2)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    {decision ? <DecisionPill decision={decision} /> : "—"}
                  </td>
                  <td className="px-4 py-2 text-xs text-textMuted">
                    {new Date(session.last_activity_at).toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
