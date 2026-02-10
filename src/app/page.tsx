"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/Toast";
import { TeamSkeleton } from "@/components/TeamSkeleton";
import { RemoveModal, RepoProgress } from "@/components/RemoveModal";
import { AddModal, RepoAddProgress } from "@/components/AddModal";

interface TeamMember {
  username: string;
  avatarUrl: string;
  profileUrl: string;
  repos: string[];
}

interface TeamData {
  team: TeamMember[];
  totalMembers: number;
  totalRepos: number;
  repos: string[];
  cachedAt?: string;
}

export default function Home() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const [data, setData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [removingMember, setRemovingMember] = useState<TeamMember | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);
  const [removeProgress, setRemoveProgress] = useState<RepoProgress[] | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addProgress, setAddProgress] = useState<RepoAddProgress[] | null>(null);
  const [search, setSearch] = useState("");
  const [repoFilter, setRepoFilter] = useState("");
  const [expandedMembers, setExpandedMembers] = useState<Set<string>>(new Set());
  const [globalError, setGlobalError] = useState<string | null>(null);
  const { showToast } = useToast();

  const fetchTeam = useCallback(async () => {
    try {
      setGlobalError(null);
      const res = await fetch("/api/team");
      if (!res.ok) {
        const err = await res.json();
        const msg = err.error || "Failed to fetch team";
        if (res.status === 401) {
          setGlobalError("Your GitHub token is invalid or expired. Check your .env file and restart the server.");
          return;
        }
        if (res.status === 403) {
          setGlobalError(msg);
          return;
        }
        if (res.status === 429) {
          const retryAfter = res.headers.get("retry-after");
          setGlobalError(
            `GitHub API rate limit exceeded.${retryAfter ? ` Try again in ${retryAfter} seconds.` : " Please wait a few minutes and try again."}`
          );
          return;
        }
        throw new Error(msg);
      }
      const json: TeamData = await res.json();
      setData(json);
    } catch (err) {
      if (!globalError) {
        showToast(
          err instanceof Error ? err.message : "Failed to load team data",
          "error"
        );
      }
    } finally {
      setLoading(false);
    }
  }, [showToast, globalError]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setGlobalError(null);
    try {
      const res = await fetch("/api/team/refresh", { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        const msg = err.error || "Failed to refresh";
        if (res.status === 401) {
          setGlobalError("Your GitHub token is invalid or expired. Check your .env file and restart the server.");
          return;
        }
        if (res.status === 403 || res.status === 429) {
          const retryAfter = res.headers.get("retry-after");
          setGlobalError(
            `GitHub API rate limit exceeded.${retryAfter ? ` Try again in ${retryAfter} seconds.` : " Please wait a few minutes and try again."}`
          );
          return;
        }
        throw new Error(msg);
      }
      const json: TeamData = await res.json();
      setData(json);
      showToast("Team data refreshed from GitHub", "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to refresh team data",
        "error"
      );
    } finally {
      setRefreshing(false);
    }
  }, [showToast]);

  const handleRemove = useCallback(
    async (member: TeamMember, selectedRepos: string[]) => {
      setRemoveLoading(true);

      // Initialize progress only for selected repos
      const initial: RepoProgress[] = selectedRepos.map((repo) => ({
        repo,
        status: "pending",
      }));
      setRemoveProgress([...initial]);

      const succeeded: string[] = [];
      const failed: string[] = [];

      // Remove from selected repos one by one
      for (let i = 0; i < selectedRepos.length; i++) {
        const repo = selectedRepos[i];

        // Mark current as removing
        setRemoveProgress((prev) =>
          prev!.map((p, idx) =>
            idx === i ? { ...p, status: "removing" } : p
          )
        );

        try {
          const res = await fetch("/api/team/remove-one", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: member.username, repo }),
          });
          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || "Failed");
          }
          succeeded.push(repo);
          setRemoveProgress((prev) =>
            prev!.map((p, idx) =>
              idx === i ? { ...p, status: "done" } : p
            )
          );
        } catch (err) {
          failed.push(repo);
          setRemoveProgress((prev) =>
            prev!.map((p, idx) =>
              idx === i
                ? {
                    ...p,
                    status: "failed",
                    error:
                      err instanceof Error ? err.message : "Unknown error",
                  }
                : p
            )
          );
        }
      }

      // Update local state — update the member's repos or remove them entirely
      setData((prev) => {
        if (!prev) return prev;
        const remainingRepos = member.repos.filter(
          (r) => !succeeded.includes(r)
        );
        let updatedTeam;
        if (remainingRepos.length === 0) {
          // Fully removed — drop from team
          updatedTeam = prev.team.filter(
            (m) => m.username.toLowerCase() !== member.username.toLowerCase()
          );
        } else {
          // Partially removed — update repo list
          updatedTeam = prev.team.map((m) =>
            m.username.toLowerCase() === member.username.toLowerCase()
              ? { ...m, repos: remainingRepos }
              : m
          );
        }
        return {
          ...prev,
          team: updatedTeam,
          totalMembers: updatedTeam.length,
          cachedAt: new Date().toISOString(),
        };
      });

      // Show summary toast
      if (failed.length > 0) {
        showToast(
          `Removed ${member.username} from ${succeeded.length} repos, failed on: ${failed.join(", ")}`,
          "error"
        );
      } else {
        showToast(
          `Removed ${member.username} from ${succeeded.length} repos`,
          "success"
        );
      }

      setRemoveLoading(false);
    },
    [showToast]
  );

  const handleAdd = useCallback(
    async (username: string, selectedRepos: string[]) => {
      setAddLoading(true);

      const initial: RepoAddProgress[] = selectedRepos.map((repo) => ({
        repo,
        status: "pending",
      }));
      setAddProgress([...initial]);

      const succeeded: string[] = [];
      const failed: string[] = [];

      for (let i = 0; i < selectedRepos.length; i++) {
        const repo = selectedRepos[i];

        setAddProgress((prev) =>
          prev!.map((p, idx) =>
            idx === i ? { ...p, status: "adding" } : p
          )
        );

        try {
          const res = await fetch("/api/team/add", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, repo }),
          });
          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || "Failed");
          }
          succeeded.push(repo);
          setAddProgress((prev) =>
            prev!.map((p, idx) =>
              idx === i ? { ...p, status: "done" } : p
            )
          );
        } catch (err) {
          failed.push(repo);
          setAddProgress((prev) =>
            prev!.map((p, idx) =>
              idx === i
                ? {
                    ...p,
                    status: "failed",
                    error:
                      err instanceof Error ? err.message : "Unknown error",
                  }
                : p
            )
          );
        }
      }

      // Update local team state
      if (succeeded.length > 0) {
        setData((prev) => {
          if (!prev) return prev;
          const existing = prev.team.find(
            (m) => m.username.toLowerCase() === username.toLowerCase()
          );
          let updatedTeam;
          if (existing) {
            updatedTeam = prev.team.map((m) =>
              m.username.toLowerCase() === username.toLowerCase()
                ? { ...m, repos: [...new Set([...m.repos, ...succeeded])] }
                : m
            );
          } else {
            updatedTeam = [
              ...prev.team,
              {
                username,
                avatarUrl: `https://github.com/${username}.png`,
                profileUrl: `https://github.com/${username}`,
                repos: succeeded,
              },
            ].sort((a, b) =>
              a.username.toLowerCase().localeCompare(b.username.toLowerCase())
            );
          }
          return {
            ...prev,
            team: updatedTeam,
            totalMembers: updatedTeam.length,
            cachedAt: new Date().toISOString(),
          };
        });
      }

      if (failed.length > 0) {
        showToast(
          `Added ${username} to ${succeeded.length} repos, failed on: ${failed.join(", ")}`,
          "error"
        );
      } else {
        showToast(
          `Added ${username} to ${succeeded.length} repos`,
          "success"
        );
      }

      setAddLoading(false);
    },
    [showToast]
  );

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Team</h1>
          <p className="text-gray-400 mt-1">
            Manage collaborators across{" "}
            <a
              href="https://github.com/altersquare"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline"
            >
              altersquare
            </a>{" "}
            repos
          </p>
        </div>
        <div className="flex items-center gap-3">
        <button
          onClick={() => setShowAddModal(true)}
          disabled={!isAdmin}
          title={!isAdmin ? "Admin only" : undefined}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            isAdmin
              ? "bg-blue-600 hover:bg-blue-500"
              : "bg-blue-600/40 cursor-not-allowed opacity-50"
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Collaborator
        </button>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg
            className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
        </div>
      </div>

      {/* Global Error Banner */}
      {globalError && (
        <div className="mb-6 bg-red-900/30 border border-red-700 rounded-xl p-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-red-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div className="flex-1">
            <p className="font-medium text-red-300">{globalError}</p>
            <button
              onClick={() => { setGlobalError(null); fetchTeam(); }}
              className="mt-2 text-sm text-red-400 hover:text-red-300 underline"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Stats Bar */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-800">
            <p className="text-2xl font-bold">{data.totalMembers}</p>
            <p className="text-gray-400 text-sm">Team Members</p>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-800">
            <p className="text-2xl font-bold">{data.totalRepos}</p>
            <p className="text-gray-400 text-sm">Repositories</p>
          </div>
          {data.cachedAt && (
            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-800 col-span-2 sm:col-span-1">
              <p className="text-sm font-medium">
                {new Date(data.cachedAt).toLocaleString()}
              </p>
              <p className="text-gray-400 text-sm">Last Synced</p>
            </div>
          )}
        </div>
      )}

      {/* Search & Repo Filter */}
      {data && data.team.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          {/* Search */}
          <div className="relative flex-1">
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
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search team members..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-800/50 border border-gray-700 rounded-lg text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Repo Filter */}
          <div className="relative flex-1">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h3m0 0a2 2 0 012 2v0a2 2 0 01-2 2H3m3-4V4m0 14v-3m8-1h3m0 0a2 2 0 012 2v0a2 2 0 01-2 2h-3m3-4V4m0 14v-3m-6-2h3m0 0a2 2 0 012 2v0a2 2 0 01-2 2h-3m3-4V4m0 14v-3" />
            </svg>
            <input
              type="text"
              value={repoFilter}
              onChange={(e) => setRepoFilter(e.target.value)}
              placeholder="Filter by repo name..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-800/50 border border-gray-700 rounded-lg text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            />
            {repoFilter && (
              <button
                onClick={() => setRepoFilter("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Team List */}
      {loading ? (
        <TeamSkeleton />
      ) : globalError && !data ? (
        <div className="text-center py-16">
          <svg className="w-16 h-16 mx-auto text-red-500/50 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <h2 className="text-xl font-semibold text-gray-300 mb-2">Could not load team data</h2>
          <p className="text-gray-500">Fix the issue above and try again.</p>
        </div>
      ) : !data || data.team.length === 0 ? (
        <div className="text-center py-16">
          <svg
            className="w-16 h-16 mx-auto text-gray-600 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          <h2 className="text-xl font-semibold text-gray-300 mb-2">
            No collaborators found
          </h2>
          <p className="text-gray-500">
            Add collaborators to your repos to see them here.
          </p>
        </div>
      ) : (() => {
        const filtered = data.team.filter((m) => {
          const matchesSearch = !search || m.username.toLowerCase().includes(search.toLowerCase());
          const matchesRepo = !repoFilter || m.repos.some(r => r.toLowerCase().includes(repoFilter.toLowerCase()));
          return matchesSearch && matchesRepo;
        });

        if (filtered.length === 0) {
          return (
            <div className="text-center py-16">
              <svg className="w-12 h-12 mx-auto text-gray-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <h2 className="text-lg font-semibold text-gray-300 mb-1">No matches</h2>
              <p className="text-gray-500 text-sm">
                No team members match {search && `"${search}"`}{search && repoFilter && " in "}{repoFilter && `repo "${repoFilter}"`}.
              </p>
              <button
                onClick={() => { setSearch(""); setRepoFilter(""); }}
                className="mt-3 text-sm text-blue-400 hover:text-blue-300 underline"
              >
                Clear filters
              </button>
            </div>
          );
        }

        return (
          <>
            {(search || repoFilter) && (
              <p className="text-xs text-gray-500 mb-3">
                Showing {filtered.length} of {data.team.length} members
                {repoFilter && <> in <span className="text-gray-400">{repoFilter}</span></>}
              </p>
            )}
            <div className="space-y-3">
              {filtered.map((member, idx) => (
            <div
              key={member.username}
              className="bg-gray-800/50 border border-gray-800 rounded-xl p-4 flex items-center gap-4 hover:bg-gray-800/80 transition-colors animate-fade-in-up"
              style={{ animationDelay: `${idx * 30}ms` }}
            >
              {/* Avatar */}
              <a
                href={member.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <img
                  src={member.avatarUrl}
                  alt={member.username}
                  className="w-10 h-10 rounded-full ring-2 ring-gray-700 hover:ring-blue-500 transition-all"
                />
              </a>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <a
                  href={member.profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium hover:text-blue-400 transition-colors"
                >
                  {member.username}
                </a>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {(() => {
                    const MAX = 8;
                    const isExpanded = expandedMembers.has(member.username);
                    const repos = isExpanded ? member.repos : member.repos.slice(0, MAX);
                    const hiddenCount = member.repos.length - MAX;
                    return (
                      <>
                        {repos.map((repo) => (
                          <span
                            key={repo}
                            className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-700/60 text-gray-300 border border-gray-700"
                          >
                            {repo}
                          </span>
                        ))}
                        {!isExpanded && hiddenCount > 0 && (
                          <button
                            onClick={() => setExpandedMembers((prev) => new Set(prev).add(member.username))}
                            className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors cursor-pointer"
                          >
                            +{hiddenCount} more
                          </button>
                        )}
                        {isExpanded && member.repos.length > MAX && (
                          <button
                            onClick={() => setExpandedMembers((prev) => { const next = new Set(prev); next.delete(member.username); return next; })}
                            className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-700/40 text-gray-400 border border-gray-700 hover:bg-gray-700/60 transition-colors cursor-pointer"
                          >
                            Show less
                          </button>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Repo count + Remove button */}
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm text-gray-400">
                  {member.repos.length}{" "}
                  {member.repos.length === 1 ? "repo" : "repos"}
                </span>
                <button
                  onClick={() => setRemovingMember(member)}
                  disabled={!isAdmin}
                  title={!isAdmin ? "Admin only" : undefined}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                    isAdmin
                      ? "bg-red-600/10 text-red-400 hover:bg-red-600/20 hover:text-red-300 border-red-600/20"
                      : "bg-red-600/5 text-red-400/40 border-red-600/10 cursor-not-allowed opacity-50"
                  }`}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
            </div>
          </>
        );
      })()}

      {/* Add Collaborator Modal */}
      {showAddModal && data && (
        <AddModal
          allRepos={data.repos}
          loading={addLoading}
          progress={addProgress}
          onConfirm={(username, selectedRepos) =>
            handleAdd(username, selectedRepos)
          }
          onCancel={() => {
            if (!addLoading) {
              setShowAddModal(false);
              setAddProgress(null);
            }
          }}
        />
      )}

      {/* Remove Confirmation Modal */}
      {removingMember && (
        <RemoveModal
          username={removingMember.username}
          repos={removingMember.repos}
          loading={removeLoading}
          progress={removeProgress}
          onConfirm={(selectedRepos) => handleRemove(removingMember, selectedRepos)}
          onCancel={() => {
            if (!removeLoading) {
              setRemovingMember(null);
              setRemoveProgress(null);
            }
          }}
        />
      )}
    </main>
  );
}
