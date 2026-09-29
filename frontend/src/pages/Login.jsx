import { useState } from "react";
import { ArrowRight, LockKeyhole, Loader2, ShieldCheck } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AuthVisual from "../components/AuthVisual";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/useToast";

function validate({ email, password }) {
  const errors = {};
  if (!email) {
    errors.email = "Email is required.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Enter a valid email address.";
  }
  if (!password) {
    errors.password = "Password is required.";
  }
  return errors;
}

export default function Login() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (field) => (event) =>
    setForm((previous) => ({ ...previous, [field]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validation = validate(form);
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;

    setSubmitting(true);
    try {
      await login(form);
      const destination = location.state?.from?.pathname || "/dashboard";
      navigate(destination, { replace: true });
    } catch (error) {
      const status = error.response?.status;
      if (status === 401) {
        toast.error("Incorrect email or password.");
      } else if (status === 422) {
        toast.error("Enter a valid email address. Local demo accounts use @aegisai.dev.");
      } else if (status === 429) {
        toast.error("Too many attempts. Please wait a minute and try again.");
      } else if (!error.response) {
        toast.error("AegisAI is not reachable. Start the backend and frontend, then try again.");
      } else {
        toast.error("Login failed. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-bg">
      <AuthVisual mode="login" />
      <main className="relative flex flex-1 items-center justify-center overflow-hidden px-5 py-10 sm:px-8 lg:px-10">
        <div className="absolute -right-20 top-0 h-80 w-80 rounded-full bg-indigo-300/20 blur-3xl" aria-hidden="true" />
        <div className="relative w-full max-w-md">
          <Link to="/" className="mb-10 flex items-center gap-2 md:hidden">
            <ShieldCheck className="text-primary" size={25} aria-hidden="true" />
            <span className="text-lg font-semibold">AegisAI</span>
          </Link>
          <div className="rounded-3xl border border-border bg-surface/95 p-7 shadow-2xl shadow-indigo-950/10 backdrop-blur sm:p-9">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <LockKeyhole size={21} aria-hidden="true" />
            </span>
            <h1 className="mt-5 text-3xl font-semibold tracking-tight">Welcome back</h1>
            <p className="mt-2 text-sm leading-6 text-textMuted">Sign in to your AegisAI command center.</p>

            <form className="mt-8 space-y-5" onSubmit={handleSubmit} noValidate>
              <div>
                <label htmlFor="email" className="block text-sm font-medium">Email</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={handleChange("email")}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? "email-error" : undefined}
                  className="mt-1.5 w-full rounded-xl border border-border bg-bg/70 px-3.5 py-3 text-sm"
                />
                {errors.email && <p id="email-error" className="mt-1.5 text-sm text-block">{errors.email}</p>}
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium">Password</label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={form.password}
                  onChange={handleChange("password")}
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? "password-error" : undefined}
                  className="mt-1.5 w-full rounded-xl border border-border bg-bg/70 px-3.5 py-3 text-sm"
                />
                {errors.password && <p id="password-error" className="mt-1.5 text-sm text-block">{errors.password}</p>}
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:-translate-y-0.5 hover:bg-primaryHover disabled:translate-y-0 disabled:opacity-60"
              >
                {submitting && <Loader2 className="animate-spin" size={16} aria-hidden="true" />}
                {submitting ? "Signing in…" : "Sign in"}
                {!submitting && <ArrowRight size={16} aria-hidden="true" />}
              </button>
            </form>

            <p className="mt-7 text-center text-sm text-textMuted">
              Don&apos;t have an account?{" "}
              <Link to="/register" className="font-medium text-primary hover:underline">Register</Link>
            </p>
          </div>
          <p className="mt-6 text-center text-xs text-textMuted">Protected by layered detection, not a single model verdict.</p>
        </div>
      </main>
    </div>
  );
}
