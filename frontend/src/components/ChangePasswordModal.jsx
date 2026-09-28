import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, X } from "lucide-react";
import * as usersApi from "../api/users";
import { useToast } from "../hooks/useToast";

function passwordStrength(password) {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Za-z]/.test(password) && /[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return Math.min(score, 4);
}

const STRENGTH_LABELS = ["Very weak", "Weak", "Fair", "Good", "Strong"];
const STRENGTH_COLORS = ["bg-block", "bg-block", "bg-neutralize", "bg-primary", "bg-allow"];

function isValidPassword(password) {
  return password.length >= 8 && /[A-Za-z]/.test(password) && /[0-9]/.test(password);
}

export default function ChangePasswordModal({ onClose, onSuccess }) {
  const toast = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [touched, setTouched] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      usersApi.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    onSuccess: () => onSuccess(),
    onError: (err) => {
      if (err.response?.status === 400) {
        toast.error("Current password is incorrect.");
      } else {
        toast.error("Could not change your password. Please try again.");
      }
    },
  });

  const weak = newPassword.length > 0 && !isValidPassword(newPassword);
  const mismatched = confirmPassword.length > 0 && confirmPassword !== newPassword;
  const canSubmit =
    currentPassword.length > 0 && isValidPassword(newPassword) && confirmPassword === newPassword;

  const strength = passwordStrength(newPassword);

  const handleSubmit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit) return;
    mutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Change password"
        className="w-full max-w-sm rounded-card border border-border bg-surface p-5"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Change password</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="currentPassword" className="block text-sm font-medium">
              Current password
            </label>
            <input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="mt-1 w-full rounded-card border border-border bg-bg px-3 py-2 text-sm focus:border-primary"
            />
          </div>

          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium">
              New password
            </label>
            <input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1 w-full rounded-card border border-border bg-bg px-3 py-2 text-sm focus:border-primary"
            />
            {newPassword && (
              <div className="mt-2">
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
            {touched && weak && (
              <p className="mt-1 text-sm text-block">
                Password must be at least 8 characters and include a letter and a digit.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium">
              Confirm new password
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 w-full rounded-card border border-border bg-bg px-3 py-2 text-sm focus:border-primary"
            />
            {touched && mismatched && (
              <p className="mt-1 text-sm text-block">Passwords do not match.</p>
            )}
          </div>

          <button
            type="submit"
            disabled={mutation.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-card bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primaryHover disabled:opacity-60"
          >
            {mutation.isPending && <Loader2 className="animate-spin" size={16} aria-hidden="true" />}
            Change password
          </button>
        </form>
      </div>
    </div>
  );
}
