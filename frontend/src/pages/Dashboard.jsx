import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, Loader2, Play, ShieldAlert, ShieldBan, ShieldCheck } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/useToast";
import * as adminApi from "../api/admin";
import * as firewallApi from "../api/firewall";
import * as historyApi from "../api/history";
import * as sessionsApi from "../api/sessions";
import StatCard from "../components/StatCard";
import EventFeed from "../components/EventFeed";
import AttackBreakdown from "../components/AttackBreakdown";
import SessionExplorer from "../components/SessionExplorer";
import { DEMO_ATTACKS } from "../demoAttacks";
import { delay } from "../utils/delay";

const POLL_MS = 2000;

export default function Dashboard() {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === "admin";
  const [demoRunning, setDemoRunning] = useState(false);

  const metricsQuery = useQuery({
    queryKey: ["admin-metrics"],
    queryFn: adminApi.getMetrics,
    enabled: isAdmin,
    refetchInterval: POLL_MS,
  });

  const adminEventsQuery = useQuery({
    queryKey: ["admin-events"],
    queryFn: () => adminApi.getEvents(50),
    enabled: isAdmin,
    refetchInterval: POLL_MS,
  });

  const historyQuery = useQuery({
    queryKey: ["history-feed"],
    queryFn: () => historyApi.listHistory({ page: 1, page_size: 50 }),
    enabled: !isAdmin,
    refetchInterval: POLL_MS,
  });

  const sessionsQuery = useQuery({
    queryKey: ["sessions-recent"],
    queryFn: () => sessionsApi.listSessions({ page: 1, page_size: 1 }),
    refetchInterval: POLL_MS,
  });

  const recentSession = sessionsQuery.data?.items?.[0] ?? null;

  const sessionDetailQuery = useQuery({
    queryKey: ["session-detail", recentSession?.session_id],
    queryFn: () => sessionsApi.getSession(recentSession.session_id),
    enabled: Boolean(recentSession),
    refetchInterval: POLL_MS,
  });

  const stats = useMemo(() => {
    if (isAdmin) {
      const m = metricsQuery.data;
      return {
        total: m?.total ?? 0,
        blocked: m?.blocked ?? 0,
        neutralized: m?.neutralized ?? 0,
        allowed: m?.allowed ?? 0,
      };
    }
    const items = historyQuery.data?.items ?? [];
    return {
      total: historyQuery.data?.total ?? 0,
      blocked: items.filter((i) => i.final_decision === "BLOCK").length,
      neutralized: items.filter((i) => i.final_decision === "NEUTRALIZE").length,
      allowed: items.filter((i) => i.final_decision === "ALLOW").length,
    };
  }, [isAdmin, metricsQuery.data, historyQuery.data]);

  const attackCounts = useMemo(() => {
    if (isAdmin) return metricsQuery.data?.by_attack_type ?? {};
    const items = historyQuery.data?.items ?? [];
    return items.reduce((acc, item) => {
      if (item.attack_type) acc[item.attack_type] = (acc[item.attack_type] ?? 0) + 1;
      return acc;
    }, {});
  }, [isAdmin, metricsQuery.data, historyQuery.data]);

  const events = useMemo(() => {
    if (isAdmin) {
      const raw = adminEventsQuery.data ?? [];
      return raw
        .slice()
        .reverse()
        .map((event, idx) => ({
          key: `${event.timestamp}-${idx}`,
          time: event.timestamp,
          source_type: event.source_type,
          input_hash: event.input_hash,
          attack_type: event.attack_type,
          decision: event.decision,
          latency_ms: event.latency_ms,
        }));
    }
    const items = historyQuery.data?.items ?? [];
    return items.map((item) => ({
      key: item.id,
      time: item.created_at,
      source_type: item.source_type,
      input_hash: item.input_hash,
      attack_type: item.attack_type,
      decision: item.final_decision,
      latency_ms: item.latency_ms_total,
    }));
  }, [isAdmin, adminEventsQuery.data, historyQuery.data]);

  const runDemoMode = async () => {
    setDemoRunning(true);
    const sessionId = crypto.randomUUID();
    try {
      for (let i = 0; i < DEMO_ATTACKS.length; i++) {
        await firewallApi.inspect({
          input_id: crypto.randomUUID(),
          session_id: sessionId,
          turn_id: i + 1,
          text: DEMO_ATTACKS[i].text,
          source_type: "user_message",
        });
        queryClient.invalidateQueries({ queryKey: ["admin-metrics"] });
        queryClient.invalidateQueries({ queryKey: ["admin-events"] });
        queryClient.invalidateQueries({ queryKey: ["history-feed"] });
        queryClient.invalidateQueries({ queryKey: ["sessions-recent"] });
        if (i < DEMO_ATTACKS.length - 1) {
          await delay(1000);
        }
      }
      toast.success("Demo mode finished — 15 scripted inspections sent.");
    } catch {
      toast.error("Demo mode failed partway through. Please try again.");
    } finally {
      setDemoRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/10 via-surface to-cyan-400/10 p-6 shadow-sm sm:p-7">
        <div className="absolute -right-10 -top-16 h-48 w-48 rounded-full bg-primary/15 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Security command center</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Protection at a glance</h1>
            <p className="mt-1 text-sm text-textMuted">Monitor every decision, then trace the signals behind it.</p>
          </div>
        <button
          type="button"
          onClick={runDemoMode}
          disabled={demoRunning}
          className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:-translate-y-0.5 hover:bg-primaryHover disabled:translate-y-0 disabled:opacity-60"
        >
          {demoRunning ? (
            <Loader2 className="animate-spin" size={16} aria-hidden="true" />
          ) : (
            <Play size={16} aria-hidden="true" />
          )}
          {demoRunning ? "Running demo…" : "Run demo mode"}
        </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total" value={stats.total} icon={Activity} accent="text-primary" />
        <StatCard label="Blocked" value={stats.blocked} icon={ShieldBan} accent="text-block" />
        <StatCard
          label="Neutralized"
          value={stats.neutralized}
          icon={ShieldAlert}
          accent="text-neutralize"
        />
        <StatCard label="Allowed" value={stats.allowed} icon={ShieldCheck} accent="text-allow" />
      </div>

      <div className="flex flex-col gap-6 xl:flex-row">
        <section className="flex-1 rounded-2xl border border-border bg-surface/95 p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">Live event feed</h2><span className="flex items-center gap-1.5 text-xs text-allow"><span className="h-2 w-2 rounded-full bg-allow" />Live</span></div>
          <EventFeed events={events} />
        </section>

        <div className="w-full space-y-6 xl:w-96">
          <section className="rounded-2xl border border-border bg-surface/95 p-5 shadow-sm">
            <h2 className="mb-3 font-semibold">Attack breakdown</h2>
            <AttackBreakdown counts={attackCounts} />
          </section>
          <section className="rounded-2xl border border-border bg-surface/95 p-5 shadow-sm">
            <h2 className="mb-3 font-semibold">Session explorer</h2>
            <SessionExplorer session={recentSession} turns={sessionDetailQuery.data?.turns ?? []} />
          </section>
        </div>
      </div>
    </div>
  );
}
