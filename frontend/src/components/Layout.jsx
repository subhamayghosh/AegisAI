import { useState } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { Shield, ShieldCheck, ChevronDown, LogOut, Settings, User } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import ThemeToggle from "./ThemeToggle";
import Nav from "./Nav";

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    navigate("/login");
  };

  return (
    <div className="relative isolate flex min-h-screen flex-col overflow-hidden">
      <div className="app-shell-ambient pointer-events-none fixed inset-0 z-0" aria-hidden="true" />
      <header className="sticky top-0 z-20 border-b border-border/80 bg-surface/90 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[90rem] items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-6">
            <Link to="/dashboard" className="flex items-center gap-2.5 font-semibold tracking-tight">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white shadow-lg shadow-indigo-500/25">
                <ShieldCheck size={19} aria-hidden="true" />
              </span>
              <span className="hidden sm:inline">AegisAI</span>
            </Link>
            <Nav />
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-haspopup="true"
                aria-expanded={menuOpen}
                aria-label="Open user menu"
                className="flex items-center gap-2 rounded-xl border border-border bg-surfaceAlt/70 px-3 py-2 text-sm transition hover:bg-surface"
              >
                <span>{user?.display_name || "Account"}</span>
                <ChevronDown size={14} aria-hidden="true" />
              </button>
              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 z-10 mt-2 w-52 rounded-2xl border border-border bg-surface py-1.5 shadow-2xl shadow-indigo-950/10"
                >
                  <Link
                    role="menuitem"
                    to="/profile"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-surfaceAlt"
                  >
                    <User size={14} aria-hidden="true" /> Profile
                  </Link>
                  <Link
                    role="menuitem"
                    to="/settings"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-surfaceAlt"
                  >
                    <Settings size={14} aria-hidden="true" /> Settings
                  </Link>
                  {user?.role === "admin" && (
                    <Link
                      role="menuitem"
                      to="/audit"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-surfaceAlt"
                    >
                      <Shield size={14} aria-hidden="true" /> Audit Log
                    </Link>
                  )}
                  <button
                    role="menuitem"
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-block hover:bg-blockBg"
                  >
                    <LogOut size={14} aria-hidden="true" /> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      <main className="relative z-10 mx-auto w-full max-w-[90rem] flex-1 px-4 py-7 sm:px-6">
        <Outlet />
      </main>
      <footer className="relative z-10 border-t border-border/80 bg-surface/70 px-4 py-5 text-center text-xs text-textMuted">
        AegisAI <span className="mx-1 text-primary">•</span> agentic prompt-injection firewall
      </footer>
    </div>
  );
}
