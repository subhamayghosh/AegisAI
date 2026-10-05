export const DECISION_STYLES = {
  ALLOW: "border-allow/20 bg-allowBg text-allow",
  NEUTRALIZE: "border-neutralize/20 bg-neutralizeBg text-neutralize",
  BLOCK: "border-block/20 bg-blockBg text-block",
};

const FRIENDLY_LABELS = { ALLOW: "Looks safe", NEUTRALIZE: "Cleaned up", BLOCK: "Stopped" };

export default function DecisionPill({ decision, friendly = false }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold tracking-wide ${
        DECISION_STYLES[decision] || "border-border bg-surfaceAlt text-textMuted"
      }`}
    >
      {friendly ? FRIENDLY_LABELS[decision] || decision : decision}
    </span>
  );
}
