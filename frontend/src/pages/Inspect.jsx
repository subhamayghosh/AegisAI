import { useState } from "react";
import { Loader2, ShieldQuestion } from "lucide-react";
import { useToast } from "../hooks/useToast";
import * as firewallApi from "../api/firewall";
import DecisionPill from "../components/DecisionPill";
import SignalCard from "../components/SignalCard";
import { ATTACK_TYPE_LABELS, SOURCE_TYPES } from "../constants";

const BINARY_SOURCE_TYPES = new Set(["pdf", "word_doc", "image"]);
const FILE_ACCEPT = {
  pdf: ".pdf,application/pdf",
  word_doc: ".doc,.docx",
  image: "image/*",
};

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      const base64 = typeof result === "string" ? result.split(",")[1] ?? "" : "";
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function Inspect() {
  const toast = useToast();
  const [sourceType, setSourceType] = useState("user_message");
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const isBinary = BINARY_SOURCE_TYPES.has(sourceType);

  const handleSourceTypeChange = (e) => {
    setSourceType(e.target.value);
    setFile(null);
    setText("");
    setResult(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    let payloadText = text;
    const metadata = {};
    if (isBinary) {
      if (!file) {
        toast.error("Choose a file to inspect.");
        return;
      }
      metadata.filename = file.name;
      if (file.type) metadata.content_type = file.type;
    } else if (!text.trim()) {
      toast.error("Enter some text to inspect.");
      return;
    }

    setSubmitting(true);
    setResult(null);
    try {
      if (isBinary) {
        payloadText = await fileToBase64(file);
      }
      const response = await firewallApi.inspect({
        input_id: crypto.randomUUID(),
        session_id: null,
        turn_id: 1,
        text: payloadText,
        source_type: sourceType,
        metadata,
      });
      setResult(response);
    } catch (err) {
      const status = err.response?.status;
      if (status === 422) {
        toast.error("Could not parse that input for the selected source type.");
      } else if (status === 503) {
        toast.error("That source type isn't supported on this server yet.");
      } else {
        toast.error("Inspection failed. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const attackSignal = result
    ? result.tier_signals.find((s) => s.flagged && s.attack_type) ||
      result.tier_signals.find((s) => s.attack_type)
    : null;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-card border border-border bg-surface p-5"
      >
        <h1 className="text-lg font-semibold">Inspect an input</h1>

        <div>
          <label htmlFor="sourceType" className="block text-sm font-medium">
            Source type
          </label>
          <select
            id="sourceType"
            value={sourceType}
            onChange={handleSourceTypeChange}
            className="mt-1 w-full rounded-card border border-border bg-bg px-3 py-2 text-sm focus:border-primary"
          >
            {SOURCE_TYPES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {isBinary ? (
          <div>
            <label htmlFor="file" className="block text-sm font-medium">
              File
            </label>
            <input
              id="file"
              type="file"
              accept={FILE_ACCEPT[sourceType]}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-1 w-full text-sm"
            />
          </div>
        ) : (
          <div>
            <label htmlFor="text" className="block text-sm font-medium">
              Content
            </label>
            <textarea
              id="text"
              rows={10}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="mt-1 w-full rounded-card border border-border bg-bg px-3 py-2 text-sm focus:border-primary"
              placeholder="Paste the content to inspect…"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="flex items-center gap-2 rounded-card bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primaryHover disabled:opacity-60"
        >
          {submitting && <Loader2 className="animate-spin" size={16} aria-hidden="true" />}
          {submitting ? "Inspecting…" : "Inspect"}
        </button>
      </form>

      <div className="rounded-card border border-border bg-surface p-5">
        <h2 className="mb-3 text-lg font-semibold">Result</h2>
        {!result && (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-textMuted">
            <ShieldQuestion size={32} aria-hidden="true" />
            <p className="text-sm">Run an inspection to see the decision and tier signals.</p>
          </div>
        )}
        {result && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <DecisionPill decision={result.final_decision} />
              {attackSignal && (
                <span className="rounded-full bg-surfaceAlt px-2.5 py-0.5 text-xs font-medium text-textMuted">
                  {ATTACK_TYPE_LABELS[attackSignal.attack_type] ?? attackSignal.attack_type}
                </span>
              )}
            </div>
            <p className="text-sm text-textMuted">{result.reason}</p>

            <div className="grid gap-3 sm:grid-cols-2">
              {result.tier_signals.map((signal, idx) => (
                <SignalCard key={`${signal.tier}-${idx}`} signal={signal} />
              ))}
            </div>

            {result.sanitized_text && (
              <details className="rounded-card border border-border bg-surfaceAlt p-3">
                <summary className="cursor-pointer text-sm font-medium">Sanitized text</summary>
                <pre className="mt-2 whitespace-pre-wrap text-xs text-textMuted">
                  {result.sanitized_text}
                </pre>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
