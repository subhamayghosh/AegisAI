import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as usersApi from "../../api/users";
import { useToast } from "../../hooks/useToast";

export default function PrivacyTab({ settings }) {
  const toast = useToast();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (payload) => usersApi.updateSettings(payload),
    onSuccess: (data) => {
      queryClient.setQueryData(["user-settings"], data);
      toast.success("Privacy preference saved.");
    },
    onError: () => toast.error("Could not save this preference. Please try again."),
  });

  const handleToggle = (e) => {
    mutation.mutate({ store_raw_text_in_history: e.target.checked });
  };

  return (
    <div className="space-y-3">
      <label
        htmlFor="storeRawText"
        className="flex items-center justify-between gap-4 text-sm font-semibold"
      >
        <span>Store my raw inspected text in history</span>
        <input
          id="storeRawText"
          type="checkbox"
          role="switch"
          aria-checked={settings.store_raw_text_in_history}
          checked={settings.store_raw_text_in_history}
          onChange={handleToggle}
          disabled={mutation.isPending}
          className="h-5 w-9 cursor-pointer accent-primary"
        />
      </label>
      <p className="text-xs text-textMuted">
        When off (default), only a SHA-256 hash of your input is stored. When on, the raw text is
        stored so you can review it later. Applies only to your own inspections.
      </p>
    </div>
  );
}
