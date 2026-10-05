import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import FriendlyResult from "./FriendlyResult";

export default function ResultOverlay({ result, sourceType, onClose }) {
  const closeButtonRef = useRef(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return createPortal(
    (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-slate-950/75 px-4 py-8 backdrop-blur-sm sm:px-8" role="presentation">
      <div
        className="mx-auto w-full max-w-4xl rounded-3xl border border-white/15 bg-bg/95 p-4 shadow-2xl shadow-slate-950/40 sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="inspection-result-overlay-title"
        aria-describedby="inspection-result-overlay-description"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Result ready</p>
            <h2 id="inspection-result-overlay-title" className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">Your safety result</h2>
            <p id="inspection-result-overlay-description" className="mt-1 text-sm text-textMuted">Here is the clear explanation of what happened and what you can do next.</p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-textMuted transition hover:border-primary/40 hover:text-text focus-visible:outline-2 focus-visible:outline-primary"
            aria-label="Close result overlay"
            title="Close result overlay"
          >
            <X size={19} aria-hidden="true" />
          </button>
        </div>
        <FriendlyResult result={result} sourceType={sourceType} />
      </div>
    </div>
    ),
    document.body
  );
}
