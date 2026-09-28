import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Lock, Pencil, X } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/useToast";
import * as usersApi from "../api/users";
import ChangePasswordModal from "../components/ChangePasswordModal";
import { delay } from "../utils/delay";

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function relativeTime(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function initials(name) {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

export default function Profile() {
  const { user, updateUser, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(user?.display_name ?? "");
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);

  const settingsQuery = useQuery({ queryKey: ["user-settings"], queryFn: usersApi.getSettings });
  const modelsQuery = useQuery({
    queryKey: ["available-models"],
    queryFn: usersApi.getAvailableModels,
  });

  const nameMutation = useMutation({
    mutationFn: (display_name) => usersApi.updateProfile({ display_name }),
    onSuccess: (data) => {
      updateUser({ display_name: data.display_name });
      setEditingName(false);
      toast.success("Display name updated.");
    },
    onError: () => toast.error("Could not update your display name."),
  });

  const handleSaveName = () => {
    if (!nameDraft.trim()) return;
    nameMutation.mutate(nameDraft.trim());
  };

  const handlePasswordChanged = async () => {
    setPasswordModalOpen(false);
    toast.success("Password changed. Please log in again.");
    await delay(2000);
    await logout();
    navigate("/login");
  };

  const settings = settingsQuery.data;
  const models = modelsQuery.data;

  const workingDefaultLabel = models
    ? models.working.find((o) => o.id === models.defaults.working)?.label ??
      models.defaults.working
    : "";
  const judgeDefaultLabel = models
    ? models.judge.find((o) => o.id === models.defaults.judge)?.label ?? models.defaults.judge
    : "";

  const workingDisplay = settings?.working_model_id
    ? models?.working.find((o) => o.id === settings.working_model_id)?.label ??
      settings.working_model_id
    : `Using app default (${workingDefaultLabel})`;
  const judgeDisplay = settings?.judge_model_id
    ? models?.judge.find((o) => o.id === settings.judge_model_id)?.label ?? settings.judge_model_id
    : `Using app default (${judgeDefaultLabel})`;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 rounded-card border border-border bg-surface p-5">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-semibold text-white">
          {initials(user?.display_name)}
        </div>
        {editingName ? (
          <div className="flex flex-1 items-center gap-2">
            <input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              aria-label="Display name"
              className="flex-1 rounded-card border border-border bg-bg px-2 py-1.5 text-sm focus:border-primary"
            />
            <button
              type="button"
              onClick={handleSaveName}
              aria-label="Save display name"
              className="text-allow"
            >
              <Check size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingName(false);
                setNameDraft(user?.display_name ?? "");
              }}
              aria-label="Cancel editing display name"
              className="text-block"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div className="flex flex-1 items-center gap-2">
            <h1 className="text-lg font-semibold">{user?.display_name}</h1>
            <button
              type="button"
              onClick={() => setEditingName(true)}
              aria-label="Edit display name"
              className="text-textMuted hover:text-text"
            >
              <Pencil size={14} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      <div className="rounded-card border border-border bg-surface p-5">
        <h2 className="mb-3 font-semibold">Identity</h2>
        <dl className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-textMuted">Email</dt>
            <dd className="flex items-center gap-2">
              <input
                value={user?.email ?? ""}
                disabled
                aria-readonly="true"
                title="Email is your login and cannot be changed."
                className="rounded-card border border-border bg-surfaceAlt px-2 py-1 text-xs text-textMuted"
              />
              <Lock size={14} className="text-textMuted" aria-hidden="true" />
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-textMuted">Account created</dt>
            <dd>{formatDate(user?.created_at)}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-textMuted">Last login</dt>
            <dd>
              {formatDate(user?.last_login_at)}
              {user?.last_login_at && (
                <span className="ml-1 text-textMuted">({relativeTime(user.last_login_at)})</span>
              )}
            </dd>
          </div>
        </dl>
      </div>

      <div className="rounded-card border border-border bg-surface p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Preferred models</h2>
          <Link
            to="/settings?tab=models"
            className="text-sm font-medium text-primary hover:underline"
          >
            Change in Settings →
          </Link>
        </div>
        {settings && models ? (
          <dl className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-textMuted">Working LLM</dt>
              <dd>{workingDisplay}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-textMuted">Judge LLM</dt>
              <dd>{judgeDisplay}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-textMuted">Loading…</p>
        )}
      </div>

      <div className="rounded-card border border-border bg-surface p-5">
        <button
          type="button"
          onClick={() => setPasswordModalOpen(true)}
          className="rounded-card border border-border px-4 py-2 text-sm font-semibold hover:bg-surfaceAlt"
        >
          Change password
        </button>
      </div>

      {passwordModalOpen && (
        <ChangePasswordModal
          onClose={() => setPasswordModalOpen(false)}
          onSuccess={handlePasswordChanged}
        />
      )}
    </div>
  );
}
