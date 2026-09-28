import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import * as usersApi from "../../api/users";
import { useToast } from "../../hooks/useToast";

const DEFAULT_VALUE = "__default__";

const WORKING_SUBTITLE =
  'Used by the mock protected agent and any future "explain this decision" endpoints.';
const JUDGE_SUBTITLE =
  "Used by Tier 3 to classify nuanced or contextual attacks that regex and embeddings miss.";

function resolveInitialValue(savedId, options) {
  if (!savedId) return { value: DEFAULT_VALUE, missing: false };
  const exists = options.some((o) => o.id === savedId);
  return { value: exists ? savedId : DEFAULT_VALUE, missing: !exists };
}

function parseFieldError(detail) {
  if (!detail) return { field: null, message: "Could not save your model preferences." };
  if (detail.startsWith("working_model_id")) return { field: "working", message: detail };
  if (detail.startsWith("judge_model_id")) return { field: "judge", message: detail };
  return { field: null, message: detail };
}

export default function ModelsTab({ settings, availableModels }) {
  const toast = useToast();
  const queryClient = useQueryClient();

  const workingInitial = resolveInitialValue(settings.working_model_id, availableModels.working);
  const judgeInitial = resolveInitialValue(settings.judge_model_id, availableModels.judge);

  const [workingValue, setWorkingValue] = useState(workingInitial.value);
  const [judgeValue, setJudgeValue] = useState(judgeInitial.value);
  const [fieldError, setFieldError] = useState(null);

  const workingDefaultLabel =
    availableModels.working.find((o) => o.id === availableModels.defaults.working)?.label ??
    availableModels.defaults.working;
  const judgeDefaultLabel =
    availableModels.judge.find((o) => o.id === availableModels.defaults.judge)?.label ??
    availableModels.defaults.judge;

  const dirty = workingValue !== workingInitial.value || judgeValue !== judgeInitial.value;

  const mutation = useMutation({
    mutationFn: (payload) => usersApi.updateSettings(payload),
    onSuccess: (data) => {
      queryClient.setQueryData(["user-settings"], data);
      setFieldError(null);
      toast.success("Model preferences saved. Next inspection will use the new models.");
    },
    onError: (err) => {
      setFieldError(parseFieldError(err.response?.data?.detail));
    },
  });

  const handleSave = () => {
    mutation.mutate({
      working_model_id: workingValue === DEFAULT_VALUE ? null : workingValue,
      judge_model_id: judgeValue === DEFAULT_VALUE ? null : judgeValue,
    });
  };

  const handleReset = () => {
    setWorkingValue(DEFAULT_VALUE);
    setJudgeValue(DEFAULT_VALUE);
  };

  return (
    <div className="space-y-6">
      {workingInitial.missing && (
        <div className="flex items-start gap-2 rounded-card border border-neutralize bg-neutralizeBg px-3 py-2 text-sm text-neutralize">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            Your saved model <strong>{settings.working_model_id}</strong> is no longer available.
            Falling back to app default. Please choose a new model.
          </span>
        </div>
      )}
      {judgeInitial.missing && (
        <div className="flex items-start gap-2 rounded-card border border-neutralize bg-neutralizeBg px-3 py-2 text-sm text-neutralize">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            Your saved model <strong>{settings.judge_model_id}</strong> is no longer available.
            Falling back to app default. Please choose a new model.
          </span>
        </div>
      )}

      <div>
        <label htmlFor="workingModel" className="block text-sm font-semibold">
          Working LLM
        </label>
        <p className="mt-0.5 text-xs text-textMuted">{WORKING_SUBTITLE}</p>
        <select
          id="workingModel"
          value={workingValue}
          onChange={(e) => setWorkingValue(e.target.value)}
          className="mt-2 w-full rounded-card border border-border bg-bg px-3 py-2 text-sm focus:border-primary"
        >
          <option value={DEFAULT_VALUE}>
            Use app default (currently: {workingDefaultLabel})
          </option>
          {availableModels.working.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label} — {opt.description}
            </option>
          ))}
        </select>
        {fieldError?.field === "working" && (
          <p className="mt-1 text-sm text-block">{fieldError.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="judgeModel" className="block text-sm font-semibold">
          Judge LLM
        </label>
        <p className="mt-0.5 text-xs text-textMuted">{JUDGE_SUBTITLE}</p>
        <select
          id="judgeModel"
          value={judgeValue}
          onChange={(e) => setJudgeValue(e.target.value)}
          className="mt-2 w-full rounded-card border border-border bg-bg px-3 py-2 text-sm focus:border-primary"
        >
          <option value={DEFAULT_VALUE}>Use app default (currently: {judgeDefaultLabel})</option>
          {availableModels.judge.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label} — {opt.description}
            </option>
          ))}
        </select>
        {fieldError?.field === "judge" && (
          <p className="mt-1 text-sm text-block">{fieldError.message}</p>
        )}
      </div>

      {fieldError && !fieldError.field && (
        <p className="text-sm text-block">{fieldError.message}</p>
      )}

      <p className="text-xs text-textMuted">
        Note: Changes take effect on your next inspection. Every inspection records which models
        it used, so your history stays auditable.
      </p>

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
