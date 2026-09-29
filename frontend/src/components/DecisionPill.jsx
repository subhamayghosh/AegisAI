export const DECISION_STYLES = {
  ALLOW: "border-allow/20 bg-allowBg text-allow",
  NEUTRALIZE: "border-neutralize/20 bg-neutralizeBg text-neutralize",
  BLOCK: "border-block/20 bg-blockBg text-block",
};

export default function DecisionPill({ decision }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold tracking-wide ${
        DECISION_STYLES[decision] || "border-border bg-surfaceAlt text-textMuted"
      }`}
    >
      {decision}
    </span>
  );
}
