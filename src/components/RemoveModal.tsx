"use client";

import { useState } from "react";
import { Button, CheckSquare, Modal, SearchInput } from "@/components/ui";
import { WarningIcon } from "@/components/icons";
import { RepoCheckRow, RepoProgress, RepoProgressList } from "@/components/RepoProgressList";
import { plural } from "@/lib/format";

export interface RemoveResult {
  username: string;
  removed: string[];
  failed: string[];
}

interface RemoveModalProps {
  username: string;
  repos: string[];
  onClose: () => void;
  onDone: (result: RemoveResult) => void;
}

/**
 * Remove a collaborator from selected repos. Nothing is pre-selected (unless there
 * is only one repo) so a stray click can't revoke access everywhere.
 */
export function RemoveModal({ username, repos, onClose, onDone }: RemoveModalProps) {
  const [selectedRepos, setSelectedRepos] = useState<Set<string>>(
    new Set(repos.length === 1 ? repos : [])
  );
  const [search, setSearch] = useState("");
  const [progress, setProgress] = useState<RepoProgress[] | null>(null);
  const [summary, setSummary] = useState<RemoveResult | null>(null);

  const running = progress !== null && summary === null;
  const filtered = repos.filter((r) => r.toLowerCase().includes(search.toLowerCase()));
  const allFilteredSelected = filtered.length > 0 && filtered.every((r) => selectedRepos.has(r));
  const removingAll = selectedRepos.size === repos.length;

  const toggleRepo = (repo: string) =>
    setSelectedRepos((prev) => {
      const next = new Set(prev);
      if (next.has(repo)) next.delete(repo);
      else next.add(repo);
      return next;
    });

  const toggleAll = () =>
    setSelectedRepos((prev) => {
      const next = new Set(prev);
      for (const r of filtered) {
        if (allFilteredSelected) next.delete(r);
        else next.add(r);
      }
      return next;
    });

  const run = async () => {
    const targets = repos.filter((r) => selectedRepos.has(r));
    if (targets.length === 0) return;
    setProgress(targets.map((repo) => ({ repo, status: "pending" })));
    const result: RemoveResult = { username, removed: [], failed: [] };

    for (let i = 0; i < targets.length; i++) {
      const repo = targets[i];
      setProgress((prev) => prev!.map((p, idx) => (idx === i ? { ...p, status: "working" } : p)));
      try {
        const res = await fetch("/api/team/remove-one", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, repo }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed");
        }
        result.removed.push(repo);
        setProgress((prev) => prev!.map((p, idx) => (idx === i ? { ...p, status: "done" } : p)));
      } catch (err) {
        result.failed.push(repo);
        const error = err instanceof Error ? err.message : "Unknown error";
        setProgress((prev) => prev!.map((p, idx) => (idx === i ? { ...p, status: "failed", error } : p)));
      }
    }

    setSummary(result);
    onDone(result);
  };

  return (
    <Modal
      title={summary ? "Done" : running ? `Removing ${username}…` : `Remove ${username}`}
      subtitle={
        summary
          ? `Removed from ${plural(summary.removed.length, "repo")}${summary.failed.length ? `, ${summary.failed.length} failed` : ""}.`
          : "Choose which repositories to revoke access from."
      }
      tone="red"
      icon={<WarningIcon className="w-5 h-5" />}
      busy={running}
      onClose={onClose}
      footer={
        summary ? (
          <Button variant="primary" onClick={onClose} autoFocus>
            Close
          </Button>
        ) : (
          <>
            <Button onClick={onClose} disabled={running}>
              Cancel
            </Button>
            <Button variant="danger" onClick={run} disabled={selectedRepos.size === 0} loading={running}>
              {selectedRepos.size === 0
                ? "Select repos"
                : removingAll && repos.length > 1
                  ? `Remove from all ${repos.length}`
                  : `Remove from ${plural(selectedRepos.size, "repo")}`}
            </Button>
          </>
        )
      }
    >
      {progress ? (
        <RepoProgressList items={progress} labels={{ working: "Removing…", done: "Removed", failed: "Failed" }} />
      ) : (
        <div>
          {repos.length > 8 && (
            <SearchInput value={search} onChange={setSearch} placeholder="Filter repos…" className="mb-2" />
          )}
          {repos.length > 1 && (
            <button
              type="button"
              onClick={toggleAll}
              disabled={filtered.length === 0}
              className="flex items-center gap-2 px-3 py-1 mb-1 text-xs text-gray-400 hover:text-gray-200 disabled:opacity-40 cursor-pointer"
            >
              <CheckSquare checked={allFilteredSelected} indeterminate={selectedRepos.size > 0} tone="red" />
              {allFilteredSelected ? "Deselect" : "Select"} {search ? "matching" : "all"} ({filtered.length})
              <span className="text-gray-500">· {selectedRepos.size} selected</span>
            </button>
          )}
          <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
            {filtered.map((repo) => (
              <RepoCheckRow
                key={repo}
                repo={repo}
                checked={selectedRepos.has(repo)}
                onToggle={() => toggleRepo(repo)}
                tone="red"
              />
            ))}
          </div>
          {removingAll && repos.length > 1 && (
            <p className="mt-3 text-xs text-amber-400">
              {username} will lose access to every repository and disappear from the team list.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
