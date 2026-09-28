export default function StatCard({ label, value, icon: Icon, accent }) {
  return (
    <div className="rounded-card border border-border bg-surface p-4" data-testid={`stat-${label}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-textMuted">{label}</span>
        {Icon && <Icon size={18} className={accent} aria-hidden="true" />}
      </div>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}
