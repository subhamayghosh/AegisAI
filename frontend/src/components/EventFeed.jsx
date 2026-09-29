import DecisionPill from "./DecisionPill";

export default function EventFeed({ events }) {
  if (!events.length) {
    return (
      <p className="text-sm text-textMuted">
        No inspections yet. Try the Inspect page or run demo mode.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border/70">
      <table className="w-full text-sm">
        <thead className="bg-surfaceAlt/70">
          <tr className="text-left text-xs font-semibold uppercase tracking-wide text-textMuted">
            <th className="px-3 py-2.5">Time</th>
            <th className="px-3 py-2.5">Source</th>
            <th className="px-3 py-2.5">Input hash</th>
            <th className="px-3 py-2.5">Attack type</th>
            <th className="px-3 py-2.5">Decision</th>
            <th className="px-3 py-2.5 text-right">Latency</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.key} className="border-t border-border/70 transition-colors hover:bg-surfaceAlt/45">
              <td className="whitespace-nowrap px-3 py-3 text-xs text-textMuted">
                {new Date(event.time).toLocaleTimeString()}
              </td>
              <td className="px-3 py-3">{event.source_type}</td>
              <td className="px-3 py-3 font-mono text-xs">
                {event.input_hash ? `${event.input_hash.slice(0, 10)}…` : "—"}
              </td>
              <td className="px-3 py-3">{event.attack_type || "—"}</td>
              <td className="px-3 py-3">
                <DecisionPill decision={event.decision} />
              </td>
              <td className="px-3 py-3 text-right text-xs text-textMuted">
                {event.latency_ms} ms
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
