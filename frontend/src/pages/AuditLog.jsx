import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy } from "lucide-react";
import * as adminApi from "../api/admin";
import DecisionPill from "../components/DecisionPill";

const EVENT_TYPES = [
  "login_success",
  "login_fail",
  "password_change",
  "settings_change",
  "firewall_inspect",
];

const PAGE_SIZE = 25;

export default function AuditLog() {
  const [eventType, setEventType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-audit", { page, eventType }],
    queryFn: () =>
      adminApi.getAudit({ page, page_size: PAGE_SIZE, event_type: eventType || undefined }),
  });

  // DEVIATION: GET /admin/audit has no from/to query params on the backend
  // (only page/page_size/decision/event_type), so the date range here
  // filters client-side over just the current page's rows.
  const items = useMemo(() => {
    const rows = data?.items ?? [];
    return rows.filter((row) => {
      const created = new Date(row.created_at);
      if (from && created < new Date(from)) return false;
      if (to && created > new Date(`${to}T23:59:59`)) return false;
      return true;
    });
  }, [data, from, to]);

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  const handleCopy = (hash) => {
    navigator.clipboard?.writeText(hash);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Audit log</h1>

      <div className="flex flex-wrap items-end gap-3 rounded-card border border-border bg-surface p-4">
        <div>
          <label htmlFor="eventType" className="block text-xs font-medium text-textMuted">
            Event type
          </label>
          <select
            id="eventType"
            value={eventType}
            onChange={(e) => {
              setEventType(e.target.value);
              setPage(1);
            }}
            className="mt-1 rounded-card border border-border bg-bg px-2 py-1.5 text-sm"
          >
            <option value="">All</option>
            {EVENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="auditFrom" className="block text-xs font-medium text-textMuted">
            From
          </label>
          <input
            id="auditFrom"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 rounded-card border border-border bg-bg px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="auditTo" className="block text-xs font-medium text-textMuted">
            To
          </label>
          <input
            id="auditTo"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 rounded-card border border-border bg-bg px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        {!isLoading && items.length === 0 ? (
          <p className="p-6 text-center text-sm text-textMuted">No audit events found.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-textMuted">
                <th className="px-4 py-2 font-medium">Time</th>
                <th className="px-4 py-2 font-medium">Event type</th>
                <th className="px-4 py-2 font-medium">User</th>
                <th className="px-4 py-2 font-medium">Decision</th>
                <th className="px-4 py-2 font-medium">Input hash</th>
                <th className="px-4 py-2 font-medium">IP address</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="px-4 py-2 text-xs text-textMuted">
                    {new Date(row.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-2">{row.event_type}</td>
                  <td className="px-4 py-2 font-mono text-xs">
                    {row.user_id ? `${row.user_id.slice(0, 8)}…` : "—"}
                  </td>
                  <td className="px-4 py-2">
                    {row.decision ? <DecisionPill decision={row.decision} /> : "—"}
                  </td>
                  <td className="px-4 py-2">
                    {row.input_hash ? (
                      <span className="flex items-center gap-1 font-mono text-xs">
                        {row.input_hash.slice(0, 10)}…
                        <button
                          type="button"
                          aria-label="Copy input hash"
                          onClick={() => handleCopy(row.input_hash)}
                          className="text-textMuted hover:text-text"
                        >
                          <Copy size={12} aria-hidden="true" />
                        </button>
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs text-textMuted">{row.ip_address || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {data && (
        <div className="flex items-center justify-between text-sm text-textMuted">
          <span>
            Page {page} of {totalPages} ({data.total} total)
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-card border border-border px-3 py-1.5 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-card border border-border px-3 py-1.5 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
