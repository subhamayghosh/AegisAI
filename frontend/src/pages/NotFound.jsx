import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <ShieldAlert className="text-textMuted" size={48} aria-hidden="true" />
      <h1 className="mt-4 text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-textMuted">
        The page you&apos;re looking for doesn&apos;t exist.
      </p>
      <Link
        to="/"
        className="mt-6 rounded-card bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primaryHover"
      >
        Back to home
      </Link>
    </div>
  );
}
