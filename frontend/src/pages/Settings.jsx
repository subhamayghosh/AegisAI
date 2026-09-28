import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import * as usersApi from "../api/users";
import ModelsTab from "../components/settings/ModelsTab";
import ThresholdsTab from "../components/settings/ThresholdsTab";
import PrivacyTab from "../components/settings/PrivacyTab";
import AppearanceTab from "../components/settings/AppearanceTab";

const TABS = [
  { id: "models", label: "Models" },
  { id: "thresholds", label: "Thresholds" },
  { id: "privacy", label: "Privacy" },
  { id: "appearance", label: "Appearance" },
];

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const activeTab = TABS.some((t) => t.id === requestedTab) ? requestedTab : "models";

  const settingsQuery = useQuery({ queryKey: ["user-settings"], queryFn: usersApi.getSettings });
  const modelsQuery = useQuery({
    queryKey: ["available-models"],
    queryFn: usersApi.getAvailableModels,
  });

  const setActiveTab = (id) => setSearchParams({ tab: id });

  if (settingsQuery.isLoading || modelsQuery.isLoading) {
    return <p className="text-sm text-textMuted">Loading settings…</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Settings</h1>

      <div className="flex gap-1 border-b border-border" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === tab.id
                ? "border-b-2 border-primary text-primary"
                : "text-textMuted hover:text-text"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="rounded-card border border-border bg-surface p-5">
        {activeTab === "models" && (
          <ModelsTab settings={settingsQuery.data} availableModels={modelsQuery.data} />
        )}
        {activeTab === "thresholds" && <ThresholdsTab settings={settingsQuery.data} />}
        {activeTab === "privacy" && <PrivacyTab settings={settingsQuery.data} />}
        {activeTab === "appearance" && <AppearanceTab settings={settingsQuery.data} />}
      </div>
    </div>
  );
}
