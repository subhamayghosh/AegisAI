import { useState } from "react";
import { ArrowRight, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import AuthVisual from "../components/AuthVisual";
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
  if (confirmPassword !== password) errors.confirmPassword = "Passwords do not match.";
  return errors;
}

export default function Register() {
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ displayName: "", email: "", password: "", confirmPassword: "" });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (field) => (event) => setForm((previous) => ({ ...previous, [field]: event.target.value }));
  const strength = passwordStrength(form.password);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validation = validate(form);
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;

    setSubmitting(true);
    try {
      await register({ email: form.email, password: form.password, display_name: form.displayName });
      navigate("/dashboard", { replace: true });
    } catch (error) {
      const status = error.response?.status;
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
    <div className="flex min-h-screen bg-bg">
      <AuthVisual mode="register" />
      <main className="relative flex flex-1 items-center justify-center overflow-hidden px-5 py-10 sm:px-8 lg:px-10">
        <div className="absolute -right-20 top-0 h-80 w-80 rounded-full bg-cyan-300/20 blur-3xl" aria-hidden="true" />
        <div className="relative w-full max-w-md">
          <Link to="/" className="mb-8 flex items-center gap-2 md:hidden">
            <ShieldCheck className="text-primary" size={25} aria-hidden="true" />
            <span className="text-lg font-semibold">AegisAI</span>
          </Link>
          <div className="rounded-3xl border border-border bg-surface/95 p-7 shadow-2xl shadow-indigo-950/10 backdrop-blur sm:p-9">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Sparkles size={21} aria-hidden="true" />
            </span>
            <h1 className="mt-5 text-3xl font-semibold tracking-tight">Create your workspace</h1>
            <p className="mt-2 text-sm leading-6 text-textMuted">Start inspecting inbound content in a few seconds.</p>

            <form className="mt-7 space-y-4" onSubmit={handleSubmit} noValidate>
              <div>
                <label htmlFor="displayName" className="block text-sm font-medium">Display name</label>
                <input id="displayName" type="text" autoComplete="name" value={form.displayName} onChange={handleChange("displayName")} aria-invalid={Boolean(errors.displayName)} aria-describedby={errors.displayName ? "displayName-error" : undefined} className="mt-1.5 w-full rounded-xl border border-border bg-bg/70 px-3.5 py-3 text-sm" />
                {errors.displayName && <p id="displayName-error" className="mt-1.5 text-sm text-block">{errors.displayName}</p>}
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium">Email</label>
                <input id="email" type="email" autoComplete="email" value={form.email} onChange={handleChange("email")} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "email-error" : undefined} className="mt-1.5 w-full rounded-xl border border-border bg-bg/70 px-3.5 py-3 text-sm" />
                {errors.email && <p id="email-error" className="mt-1.5 text-sm text-block">{errors.email}</p>}
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium">Password</label>
                <input id="password" type="password" autoComplete="new-password" value={form.password} onChange={handleChange("password")} aria-invalid={Boolean(errors.password)} aria-describedby="password-strength" className="mt-1.5 w-full rounded-xl border border-border bg-bg/70 px-3.5 py-3 text-sm" />
                {form.password && (
                  <div id="password-strength" className="mt-2">
                    <div className="flex h-1.5 gap-1">{Array.from({ length: 4 }).map((_, index) => <div key={index} className={`h-full flex-1 rounded ${index < strength ? STRENGTH_COLORS[strength] : "bg-surfaceAlt"}`} />)}</div>
                    <p className="mt-1 text-xs text-textMuted">Strength: {STRENGTH_LABELS[strength]}</p>
                  </div>
                )}
                {errors.password && <p className="mt-1.5 text-sm text-block">{errors.password}</p>}
              </div>
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium">Confirm password</label>
                <input id="confirmPassword" type="password" autoComplete="new-password" value={form.confirmPassword} onChange={handleChange("confirmPassword")} aria-invalid={Boolean(errors.confirmPassword)} aria-describedby={errors.confirmPassword ? "confirmPassword-error" : undefined} className="mt-1.5 w-full rounded-xl border border-border bg-bg/70 px-3.5 py-3 text-sm" />
                {errors.confirmPassword && <p id="confirmPassword-error" className="mt-1.5 text-sm text-block">{errors.confirmPassword}</p>}
              </div>
              <button type="submit" disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:-translate-y-0.5 hover:bg-primaryHover disabled:translate-y-0 disabled:opacity-60">
                {submitting && <Loader2 className="animate-spin" size={16} aria-hidden="true" />}
                {submitting ? "Creating account…" : "Create account"}
                {!submitting && <ArrowRight size={16} aria-hidden="true" />}
              </button>
            </form>

            <p className="mt-7 text-center text-sm text-textMuted">Already have an account? <Link to="/login" className="font-medium text-primary hover:underline">Sign in</Link></p>
          </div>
        </div>
      </main>
    </div>
  );
}
