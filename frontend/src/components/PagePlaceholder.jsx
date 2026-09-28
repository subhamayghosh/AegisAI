export default function PagePlaceholder({ title, note }) {
  return (
    <div className="rounded-card border border-dashed border-border bg-surface p-8 text-center">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-textMuted">{note}</p>
    </div>
  );
}
