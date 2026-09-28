import { NavLink } from "react-router-dom";

const LINKS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/inspect", label: "Inspect" },
  { to: "/history", label: "History" },
  { to: "/sessions", label: "Sessions" },
];

export default function Nav() {
  return (
    <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
      {LINKS.map(({ to, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "bg-primary/10 text-primary"
                : "text-textMuted hover:bg-surfaceAlt hover:text-text"
            }`
          }
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
