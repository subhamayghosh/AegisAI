import { ShieldCheck } from "lucide-react";

export default function ThreeDSpinner({ label = "Inspecting" }) {
  return (
    <div className="shield-spinner" role="status" aria-label={label}>
      <span className="shield-spinner__halo" aria-hidden="true" />
      <span className="shield-spinner__face" aria-hidden="true">
        <ShieldCheck size={24} strokeWidth={2.4} />
      </span>
      <span className="sr-only">{label}</span>
    </div>
  );
}
