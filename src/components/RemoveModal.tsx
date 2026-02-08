"use client";

import { useState } from "react";

export type RepoRemoveStatus = "pending" | "removing" | "done" | "failed";

export interface RepoProgress {
  repo: string;
  status: RepoRemoveStatus;
  error?: string;
}

interface RemoveModalProps {
  username: string;
  repos: string[];
  onConfirm: (selectedRepos: string[]) => void;
  onCancel: () => void;
  loading: boolean;
  progress: RepoProgress[] | null; // null = not started yet
}

const statusIcon: Record<RepoRemoveStatus, React.ReactNode> = {
  pending: (
    <svg className="w-4 h-4 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <circle cx="12" cy="12" r="10" />
    </svg>
  ),
  removing: (
    <svg className="w-4 h-4 text-yellow-400 shrink-0 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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

const statusLabel: Record<RepoRemoveStatus, string> = {
  pending: "",
  removing: "Removing...",
  done: "Removed",
  failed: "Failed",
};

export function RemoveModal({
  username,
  repos,
  onConfirm,
  onCancel,
  loading,
  progress,
}: RemoveModalProps) {
  const [selectedRepos, setSelectedRepos] = useState<Set<string>>(
    new Set(repos)
  );
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

  const toggleAll = () => {
    if (selectedRepos.size === repos.length) {
      setSelectedRepos(new Set());
    } else {
      setSelectedRepos(new Set(repos));
    }
  };

  const allSelected = selectedRepos.size === repos.length;
  const noneSelected = selectedRepos.size === 0;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={!loading ? onCancel : undefined}
      />

      {/* Modal */}
      <div className="relative bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
        {/* Warning icon */}
        <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full bg-red-500/10">
          <svg
            className="w-6 h-6 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>

        <h3 className="text-lg font-semibold text-center mb-2">
          Remove Collaborator
        </h3>
        <p className="text-gray-400 text-center text-sm mb-4">
          {inProgress ? (
            <>
              Removing{" "}
              <span className="text-white font-medium">{username}</span> —{" "}
              <span className="text-white font-medium">
                {completedCount}/{progressTotal}
              </span>{" "}
              repos done
            </>
          ) : (
            <>
              Select repos to remove{" "}
              <span className="text-white font-medium">{username}</span> from:
            </>
          )}
        </p>

        {/* Progress bar */}
        {inProgress && (
          <div className="w-full bg-gray-800 rounded-full h-1.5 mb-4 overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-300"
              style={{
                width: `${progressTotal > 0 ? (completedCount / progressTotal) * 100 : 0}%`,
              }}
            />
          </div>
        )}

        {/* Select All toggle (only before progress starts) */}
        {!inProgress && repos.length > 1 && (
          <button
            onClick={toggleAll}
            className="flex items-center gap-2 mb-2 px-3 py-1 text-xs text-gray-400 hover:text-gray-200 transition-colors"
          >
            <div
              className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                allSelected
                  ? "bg-red-600 border-red-600"
                  : "border-gray-600 bg-transparent"
              }`}
            >
              {allSelected && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
              {!allSelected && selectedRepos.size > 0 && (
                <div className="w-2 h-0.5 bg-gray-400 rounded" />
              )}
            </div>
            {allSelected ? "Deselect All" : "Select All"}
            <span className="text-gray-500">
              ({selectedRepos.size}/{repos.length})
            </span>
          </button>
        )}

        {/* Repo list — checkboxes before progress, status icons during */}
        <div className="max-h-48 overflow-y-auto mb-6 space-y-1">
          {inProgress
            ? progress!.map((item) => (
                <div
                  key={item.repo}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    item.status === "done"
                      ? "bg-emerald-500/10"
                      : item.status === "failed"
                        ? "bg-red-500/10"
                        : item.status === "removing"
                          ? "bg-yellow-500/5"
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
                            : "text-yellow-400"
                      }`}
                    >
                      {statusLabel[item.status]}
                    </span>
                  )}
                </div>
              ))
            : repos.map((repo) => {
                const checked = selectedRepos.has(repo);
                return (
                  <label
                    key={repo}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm cursor-pointer transition-colors ${
                      checked
                        ? "bg-red-500/10 hover:bg-red-500/15"
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
                          ? "bg-red-600 border-red-600"
                          : "border-gray-600 bg-transparent"
                      }`}
                    >
                      {checked && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className={checked ? "text-red-300" : "text-gray-400"}>
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
              onClick={() => onConfirm(Array.from(selectedRepos))}
              disabled={loading || noneSelected}
              className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Remove ({selectedRepos.size})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
