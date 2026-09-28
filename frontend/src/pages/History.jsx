import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Inbox, Plus } from "lucide-react";
import * as historyApi from "../api/history";
import DecisionPill from "../components/DecisionPill";
import { ATTACK_TYPES, DECISIONS, SOURCE_TYPES } from "../constants";

const PAGE_SIZE = 25;

const DEFAULT_FILTERS = { from: "", to: "", decision: "", attack_type: "", source_type: "" };

export default function History() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);

  const params = useMemo(
    () => ({
      page,
      page_size: PAGE_SIZE,
      decision: filters.decision || undefined,
      attack_type: filters.attack_type || undefined,
      source_type: filters.source_type || undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
    }),
    [page, filters]
  );

  const { data, isLoading } = useQuery({
    queryKey: ["history", params],
    queryFn: () => historyApi.listHistory(params),
  });

  const updateFilter = (key) => (e) => {
    setFilters((prev) => ({ ...prev, [key]: e.target.value }));
    setPage(1);
  };

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const isEmpty = !isLoading && items.length === 0;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">History</h1>

      <div className="flex flex-wrap items-end gap-3 rounded-card border border-border bg-surface p-4">
        <div>
          <label htmlFor="from" className="block text-xs font-medium text-textMuted">
            From
          </label>
          <input
            id="from"
            type="date"
            value={filters.from}
            onChange={updateFilter("from")}
            className="mt-1 rounded-card border border-border bg-bg px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="to" className="block text-xs font-medium text-textMuted">
            To
          </label>
          <input
            id="to"
            type="date"
            value={filters.to}
            onChange={updateFilter("to")}
            className="mt-1 rounded-card border border-border bg-bg px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="decision" className="block text-xs font-medium text-textMuted">
            Decision
          </label>
          <select
            id="decision"
            value={filters.decision}
            onChange={updateFilter("decision")}
            className="mt-1 rounded-card border border-border bg-bg px-2 py-1.5 text-sm"
          >
            <option value="">All</option>
            {DECISIONS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="attackType" className="block text-xs font-medium text-textMuted">
            Attack type
          </label>
          <select
            id="attackType"
            value={filters.attack_type}
            onChange={updateFilter("attack_type")}
            className="mt-1 rounded-card border border-border bg-bg px-2 py-1.5 text-sm"
          >
            <option value="">All</option>
            {ATTACK_TYPES.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="sourceType" className="block text-xs font-medium text-textMuted">
            Source type
          </label>
          <select
            id="sourceType"
            value={filters.source_type}
            onChange={updateFilter("source_type")}
            className="mt-1 rounded-card border border-border bg-bg px-2 py-1.5 text-sm"
          >
            <option value="">All</option>
            {SOURCE_TYPES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-card border border-border bg-surface">
        {isEmpty ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Inbox className="text-textMuted" size={32} aria-hidden="true" />
            <p className="text-sm text-textMuted">No inspections match these filters yet.</p>
            <button
              type="button"
              onClick={() => navigate("/inspect")}
              className="flex items-center gap-2 rounded-card bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primaryHover"
            >
              <Plus size={16} aria-hidden="true" /> Run an inspection
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-textMuted">
                  <th className="px-4 py-2 font-medium">Time</th>
                  <th className="px-4 py-2 font-medium">Source</th>
                  <th className="px-4 py-2 font-medium">Attack type</th>
                  <th className="px-4 py-2 font-medium">Decision</th>
                  <th className="px-4 py-2 text-right font-medium">Latency</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => navigate(`/history/${item.id}`)}
                    className="cursor-pointer border-t border-border hover:bg-surfaceAlt"
                  >
                    <td className="px-4 py-2 text-xs text-textMuted">
                      {new Date(item.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2">{item.source_type}</td>
                    <td className="px-4 py-2">{item.attack_type || "—"}</td>
                    <td className="px-4 py-2">
                      <DecisionPill decision={item.final_decision} />
                    </td>
                    <td className="px-4 py-2 text-right text-xs text-textMuted">
                      {item.latency_ms_total} ms
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!isEmpty && (
        <div className="flex items-center justify-between text-sm text-textMuted">
          <span>
            Page {page} of {totalPages} ({total} total)
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
