import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShieldCheck, Loader2 } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/useToast";

function passwordStrength(password) {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return Math.min(score, 4);
}

const STRENGTH_LABELS = ["Very weak", "Weak", "Fair", "Good", "Strong"];
const STRENGTH_COLORS = ["bg-block", "bg-block", "bg-neutralize", "bg-primary", "bg-allow"];

function validate({ email, password, confirmPassword, displayName }) {
  const errors = {};
  if (!displayName.trim()) errors.displayName = "Display name is required.";
  if (!email) {
    errors.email = "Email is required.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Enter a valid email address.";
  }
  if (!password) {
    errors.password = "Password is required.";
  } else if (password.length < 8) {
    errors.password = "Password must be at least 8 characters.";
  }
  if (confirmPassword !== password) {
    errors.confirmPassword = "Passwords do not match.";
  }
  return errors;
}

export default function Register() {
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    displayName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const strength = passwordStrength(form.password);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validation = validate(form);
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;

    setSubmitting(true);
    try {
      await register({
        email: form.email,
        password: form.password,
        display_name: form.displayName,
      });
      navigate("/dashboard", { replace: true });
    } catch (err) {
      const status = err.response?.status;
      if (status === 409 || status === 400) {
        toast.error("An account with that email already exists.");
      } else if (status === 422) {
        toast.error("Please check your details and try again.");
      } else {
        toast.error("Registration failed. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-card border border-border bg-surface p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <ShieldCheck className="text-primary" size={24} aria-hidden="true" />
          <span className="text-lg font-semibold">PromptShield</span>
        </div>
        <h1 className="text-xl font-semibold">Create your account</h1>
        <p className="mt-1 text-sm text-textMuted">
          Start inspecting inputs for prompt injection in minutes.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
          <div>
            <label htmlFor="displayName" className="block text-sm font-medium">
              Display name
            </label>
            <input
              id="displayName"
              type="text"
              autoComplete="name"
              value={form.displayName}
              onChange={handleChange("displayName")}
              aria-invalid={Boolean(errors.displayName)}
              aria-describedby={errors.displayName ? "displayName-error" : undefined}
              className="mt-1 w-full rounded-card border border-border bg-bg px-3 py-2 text-sm focus:border-primary"
            />
            {errors.displayName && (
              <p id="displayName-error" className="mt-1 text-sm text-block">
                {errors.displayName}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={handleChange("email")}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "email-error" : undefined}
              className="mt-1 w-full rounded-card border border-border bg-bg px-3 py-2 text-sm focus:border-primary"
            />
            {errors.email && (
              <p id="email-error" className="mt-1 text-sm text-block">
                {errors.email}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={handleChange("password")}
              aria-invalid={Boolean(errors.password)}
              aria-describedby="password-strength"
              className="mt-1 w-full rounded-card border border-border bg-bg px-3 py-2 text-sm focus:border-primary"
            />
            {form.password && (
              <div id="password-strength" className="mt-2">
                <div className="flex h-1.5 gap-1">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-full flex-1 rounded ${
                        i < strength ? STRENGTH_COLORS[strength] : "bg-surfaceAlt"
                      }`}
                    />
                  ))}
                </div>
                <p className="mt-1 text-xs text-textMuted">
                  Strength: {STRENGTH_LABELS[strength]}
                </p>
              </div>
            )}
            {errors.password && (
              <p className="mt-1 text-sm text-block">{errors.password}</p>
            )}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium">
              Confirm password
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={handleChange("confirmPassword")}
              aria-invalid={Boolean(errors.confirmPassword)}
              aria-describedby={errors.confirmPassword ? "confirmPassword-error" : undefined}
              className="mt-1 w-full rounded-card border border-border bg-bg px-3 py-2 text-sm focus:border-primary"
            />
            {errors.confirmPassword && (
              <p id="confirmPassword-error" className="mt-1 text-sm text-block">
                {errors.confirmPassword}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-card bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primaryHover disabled:opacity-60"
          >
            {submitting && <Loader2 className="animate-spin" size={16} aria-hidden="true" />}
            {submitting ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-textMuted">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
