import { useState } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { Shield, ChevronDown, LogOut, Settings, User } from "lucide-react";
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
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <Link to="/dashboard" className="flex items-center gap-2 font-semibold">
              <Shield className="text-primary" size={22} aria-hidden="true" />
              <span>PromptShield</span>
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
                className="flex items-center gap-2 rounded-card border border-border bg-surfaceAlt px-3 py-1.5 text-sm hover:bg-surface"
              >
                <span>{user?.display_name || "Account"}</span>
                <ChevronDown size={14} aria-hidden="true" />
              </button>
              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 z-10 mt-2 w-48 rounded-card border border-border bg-surface py-1 shadow-lg"
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
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <Outlet />
      </main>
      <footer className="border-t border-border bg-surface px-4 py-4 text-center text-sm text-textMuted">
        PromptShield — agentic prompt-injection firewall
      </footer>
    </div>
  );
}
