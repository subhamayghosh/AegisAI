export default function ConfidenceBar({ value }) {
  const pct = Math.round(Math.min(Math.max(value ?? 0, 0), 1) * 100);
  return (
    <div className="flex items-center gap-2">
      <div
        role="meter"
        aria-label="Confidence"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1.5 flex-1 rounded-full bg-surfaceAlt"
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 text-right text-xs text-textMuted">{pct}%</span>
    </div>
  );
}
