"use client";

import { useState } from "react";

export type RepoAddStatus = "pending" | "adding" | "done" | "failed";

export interface RepoAddProgress {
  repo: string;
  status: RepoAddStatus;
  error?: string;
}

interface AddModalProps {
  allRepos: string[];
  onConfirm: (username: string, selectedRepos: string[]) => void;
  onCancel: () => void;
  loading: boolean;
  progress: RepoAddProgress[] | null;
}

const statusIcon: Record<RepoAddStatus, React.ReactNode> = {
  pending: (
    <svg className="w-4 h-4 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <circle cx="12" cy="12" r="10" />
    </svg>
  ),
  adding: (
    <svg className="w-4 h-4 text-blue-400 shrink-0 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
  done: (
    <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  ),
  failed: (
    <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
};

const statusLabel: Record<RepoAddStatus, string> = {
  pending: "",
  adding: "Adding...",
  done: "Added",
  failed: "Failed",
};

export function AddModal({
  allRepos,
  onConfirm,
  onCancel,
  loading,
  progress,
}: AddModalProps) {
  const [username, setUsername] = useState("");
  const [selectedRepos, setSelectedRepos] = useState<Set<string>>(new Set());
  const [repoSearch, setRepoSearch] = useState("");
  const inProgress = progress !== null;
  const progressTotal = progress?.length ?? 0;
  const completedCount =
    progress?.filter((p) => p.status === "done" || p.status === "failed")
      .length ?? 0;
  const allDone = inProgress && completedCount === progressTotal;

  const toggleRepo = (repo: string) => {
    setSelectedRepos((prev) => {
      const next = new Set(prev);
      if (next.has(repo)) {
        next.delete(repo);
      } else {
        next.add(repo);
      }
      return next;
    });
  };

  const filteredRepos = allRepos.filter((repo) =>
    repo.toLowerCase().includes(repoSearch.toLowerCase())
  );

  const allFilteredSelected =
    filteredRepos.length > 0 &&
    filteredRepos.every((repo) => selectedRepos.has(repo));

  const toggleAll = () => {
    setSelectedRepos((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        // Deselect only the currently visible repos
        for (const repo of filteredRepos) {
          next.delete(repo);
        }
      } else {
        // Select all currently visible repos
        for (const repo of filteredRepos) {
          next.add(repo);
        }
      }
      return next;
    });
  };

  const noneSelected = selectedRepos.size === 0;
  const trimmedUsername = username.trim();
  const canSubmit = trimmedUsername.length > 0 && !noneSelected && !loading;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={!loading ? onCancel : undefined}
      />

      {/* Modal */}
      <div className="relative bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
        {/* Icon */}
        <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full bg-blue-500/10">
          <svg
            className="w-6 h-6 text-blue-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
            />
          </svg>
        </div>

        <h3 className="text-lg font-semibold text-center mb-4">
          Add Collaborator
        </h3>

        {/* Progress summary */}
        {inProgress && (
          <p className="text-gray-400 text-center text-sm mb-3">
            Adding{" "}
            <span className="text-white font-medium">{trimmedUsername}</span> —{" "}
            <span className="text-white font-medium">
              {completedCount}/{progressTotal}
            </span>{" "}
            repos done
          </p>
        )}

        {/* Progress bar */}
        {inProgress && (
          <div className="w-full bg-gray-800 rounded-full h-1.5 mb-4 overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-300"
              style={{
                width: `${progressTotal > 0 ? (completedCount / progressTotal) * 100 : 0}%`,
              }}
            />
          </div>
        )}

        {/* Username input (only before progress) */}
        {!inProgress && (
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-1.5">
              GitHub Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. octocat"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && canSubmit) {
                  onConfirm(trimmedUsername, Array.from(selectedRepos));
                }
              }}
            />
          </div>
        )}

        {/* Search + Select All + Repo list (only before progress) */}
        {!inProgress && (
          <div className="mb-2">
            {/* Repo search input */}
            <div className="relative mb-2">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={repoSearch}
                onChange={(e) => setRepoSearch(e.target.value)}
                placeholder="Search repos..."
                className="w-full pl-9 pr-8 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {repoSearch && (
                <button
                  onClick={() => setRepoSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Select All toggle + selected count */}
            <div className="flex items-center justify-between mb-1">
              <button
                onClick={toggleAll}
                disabled={filteredRepos.length === 0}
                className="flex items-center gap-2 px-1 py-1 text-xs text-gray-400 hover:text-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <div
                  className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                    allFilteredSelected
                      ? "bg-blue-600 border-blue-600"
                      : "border-gray-600 bg-transparent"
                  }`}
                >
                  {allFilteredSelected && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {!allFilteredSelected && selectedRepos.size > 0 && (
                    <div className="w-2 h-0.5 bg-gray-400 rounded" />
                  )}
                </div>
                {allFilteredSelected ? "Deselect All" : "Select All"}
              </button>
              <span className="text-xs text-gray-500">
                {selectedRepos.size} repo{selectedRepos.size !== 1 ? "s" : ""} selected
              </span>
            </div>
          </div>
        )}

        {/* Repo list — checkboxes or progress */}
        <div className="max-h-52 overflow-y-auto mb-6 space-y-1">
          {inProgress
            ? progress!.map((item) => (
                <div
                  key={item.repo}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    item.status === "done"
                      ? "bg-emerald-500/10"
                      : item.status === "failed"
                        ? "bg-red-500/10"
                        : item.status === "adding"
                          ? "bg-blue-500/5"
                          : "bg-gray-800/60"
                  }`}
                >
                  {statusIcon[item.status]}
                  <span
                    className={`flex-1 ${
                      item.status === "done"
                        ? "text-emerald-300"
                        : item.status === "failed"
                          ? "text-red-300"
                          : "text-gray-300"
                    }`}
                  >
                    {item.repo}
                  </span>
                  {item.status !== "pending" && (
                    <span
                      className={`text-xs ${
                        item.status === "done"
                          ? "text-emerald-400"
                          : item.status === "failed"
                            ? "text-red-400"
                            : "text-blue-400"
                      }`}
                    >
                      {statusLabel[item.status]}
                    </span>
                  )}
                </div>
              ))
            : filteredRepos.map((repo) => {
                const checked = selectedRepos.has(repo);
                return (
                  <label
                    key={repo}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm cursor-pointer transition-colors ${
                      checked
                        ? "bg-blue-500/10 hover:bg-blue-500/15"
                        : "bg-gray-800/60 hover:bg-gray-800"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleRepo(repo)}
                      className="sr-only"
                    />
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                        checked
                          ? "bg-blue-600 border-blue-600"
                          : "border-gray-600 bg-transparent"
                      }`}
                    >
                      {checked && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className={checked ? "text-blue-300" : "text-gray-400"}>
                      {repo}
                    </span>
                  </label>
                );
              })}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading && !allDone}
            className="flex-1 px-4 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {allDone ? "Close" : "Cancel"}
          </button>
          {!inProgress && (
            <button
              onClick={() =>
                onConfirm(trimmedUsername, Array.from(selectedRepos))
              }
              disabled={!canSubmit}
              className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add ({selectedRepos.size})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
