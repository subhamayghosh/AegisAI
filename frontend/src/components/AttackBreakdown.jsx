const LABELS = {
  instruction_override: "Instruction override",
  role_change: "Role change",
  secret_extraction: "Secret extraction",
  tool_abuse: "Tool abuse",
  credential_theft: "Credential theft",
  context_poisoning: "Context poisoning",
  multi_step_jailbreak: "Multi-step jailbreak",
  encoded_instructions: "Encoded instructions",
  indirect_prompt_injection: "Indirect prompt injection",
};

export default function AttackBreakdown({ counts }) {
  const entries = Object.entries(counts || {})
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  if (!entries.length) {
    return <p className="text-sm text-textMuted">No attacks detected yet.</p>;
  }

  const max = entries[0][1];

  return (
    <div className="space-y-2.5">
      {entries.map(([type, count]) => (
        <div key={type}>
          <div className="flex justify-between text-xs text-textMuted">
            <span>{LABELS[type] || type}</span>
            <span>{count}</span>
          </div>
          <div className="mt-1.5 h-2 rounded-full bg-surfaceAlt">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-fuchsia-500"
              style={{ width: `${max ? (count / max) * 100 : 0}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
