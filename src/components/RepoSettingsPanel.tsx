"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import { ConfirmModal } from "@/components/ConfirmModal";
import { Button, ErrorState, ListSkeleton, inputClass } from "@/components/ui";
import { XIcon } from "@/components/icons";
import { postJson } from "@/lib/api";

interface RepoSettings {
  description: string;
  homepage: string;
  topics: string[];
  private: boolean;
  archived: boolean;
  defaultBranch: string;
}

const TOPIC_PATTERN = /^[a-z0-9][a-z0-9-]{0,49}$/;

/** Turns "My Topic" into "my-topic". */
const normalizeTopic = (t: string) =>
  t.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);

type Danger = "visibility" | "archive" | null;

/** Admin-only repository settings: details, topics, visibility and archiving. */
export function RepoSettingsPanel({
  repo,
  onChanged,
}: {
  repo: string;
  /** Called after visibility/archive/description change so the page header can refresh. */
  onChanged: () => void;
}) {
  const { showToast } = useToast();
  const [settings, setSettings] = useState<RepoSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [homepage, setHomepage] = useState("");
  const [topics, setTopics] = useState<string[]>([]);
  const [topicInput, setTopicInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [danger, setDanger] = useState<Danger>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/repos/settings?repo=${encodeURIComponent(repo)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to load settings");
      const s: RepoSettings = data.settings;
      setSettings(s);
      setDescription(s.description);
      setHomepage(s.homepage);
      setTopics(s.topics);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings");
    }
  }, [repo]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!settings) return <ListSkeleton rows={3} />;

  const dirty =
    description !== settings.description ||
    homepage !== settings.homepage ||
    topics.join(",") !== settings.topics.join(",");
  const homepageError = homepage && !/^https?:\/\/\S+$/.test(homepage) ? "Use a full URL starting with https://" : null;
  const locked = settings.archived;

  const addTopic = (raw: string) => {
    const t = normalizeTopic(raw);
    if (!t || !TOPIC_PATTERN.test(t) || topics.includes(t) || topics.length >= 20) return;
    setTopics([...topics, t]);
    setTopicInput("");
  };

  const save = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!dirty || homepageError || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const body: Record<string, unknown> = { repo };
      if (description !== settings.description) body.description = description;
      if (homepage !== settings.homepage) body.homepage = homepage;
      if (topics.join(",") !== settings.topics.join(",")) body.topics = topics;
      await postJson("/api/repos/settings/update", body, "Failed to save settings");
      setSettings({ ...settings, description, homepage, topics });
      showToast("Settings saved", "success");
      onChanged();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const applyDanger = async (change: { private?: boolean; archived?: boolean }) => {
    await postJson("/api/repos/settings/update", { repo, ...change }, "Failed to update repository");
  };

  return (
    <div className="space-y-10">
      {/* General */}
      <section>
        <h3 className="text-sm font-semibold text-gray-300 mb-1">General</h3>
        <p className="text-xs text-gray-500 mb-4">
          {locked ? "This repository is archived — unarchive it below to edit these." : "Shown on GitHub and in the repo list here."}
        </p>
        <form onSubmit={save} className="space-y-4 max-w-xl">
          <div>
            <label htmlFor="rs-description" className="block text-sm font-medium text-gray-300 mb-1.5">
              Description
            </label>
            <input
              id="rs-description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={350}
              disabled={locked}
              placeholder="What is this repository for?"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="rs-homepage" className="block text-sm font-medium text-gray-300 mb-1.5">
              Website
            </label>
            <input
              id="rs-homepage"
              type="url"
              value={homepage}
              onChange={(e) => setHomepage(e.target.value.trim())}
              disabled={locked}
              placeholder="https://example.com"
              className={`${inputClass} ${homepageError ? "border-red-500/60" : ""}`}
            />
            {homepageError && <p className="mt-1.5 text-xs text-red-400">{homepageError}</p>}
          </div>
          <div>
            <label htmlFor="rs-topics" className="block text-sm font-medium text-gray-300 mb-1.5">
              Topics <span className="text-gray-500 font-normal">({topics.length}/20)</span>
            </label>
            <div
              className={`flex flex-wrap items-center gap-1.5 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded-lg focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 ${
                locked ? "opacity-60" : ""
              }`}
            >
              {topics.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-blue-500/15 text-blue-300 text-xs">
                  {t}
                  {!locked && (
                    <button
                      type="button"
                      onClick={() => setTopics(topics.filter((x) => x !== t))}
                      aria-label={`Remove topic ${t}`}
                      className="p-0.5 hover:text-white cursor-pointer"
                    >
                      <XIcon className="w-3 h-3" />
                    </button>
                  )}
                </span>
              ))}
              <input
                id="rs-topics"
                type="text"
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addTopic(topicInput);
                  } else if (e.key === "Backspace" && !topicInput && topics.length) {
                    setTopics(topics.slice(0, -1));
                  }
                }}
                onBlur={() => topicInput && addTopic(topicInput)}
                disabled={locked || topics.length >= 20}
                placeholder={topics.length ? "" : "Type a topic and press Enter"}
                className="flex-1 min-w-32 bg-transparent text-sm text-gray-100 placeholder-gray-500 py-0.5 focus:outline-none"
              />
            </div>
            <p className="mt-1.5 text-xs text-gray-500">Lowercase letters, digits and hyphens. Press Enter or comma to add.</p>
          </div>
          {saveError && <p className="text-sm text-red-400">{saveError}</p>}
          <div className="flex items-center gap-2">
            <Button type="submit" variant="primary" disabled={!dirty || Boolean(homepageError) || locked} loading={saving}>
              Save changes
            </Button>
            {dirty && (
              <Button
                variant="ghost"
                onClick={() => {
                  setDescription(settings.description);
                  setHomepage(settings.homepage);
                  setTopics(settings.topics);
                }}
              >
                Discard
              </Button>
            )}
          </div>
        </form>
      </section>

      {/* Danger zone */}
      <section>
        <h3 className="text-sm font-semibold text-red-400 mb-3">Danger zone</h3>
        <div className="border border-red-900/60 rounded-xl divide-y divide-red-900/40">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-200">
                Visibility: <span className={settings.private ? "text-amber-400" : "text-emerald-400"}>{settings.private ? "Private" : "Public"}</span>
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {settings.private
                  ? "Making it public exposes all code, history, issues and Actions logs to everyone."
                  : "Making it private removes stars and watchers and may break forks and GitHub Pages."}
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setDanger("visibility")} disabled={locked} className="shrink-0">
              Make {settings.private ? "public" : "private"}
            </Button>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-200">{settings.archived ? "Unarchive repository" : "Archive repository"}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {settings.archived
                  ? "Makes the repository writable again (code, issues, secrets, variables)."
                  : "Makes it read-only for everyone: no pushes, issues, or secret/variable changes until unarchived."}
              </p>
            </div>
            <Button
              variant={settings.archived ? "secondary" : "danger"}
              size="sm"
              onClick={() => setDanger("archive")}
              className="shrink-0"
            >
              {settings.archived ? "Unarchive" : "Archive"}
            </Button>
          </div>
        </div>
      </section>

      {danger === "visibility" && (
        <ConfirmModal
          title={`Make ${repo} ${settings.private ? "public" : "private"}`}
          message={
            settings.private
              ? "Everyone on the internet will be able to see this repository, including its full commit history. Secrets stored in Actions stay hidden, but anything committed to the code will be exposed."
              : "Only you and collaborators will be able to see this repository."
          }
          confirmLabel={`Make ${settings.private ? "public" : "private"}`}
          destructive={settings.private}
          requireTyping={repo}
          onConfirm={() => applyDanger({ private: !settings.private })}
          onClose={() => setDanger(null)}
          onSuccess={() => {
            setDanger(null);
            showToast(`${repo} is now ${settings.private ? "public" : "private"}`, "success");
            setSettings({ ...settings, private: !settings.private });
            onChanged();
          }}
        />
      )}

      {danger === "archive" && (
        <ConfirmModal
          title={settings.archived ? `Unarchive ${repo}` : `Archive ${repo}`}
          message={
            settings.archived
              ? "The repository becomes writable again."
              : "The repository becomes read-only. You can unarchive it later from this tab."
          }
          confirmLabel={settings.archived ? "Unarchive" : "Archive"}
          destructive={!settings.archived}
          requireTyping={settings.archived ? undefined : repo}
          onConfirm={() => applyDanger({ archived: !settings.archived })}
          onClose={() => setDanger(null)}
          onSuccess={() => {
            setDanger(null);
            showToast(`${repo} ${settings.archived ? "unarchived" : "archived"}`, "success");
            setSettings({ ...settings, archived: !settings.archived });
            onChanged();
          }}
        />
      )}
    </div>
  );
}
