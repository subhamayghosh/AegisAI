import { Monitor, Moon, Sun } from "lucide-react";
import { useThemeContext } from "../contexts/ThemeContext";

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "auto", label: "Auto", icon: Monitor },
];

export default function ThemeToggle() {
  const { theme, setTheme } = useThemeContext();

  return (
    <div
      className="flex items-center gap-1 rounded-card border border-border bg-surfaceAlt p-1"
      role="group"
      aria-label="Theme"
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          aria-label={`${label} theme`}
          aria-pressed={theme === value}
          onClick={() => setTheme(value)}
          className={`rounded-md p-1.5 transition-colors ${
            theme === value
              ? "bg-primary text-white"
              : "text-textMuted hover:text-text"
          }`}
        >
          <Icon size={16} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
