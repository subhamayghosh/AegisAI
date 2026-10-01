import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { CheckCircle2, XCircle, X } from "lucide-react";

const ToastContext = createContext(null);
let idCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());
  // `${variant}|${message}` -> id for the toasts currently on screen, so a
  // repeated action re-shows one toast instead of stacking identical copies.
  const visible = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    for (const [key, visibleId] of visible.current) {
      if (visibleId === id) {
        visible.current.delete(key);
        break;
      }
    }
  }, []);

  const push = useCallback(
    (message, variant = "success") => {
      const key = `${variant}|${message}`;
      const existingId = visible.current.get(key);
      if (existingId !== undefined) {
        // Already showing this exact message: restart its dismiss timer so it
        // stays readable for the full window after the latest trigger.
        clearTimeout(timers.current.get(existingId));
        timers.current.set(existingId, setTimeout(() => dismiss(existingId), 5000));
        return existingId;
      }
      const id = ++idCounter;
      visible.current.set(key, id);
      setToasts((prev) => [...prev, { id, message, variant }]);
      const timer = setTimeout(() => dismiss(id), 5000);
      timers.current.set(id, timer);
      return id;
    },
    [dismiss]
  );

  const value = useMemo(
    () => ({
      success: (message) => push(message, "success"),
      error: (message) => push(message, "error"),
      dismiss,
    }),
    [push, dismiss]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2"
        role="region"
        aria-label="Notifications"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="alert"
            className={`flex items-center gap-2 rounded-card border px-4 py-3 shadow-lg ${
              t.variant === "error"
                ? "bg-blockBg border-block text-block"
                : "bg-allowBg border-allow text-allow"
            }`}
          >
            {t.variant === "error" ? (
              <XCircle size={18} aria-hidden="true" />
            ) : (
              <CheckCircle2 size={18} aria-hidden="true" />
            )}
            <span className="text-sm">{t.message}</span>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => dismiss(t.id)}
              className="ml-2 opacity-70 hover:opacity-100"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToastContext() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToastContext must be used within a ToastProvider");
  }
  return ctx;
}
