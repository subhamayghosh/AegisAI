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
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-textMuted">
            <th className="px-2 py-1 font-medium">Time</th>
            <th className="px-2 py-1 font-medium">Source</th>
            <th className="px-2 py-1 font-medium">Input hash</th>
            <th className="px-2 py-1 font-medium">Attack type</th>
            <th className="px-2 py-1 font-medium">Decision</th>
            <th className="px-2 py-1 text-right font-medium">Latency</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.key} className="border-t border-border">
              <td className="whitespace-nowrap px-2 py-1.5 text-xs text-textMuted">
                {new Date(event.time).toLocaleTimeString()}
              </td>
              <td className="px-2 py-1.5">{event.source_type}</td>
              <td className="px-2 py-1.5 font-mono text-xs">
                {event.input_hash ? `${event.input_hash.slice(0, 10)}…` : "—"}
              </td>
              <td className="px-2 py-1.5">{event.attack_type || "—"}</td>
              <td className="px-2 py-1.5">
                <DecisionPill decision={event.decision} />
              </td>
              <td className="px-2 py-1.5 text-right text-xs text-textMuted">
                {event.latency_ms} ms
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
