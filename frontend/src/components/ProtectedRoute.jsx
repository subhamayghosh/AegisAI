import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/useToast";

export default function ProtectedRoute({ adminOnly = false }) {
  const { user, initializing } = useAuth();
  const location = useLocation();
  const toast = useToast();

  const forbidden = Boolean(adminOnly && user && user.role !== "admin");

  useEffect(() => {
    if (forbidden) {
      toast.error("You don't have access to that page.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forbidden]);

  if (initializing) {
    return (
      <div className="flex h-screen items-center justify-center text-textMuted">
        Loading…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (forbidden) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
