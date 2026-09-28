import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as usersApi from "../../api/users";
import { useToast } from "../../hooks/useToast";

const DEFAULTS = { tier2_threshold: 0.75, session_jailbreak_threshold: 0.7 };

export default function ThresholdsTab({ settings }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [tier2, setTier2] = useState(settings.tier2_threshold);
  const [sessionThreshold, setSessionThreshold] = useState(settings.session_jailbreak_threshold);

  const dirty =
    tier2 !== settings.tier2_threshold ||
    sessionThreshold !== settings.session_jailbreak_threshold;

  const mutation = useMutation({
    mutationFn: (payload) => usersApi.updateSettings(payload),
    onSuccess: (data) => {
      queryClient.setQueryData(["user-settings"], data);
      toast.success("Thresholds saved.");
    },
    onError: () => toast.error("Could not save thresholds. Please try again."),
  });

  const handleSave = () => {
    mutation.mutate({ tier2_threshold: tier2, session_jailbreak_threshold: sessionThreshold });
  };

  const handleReset = () => {
    setTier2(DEFAULTS.tier2_threshold);
    setSessionThreshold(DEFAULTS.session_jailbreak_threshold);
  };

  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="tier2" className="flex items-center justify-between text-sm font-semibold">
          <span>Tier 2 similarity threshold</span>
          <span className="text-textMuted">{tier2.toFixed(2)}</span>
        </label>
        <input
          id="tier2"
          type="range"
          min={0.5}
          max={0.95}
          step={0.05}
          value={tier2}
          onChange={(e) => setTier2(Number(e.target.value))}
          className="mt-2 w-full accent-primary"
        />
      </div>
      <div>
        <label
          htmlFor="sessionThreshold"
          className="flex items-center justify-between text-sm font-semibold"
        >
          <span>Session jailbreak threshold</span>
          <span className="text-textMuted">{sessionThreshold.toFixed(2)}</span>
        </label>
        <input
          id="sessionThreshold"
          type="range"
          min={0.5}
          max={0.95}
          step={0.05}
          value={sessionThreshold}
          onChange={(e) => setSessionThreshold(Number(e.target.value))}
          className="mt-2 w-full accent-primary"
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleReset}
          className="rounded-card border border-border px-4 py-2 text-sm font-semibold hover:bg-surfaceAlt"
        >
          Reset to defaults
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || mutation.isPending}
          className="rounded-card bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primaryHover disabled:opacity-60"
        >
          Save changes
        </button>
      </div>
    </div>
  );
}
