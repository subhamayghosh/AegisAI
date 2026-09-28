export const DECISION_STYLES = {
  ALLOW: "bg-allowBg text-allow",
  NEUTRALIZE: "bg-neutralizeBg text-neutralize",
  BLOCK: "bg-blockBg text-block",
};

export default function DecisionPill({ decision }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        DECISION_STYLES[decision] || "bg-surfaceAlt text-textMuted"
      }`}
    >
      {decision}
    </span>
  );
}
