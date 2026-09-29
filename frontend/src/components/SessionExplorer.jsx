import { DECISION_STYLES } from "./DecisionPill";

const THRESHOLD = 0.7;

export default function SessionExplorer({ session, turns }) {
  if (!session) {
    return (
      <p className="text-sm text-textMuted">
        No sessions yet. Run an inspection to start one.
      </p>
    );
  }

  const score = Math.min(Math.max(session.max_suspicion_score ?? 0, 0), 1);

  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-textMuted">Most recent session</span>
        <span className="font-mono text-xs text-textMuted">
          {session.session_id.slice(0, 8)}…
        </span>
      </div>

      <div className="relative mt-4">
        <div className="h-2.5 rounded-full bg-surfaceAlt">
          <div
            className={`h-full rounded-full ${score >= THRESHOLD ? "bg-block" : "bg-gradient-to-r from-primary to-cyan-400"}`}
            style={{ width: `${score * 100}%` }}
          />
        </div>
        <div
          className="absolute top-[-4px] h-4 w-0.5 bg-neutralize"
          style={{ left: `${THRESHOLD * 100}%` }}
          title={`Jailbreak threshold (${THRESHOLD.toFixed(2)})`}
        />
      </div>
      <p className="mt-1 text-xs text-textMuted">
        Suspicion score: {score.toFixed(2)} (threshold {THRESHOLD.toFixed(2)})
      </p>

      <div className="mt-4 flex flex-wrap gap-1.5" aria-label="Session turns">
        {turns.map((turn) => (
          <span
            key={turn.inspection_id}
            title={`Turn ${turn.turn_id}: ${turn.final_decision}${
              turn.attack_type ? ` — ${turn.attack_type}` : ""
            }`}
            className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
              DECISION_STYLES[turn.final_decision] || "bg-surfaceAlt text-textMuted"
            }`}
          >
            {turn.turn_id}
          </span>
        ))}
      </div>
    </div>
  );
}
