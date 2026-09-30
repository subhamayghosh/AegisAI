import { NavLink } from "react-router-dom";

const LINKS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/inspect", label: "Inspect" },
  { to: "/history", label: "History" },
  { to: "/sessions", label: "Sessions" },
];

export default function Nav({ mobile = false }) {
  return (
    <nav
      className={mobile ? "grid grid-cols-4 gap-1" : "hidden items-center gap-1 md:flex"}
      aria-label={mobile ? "Primary mobile" : "Primary"}
    >
      {LINKS.map(({ to, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `rounded-xl px-3 py-2 text-center font-medium transition-all ${mobile ? "text-xs" : "text-sm"} ${
              isActive
                ? "bg-primary/10 text-primary shadow-sm"
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
