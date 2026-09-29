export default function StatCard({ label, value, icon: Icon, accent }) {
  return (
    <div className="group rounded-2xl border border-border bg-surface/95 p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-950/5" data-testid={`stat-${label}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-textMuted">{label}</span>
        {Icon && <span className="rounded-xl bg-surfaceAlt p-2"><Icon size={18} className={accent} aria-hidden="true" /></span>}
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}
