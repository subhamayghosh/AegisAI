import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as usersApi from "../../api/users";
import { useThemeContext } from "../../contexts/ThemeContext";
import { useToast } from "../../hooks/useToast";

const OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "auto", label: "Auto" },
];

export default function AppearanceTab() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { theme, setTheme } = useThemeContext();

  const mutation = useMutation({
    mutationFn: (payload) => usersApi.updateSettings(payload),
    onSuccess: (data) => queryClient.setQueryData(["user-settings"], data),
    onError: () => toast.error("Could not save your theme preference."),
  });

  const handleChange = (value) => {
    setTheme(value);
    mutation.mutate({ theme: value });
  };

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold">Appearance</legend>
      {OPTIONS.map((opt) => (
        <label key={opt.value} className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="appearance"
            value={opt.value}
            checked={theme === opt.value}
            onChange={() => handleChange(opt.value)}
          />
          {opt.label}
        </label>
      ))}
    </fieldset>
  );
}
